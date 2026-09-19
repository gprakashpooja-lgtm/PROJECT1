import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { getDocumentProxy, extractText } from 'npm:unpdf@0.12.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ProcessRequest {
  documentId: string;
  filename: string;
  pdfData: string; // base64-encoded PDF
}

interface PageText {
  pageNumber: number;
  text: string;
}

interface Chunk {
  content: string;
  page_number: number;
}

const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIM = 768;
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;
const MAX_CHUNKS_PER_DOC = 500;

// Extract text page-by-page from a PDF using unpdf (server-side pdfjs)
async function extractPdfPages(pdfBytes: Uint8Array): Promise<PageText[]> {
  const pdf = await getDocumentProxy(new Uint8Array(pdfBytes));

  const { text, totalPages } = await extractText(pdf, { mergePages: false });

  const pages: PageText[] = [];
  const pageTexts = Array.isArray(text) ? text : [text];

  for (let i = 0; i < totalPages; i++) {
    const pageText = (pageTexts[i] || '').trim();
    pages.push({ pageNumber: i + 1, text: pageText });
  }

  return pages;
}

// Chunk text while preserving page number
function chunkPages(pages: PageText[]): Chunk[] {
  const chunks: Chunk[] = [];

  for (const page of pages) {
    if (!page.text.trim()) continue;

    const text = page.text;
    const chunksForPage: string[] = [];

    if (text.length <= CHUNK_SIZE) {
      chunksForPage.push(text);
    } else {
      const paragraphs = text.split(/\n\n+/);
      let current = '';

      for (const para of paragraphs) {
        if (current.length + para.length + 1 > CHUNK_SIZE && current.length > 0) {
          chunksForPage.push(current.trim());
          const overlapText = current.slice(-CHUNK_OVERLAP);
          current = overlapText + '\n\n' + para;
        } else {
          current = current ? current + '\n\n' + para : para;
        }

        while (current.length > CHUNK_SIZE) {
          let splitAt = CHUNK_SIZE;
          const sentenceEnd = current.lastIndexOf('. ', CHUNK_SIZE);
          if (sentenceEnd > CHUNK_SIZE * 0.5) splitAt = sentenceEnd + 1;

          chunksForPage.push(current.slice(0, splitAt).trim());
          current = current.slice(splitAt);
        }
      }

      if (current.trim()) {
        chunksForPage.push(current.trim());
      }
    }

    for (const chunkText of chunksForPage) {
      if (chunkText.trim().length >= 20) {
        chunks.push({
          content: chunkText.trim(),
          page_number: page.pageNumber,
        });
      }
    }
  }

  return chunks.slice(0, MAX_CHUNKS_PER_DOC);
}

// Get Gemini embeddings for a batch of texts
async function getGeminiEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents`;

  const body = {
    requests: texts.map((t) => ({
      model: `models/${GEMINI_EMBEDDING_MODEL}`,
      content: { parts: [{ text: t }] },
      outputDimensionality: EMBEDDING_DIM,
    })),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini embedding API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const embeddings: number[][] = (data.embeddings || []).map(
    (e: { values: number[] }) => e.values,
  );

  if (embeddings.length !== texts.length) {
    throw new Error(`Embedding count mismatch: got ${embeddings.length}, expected ${texts.length}`);
  }

  for (const emb of embeddings) {
    if (emb.length !== EMBEDDING_DIM) {
      throw new Error(`Embedding dimension mismatch: got ${emb.length}, expected ${EMBEDDING_DIM}`);
    }
  }

  return embeddings;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let documentId: string | null = null;

  try {
    const requestBody = (await req.json()) as ProcessRequest;
    documentId = requestBody.documentId;
    const { filename, pdfData } = requestBody;

    if (!documentId || !filename || !pdfData) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: documentId, filename, pdfData' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY')!;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase environment variables are not configured');
    }
    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update status to processing
    await supabase
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

    // Decode PDF from base64
    const pdfBytes = Uint8Array.from(atob(pdfData), (c) => c.charCodeAt(0));

    // Extract text page-by-page using unpdf
    const pages = await extractPdfPages(pdfBytes);

    if (pages.length === 0) {
      throw new Error('No text could be extracted from this PDF. It may be scanned or encrypted.');
    }

    const pagesWithText = pages.filter((p) => p.text.trim().length > 0);
    if (pagesWithText.length === 0) {
      throw new Error('No text could be extracted from this PDF. It may be scanned or encrypted.');
    }

    // Chunk while preserving page numbers
    const chunks = chunkPages(pages);

    if (chunks.length === 0) {
      throw new Error('No text chunks could be created from this PDF.');
    }

    // Get embeddings in batches
    const BATCH_SIZE = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchTexts = batch.map((c) => c.content);
      const batchEmbeddings = await getGeminiEmbeddings(batchTexts, geminiKey);
      allEmbeddings.push(...batchEmbeddings);
    }

    // Insert chunks with embeddings — pass vector as string for pgvector
    const chunkRows = chunks.map((chunk, i) => ({
      document_id: documentId,
      content: chunk.content,
      page_number: chunk.page_number,
      embedding: allEmbeddings[i],
    }));

    const { error: insertError } = await supabase
      .from('chunks')
      .insert(chunkRows);

    if (insertError) {
      throw new Error(`Failed to insert chunks: ${insertError.message}`);
    }

    // Update document status to ready
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        status: 'ready',
        total_pages: pages.length,
        total_chunks: chunks.length,
      })
      .eq('id', documentId);

    if (updateError) {
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        documentId,
        filename,
        status: 'ready',
        totalPages: pages.length,
        totalChunks: chunks.length,
        error: null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown processing error';

    // Update document status to failed — documentId was saved before the try body
    if (documentId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          await supabase
            .from('documents')
            .update({ status: 'failed', error_message: errorMessage })
            .eq('id', documentId);
        }
      } catch {
        // Ignore update failure
      }
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
