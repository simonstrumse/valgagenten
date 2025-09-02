import fs from "node:fs";
import path from "node:path";

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
  const docs = loadDocs().filter(
    (d) => d.party.toLowerCase() === party.toLowerCase() && d.topic.toLowerCase() === topic.toLowerCase()
  );
  const ranked = docs
    .map((d) => ({ d, s: scoreLex(`${party} ${topic}`, d.content) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map(({ d }) => d);
  const context = ranked
    .map((d) => `- ${d.content} [KILDE: ${d.party}${d.year ? ", " + d.year : ""}]`)
    .join("\n");
  return { context, citations: ranked.map((d) => ({ id: d.id, source_url: d.source_url })) };
}

