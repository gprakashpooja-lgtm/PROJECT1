import type { EvaluationStats } from '../types';

interface EvaluationPanelProps {
  stats: EvaluationStats;
  history: { question: string; refused: boolean; topSimilarity: number; avgSimilarity: number }[];
  onClose: () => void;
}

export function EvaluationPanel({ stats, history, onClose }: EvaluationPanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-navy-700 bg-navy-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h2 className="text-lg font-semibold text-white">Evaluation Metrics</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-navy-400 transition-colors hover:bg-navy-800 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats grid */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Questions" value={stats.totalQuestions.toString()} color="text-white" />
          <StatCard label="Answered" value={stats.answered.toString()} color="text-green-400" />
          <StatCard label="Refused" value={stats.refused.toString()} color="text-red-400" />
          <StatCard
            label="Refusal Rate"
            value={`${stats.refusalRate.toFixed(1)}%`}
            color={stats.refusalRate > 50 ? 'text-red-400' : 'text-cyan-400'}
          />
        </div>

        {/* Similarity metrics */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-navy-700 bg-navy-800/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-navy-400">
              Avg Top Similarity
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-2xl font-bold text-cyan-400">
                {stats.avgTopSimilarity.toFixed(3)}
              </span>
              <span className="mb-1 text-xs text-navy-400">
                ({Math.round(stats.avgTopSimilarity * 100)}%)
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-700">
              <div
                className="h-full rounded-full bg-cyan-400"
                style={{ width: `${Math.round(stats.avgTopSimilarity * 100)}%` }}
              />
            </div>
          </div>
          <div className="rounded-lg border border-navy-700 bg-navy-800/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-navy-400">
              Avg Overall Similarity
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-2xl font-bold text-navy-300">
                {stats.avgSimilarity.toFixed(3)}
              </span>
              <span className="mb-1 text-xs text-navy-400">
                ({Math.round(stats.avgSimilarity * 100)}%)
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-700">
              <div
                className="h-full rounded-full bg-navy-400"
                style={{ width: `${Math.round(stats.avgSimilarity * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* History table */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-navy-400">
            Question History
          </h3>
          {history.length === 0 ? (
            <p className="py-4 text-center text-sm text-navy-400">No questions asked yet</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-navy-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-navy-800 text-xs uppercase text-navy-400">
                  <tr>
                    <th className="px-4 py-2 font-medium">Question</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Top Sim</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item, idx) => (
                    <tr key={idx} className="border-t border-navy-700">
                      <td className="max-w-xs truncate px-4 py-2 text-navy-200" title={item.question}>
                        {item.question}
                      </td>
                      <td className="px-4 py-2">
                        {item.refused ? (
                          <span className="rounded-md bg-red-400/10 px-2 py-0.5 text-xs text-red-400">
                            Refused
                          </span>
                        ) : (
                          <span className="rounded-md bg-green-400/10 px-2 py-0.5 text-xs text-green-400">
                            Answered
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-navy-300">
                        {item.topSimilarity.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-navy-700 bg-navy-800/50 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-navy-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
