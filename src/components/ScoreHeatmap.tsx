import { FC, memo, useState } from 'react';

interface ScoreHeatmapProps {
  matrix: number[][];
  homeTeam: string;
  awayTeam: string;
}

export const ScoreHeatmap: FC<ScoreHeatmapProps> = memo(({ matrix, homeTeam, awayTeam }) => {
  const limit = Math.min(matrix.length - 1, 5);
  const maxProb = Math.max(...matrix.flat());
  const [hovered, setHovered] = useState<{ h: number; a: number; prob: number } | null>(null);

  return (
    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
            Exact Score Probability Matrix
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Dixon-Coles Poisson grid · {homeTeam} (rows) vs {awayTeam} (columns)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
          {hovered ? (
            <span className="font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums">
              {homeTeam} {hovered.h}–{hovered.a} {awayTeam} · {(hovered.prob * 100).toFixed(2)}% ·{' '}
              {hovered.h + hovered.a > 2.5 ? 'Over 2.5' : 'Under 2.5'}
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-emerald-500/15 border border-slate-300 dark:border-slate-800" aria-hidden="true" />
                Low probability
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-emerald-500/55 border border-emerald-500/50" aria-hidden="true" />
                Peak probability
              </span>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[360px]">
          <div className="text-center text-xs font-medium text-slate-600 dark:text-slate-400 mb-3">
            {awayTeam} (Away Goals)
          </div>

          <div className="grid grid-cols-7 gap-1.5 items-center">
            <div className="text-right pr-2 text-xs font-medium text-slate-500">H \ A</div>
            {Array.from({ length: limit + 1 }).map((_, a) => (
              <div key={`h-${a}`} className="text-center text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 tabular-nums py-1">
                {a}
              </div>
            ))}

            {Array.from({ length: limit + 1 }).map((_, h) => (
              <div key={`r-${h}`} className="contents">
                <div className="text-right pr-2 text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                  {h}
                </div>
                {Array.from({ length: limit + 1 }).map((_, a) => {
                  const prob = matrix[h]?.[a] || 0;
                  const intensity = maxProb > 0 ? prob / maxProb : 0;
                  const isHigh = intensity >= 0.7;

                  return (
                    <div
                      key={`${h}-${a}`}
                      onMouseEnter={() => setHovered({ h, a, prob })}
                      onMouseLeave={() => setHovered(null)}
                      title={`${homeTeam} ${h} - ${a} ${awayTeam}: ${(prob * 100).toFixed(2)}%`}
                      className={`h-11 md:h-12 flex flex-col items-center justify-center rounded-md border transition-colors cursor-default ${
                        isHigh
                          ? 'border-emerald-500/70 text-slate-950 dark:text-slate-50'
                          : 'border-slate-200 dark:border-slate-800/80 text-slate-800 dark:text-slate-300 hover:border-emerald-500/40'
                      }`}
                      style={{
                        backgroundColor: `rgba(16, 185, 129, ${(0.06 + intensity * 0.48).toFixed(3)})`,
                      }}
                    >
                      <span className="text-xs font-mono font-semibold tabular-nums">
                        {(prob * 100).toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
