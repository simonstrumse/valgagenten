#!/usr/bin/env node
import 'dotenv/config';
import fs from 'node:fs/promises';
import fscb from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { Pool } from 'pg';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const connStr = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!connStr) {
  console.error('Missing DATABASE_URL/SUPABASE_DB_URL env');
  process.exit(1);
}
const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: true } });

function has(f, ...keys) {
  return keys.some((k) => f.includes(k));
}

function guessParty(filename) {
  const f = filename.toLowerCase();
  if (has(f, 'hoyre', 'høyre', 'hoyres', 'høyres')) return 'H';
  if (has(f, 'arbeiderpartiet', ' ap ', ' ap-', ' ap_', 'ap.', 'ap ')) return 'Ap';
  if (has(f, 'sosialistisk venstreparti', 'sv-', 'sv_', ' sv ', ' sv.', 'sv ', ' sv')) return 'SV';
  if (has(f, 'mdg', 'miljøpartiet', 'miljopartiet', 'de grønne', 'de gronne')) return 'MDG';
  if (has(f, 'fremskrittspartiet', 'frp-', 'frp_', ' frp ', ' frp.', 'frp')) return 'FrP';
  if (has(f, 'senterpartiet', ' senterparti', 'sp-', 'sp_', ' sp ', ' sp.')) return 'Sp';
  if (has(f, 'rødt', 'rodt', 'rodts', ' rødt ', ' rødt.')) return 'R';
  if (has(f, 'venstre', ' venstre-', ' venstre_')) return 'V';
  if (has(f, 'krf', 'kristelig folkeparti', 'kristelig-folkeparti', 'kristeligfolkeparti')) return 'KrF';
  return 'Ap';
}

function guessTopic(text) {
  const t = text.toLowerCase();
  if (/(klima|utslipp|fornybar|co2|energi)/.test(t)) return 'klima';
  if (/(skatt|avgift|formuesskatt|inntektsskatt)/.test(t)) return 'skatt';
  if (/(skole|utdanning|lærer|elever)/.test(t)) return 'skole';
  if (/(helse|sykehus|fastlege|psykiatri)/.test(t)) return 'helse';
  if (/(innvandring|asyl|integrering)/.test(t)) return 'innvandring';
  return 'miljø';
}

function segment(text, maxChars = 2000) {
  const paras = text
    .replace(/\r/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out = [];
  let cur = '';
  for (const p of paras) {
    const cand = cur ? cur + '\n\n' + p : p;
    if (cand.length > maxChars && cur) {
      out.push(cur);
      cur = p;
    } else {
      cur = cand;
    }
  }
  if (cur) out.push(cur);
  return out.filter((s) => s.length > 200);
}

async function extractPages(fp) {
  const data = new Uint8Array(await fs.readFile(fp));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pages = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((it) => (typeof it.str === 'string' ? it.str : '')).join(' ');
    pages.push({ page: pageNum, text: pageText });
  }
  return pages;
}

async function embedBatch(texts) {
  const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: texts });
  return res.data.map((d) => d.embedding);
}

function docId(file, page, idx) {
  return crypto.createHash('sha1').update(`${file}#p${page}#${idx}`).digest('hex');
}

async function upsertChunk(client, d) {
  await client.query(
    `insert into documents (id, content, party, topic, year, source_url, page, excerpt)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (id) do update set content=excluded.content, party=excluded.party, topic=excluded.topic,
       year=excluded.year, source_url=excluded.source_url, page=excluded.page, excerpt=excluded.excerpt`,
    [d.id, d.content, d.party, d.topic, d.year || null, d.source_url || null, d.page || null, d.excerpt || null]
  );
  await client.query(
    `insert into embeddings (id, embedding) values ($1, $2::vector)
     on conflict (id) do update set embedding=excluded.embedding`,
    [d.id, `[${d.embedding.join(',')}]`]
  );
}

function normalizeBaseName(name) {
  const withoutExt = name.replace(/\.[^.]+$/i, "");
  // Basic Norwegian mapping + diacritics removal
  let s = withoutExt
    .replace(/æ/gi, 'ae')
    .replace(/å/gi, 'a')
    .replace(/ø/gi, 'o')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$|/g, '');
  return s.slice(0, 80);
}

function buildNormalizedFilename(original, party, year) {
  const base = normalizeBaseName(original);
  const parts = [party || 'x', year || 'xxxx', base].filter(Boolean);
  return parts.join('-') + '.pdf';
}

async function moveToStorage(absPath, party, year) {
  const orig = path.basename(absPath);
  const yyyy = new Date().toISOString().slice(0, 10);
  const destDir = path.join(repoRoot, 'storage', 'ingested', yyyy, party);
  await fs.mkdir(destDir, { recursive: true });
  let filename = buildNormalizedFilename(orig, party, year);
  let dest = path.join(destDir, filename);
  let i = 1;
  while (fscb.existsSync(dest)) {
    const base = filename.replace(/\.pdf$/i, '');
    dest = path.join(destDir, `${base}-${i}.pdf`);
    i++;
  }
  try {
    await fs.rename(absPath, dest);
  } catch (e) {
    await fs.copyFile(absPath, dest);
    await fs.unlink(absPath);
  }
  return dest;
}

async function main() {
  const dirArg = process.argv[2] || 'programmer';
  const dir = path.isAbsolute(dirArg) ? dirArg : path.join(repoRoot, dirArg);
  if (!fscb.existsSync(dir)) {
    console.error('Kildemappe finnes ikke:', dir);
    process.exit(1);
  }
  const files = (await fs.readdir(dir)).filter((f) => f.toLowerCase().endsWith('.pdf'));
  if (!files.length) {
    console.log('Ingen PDFer funnet i', dir);
    return;
  }
  const client = await pool.connect();
  try {
    for (const f of files) {
      const abs = path.join(dir, f);
      const party = guessParty(f);
      const yearMatch = f.match(/(20\d{2})/);
      const year = yearMatch ? yearMatch[1] : undefined;
      console.log('Leser:', f, '→ parti:', party);
      const pages = await extractPages(abs);

      let segments = [];
      for (const { page, text } of pages) {
        const segs = segment(text).map((content, i) => ({ content, page, idx: i }));
        segments.push(...segs);
      }
      console.log('  Chunks:', segments.length);

      const batchSize = 50;
      for (let i = 0; i < segments.length; i += batchSize) {
        const batch = segments.slice(i, i + batchSize);
        const embs = await embedBatch(batch.map((s) => s.content));
        for (let j = 0; j < batch.length; j++) {
          const seg = batch[j];
          const id = docId(f, seg.page, seg.idx);
          const topic = guessTopic(seg.content);
          const excerpt = seg.content.slice(0, 220);
          await upsertChunk(client, {
            id,
            content: seg.content,
            party,
            topic,
            year,
            source_url: f,
            page: seg.page,
            excerpt,
            embedding: embs[j],
          });
        }
      }

      const dest = await moveToStorage(abs, party, year);
      console.log('  Flyttet til:', dest);
    }
  } finally {
    client.release();
  }
  console.log('Ingest ferdig.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
