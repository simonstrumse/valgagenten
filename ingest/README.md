Ingest pipeline for RAG (documents + embeddings).

Usage from web/ folder:

- npm run ingest:pg         # reads from ../programmer, moves processed files to ../storage/ingested

The script extracts text per PDF page, segments, creates embeddings, and upserts to Supabase.
After success, it moves the original PDF to storage/ingested/<YYYY-MM-DD>/<party>/.

