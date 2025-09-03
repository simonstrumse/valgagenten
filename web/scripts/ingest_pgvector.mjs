#!/usr/bin/env node
import 'dotenv/config';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0';
import fs from "node:fs/promises";
import path from "node:path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import crypto from "node:crypto";
import { Pool } from "pg";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const connStr = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!connStr) {
  console.error("Missing DATABASE_URL/SUPABASE_DB_URL env");
  process.exit(1);
}
const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

function guessParty(filename) {
  const f = filename.toLowerCase();
  const has = (...keys) => keys.some((k) => f.includes(k));
  // Høyre
  if (has("hoyre", "høyre", "hoyres", "høyres")) return "H";
  // Arbeiderpartiet
  if (has("arbeiderpartiet", " ap ", " ap-", " ap_", "ap.", "ap ")) return "Ap";
  // Sosialistisk Venstreparti
  if (has("sosialistisk venstreparti", "sv-", "sv_", " sv ", " sv.", "sv ", " sv")) return "SV";
  // Miljøpartiet De Grønne
  if (has("mdg", "miljøpartiet", "miljopartiet", "de grønne", "de gronne")) return "MDG";
  // Fremskrittspartiet
  if (has("fremskrittspartiet", "frp-", "frp_", " frp ", " frp.", "frp")) return "FrP";
  // Senterpartiet
  if (has("senterpartiet", " senterparti", "sp-", "sp_", " sp ", " sp.")) return "Sp";
  // Rødt
  if (has("rødt", "rodt", "rodts", " rødt ", " rødt.")) return "R";
  // Venstre
  if (has("venstre", " venstre-", " venstre_")) return "V";
  // KrF
  if (has("krf", "kristelig folkeparti", "kristelig-folkeparti", "kristeligfolkeparti")) return "KrF";
  // No generic fallbacks that override other parties
  return "Ap"; // conservative default if unknown
}

function guessTopic(text) {
  const t = text.toLowerCase();
  if (/(klima|utslipp|fornybar|co2|energi)/.test(t)) return "klima";
  if (/(skatt|avgift|formuesskatt|inntektsskatt)/.test(t)) return "skatt";
  if (/(skole|utdanning|lærer|elever)/.test(t)) return "skole";
  if (/(helse|sykehus|fastlege|psykiatri)/.test(t)) return "helse";
  if (/(innvandring|asyl|integrering)/.test(t)) return "innvandring";
  return "miljø";
}

function segment(text, maxChars = 2000) {
  const paras = text
    .replace(/\r/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out = [];
  let cur = "";
  for (const p of paras) {
    const cand = cur ? cur + "\n\n" + p : p;
    if (cand.length > maxChars && cur) {
      out.push(cur);
      cur = p;
    } else {
      cur = cand;
    }
  }
  if (cur) out.push(cur);
  return out.filter((s) => s.length > 200); // drop tiny chunks
}

async function extractPdf(fp) {
  const data = new Uint8Array(await fs.readFile(fp));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  let text = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((it) => (typeof it.str === "string" ? it.str : "")).join(" ");
    text += pageText + "\n\n";
  }
  return text;
}

async function embedBatch(texts) {
  const res = await openai.embeddings.create({ model: "text-embedding-3-small", input: texts });
  return res.data.map((d) => d.embedding);
}

function docId(file, idx) {
  return crypto.createHash("sha1").update(`${file}#${idx}`).digest("hex");
}

async function upsertChunk(client, d) {
  await client.query(
    `insert into documents (id, content, party, topic, year, source_url)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (id) do update set content=excluded.content, party=excluded.party, topic=excluded.topic, year=excluded.year, source_url=excluded.source_url`,
    [d.id, d.content, d.party, d.topic, d.year || null, d.source_url || null]
  );
  await client.query(
    `insert into embeddings (id, embedding) values ($1, $2::vector)
     on conflict (id) do update set embedding=excluded.embedding`,
    [d.id, `[${d.embedding.join(",")}]`]
  );
}

async function main() {
  const dir = process.argv[2] || path.join(process.cwd(), "..", "programmer");
  const files = (await fs.readdir(dir)).filter((f) => f.toLowerCase().endsWith(".pdf"));
  if (!files.length) {
    console.log("Ingen PDFer funnet i", dir);
    return;
  }
  const client = await pool.connect();
  try {
    for (const f of files) {
      const abs = path.join(dir, f);
      const party = guessParty(f);
      const yearMatch = f.match(/(20\d{2})/);
      const year = yearMatch ? yearMatch[1] : undefined;
      console.log("Leser:", f, "→ parti:", party);
      const text = await extractPdf(abs);
      const chunks = segment(text);
      console.log("  Chunks:", chunks.length);
      // Embed i batcher på 50
      const batchSize = 50;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const slice = chunks.slice(i, i + batchSize);
        const embs = await embedBatch(slice);
        for (let j = 0; j < slice.length; j++) {
          const idx = i + j;
          const id = docId(f, idx);
          const content = slice[j];
          const topic = guessTopic(content);
          await upsertChunk(client, {
            id,
            content,
            party,
            topic,
            year,
            source_url: f,
            embedding: embs[j],
          });
        }
      }
    }
  } finally {
    client.release();
  }
  console.log("Ingest ferdig.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
