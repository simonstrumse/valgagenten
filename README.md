# Valgagenten – Next.js App + Reusable AI/RAG Infrastructure

Dette repoet inneholder to tydelige lag:

- Infrastruktur (gjenbrukbart): Supabase/Postgres + pgvector, migrasjoner, ingest-pipeline, hybrid (lexical+vector) søk med MMR, OpenAI-integrasjoner, TTS/STT, moderering, og DevOps (Vercel + vercel.json for subdir-build).
- Applikasjonen Valgagenten: En norsk debatttrener der brukeren velger tema og parti og argumenterer mot en AI som forsvarer partiets standpunkt, med dommer og poeng.

Målet er at dere enkelt kan bygge flere apper på samme infrastruktur (dokumentert nedenfor), uten å måtte redesigne datalag, RAG-søk eller DevOps.


## Innhold
- Oversikt
- Mappestruktur
- Infrastruktur (gjenbrukbart)
  - Database (Supabase/Postgres, Prisma)
  - Skjema og migrasjoner
  - RLS-policy
  - pgvector og indekser
  - RAG-søk (hybrid + MMR)
  - Ingest-pipeline (PDF → tekst → segment → embeddings)
  - Moderering
  - STT/TTS
  - Miljøvariabler
  - Deploy (Vercel), bygg fra subkatalog
- Valgagenten (appen)
  - Brukerflyt og sider
  - API-endepunkter
  - Statehåndtering
  - Tilgjengelighet og sikkerhet
  - Ytelse og kost
- Lokal utvikling
- Drift og feilsøking
- Gjenbruk av infrastrukturen til nye apper
  - Sjekkliste for ny app
  - Arkitekturdiagram (mermaid)
  - Kilder, sitering og håndtering av PDFer


## Oversikt
- Stack: Next.js (App Router), React, Tailwind, Zustand, @tanstack/react-query
- Infra: Supabase/Postgres + Prisma + pgvector, OpenAI (GPT-4o mini, embeddings, Whisper), ElevenLabs (norsk TTS)
- Deploy: Vercel (vercel.json peker på `web/` som prosjektrot)

Live: Deploy-URL opprettes per bygg (se Vercel). Kjør `vercel inspect <url> --logs` for feilsøking.


## Mappestruktur
- `web/` – Next.js-appen og all appkode
  - `src/app` – App Router-sider og API-ruter
  - `src/lib` – klienter (Prisma, OpenAI), RAG, prompts, moderering
  - `src/store` – Zustand (debattstate)
  - `prisma/` – Prisma schema
  - `scripts/` – ingest-skript
  - `data/` – evt. lokal fallback for RAG (JSON)
- `programmer/` – PDF-partiprogrammer (kilde for ingest)
- `vercel.json` – peker Vercel til å bygge `web/`-katalogen
- `PLAN.md` – PRD og arbeidsplan


## Infrastruktur (gjenbrukbart)

### Database (Supabase/Postgres, Prisma)
- Vi bruker Supabase Postgres. ORM er Prisma for enkel modellering, migrasjoner og server-side queries.
- For serverless (Vercel) bruker vi Supabase Transaction Pooler (port 6543) og deaktiverer prepared statements via `?pgbouncer=true&sslmode=require` i connection string.
- Vi benytter Prisma generering i `postinstall` for å unngå “stale client” i Vercel-cache.

Connection (Vercel env):
- `DATABASE_URL=postgresql://postgres.<project-ref>:<PASS>@aws-1-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require`
- Alternativ alias brukt i kode: `SUPABASE_DB_URL` (app tar fallback fra denne til `DATABASE_URL` hvis satt)

### Skjema og migrasjoner
Prisma-modeller (se `web/prisma/schema.prisma`):
- `Session`: id, createdAt, topic, party, rounds[], totalScore?, anonHandle
- `Round`: id, sessionId, index (1..3), aiOpening, userReply, aiRebuttal?, judgeScore?, judgeNotes?
- `Leaderboard`: id, sessionId (unique), totalScore, createdAt

RAG-tabeller (SQL via MCP):
- `documents(id, content, party, topic, year, source_url, content_tsv)`
- `embeddings(id references documents(id), embedding vector(1536))`
- Indekser:
  - `GIN` på `content_tsv` (leksikalt)
  - `IVFFLAT` på `embedding vector_cosine_ops` (vektor)

Migrasjoner er allerede brukt via MCP (Supabase). Nye endringer kan enten kjøres via Prisma (for app-tabeller) eller MCP/SQL (for RAG/indekser).

### RLS-policy
- RLS er aktivert på `Session`, `Round`, `Leaderboard`, `documents`, `embeddings`.
- Public lesepolicy er definert for `Leaderboard` (select using true) for å kunne vise toppliste uten autentisering.
- `Session` og `Round` eksponeres ikke via PostgREST; disse brukes kun via server-kode (Prisma) i API-ruter.

### pgvector og indekser
- Embedding-modell: `text-embedding-3-small` (1536 dimensjoner), egnet for kost/ytelse.
- Vektorindeks: `IVFFLAT` (cosine), `lists=100` (justerbar).

### RAG-søk (hybrid + MMR)
- Query embedding lages per (party, topic) i API-kall.
- SQL henter kandidater med kombinasjon: `0.6*vector_score + 0.4*ts_rank`.
- Node-side MMR-reranking (diversity) med cosine-sim, lambda ~ 0.7, k=6.
- Fallback: Lokal JSON (web/data/documents.json) dersom DB feiler.

### Ingest-pipeline (PDF → tekst → segment → embeddings)
- Script: `web/scripts/ingest_pgvector.mjs`
- Input: PDFer i `programmer/`.
- Steg:
  1) Ekstraher tekst (pdfjs legacy build)
  2) Segmentér i avsnitt (200–2000 tegn)
  3) Gjett parti/tema (nøkkelord; kan forbedres med klassifisering)
  4) Lag embeddings (`text-embedding-3-small`) i batcher og upsert til `documents` + `embeddings`
- Kjøring:
  - Lokalt: `cd web && npm run ingest:pg` (leser `../programmer`)
  - Scripten er idempotent: samme id oppdateres (sha1(file#idx)).

### Moderering
- Enkel moderering av brukerinput (`omni-moderation-latest`), brukt i `/api/ai/rebuttal` og `/api/judge`.
- Flagget input får høflig avslag (eller score=1 hos dommer).

### STT/TTS
- STT: `/api/stt` → OpenAI Whisper (`whisper-1`). Mic-knappen sender `FormData(file)` og får transkribert tekst.
- TTS: `/api/tts` → ElevenLabs (standard norsk stemme, kan settes via `ELEVENLABS_VOICE_ID`). Returnerer `audio/mpeg` som stream.

### Miljøvariabler
Eksternt (Vercel):
- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY`
- `DATABASE_URL` (pooler 6543 + `pgbouncer=true&sslmode=require`)
- `SUPABASE_DB_URL` (samme som over, alternativ alias)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_BASE_URL` (prod-URL)

Lokalt (`web/.env`):
- samme nøkler (base_url → `http://localhost:3000`)

### Deploy (Vercel), bygg fra subkatalog
- Roten av repo har `vercel.json` som sier “bygg `web/` med @vercel/next, og rut alt til `web/`”.
- Dette sikrer at Git-integrasjon finner Next.js i riktig mappe.
- Prisma genereres i `postinstall` for å unngå stale client i Vercel.


## Valgagenten (appen)

### Brukerflyt og sider
- `/` – Velg tema og parti; CTA “Start debatt”. Ved start nullstilles eventuell lagret debattstate.
- `/debatt` – Tre runder:
  - Runde åpner med engasjerende AI-innledning (alltid, også ved tom kontekst).
  - Bruker svarer (tekst eller mic).
  - AI gir motargument (RAG + vurderer brukerinput).
  - Dommer gir score og begrunnelse.
  - “Neste runde”-knapp (manuell, forutsigbar progresjon).
  - TTS på AI-meldinger.
- `/resultat` – Total score, runde-for-runde, delbar tekst.
- `/toppliste` – Anonym toppliste uke/måned/all.
- `/personvern`, `/vilkår` – Info.

### API-endepunkter
- `POST /api/start` – Opprett sesjon (DB hvis tilgjengelig; fallback mock). Returnerer `sessionId` + `anonHandle`.
- `POST /api/ai/opening` – Parti-agentens engasjerende åpning (RAG hybrid + MMR). Returnerer tekst + forslag.
- `POST /api/ai/rebuttal` – Parti-agentens motargument; modererer userText før svar.
- `POST /api/judge` – Objektiv dommer; moderering (flagget → score 1) og stram output-parsing.
- `POST /api/stt` – Whisper transkripsjon.
- `POST /api/tts` – ElevenLabs lydstream.
- `GET /api/leaderboard` – Viser toppliste (DB eller mock hvis DB nede).
- `POST /api/finish` – Lagrer totalscore og leaderboard.

### Statehåndtering
- Zustand (`web/src/store/useDebateStore.ts`) med persist for å tåle refresh. Når brukeren starter en ny debatt fra landing, resettes state først for å unngå “spøkelses-åpning”.
- Aktiv runde styres med `activeIndex` og “Neste runde”-knapp.

### Tilgjengelighet og sikkerhet
- A11y: aria-live på TTS-status, synlig fokus, tastaturnavigering.
- Moderering: enkel server-side moderering av brukerinput og dommer-score.
- Sikkerhetsprompts: ignorere prompt-injeksjoner, ingen valgoppfordringer, siter kilder kort.

### Ytelse og kost
- Hybrid søk begrenser kontekst (top-k), MMR gir bedre variasjon.
- GPT-4o mini for agent og dommer (rimelig og raskt), `max_tokens` stramt.
- Caching (kan utvides) for (party,topic)-spørringer.


## Lokal utvikling
1) Installer:
```
cd web
npm i
```
2) Miljøvariabler: kopier `.env.example` til `.env` og fyll inn.
3) Prisma:
```
npm run prisma:generate
# (ved database-endringer lokalt)
npm run prisma:migrate
```
4) Kjør dev:
```
npm run dev
```
5) Ingest PDFer til Supabase:
```
# legg PDFer i ../programmer
npm run ingest:pg
```


## Drift og feilsøking
- Vercel build: repo har `vercel.json` (bygger `web/`). Ved feil “No Next.js version detected”, sjekk at bygg skjer i korrekt subdir.
- Prisma på Vercel: `postinstall` kjører `prisma generate` for å unngå stale client.
- Supabase fra Vercel: bruk Transaction Pooler på port 6543 og `?pgbouncer=true&sslmode=require`.
- Logs: `vercel inspect <deploy-url> --logs` eller Vercel UI.


## Gjenbruk av infrastrukturen (bygge nye apper)
- Hold `documents` + `embeddings` og ingest-skript som felles RAG-lag.
- Bygg ny app i en ny submappe (f.eks. `apps/ny-app`) eller gjenbruk `web/` og endre UI/flow.
- Skriv egne API-ruter som bruker `web/src/lib/rag.ts` (DB-søk + MMR) og `web/src/lib/openai.ts`.
- Del Supabase-prosjektet og miljøvariabler via Vercel Projects og “Environment Variables”.
- Hvis du vil åpne PostgREST for `documents`, legg eksplisitte RLS-policies.

Forslag til videre arbeid
- Bedre topic-annotering (centroid + fallback LLM på tvilstilfeller)
- Caching av RAG-resultat per (party, topic)
- Flere TTS-stemmer (ElevenLabs voice-id per parti/tema)
- e2e-tester (3-runders flyt) + enhetstester for judge-parser


### Sjekkliste for ny app på samme infrastruktur
- Opprett (eller gjenbruk) Supabase-prosjektet
  - Aktiver `vector`-extension
  - Kjør RAG-migrasjoner (documents/embeddings + indekser)
  - (Valgfritt) Kjør app-migrasjoner (Session/Round/Leaderboard) hvis du trenger samme flyt
- Sett Vercel-prosjekt (eller tilsvarende hosting)
  - Peker til riktig subdir (via `vercel.json` eller UI “Root Directory”)
  - Konfigurer envs: `DATABASE_URL` (pooler 6543), `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `NEXT_PUBLIC_*`
- Kjør ingest for dine kilder (PDF/HTML)
  - Justér party/topic-detektering hvis andre domener
  - Verifiser dekning (`select party, topic, count(*) from documents ...`)
- Lag API-ruter
  - Bruk `ragSearch()` for hybrid + MMR
  - Bygg systemprompter, moderering og formatkrav (poeng/skår/parsing)
- UI
  - Sider/komponenter (shadcn/ui anbefales)
  - Tilgjengelighet (aria-live, fokus, tastaturnavigering)


### Arkitekturdiagram
```mermaid
flowchart TD
  A[Bruker/Browser] -- UI (React/Tailwind) --> B[Next.js App Router]
  B -- Zustand/Query --> B
  subgraph API-Ruter (Server)
    B1[/api/ai/opening|rebuttal|judge/]
    B2[/api/tts/]
    B3[/api/stt/]
    B4[/api/start|finish|leaderboard/]
  end
  B --> B1
  B --> B2
  B --> B3
  B --> B4
  B1 -- RAG --> C[(Supabase Postgres)]
  C <-- Prisma (Session/Round/Leaderboard) --> B4
  C -. pgvector .- C
  B1 -- LLM --> D[[OpenAI Chat/Embeddings]]
  B3 -- Whisper --> D
  B2 -- TTS --> E[[ElevenLabs]]
  subgraph Supabase DB
    C1[(documents)]
    C2[(embeddings)]
    C3[(session/round/leaderboard)]
  end
  C --- C1
  C --- C2
  C --- C3
```


### Kilder, sitering og håndtering av PDFer
Spørsmål: “Når PDFene er ingestet, kan/skal de slettes?”
- Drift: PDFene trengs ikke i runtime. All tekst og embeddings ligger i databasen.
- Reproduserbarhet: Behold dem et sted (repository, object storage eller som CI-artifakt) hvis du ønsker å kjøre ingest på nytt eller dokumentere nøyaktig kildeversjon.
- Anbefaling: Ikke behold tunge PDFer i app-repo på sikt (repo-størrelse). Flytt dem til skylagring (S3/GCS) eller en egen “data” repo, men ta vare på lenker/metadata.

Sitering i svar (dagens og plan for “bedre fotnoter”)
- I dag returnerer `ragSearch()` `citations` med `id` og `source_url` for hver brukt chunk. Appen instruerer modellen å sitere kort: `[KILDE: Parti, År]` når konkrete posisjoner brukes.
- For mer presis kildevisning i UI anbefales følgende utvidelse:
  1) Utvid `documents` med flere metadata: `page int`, `span_start int`, `span_end int`, `excerpt text` (eller en egen `document_spans`-tabell som relaterer `documents.id` til flere spans per side/avsnitt).
  2) Oppdater ingest til å fylle `page` (vi itererer per side i pdfjs – lett å holde rede på).
  3) La `ragSearch()` returnere `citations` som `{ id, source_url, page, excerpt }` for topp-k.
  4) Vis fotnoter under AI-svaret: `[1] Parti, år – side X` som lenker til `source_url#page=X` (hvis PDF-viewer støtter) og evt. viser `excerpt` i tooltip.
  5) Justér systemprompter: “Når konkrete posisjoner brukes, sett [KILDE: Parti, År; s. X]”.

Vedlikehold av kilder
- Oppdater PDFer ved nye programversjoner, kjør ingest igjen. Bruk år/version i metadata for å kunne vise `[KILDE: Parti, 2025]`.
- Det er mulig å ingest’e HTML-kilder med samme pipeline (rens → segment → embeddings). Da kan `source_url` være en permalink.


## Vedlegg – Hurtigkommandoliste
- Dev: `cd web && npm run dev`
- Build prod lokalt: `cd web && npm run build`
- Deploy: `cd web && vercel deploy --prod`
- Prisma: `cd web && npm run prisma:generate`
- Ingest RAG: `cd web && npm run ingest:pg`
