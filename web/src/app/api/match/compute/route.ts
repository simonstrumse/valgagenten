import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import OpenAI from "openai";
import { ragSearch } from "@/lib/rag";

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
    const { conversationId } = await req.json();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
    const topics = ["klima", "skatt", "skole", "helse", "miljø", "innvandring"];
    const weights: Record<string, number> = { klima: 0.3, skatt: 0.25, skole: 0.2, helse: 0.15, miljø: 0.07, innvandring: 0.03 };
    // Summarize conversation (placeholder): in real impl., fetch messages by conversationId and summarize
    const summary = "Brukeren er opptatt av klima, skatt for småbedrifter og fellesskolen.";

    const parties = ["Ap", "H", "FrP", "SV", "MDG", "Sp", "R", "V", "KrF"];
    const perTopic: Record<string, Record<string, number>> = {};
    const partyScores: Record<string, number> = {};

    for (const t of topics) {
      const query = `${t} ${summary}`;
      const userEmb = (await openai.embeddings.create({ model: "text-embedding-3-small", input: query })).data[0].embedding;
      perTopic[t] = {};
      for (const party of parties) {
        const centroid = await getCentroid(pool, party, t);
        if (!centroid) continue;
        const s = cos(userEmb, centroid);
        perTopic[t][party] = s;
        partyScores[party] = (partyScores[party] || 0) + (weights[t] || 0) * s;
      }
    }
    const vals = Object.values(partyScores);
    const min = Math.min(...vals), max = Math.max(...vals);
    const scaled: Record<string, number> = {};
    for (const p of Object.keys(partyScores)) scaled[p] = max === min ? 0.5 : (partyScores[p] - min) / (max - min);

    // Build rationale: top 3 parties with top citations
    const top = Object.entries(scaled).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([party, score]) => ({ party, score }));
    const explain = [] as any[];
    for (const p of top) {
      const cites: any[] = [];
      for (const t of topics.slice(0, 3)) {
        const { citations } = await ragSearch({ party: p.party, topic: t, k: 2 });
        cites.push(...citations);
      }
      explain.push({ party: p.party, score: p.score, why: ["Samsvar på prioriterte temaer"], disagree: ["Uenighet på lavt vektede tema"], citations: cites.slice(0, 4) });
    }

    return NextResponse.json({ top: explain, scores: scaled, perTopic });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "compute error" }, { status: 500 });
  }
}

