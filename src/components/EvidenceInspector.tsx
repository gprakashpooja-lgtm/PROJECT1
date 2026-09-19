import { useState } from 'react';
import type { ChunkMatch } from '../types';

interface EvidenceInspectorProps {
  sources: ChunkMatch[];
}

export function EvidenceInspector({ sources }: EvidenceInspectorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (sources.length === 0) {
    return null;
  }

  const getSimilarityColor = (sim: number) => {
    if (sim >= 0.75) return 'text-green-400 bg-green-400/10';
    if (sim >= 0.6) return 'text-cyan-400 bg-cyan-400/10';
    if (sim >= 0.55) return 'text-yellow-400 bg-yellow-400/10';
    return 'text-red-400 bg-red-400/10';
  };

  const getSimilarityBar = (sim: number) => {
    if (sim >= 0.75) return 'bg-green-400';
    if (sim >= 0.6) return 'bg-cyan-400';
    if (sim >= 0.55) return 'bg-yellow-400';
    return 'bg-red-400';
  };

  return (
    <div className="animate-fade-in rounded-xl border border-navy-700 bg-navy-900 p-5">
      <div className="mb-4 flex items-center gap-2">
        <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-navy-300">
          Evidence Inspector
        </h2>
        <span className="ml-auto text-xs text-navy-400">{sources.length} sources retrieved</span>
      </div>

      <div className="space-y-2">
        {sources.map((source, idx) => {
          const isExpanded = expandedId === source.id;
          const simPct = Math.round(source.similarity * 100);
          return (
            <div
              key={source.id}
              className="overflow-hidden rounded-lg border border-navy-700 bg-navy-800/50"
            >
              {/* Header row */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : source.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-navy-800"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-navy-700 text-xs font-semibold text-navy-200">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy-100" title={source.filename}>
                    {source.filename}
                  </p>
                  <p className="text-xs text-navy-400">Page {source.page_number}</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Similarity bar */}
                  <div className="hidden w-20 sm:block">
                    <div className="h-1.5 overflow-hidden rounded-full bg-navy-700">
                      <div
                        className={`h-full rounded-full ${getSimilarityBar(source.similarity)}`}
                        style={{ width: `${simPct}%` }}
                      />
                    </div>
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${getSimilarityColor(source.similarity)}`}>
                    {simPct}%
                  </span>
                  <svg
                    className={`h-4 w-4 shrink-0 text-navy-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-navy-700 px-4 py-3">
                  <div className="mb-2 flex items-center gap-2 text-xs text-navy-400">
                    <span className="font-mono">Similarity: {source.similarity.toFixed(4)}</span>
                    <span className="text-navy-600">·</span>
                    <span className="font-mono">Page: {source.page_number}</span>
                    <span className="text-navy-600">·</span>
                    <span className="font-mono">Source ID: {source.id.slice(0, 8)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-navy-200">
                    {source.content}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
