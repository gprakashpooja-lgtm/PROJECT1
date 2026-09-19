import { useState } from 'react';

interface AskPanelProps {
  onAsk: (question: string) => void;
  loading: boolean;
  disabled: boolean;
}

export function AskPanel({ onAsk, loading, disabled }: AskPanelProps) {
  const [question, setQuestion] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading || disabled) return;
    onAsk(question.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (question.trim() && !loading && !disabled) {
        onAsk(question.trim());
      }
    }
  };

  return (
    <div className="rounded-xl border border-navy-700 bg-navy-900 p-5">
      <div className="mb-3 flex items-center gap-2">
        <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093V14m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-navy-300">
          Ask your knowledge base
        </h2>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          placeholder={disabled ? 'Upload documents first to enable questions...' : 'Ask a question about your uploaded documents...'}
          rows={3}
          className="w-full resize-none rounded-lg border border-navy-700 bg-navy-800 px-4 py-3 text-sm text-navy-100 placeholder-navy-400 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-navy-400">
            Press Enter to ask · Shift+Enter for new line
          </p>
          <button
            type="submit"
            disabled={!question.trim() || loading || disabled}
            className="flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2 text-sm font-medium text-navy-950 transition-all hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Searching evidence...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                Ask
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
