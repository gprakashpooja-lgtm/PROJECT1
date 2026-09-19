export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface DocumentRecord {
  id: string;
  filename: string;
  status: DocumentStatus;
  total_pages: number | null;
  total_chunks: number | null;
  error_message: string | null;
  created_at: string;
}

export interface ChunkMatch {
  id: string;
  document_id: string;
  content: string;
  page_number: number;
  filename: string;
  similarity: number;
}

export interface QueryResult {
  answer: string;
  sources: ChunkMatch[];
  refused: boolean;
  refusalReason: string | null;
}

export interface ProcessingResult {
  documentId: string;
  filename: string;
  status: DocumentStatus;
  totalPages: number;
  totalChunks: number;
  error: string | null;
}

export interface EvaluationStats {
  totalQuestions: number;
  answered: number;
  refused: number;
  refusalRate: number;
  avgSimilarity: number;
  avgTopSimilarity: number;
}
