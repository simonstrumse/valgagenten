// Minimal ingest skeleton: fetch URLs, basic clean, segment, and write JSON.
import fs from "node:fs/promises";
import path from "node:path";
import fetch from "node-fetch";

const urls = [
  // TODO: legg til faktiske kilder per parti/tema
];

function segment(text, max = 1200) {
  const paras = text.split(/\n{2,}/);
  const out = [];
  let cur = "";
  for (const p of paras) {
    if ((cur + "\n\n" + p).length > max && cur) {
      out.push(cur.trim());
      cur = p;
    } else {
      cur = cur ? cur + "\n\n" + p : p;
    }
  }
  if (cur) out.push(cur.trim());
  return out;
}

function clean(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const docs = [];
  for (const url of urls) {
    const res = await fetch(url);
    const html = await res.text();
    const text = clean(html);
    const parts = segment(text);
    parts.forEach((content, i) => {
      docs.push({
        id: `${url}#${i}`,
        content,
        party: "",
        topic: "",
        year: "",
        source_url: url,
      });
    });
  }
  const outDir = path.join(process.cwd(), "data");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "documents.json"), JSON.stringify(docs, null, 2), "utf8");
  console.log(`Skrev ${docs.length} dokumenter til data/documents.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

