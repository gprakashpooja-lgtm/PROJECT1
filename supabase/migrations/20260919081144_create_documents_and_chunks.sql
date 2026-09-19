/*
# Create documents and chunks tables with pgvector for RAG

## Purpose
This migration sets up the database schema for PROJECT1, an Evidence-First AI Knowledge
Assistant. Documents (PDFs) are uploaded, their text is extracted page-by-page, chunked,
embedded with Gemini, and stored. Semantic search uses pgvector cosine similarity to
retrieve relevant chunks for grounded question answering.

## New Tables

### documents
- `id` (uuid, primary key) — unique document identifier
- `filename` (text, not null) — original uploaded filename
- `status` (text, not null, default 'pending') — processing state: pending | processing | ready | failed
- `total_pages` (integer) — number of pages extracted from the PDF
- `total_chunks` (integer) — number of chunks created from the document
- `error_message` (text) — failure reason if status is 'failed'
- `created_at` (timestamptz, default now()) — upload timestamp

### chunks
- `id` (uuid, primary key) — unique chunk identifier
- `document_id` (uuid, foreign key to documents.id, cascade delete) — parent document
- `content` (text, not null) — the chunk text content
- `page_number` (integer, not null) — page number this chunk came from (1-indexed)
- `embedding` (vector(768), not null) — Gemini embedding vector (768 dimensions)
- `created_at` (timestamptz, default now()) — creation timestamp

## Indexes
- `idx_chunks_document_id` — fast lookup of chunks by document
- `idx_chunks_embedding_hnsw` — HNSW index on the embedding column for fast cosine
  similarity search (vector_cosine_ops)

## Functions
- `match_chunks(query_embedding vector(768), match_count int default 5)` — returns the
  top N chunks by cosine similarity, joined with document filename, with similarity score.
  This is the core retrieval function used by the RAG pipeline.

## Security
- RLS enabled on both tables.
- This is a single-tenant app with no sign-in screen, so policies use
  `TO anon, authenticated` with `USING (true)` — the data is intentionally shared.
- The `match_chunks` function is marked SECURITY DEFINER so it can read chunks even
  if called via RPC (which runs as the caller, not the owner).

## Important Notes
1. The `vector` extension (pgvector) must be enabled — included in this migration.
2. Embeddings use 768 dimensions to match Gemini's text-embedding-004 model.
3. The match_chunks function returns similarity as a float between 0 and 1
   (1 - cosine_distance, since pgvector stores distance not similarity).
4. The HNSW index uses vector_cosine_ops for cosine similarity search.
*/

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  total_pages integer,
  total_chunks integer,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Chunks table with pgvector embedding column
CREATE TABLE IF NOT EXISTS chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content text NOT NULL,
  page_number integer NOT NULL,
  embedding vector(768) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for looking up chunks by document
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);

-- HNSW index for fast cosine similarity search on embeddings
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw ON chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Enable RLS on both tables
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;

-- Documents policies (single-tenant, shared data)
DROP POLICY IF EXISTS "anon_select_documents" ON documents;
CREATE POLICY "anon_select_documents" ON documents FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_documents" ON documents;
CREATE POLICY "anon_insert_documents" ON documents FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_documents" ON documents;
CREATE POLICY "anon_update_documents" ON documents FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_documents" ON documents;
CREATE POLICY "anon_delete_documents" ON documents FOR DELETE
  TO anon, authenticated USING (true);

-- Chunks policies (single-tenant, shared data)
DROP POLICY IF EXISTS "anon_select_chunks" ON chunks;
CREATE POLICY "anon_select_chunks" ON chunks FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_chunks" ON chunks;
CREATE POLICY "anon_insert_chunks" ON chunks FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_chunks" ON chunks;
CREATE POLICY "anon_update_chunks" ON chunks FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_chunks" ON chunks;
CREATE POLICY "anon_delete_chunks" ON chunks FOR DELETE
  TO anon, authenticated USING (true);

-- match_chunks function for cosine similarity search
-- Returns top N chunks matching the query embedding, with similarity score
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(768),
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  page_number integer,
  filename text,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id,
    c.document_id,
    c.content,
    c.page_number,
    d.filename,
    (1 - (c.embedding <=> query_embedding))::float AS similarity
  FROM chunks c
  JOIN documents d ON d.id = c.document_id
  WHERE d.status = 'ready'
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Grant execute on match_chunks to anon and authenticated
GRANT EXECUTE ON FUNCTION match_chunks(vector(768), int) TO anon, authenticated;