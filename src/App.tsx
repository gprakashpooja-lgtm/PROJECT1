import { useState, useCallback, useEffect } from 'react';
import { supabase } from './lib/supabase';
import type { DocumentRecord, QueryResult, EvaluationStats } from './types';
import { Sidebar } from './components/Sidebar';
import { AskPanel } from './components/AskPanel';
import { AnswerPanel } from './components/AnswerPanel';
import { EvidenceInspector } from './components/EvidenceInspector';
import { EvaluationPanel } from './components/EvaluationPanel';

export default function App() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [evaluationStats, setEvaluationStats] = useState<EvaluationStats | null>(null);
  const [queryHistory, setQueryHistory] = useState<
    { question: string; refused: boolean; topSimilarity: number; avgSimilarity: number }[]
  >([]);

  const fetchDocuments = useCallback(async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch documents:', error);
      return;
    }

    setDocuments((data || []) as DocumentRecord[]);
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Poll for processing documents
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === 'processing' || d.status === 'pending');
    if (!hasProcessing) return;

    const interval = setInterval(fetchDocuments, 3000);
    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  const handleUpload = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith('.pdf')) continue;

        // Create document record
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .insert({
            filename: file.name,
            status: 'pending',
          })
          .select()
          .single();

        if (docError || !docData) {
          console.error('Failed to create document record:', docError);
          continue;
        }

        // Immediately update local state
        setDocuments((prev) => [docData as DocumentRecord, ...prev]);

        // Read file as base64
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
        );

        // Call the process-pdf edge function
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const functionUrl = `${supabaseUrl}/functions/v1/process-pdf`;

        try {
          const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${anonKey}`,
              apikey: anonKey,
            },
            body: JSON.stringify({
              documentId: docData.id,
              filename: file.name,
              pdfData: base64,
            }),
          });

          if (!response.ok) {
            const errBody = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Processing failed:', errBody.error);
          }
        } catch (err) {
          console.error('Failed to call process-pdf:', err);
        }
      }

      // Refresh documents after a short delay
      setTimeout(fetchDocuments, 1000);
    },
    [fetchDocuments],
  );

  const handleDeleteDocument = useCallback(
    async (docId: string) => {
      const { error } = await supabase.from('documents').delete().eq('id', docId);
      if (error) {
        console.error('Failed to delete document:', error);
        return;
      }
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      if (selectedDocId === docId) setSelectedDocId(null);
    },
    [selectedDocId],
  );

  const handleAsk = useCallback(
    async (question: string) => {
      setQueryLoading(true);
      setQueryError(null);
      setCurrentQuestion(question);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const functionUrl = `${supabaseUrl}/functions/v1/rag-query`;

      try {
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify({ question }),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errBody.error || `Request failed (${response.status})`);
        }

        const result = (await response.json()) as QueryResult;
        setQueryResult(result);

        // Track for evaluation
        const topSim = result.sources.length > 0 ? result.sources[0].similarity : 0;
        const avgSim =
          result.sources.length > 0
            ? result.sources.reduce((sum, s) => sum + s.similarity, 0) / result.sources.length
            : 0;

        setQueryHistory((prev) => [
          ...prev,
          { question, refused: result.refused, topSimilarity: topSim, avgSimilarity: avgSim },
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to get answer';
        setQueryError(msg);
      } finally {
        setQueryLoading(false);
      }
    },
    [],
  );

  // Update evaluation stats when history changes
  useEffect(() => {
    if (queryHistory.length === 0) {
      setEvaluationStats(null);
      return;
    }

    const total = queryHistory.length;
    const refused = queryHistory.filter((q) => q.refused).length;
    const answered = total - refused;
    const refusalRate = (refused / total) * 100;
    const answeredItems = queryHistory.filter((q) => !q.refused);
    const avgSimilarity =
      answeredItems.length > 0
        ? answeredItems.reduce((sum, q) => sum + q.avgSimilarity, 0) / answeredItems.length
        : 0;
    const avgTopSimilarity =
      answeredItems.length > 0
        ? answeredItems.reduce((sum, q) => sum + q.topSimilarity, 0) / answeredItems.length
        : 0;

    setEvaluationStats({
      totalQuestions: total,
      answered,
      refused,
      refusalRate,
      avgSimilarity,
      avgTopSimilarity,
    });
  }, [queryHistory]);

  const readyDocs = documents.filter((d) => d.status === 'ready');

  return (
    <div className="flex h-screen overflow-hidden bg-navy-950 text-navy-100">
      {/* Sidebar */}
      <Sidebar
        documents={documents}
        onUpload={handleUpload}
        onDelete={handleDeleteDocument}
        selectedDocId={selectedDocId}
        onSelectDoc={setSelectedDocId}
        onShowEvaluation={() => setShowEvaluation(true)}
      />

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-navy-700 bg-navy-900 px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-white">
              Evidence-First AI Knowledge Assistant
            </h1>
            <p className="text-sm text-navy-300">
              Ask questions answered only from your uploaded documents
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-navy-800 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              <span className="text-sm text-navy-200">{readyDocs.length} ready</span>
            </div>
          </div>
        </header>

        {/* Content area */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          {readyDocs.length === 0 && documents.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <AskPanel
                onAsk={handleAsk}
                loading={queryLoading}
                disabled={readyDocs.length === 0}
              />

              {queryError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {queryError}
                </div>
              )}

              {queryResult && !queryError && (
                <>
                  <AnswerPanel
                    result={queryResult}
                    question={currentQuestion}
                  />
                  <EvidenceInspector sources={queryResult.sources} />
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* Evaluation modal */}
      {showEvaluation && evaluationStats && (
        <EvaluationPanel stats={evaluationStats} history={queryHistory} onClose={() => setShowEvaluation(false)} />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-navy-800">
        <svg className="h-10 w-10 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m-6-8h6M5 5h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
        </svg>
      </div>
      <div>
        <p className="text-lg font-medium text-navy-100">Upload documents to build your evidence base</p>
        <p className="mt-1 text-sm text-navy-300">
          Add PDF files from the sidebar to start asking grounded questions
        </p>
      </div>
    </div>
  );
}
