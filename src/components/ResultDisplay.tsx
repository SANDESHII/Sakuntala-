import { FC, memo, useEffect, useState } from 'react';
import { AnalysisResult } from '../types';
import { ScoreHeatmap } from './ScoreHeatmap';

interface ResultGridProps {
  analysis: AnalysisResult;
}

const EDGE_THRESHOLD = 0.03;
const KELLY_FRACTION = 0.35;
const MAX_KELLY_STAKE = 0.05;

const GoalDistributionChart = ({
  distribution,
  predictionType,
}: {
  distribution: { goals: string; probability: number }[];
  predictionType: 'OVER_25' | 'UNDER_25' | 'NO_BET';
}) => {
  const maxProb = Math.max(...distribution.map((d) => d.probability), 1);

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Total Goals Distribution</h3>
          <p className="text-xs text-slate-400">
            Dixon-Coles Poisson probability across 0 to 5+ total match goals
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>Under 2.5: 0–2 goals</span>
          <span aria-hidden="true">·</span>
          <span>Over 2.5: 3+ goals</span>
        </div>
      </div>

      <div className="h-52 w-full flex items-end gap-3 pt-6 pb-2 px-2 border-b border-slate-800">
        {distribution.map((item, index) => {
          const isHighlighted =
            (predictionType === 'OVER_25' && index >= 3) ||
            (predictionType === 'UNDER_25' && index <= 2);
          const barHeightPct = Math.max(4, (item.probability / maxProb) * 100);

          return (
            <div key={item.goals} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <span className="text-xs font-mono font-medium text-slate-300 tabular-nums">
                {item.probability.toFixed(1)}%
              </span>
              <div
                className={`w-full max-w-[56px] rounded-t-md transition-all ${
                  isHighlighted ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
                style={{ height: `${barHeightPct}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 px-2">
        {distribution.map((item) => (
          <div key={item.goals} className="flex-1 text-center text-xs font-mono font-medium text-slate-400">
            {item.goals} {item.goals === '1' ? 'goal' : 'goals'}
          </div>
        ))}
      </div>
    </div>
  );
};

export const ResultGrid: FC<ResultGridProps> = memo(({ analysis }) => {
  const probOver25 = analysis.rawProbability;
  const probUnder25 = 1 - probOver25;
  const probOver25Pct = probOver25 * 100;
  const probUnder25Pct = probUnder25 * 100;
  const combinedXg = analysis.homeExpectedGoals + analysis.awayExpectedGoals;

  const minOddsOver25 = probOver25 > EDGE_THRESHOLD ? 1 / (probOver25 - EDGE_THRESHOLD) : null;
  const minOddsUnder25 = probUnder25 > EDGE_THRESHOLD ? 1 / (probUnder25 - EDGE_THRESHOLD) : null;

  const [overOddsInput, setOverOddsInput] = useState<string>('');
  const [underOddsInput, setUnderOddsInput] = useState<string>('');

  useEffect(() => {
    const apiOver = analysis.context.marketOdds.pinnacleOver25;
    const apiUnder = analysis.context.marketOdds.pinnacleUnder25;
    setOverOddsInput(apiOver && apiOver > 1 ? apiOver.toFixed(2) : '');
    setUnderOddsInput(apiUnder && apiUnder > 1 ? apiUnder.toFixed(2) : '');
  }, [analysis]);

  const parsedOver = Number(overOddsInput);
  const parsedUnder = Number(underOddsInput);
  const hasCustomOdds =
    (Number.isFinite(parsedOver) && parsedOver > 1) ||
    (Number.isFinite(parsedUnder) && parsedUnder > 1);

  let effectivePick: 'OVER_25' | 'UNDER_25' | 'NO_BET' = analysis.predictionType;
  let effectiveEdgePct = analysis.edge;
  let effectiveOdds = analysis.marketOdds;
  let effectiveStakePct = analysis.recommendedStake;
  let effectiveImpliedPct =
    analysis.marketImpliedProb !== null ? analysis.marketImpliedProb * 100 : null;
  let effectiveVerdict = analysis.verdict;

  if (hasCustomOdds) {
    const oPrice = Number.isFinite(parsedOver) && parsedOver > 1 ? parsedOver : 0;
    const uPrice = Number.isFinite(parsedUnder) && parsedUnder > 1 ? parsedUnder : 0;
    const oEdge = oPrice > 1 ? probOver25 - 1 / oPrice : -1;
    const uEdge = uPrice > 1 ? probUnder25 - 1 / uPrice : -1;

    effectivePick =
      !analysis.isLowConfidence && oEdge > uEdge && oEdge > EDGE_THRESHOLD
        ? 'OVER_25'
        : !analysis.isLowConfidence && uEdge > EDGE_THRESHOLD
        ? 'UNDER_25'
        : 'NO_BET';

    const rawEdge =
      effectivePick === 'OVER_25' ? oEdge : effectivePick === 'UNDER_25' ? uEdge : Math.max(oEdge, uEdge, 0);
    effectiveOdds =
      effectivePick === 'OVER_25' ? oPrice : effectivePick === 'UNDER_25' ? uPrice : null;
    const pSide =
      effectivePick === 'OVER_25' ? probOver25 : effectivePick === 'UNDER_25' ? probUnder25 : 0;
    const kelly =
      effectiveOdds && rawEdge > EDGE_THRESHOLD
        ? Math.min(MAX_KELLY_STAKE, ((pSide * effectiveOdds - 1) / (effectiveOdds - 1)) * KELLY_FRACTION)
        : 0;

    effectiveEdgePct = Math.round(rawEdge * 1000) / 10;
    effectiveStakePct = Math.round(kelly * 1000) / 10;
    effectiveImpliedPct = effectiveOdds ? (1 / effectiveOdds) * 100 : null;
    effectiveVerdict = kelly > 0 ? 'EXECUTE_BET' : 'NO_BET';
  }

  const isExecute = effectiveVerdict === 'EXECUTE_BET';
  const effectiveLabel = effectivePick === 'NO_BET' ? 'NO EDGE' : effectivePick;

  return (
    <div className="space-y-8 page-transition max-w-5xl mx-auto">
      {/* Match & Signal Verdict */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{analysis.context.league}</span>
            <span aria-hidden="true">·</span>
            <span>{analysis.kickoff || 'Scheduled'}</span>
            <span aria-hidden="true">·</span>
            <span>{analysis.modelSource === 'MLE_FITTED' ? 'Dixon-Coles MLE' : 'Heuristic Fallback'}</span>
            <span aria-hidden="true">·</span>
            <span>{analysis.dataSource === 'LIVE' ? 'Live Feed' : 'Fallback Data'}</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-50 tracking-tight">
            {analysis.homeStats.name} vs {analysis.awayStats.name}
          </h2>
          <p className="text-sm text-slate-400 tabular-nums">
            Expected goals: {analysis.homeExpectedGoals.toFixed(2)} (Home) +{' '}
            {analysis.awayExpectedGoals.toFixed(2)} (Away) ={' '}
            <span className="font-mono font-semibold text-slate-100">{combinedXg.toFixed(2)}</span> total xG
          </p>
        </div>

        <div
          className={`rounded-xl border p-5 min-w-[270px] space-y-2 ${
            isExecute
              ? 'bg-emerald-500/10 border-emerald-500/40'
              : 'bg-slate-950/70 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-slate-400">Signal Verdict</span>
            <span
              className={`text-xs font-semibold ${
                isExecute ? 'text-emerald-400' : 'text-slate-300'
              }`}
            >
              {isExecute ? 'Execute Bet' : 'No Bet'}
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-50 tracking-tight">
            {effectiveLabel}
          </div>
          <p className="text-xs text-slate-400 tabular-nums">
            {isExecute && effectiveOdds !== null
              ? `Edge +${effectiveEdgePct?.toFixed(1)}% at ${effectiveOdds.toFixed(2)} odds · Kelly stake ${effectiveStakePct.toFixed(1)}%`
              : hasCustomOdds
              ? 'Edge below 3.0% threshold for entered odds.'
              : 'Enter bookmaker odds below to compute live edge & Kelly stake.'}
          </p>
        </div>
      </div>

      {/* Core Dixon-Coles & Kelly Outputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-400">Model P(Over 2.5)</p>
          <p className="text-2xl font-mono font-bold text-slate-50 tabular-nums">
            {probOver25Pct.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-400 font-mono tabular-nums">
            Fair {(1 / Math.max(probOver25, 0.01)).toFixed(2)} · Min +3%{' '}
            {minOddsOver25 ? minOddsOver25.toFixed(2) : '--'}
          </p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-400">Model P(Under 2.5)</p>
          <p className="text-2xl font-mono font-bold text-slate-50 tabular-nums">
            {probUnder25Pct.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-400 font-mono tabular-nums">
            Fair {(1 / Math.max(probUnder25, 0.01)).toFixed(2)} · Min +3%{' '}
            {minOddsUnder25 ? minOddsUnder25.toFixed(2) : '--'}
          </p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-400">Model Edge vs Market</p>
          <p
            className={`text-2xl font-mono font-bold tabular-nums ${
              effectiveEdgePct !== null && effectiveEdgePct > 3 ? 'text-emerald-400' : 'text-slate-100'
            }`}
          >
            {effectiveEdgePct !== null && (hasCustomOdds || analysis.marketOdds !== null)
              ? `${effectiveEdgePct > 0 ? '+' : ''}${effectiveEdgePct.toFixed(1)}%`
              : '--'}
          </p>
          <p className="text-xs text-slate-400 font-mono tabular-nums">
            {effectiveImpliedPct !== null
              ? `Implied ${effectiveImpliedPct.toFixed(1)}%`
              : 'No market odds quoted'}
          </p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-400">Team Expected Goals (λ / μ)</p>
          <p className="text-2xl font-mono font-bold text-slate-50 tabular-nums">
            {analysis.homeExpectedGoals.toFixed(2)} / {analysis.awayExpectedGoals.toFixed(2)}
          </p>
          <p className="text-xs text-slate-400 tabular-nums">
            Sample confidence: {analysis.isLowConfidence ? 'Low (<6 matches)' : 'Standard'}
          </p>
        </div>
      </div>

      {/* Bookmaker Odds & Fractional Kelly Evaluator */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-100">Market Edge & Fractional Kelly Calculator</h3>
          <p className="text-xs text-slate-400">
            Compare decimal bookmaker odds against Dixon-Coles fair probabilities (0.35× Kelly, 5.0% cap, 3.0% min edge).
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 shrink-0">
          <div className="space-y-1.5">
            <label htmlFor="calc-over-odds" className="block text-xs font-medium text-slate-400">
              Over 2.5 Odds
            </label>
            <input
              id="calc-over-odds"
              type="number"
              step="0.01"
              min="1.01"
              value={overOddsInput}
              onChange={(e) => setOverOddsInput(e.target.value)}
              placeholder={minOddsOver25 ? minOddsOver25.toFixed(2) : '1.90'}
              className="w-28 min-h-[40px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-100 tabular-nums focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="calc-under-odds" className="block text-xs font-medium text-slate-400">
              Under 2.5 Odds
            </label>
            <input
              id="calc-under-odds"
              type="number"
              step="0.01"
              min="1.01"
              value={underOddsInput}
              onChange={(e) => setUnderOddsInput(e.target.value)}
              placeholder={minOddsUnder25 ? minOddsUnder25.toFixed(2) : '2.00'}
              className="w-28 min-h-[40px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-100 tabular-nums focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {analysis.goalDistribution && analysis.goalDistribution.length > 0 && (
        <GoalDistributionChart
          distribution={analysis.goalDistribution}
          predictionType={effectivePick}
        />
      )}

      {analysis.scoreMatrix && (
        <ScoreHeatmap
          matrix={analysis.scoreMatrix}
          homeTeam={analysis.homeStats.name}
          awayTeam={analysis.awayStats.name}
        />
      )}
    </div>
  );
});
