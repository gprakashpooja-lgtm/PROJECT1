import type { QueryResult } from '../types';

interface AnswerPanelProps {
  result: QueryResult;
  question: string;
}

export function AnswerPanel({ result, question }: AnswerPanelProps) {
  if (result.refused) {
    return (
      <div className="animate-slide-up rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-yellow-400">
            No Sufficient Evidence
          </h2>
        </div>
        <p className="text-base leading-relaxed text-navy-100">
          {result.answer}
        </p>
        {result.refusalReason && (
          <p className="mt-3 text-sm text-navy-400">
            <span className="font-medium">Reason: </span>
            {result.refusalReason}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="animate-slide-up rounded-xl border border-navy-700 bg-navy-900 p-5">
      {/* Question */}
      <div className="mb-4 rounded-lg bg-navy-800/50 px-4 py-2.5">
        <p className="text-xs font-medium uppercase tracking-wider text-navy-400">Question</p>
        <p className="mt-1 text-sm text-navy-200">{question}</p>
      </div>

      {/* Answer */}
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-2">
          <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
            Grounded Answer
          </h2>
        </div>
        <div className="prose prose-invert max-w-none">
          <p className="whitespace-pre-wrap text-base leading-relaxed text-navy-100">
            {result.answer}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 border-t border-navy-700 pt-4">
        <div className="ml-auto flex items-center gap-1.5 text-xs text-navy-400">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Answered from {result.sources.length} evidence sources
        </div>
      </div>
    </div>
  );
}
