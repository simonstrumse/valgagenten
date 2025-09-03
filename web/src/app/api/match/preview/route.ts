import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import OpenAI from "openai";

function norm(v: number[]) { return Math.sqrt(v.reduce((s, x) => s + x * x, 0) || 1); }
function dot(a: number[], b: number[]) { return a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0); }
function cos(a: number[], b: number[]) { return dot(a, b) / (norm(a) * norm(b)); }

async function getCentroid(pool: Pool, party: string, topic: string, k = 20) {
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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversationId") || "";
    // Minimal preview: assume a neutral summary and topics for now
    const topics = ["klima", "skatt", "skole", "helse"]; // heuristic only for preview
    const weights = { klima: 0.4, skatt: 0.3, skole: 0.2, helse: 0.1 } as Record<string, number>;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const parties = ["Ap", "H", "FrP", "SV", "MDG", "Sp", "R", "V", "KrF"];

    const scores: Record<string, number> = {};
    for (const party of parties) {
      let s = 0;
      for (const t of topics) {
        const userEmb = (await openai.embeddings.create({ model: "text-embedding-3-small", input: `${t} viktige hensyn og verdier` })).data[0].embedding;
        const centroid = await getCentroid(pool, party, t);
        if (!centroid) continue;
        s += (weights[t] || 0) * cos(userEmb, centroid);
      }
      scores[party] = s;
    }
    const vals = Object.values(scores);
    const min = Math.min(...vals), max = Math.max(...vals);
    const scaled: Record<string, number> = {};
    for (const p of Object.keys(scores)) scaled[p] = max === min ? 0.5 : (scores[p] - min) / (max - min);
    return NextResponse.json({ conversationId, scores: scaled });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "preview error" }, { status: 500 });
  }
}

