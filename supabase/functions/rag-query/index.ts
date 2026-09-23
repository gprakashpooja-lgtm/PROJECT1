import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface QueryRequest {
  question: string;
}

interface ChunkMatch {
  id: string;
  document_id: string;
  content: string;
  page_number: number;
  filename: string;
  similarity: number;
}

interface QueryResponse {
  answer: string;
  sources: ChunkMatch[];
  refused: boolean;
  refusalReason: string | null;
}

const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIM = 768;
const GEMINI_ANSWER_MODEL = 'gemini-3.5-flash-lite';
const SIMILARITY_THRESHOLD = 0.50;
const MATCH_COUNT = 5;

// Get Gemini embedding for a single text
async function getGeminiEmbedding(text: string, apiKey: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent`;

  const body = {
    model: `models/${GEMINI_EMBEDDING_MODEL}`,
    content: { parts: [{ text }] },
    outputDimensionality: EMBEDDING_DIM,
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
  const embedding: number[] = data.embedding?.values || [];

  if (embedding.length !== EMBEDDING_DIM) {
    throw new Error(`Embedding dimension mismatch: got ${embedding.length}, expected ${EMBEDDING_DIM}`);
  }

  return embedding;
}

// Generate grounded answer using Gemini
async function generateGroundedAnswer(
  question: string,
  evidence: ChunkMatch[],
  apiKey: string,
): Promise<string> {
  const evidenceText = evidence
    .map((e, i) => `[Source ${i + 1}] (Document: "${e.filename}", Page ${e.page_number})\n${e.content}`)
    .join('\n\n---\n\n');

  const prompt = `You are an evidence-first knowledge assistant. Answer the user's question using ONLY the evidence provided below. Do not use any outside knowledge. If the evidence does not contain enough information to answer the question, say so explicitly.

When you use information from the evidence, cite the source number and page number in this format: [Source N, Page P]. Include citations inline where relevant.

EVIDENCE:
${evidenceText}

QUESTION: ${question}

Answer the question based only on the evidence above. Include inline citations like [Source 1, Page 3] where relevant.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_ANSWER_MODEL}:generateContent`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 1024,
    },
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
    throw new Error(`Gemini answer API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const answer: string = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!answer.trim()) {
    throw new Error('Gemini returned an empty answer');
  }

  return answer.trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { question } = (await req.json()) as QueryRequest;

    if (!question || !question.trim()) {
      return new Response(
        JSON.stringify({ error: 'Question is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY')!;

    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Embed the question
    const queryEmbedding = await getGeminiEmbedding(question, geminiKey);

    // Step 2: Retrieve top 5 chunks via pgvector cosine similarity
    const { data: matches, error: matchError } = await supabase.rpc('match_chunks', {
      query_embedding: queryEmbedding,
      match_count: MATCH_COUNT,
    });

    if (matchError) {
      throw new Error(`Retrieval failed: ${matchError.message}`);
    }

    const sources: ChunkMatch[] = (matches || []).map((m: Record<string, unknown>) => ({
      id: m.id as string,
      document_id: m.document_id as string,
      content: m.content as string,
      page_number: m.page_number as number,
      filename: m.filename as string,
      similarity: m.similarity as number,
    }));

    // Step 3: Check if we have sufficient evidence
    if (sources.length === 0) {
      const response: QueryResponse = {
        answer: "I couldn't find sufficient evidence in the uploaded documents to answer this question.",
        sources: [],
        refused: true,
        refusalReason: 'No matching chunks found in the database.',
      };
      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const topSimilarity = sources[0].similarity;

    // Step 4: Reject if evidence similarity is below threshold
    if (topSimilarity < SIMILARITY_THRESHOLD) {
      const response: QueryResponse = {
        answer: "I couldn't find sufficient evidence in the uploaded documents to answer this question. The available evidence does not closely match your question.",
        sources,
        refused: true,
        refusalReason: `Top similarity score ${topSimilarity.toFixed(3)} is below the threshold of ${SIMILARITY_THRESHOLD}.`,
      };
      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Step 5: Generate grounded answer using ONLY retrieved evidence
    const answer = await generateGroundedAnswer(question, sources, geminiKey);

    const response: QueryResponse = {
      answer,
      sources,
      refused: false,
      refusalReason: null,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown query error';

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
