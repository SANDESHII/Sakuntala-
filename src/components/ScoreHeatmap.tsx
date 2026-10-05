import { FC, memo } from 'react';

interface ScoreHeatmapProps {
  matrix: number[][];
  homeTeam: string;
  awayTeam: string;
}

export const ScoreHeatmap: FC<ScoreHeatmapProps> = memo(({ matrix, homeTeam, awayTeam }) => {
  const limit = Math.min(matrix.length - 1, 5); // Show up to 5x5
  const maxProb = Math.max(...matrix.flat());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Score Probability Matrix (DC-MLE)</p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20" />
            <span className="text-[8px] font-black text-neutral-600 uppercase tracking-tighter">Low Density</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-[8px] font-black text-neutral-600 uppercase tracking-tighter">High Probability</span>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden border border-neutral-900 rounded-2xl bg-neutral-900/10 p-6 md:p-12">
        {/* Axes */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[8px] font-black text-neutral-700 uppercase tracking-[0.3em]">
          {awayTeam} (Away)
        </div>
        <div className="absolute top-1/2 left-4 -translate-y-1/2 -rotate-90 text-[8px] font-black text-neutral-700 uppercase tracking-[0.3em]">
          {homeTeam} (Home)
        </div>

        {/* Matrix Grid */}
        <div className="grid grid-cols-6 gap-1 md:gap-2">
          {/* Header Row */}
          <div />
          {Array.from({ length: limit + 1 }).map((_, i) => (
            <div key={`h-${i}`} className="text-center text-[10px] font-black text-neutral-800">{i}</div>
          ))}

          {/* Rows */}
          {Array.from({ length: limit + 1 }).map((_, h) => (
            <div key={`r-${h}`} className="contents">
              <div className="flex items-center justify-center text-[10px] font-black text-neutral-800">{h}</div>
              {Array.from({ length: limit + 1 }).map((_, a) => {
                const prob = matrix[h]?.[a] || 0;
                const intensity = maxProb > 0 ? (prob / maxProb) : 0;
                
                return (
                  <div
                    key={`${h}-${a}`}
                    className="relative group aspect-square flex items-center justify-center rounded-sm md:rounded-md transition-all border border-neutral-900/50"
                    style={{
                      backgroundColor: `rgba(16, 185, 129, ${intensity * 0.4})`,
                      boxShadow: intensity > 0.8 ? 'inset 0 0 12px rgba(16, 185, 129, 0.2)' : 'none'
                    }}
                  >
                    <span className="text-[8px] md:text-[10px] font-bold text-neutral-400 group-hover:text-white tabular-nums transition-colors">
                      {(prob * 100).toFixed(1)}%
                    </span>
                    
                    {intensity > 0.7 && (
                      <div className="absolute inset-0 border border-emerald-500/20 rounded-md animate-pulse" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
