import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import OpenAI from "openai";

type Doc = {
  id: string;
  content: string;
  party: string;
  topic: string;
  year?: string;
  source_url?: string;
};

let cached: Doc[] | null = null;

function loadDocs(): Doc[] {
  if (cached) return cached;
  const p = path.join(process.cwd(), "data", "documents.json");
  if (!fs.existsSync(p)) return (cached = []);
  const raw = fs.readFileSync(p, "utf8");
  cached = JSON.parse(raw);
  return cached!;
}

function scoreLex(q: string, text: string) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = text.toLowerCase();
  return terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0) + Math.min(text.length / 500, 1);
}

export async function ragSearch({ party, topic, k = 6 }: { party: string; topic: string; k?: number }) {
  const connStr = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (connStr) {
    try {
      const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const emb = await openai.embeddings.create({ model: "text-embedding-3-small", input: `${party} ${topic}` });
      const queryEmb = emb.data[0].embedding;
      const vector = `[${queryEmb.join(",")}]`;
      const client = await pool.connect();
      try {
        const candLimit = Math.max(12, 4 * k);
        const { rows } = await client.query(
          `with scored as (
             select d.id, d.content, d.party, d.topic, d.year, d.source_url,
               (1 - (e.embedding <=> $1::vector)) as vec_score,
               ts_rank_cd(d.content_tsv, plainto_tsquery('norwegian', $2)) as lex_score,
               e.embedding::text as embtext
             from documents d join embeddings e on e.id = d.id
             where lower(d.party) = lower($3) and lower(d.topic) = lower($4)
           )
           select * from scored
           order by (0.6*vec_score + 0.4*lex_score) desc
           limit $5`,
          [vector, `${party} ${topic}`, party, topic, candLimit]
        );

        const parseEmb = (t: string): number[] =>
          t
            .replace(/^[\[\s]*/, "")
            .replace(/[\]\s]*$/, "")
            .split(/,\s*/)
            .map((x) => parseFloat(x));

        const candidates = rows.map((r: any) => ({
          id: r.id,
          content: r.content,
          party: r.party,
          topic: r.topic,
          year: r.year,
          source_url: r.source_url,
          vec_score: Number(r.vec_score ?? 0),
          lex_score: Number(r.lex_score ?? 0),
          emb: parseEmb(r.embtext as string),
        }));

        const norm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0) || 1);
        const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0);
        const cosSim = (a: number[], b: number[]) => dot(a, b) / (norm(a) * norm(b));

        const mmr = (docs: typeof candidates, kOut: number, lambda = 0.7) => {
          const selected: typeof candidates = [];
          const poolDocs = [...docs];
          while (selected.length < kOut && poolDocs.length) {
            let bestIdx = 0;
            let bestScore = -Infinity;
            for (let i = 0; i < poolDocs.length; i++) {
              const d = poolDocs[i];
              const rel = cosSim(queryEmb, d.emb);
              const div = selected.length
                ? Math.max(...selected.map((s) => cosSim(d.emb, s.emb)))
                : 0;
              const s = lambda * rel - (1 - lambda) * div;
              if (s > bestScore) {
                bestScore = s;
                bestIdx = i;
              }
            }
            selected.push(poolDocs.splice(bestIdx, 1)[0]);
          }
          return selected;
        };

        const ranked = mmr(candidates, k);
        const context = ranked.map((d) => `- ${d.content} [KILDE: ${d.party}${d.year ? ", " + d.year : ""}]`).join("\n");
        return { context, citations: ranked.map((d) => ({ id: d.id, source_url: d.source_url })) };
      } finally {
        client.release();
      }
    } catch (e: any) {
      console.error("RAG DB search failed, falling back to local:", e?.message || e);
    }
  }
  const docs = loadDocs().filter(
    (d) => d.party.toLowerCase() === party.toLowerCase() && d.topic.toLowerCase() === topic.toLowerCase()
  );
  const ranked = docs
    .map((d) => ({ d, s: scoreLex(`${party} ${topic}`, d.content) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map(({ d }) => d);
  const context = ranked.map((d) => `- ${d.content} [KILDE: ${d.party}${d.year ? ", " + d.year : ""}]`).join("\n");
  return { context, citations: ranked.map((d) => ({ id: d.id, source_url: d.source_url })) };
}
