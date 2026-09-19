# PROJECT1 — Evidence-First AI Knowledge Assistant

A full-stack RAG (Retrieval-Augmented Generation) application that lets you upload PDFs, ask questions, and get answers **grounded strictly in your documents** — never from outside knowledge.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend (React)                        │
│                                                                │
│  ┌──────────┐  ┌─────────────┐  ┌──────────┐  ┌────────────┐ │
│  │ Sidebar  │  │ Ask Panel   │  │ Answer   │  │ Evidence   │ │
│  │ (Upload, │  │ (Question  │  │ (Grounded│  │ Inspector  │ │
│  │ Library) │  │  Input)    │  │  Answer) │  │ (Sources)  │ │
│  └────┬─────┘  └──────┬─────┘  └──────────┘  └────────────┘ │
│       │                │                                      │
└───────┼────────────────┼──────────────────────────────────────┘
        │                │
        ▼                ▼
┌───────────────┐  ┌───────────────────┐
│ process-pdf   │  │ rag-query          │
│ (Edge Func)   │  │ (Edge Func)        │
│               │  │                     │
│ PDF → Text    │  │ Question → Embed   │
│ → Chunk →     │  │ → pgvector Search  │
│ Embed → Store │  │ → Threshold Check  │
│               │  │ → Gemini Answer    │
└───────┬───────┘  └─────────┬─────────┘
        │                    │
        ▼                    ▼
┌──────────────────────────────────────────┐
│           Supabase (PostgreSQL)           │
│                                           │
│  documents(id, filename, status, ...)     │
│  chunks(id, document_id, content,         │
│         page_number, embedding vector(768))│
│                                           │
│  match_chunks() — cosine similarity RPC   │
│  pgvector HNSW index for fast retrieval   │
└───────────────────────────────────────────┘
        │                    │
        ▼                    ▼
┌──────────────────────────────────────────┐
│           Gemini API (Google)             │
│                                           │
│  text-embedding-004 — 768-dim embeddings  │
│  gemini-2.0-flash — grounded generation   │
└───────────────────────────────────────────┘
```

## How It Works

### 1. PDF Upload & Processing (`process-pdf` edge function)

1. User uploads one or more PDFs via the sidebar
2. A `documents` row is created with status `pending`
3. The `process-pdf` edge function receives the PDF as base64
4. **Text extraction**: The PDF is parsed page-by-page, extracting text from content streams (including FlateDecode/decompression)
5. **Chunking**: Text is split into ~1200-character chunks with 150-character overlap, preserving the page number for each chunk
6. **Embedding**: Chunks are sent to Gemini's `text-embedding-004` model in batches of 100 to get 768-dimensional embeddings
7. **Storage**: Chunks with embeddings are stored in the `chunks` table; the document status is updated to `ready`

### 2. Question Answering (`rag-query` edge function)

1. User asks a question
2. The question is embedded using Gemini's `text-embedding-004`
3. The `match_chunks()` PostgreSQL function performs cosine similarity search via pgvector's HNSW index, returning the top 5 chunks
4. **Evidence threshold**: If the top similarity score is below 0.55, the system **refuses to answer** — it will never use outside knowledge
5. **Grounded generation**: If evidence is sufficient, the retrieved chunks (and only those chunks) are sent to `gemini-2.0-flash` with instructions to answer using only the provided evidence and to cite sources inline
6. The answer, sources with page numbers, and similarity scores are returned to the frontend

### 3. Evidence Inspector

Each retrieved chunk is displayed with:
- Source document filename
- Page number
- Cosine similarity score (as percentage and decimal)
- Full chunk text (expandable)

### 4. Explain Simply

Uses the same retrieved evidence to generate a simplified, non-technical explanation of the answer.

### 5. Evaluation Page

Tracks retrieval success metrics:
- Total questions asked
- Questions answered vs refused
- Refusal rate
- Average top similarity and overall similarity scores
- Per-question history

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS (dark navy/slate theme with cyan accents) |
| Database | Supabase PostgreSQL + pgvector |
| Server-side API | Supabase Edge Functions (Deno runtime) |
| AI | Google Gemini API (`gemini-embedding-001` 768-dim + `gemini-3.6-flash`) |
| Vector Search | pgvector with HNSW index, cosine similarity |

## Database Schema

```sql
-- Documents table
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- pending | processing | ready | failed
  total_pages integer,
  total_chunks integer,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Chunks table with pgvector embeddings
CREATE TABLE chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content text NOT NULL,
  page_number integer NOT NULL,
  embedding vector(768) NOT NULL,  -- Gemini gemini-embedding-001 (768-dim via outputDimensionality)
  created_at timestamptz DEFAULT now()
);

-- Cosine similarity search function
CREATE FUNCTION match_chunks(query_embedding vector(768), match_count int DEFAULT 5)
RETURNS TABLE (id, document_id, content, page_number, filename, similarity)
```

## Security

- **No API keys in the frontend**: All Gemini API calls happen server-side in Supabase Edge Functions
- **Environment variables**: `GEMINI_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` are used only in edge functions, never exposed to the browser
- **RLS enabled**: Row-level security is enabled on all tables (single-tenant shared data model)
- **No mock responses**: All AI responses are real Gemini API calls — no fake citations, no hardcoded answers

## Setup

### Prerequisites

- Node.js 18+
- A Supabase project with pgvector enabled
- A Google Gemini API key

### Environment Variables

The following are pre-configured in the `.env` file for the frontend:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

The following are configured as Supabase Edge Function secrets (server-side only):

```
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Installation

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck
```

### Database Setup

The database schema (tables, pgvector extension, HNSW index, `match_chunks` function, and RLS policies) is applied via Supabase migrations. See the migration in the Supabase dashboard.

### Edge Function Deployment

Edge functions are deployed to Supabase:

- `process-pdf` — handles PDF upload, text extraction, chunking, and embedding
- `rag-query` — handles question embedding, vector search, and grounded answer generation

## Usage

1. **Upload PDFs**: Drag and drop PDF files into the sidebar, or click to browse
2. **Wait for processing**: Documents show a "Processing" status while text is extracted and embeddings are generated
3. **Ask questions**: Type a question in the Ask panel and press Enter
4. **Review the answer**: The grounded answer appears with inline citations like `[Source 1, Page 3]`
5. **Inspect evidence**: Click any source in the Evidence Inspector to see the full chunk text, page number, and similarity score
6. **Explain Simply**: Click "Explain Simply" to get a plain-language version of the answer
7. **View evaluation**: Click "Evaluation" in the sidebar to see retrieval metrics and refusal rates

## Design

The UI uses a premium dark navy/slate research-tool aesthetic:
- Background: deep navy (#060f1f, #0a1c33)
- Accent: cyan (#22d3ee) for interactive elements and highlights
- Cards: subtle borders with rounded corners
- Typography: Inter for body text, JetBrains Mono for technical data
- Responsive layout: sidebar + main content, works from mobile to desktop
- Micro-interactions: hover states, fade-in animations, expandable evidence cards

## Key Design Decisions

- **768-dimension embeddings**: Uses Gemini's `gemini-embedding-001` model with `outputDimensionality: 768` to match the pgvector schema
- **HNSW index**: Chosen over IVFFlat for better recall at this scale and no training step
- **0.55 similarity threshold**: Questions below this threshold are refused to prevent hallucination
- **Page-aware chunking**: Each chunk preserves its source page number for accurate citations
- **Batch embedding**: Chunks are embedded in batches of 100 to stay within API limits
- **Server-side only**: All API keys and Gemini calls happen in edge functions, never in the browser
