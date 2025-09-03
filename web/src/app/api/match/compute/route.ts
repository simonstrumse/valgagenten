import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import OpenAI from "openai";
import { ragSearch } from "@/lib/rag";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { CHATTOMATEN_CLAIMS } from "@/lib/prompts";

function norm(v: number[]) { return Math.sqrt(v.reduce((s, x) => s + x * x, 0) || 1); }
function dot(a: number[], b: number[]) { return a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0); }
function cos(a: number[], b: number[]) { return dot(a, b) / (norm(a) * norm(b)); }

async function getCentroid(pool: Pool, party: string, topic: string, k = 30) {
  const vectorRows = await pool.query(
    `select e.embedding::text as emb from documents d join embeddings e on e.id=d.id where lower(d.party)=lower($1) and lower(d.topic)=lower($2) limit $3`,
    [party, topic, k]
  );
  const parse = (t: string) => t.replace(/^\[/, "").replace(/\]$/, "").split(/,\s*/).map(parseFloat);
  const embs = vectorRows.rows.map((r) => parse(r.emb));
  if (!embs.length) return null;
  const dim = embs[0].length;
  const sum = new Array(dim).fill(0);
  for (const v of embs) for (let i = 0; i < dim; i++) sum[i] += v[i];
  return sum.map((x) => x / embs.length);
}

export async function POST(req: NextRequest) {
  try {
    const { conversationId, lastUserText } = await req.json();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
    // Extract quantified claims from last user text (or whole conversation if provided in future)
    const extractor = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const claimMsg: ChatCompletionMessageParam[] = [
      { role: "system", content: CHATTOMATEN_CLAIMS },
      { role: "user", content: lastUserText || "" },
    ];
    const claimRes = await extractor.chat.completions.create({ model: process.env.OPENAI_MODEL_MATCH || "gpt-4o-mini", messages: claimMsg, max_tokens: 300, temperature: 0 });
    let claims: Array<{ topic: string; dimension: string; value: string; strength?: number; polarity?: string; verbatim?: string }>; 
    try { claims = JSON.parse(claimRes.choices?.[0]?.message?.content || "{}")?.claims || []; } catch { claims = []; }
    // Topic set based on claims
    const topics = Array.from(new Set(claims.map((c) => c.topic))).slice(0, 4);
    const weights: Record<string, number> = Object.fromEntries(topics.map((t) => [t, 1 / Math.max(1, topics.length)]));

    const parties = ["Ap", "H", "FrP", "SV", "MDG", "Sp", "R", "V", "KrF"];
    const perTopic: Record<string, Record<string, number>> = {};
    const partyScores: Record<string, number> = {};

    // Build party profiles for these topics via RAG + LLM profile extraction
    const profRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/match/profiles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parties, topics }) });
    const { profiles } = await profRes.json();
    // Score by comparing claims to party profiles
    for (const t of topics) {
      perTopic[t] = {};
      for (const party of parties) {
        const p = profiles?.[party]?.[t] || {};
        let sAcc = 0; let denom = 0;
        for (const c of claims.filter((x) => x.topic === t)) {
          const pv = p?.[c.dimension];
          if (!pv) continue;
          denom += (c.strength || 1);
          if (pv === c.value) sAcc += (c.strength || 1);
          else if (pv === 'ukjent') sAcc += 0.5 * (c.strength || 1);
          else sAcc += 0; // mismatch
        }
        const s = denom ? sAcc / denom : 0.5;
        perTopic[t][party] = s;
        partyScores[party] = (partyScores[party] || 0) + (weights[t] || 0) * s;
      }
    }
    const vals = Object.values(partyScores);
    const min = Math.min(...vals), max = Math.max(...vals);
    const scaled: Record<string, number> = {};
    for (const p of Object.keys(partyScores)) scaled[p] = max === min ? 0.5 : (partyScores[p] - min) / (max - min);

    // Build rationale: top 3 parties with citations from profiles
    const top = Object.entries(scaled).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([party, score]) => ({ party, score }));
    const explain = [] as any[];
    for (const p of top) {
      const cites: any[] = [];
      for (const t of topics.slice(0, 3)) {
        const partyProf = profiles?.[p.party]?.[t];
        if (partyProf?.citations) cites.push(...partyProf.citations);
      }
      const why = ["Samsvar på uttrykte preferanser"].concat(claims.slice(0, 2).map((c) => `${c.topic}/${c.dimension}=${c.value}`));
      explain.push({ party: p.party, score: p.score, why, disagree: [], citations: cites.slice(0, 4) });
    }

    return NextResponse.json({ top: explain, scores: scaled, perTopic });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "compute error" }, { status: 500 });
  }
}
