import { FC, memo, useEffect, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { AnalysisResult } from '../types';
import { MODEL_CONFIG } from '../core/constants';
import { ScoreHeatmap } from './ScoreHeatmap';

interface ResultGridProps {
  analysis: AnalysisResult;
}

const GoalDistributionChart = ({
  distribution,
  predictionType,
}: {
  distribution: { goals: string; probability: number }[];
  predictionType: 'OVER_25' | 'UNDER_25' | 'NO_BET';
}) => {
  const maxProb = Math.max(...distribution.map((d) => d.probability), 1);

  return (
    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-5 h-full">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">Total Goals Distribution</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Dixon-Coles Poisson probability across 0 to 5+ total match goals
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>Under 2.5: 0–2</span>
          <span aria-hidden="true">·</span>
          <span>Over 2.5: 3+</span>
        </div>
      </div>

      <div className="h-52 w-full flex items-end gap-3 pt-6 pb-2 px-2 border-b border-slate-200 dark:border-slate-800">
        {distribution.map((item, index) => {
          const isHighlighted =
            (predictionType === 'OVER_25' && index >= 3) ||
            (predictionType === 'UNDER_25' && index <= 2);
          const barHeightPct = Math.max(4, (item.probability / maxProb) * 100);

          return (
            <div key={item.goals} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                {item.probability.toFixed(1)}%
              </span>
              <div
                className={`w-full max-w-[52px] rounded-t-md transition-all ${
                  isHighlighted ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
                style={{ height: `${barHeightPct}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 px-2">
        {distribution.map((item) => (
          <div key={item.goals} className="flex-1 text-center text-xs font-mono font-medium text-slate-600 dark:text-slate-400">
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

  const minOddsOver25 = probOver25 > MODEL_CONFIG.EDGE_THRESHOLD ? 1 / (probOver25 - MODEL_CONFIG.EDGE_THRESHOLD) : null;
  const minOddsUnder25 = probUnder25 > MODEL_CONFIG.EDGE_THRESHOLD ? 1 / (probUnder25 - MODEL_CONFIG.EDGE_THRESHOLD) : null;

  const [overOddsInput, setOverOddsInput] = useState<string>('');
  const [underOddsInput, setUnderOddsInput] = useState<string>('');
  const [bankrollInput, setBankrollInput] = useState<string>('1000');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const apiOver = analysis.context.marketOdds.pinnacleOver25;
    const apiUnder = analysis.context.marketOdds.pinnacleUnder25;
    setOverOddsInput(apiOver && apiOver > 1 ? apiOver.toFixed(2) : '');
    setUnderOddsInput(apiUnder && apiUnder > 1 ? apiUnder.toFixed(2) : '');
  }, [analysis]);

  const parsedOver = Number(overOddsInput);
  const parsedUnder = Number(underOddsInput);
  const bankroll = Math.max(0, Number(bankrollInput) || 0);
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
      !analysis.isLowConfidence && oEdge > uEdge && oEdge > MODEL_CONFIG.EDGE_THRESHOLD
        ? 'OVER_25'
        : !analysis.isLowConfidence && uEdge > MODEL_CONFIG.EDGE_THRESHOLD
        ? 'UNDER_25'
        : 'NO_BET';

    const rawEdge =
      effectivePick === 'OVER_25' ? oEdge : effectivePick === 'UNDER_25' ? uEdge : Math.max(oEdge, uEdge, 0);
    effectiveOdds =
      effectivePick === 'OVER_25' ? oPrice : effectivePick === 'UNDER_25' ? uPrice : null;
    const pSide =
      effectivePick === 'OVER_25' ? probOver25 : effectivePick === 'UNDER_25' ? probUnder25 : 0;
    const kelly =
      effectiveOdds && rawEdge > MODEL_CONFIG.EDGE_THRESHOLD
        ? Math.min(MODEL_CONFIG.MAX_KELLY_STAKE, ((pSide * effectiveOdds - 1) / (effectiveOdds - 1)) * MODEL_CONFIG.KELLY_FRACTION)
        : 0;

    effectiveEdgePct = Math.round(rawEdge * 1000) / 10;
    effectiveStakePct = Math.round(kelly * 1000) / 10;
    effectiveImpliedPct = effectiveOdds ? (1 / effectiveOdds) * 100 : null;
    effectiveVerdict = kelly > 0 ? 'EXECUTE_BET' : 'NO_BET';
  }

  const isExecute = effectiveVerdict === 'EXECUTE_BET';
  const effectiveLabel = effectivePick === 'NO_BET' ? 'NO EDGE' : effectivePick === 'OVER_25' ? 'OVER 2.5' : 'UNDER 2.5';
  const stakeAmount = (bankroll * effectiveStakePct) / 100;
  const evPct =
    effectiveOdds && effectivePick !== 'NO_BET'
      ? ((effectivePick === 'OVER_25' ? probOver25 : probUnder25) * effectiveOdds - 1) * 100
      : null;

  const homeLabel = analysis.homeStats.displayName || analysis.homeStats.name;
  const awayLabel = analysis.awayStats.displayName || analysis.awayStats.name;

  const handleCopySummary = async () => {
    const lines = [
      `${homeLabel} vs ${awayLabel} (${analysis.context.league})`,
      `xG: ${analysis.homeExpectedGoals.toFixed(2)} - ${analysis.awayExpectedGoals.toFixed(2)} (Total ${combinedXg.toFixed(2)})`,
      `Over 2.5: ${probOver25Pct.toFixed(1)}% (Fair ${(1 / Math.max(probOver25, 0.01)).toFixed(2)})`,
      `Under 2.5: ${probUnder25Pct.toFixed(1)}% (Fair ${(1 / Math.max(probUnder25, 0.01)).toFixed(2)})`,
      `Verdict: ${effectiveLabel} | Stake: ${effectiveStakePct.toFixed(1)}%`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analysis.homeStats.name}_vs_${analysis.awayStats.name}_${analysis.context.league}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const marketRows = analysis.markets
    ? [
        { market: 'Home Win (1)', prob: analysis.markets.homeWin },
        { market: 'Draw (X)', prob: analysis.markets.draw },
        { market: 'Away Win (2)', prob: analysis.markets.awayWin },
        { market: 'Over 1.5 Goals', prob: analysis.markets.over15 },
        { market: 'Over 2.5 Goals', prob: analysis.markets.over25 },
        { market: 'Under 2.5 Goals', prob: analysis.markets.under25 },
        { market: 'Over 3.5 Goals', prob: analysis.markets.over35 },
        { market: 'BTTS Yes', prob: analysis.markets.bttsYes },
        { market: 'BTTS No', prob: analysis.markets.bttsNo },
      ]
    : [];

  return (
    <div className="space-y-8 page-transition">
      {/* Match & Signal Verdict */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span>{analysis.context.league}</span>
            <span aria-hidden="true">·</span>
            <span>{analysis.kickoff || 'Scheduled'}</span>
            <span aria-hidden="true">·</span>
            <span>{analysis.modelSource === 'MLE_FITTED' ? 'Dixon-Coles MLE' : 'Heuristic Prior'}</span>
            <span aria-hidden="true">·</span>
            <span>{analysis.diagnostics?.dataProvider || analysis.dataSource}</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-950 dark:text-slate-50 tracking-tight">
            {homeLabel} vs {awayLabel}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 tabular-nums">
            Expected goals: {analysis.homeExpectedGoals.toFixed(2)} (Home) +{' '}
            {analysis.awayExpectedGoals.toFixed(2)} (Away) ={' '}
            <span className="font-mono font-semibold text-slate-950 dark:text-slate-100">{combinedXg.toFixed(2)}</span> total xG
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied Brief' : 'Copy Brief'}
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export JSON
            </button>
          </div>
        </div>

        <div
          className={`rounded-xl border p-5 min-w-[290px] space-y-2 ${
            isExecute
              ? 'bg-emerald-500/10 border-emerald-500/40'
              : 'bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Signal Verdict</span>
            <span
              className={`text-xs font-semibold ${
                isExecute ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {isExecute ? 'Execute Bet' : 'No Bet'}
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-950 dark:text-slate-50 tracking-tight">
            {effectiveLabel}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            {isExecute && effectiveOdds !== null
              ? `Edge +${effectiveEdgePct?.toFixed(1)}% at ${effectiveOdds.toFixed(2)} · Stake ${effectiveStakePct.toFixed(1)}% (${stakeAmount.toFixed(0)} units)`
              : hasCustomOdds
              ? 'Edge below 3.0% threshold for entered odds.'
              : 'Enter bookmaker odds below to compute live edge & Kelly stake.'}
          </p>
        </div>
      </div>

      {/* Core Dixon-Coles & Kelly Outputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Model P(Over 2.5)</p>
          <p className="text-2xl font-mono font-bold text-slate-950 dark:text-slate-50 tabular-nums">
            {probOver25Pct.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Fair {(1 / Math.max(probOver25, 0.01)).toFixed(2)} · Min +3%{' '}
            {minOddsOver25 ? minOddsOver25.toFixed(2) : '--'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Model P(Under 2.5)</p>
          <p className="text-2xl font-mono font-bold text-slate-950 dark:text-slate-50 tabular-nums">
            {probUnder25Pct.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Fair {(1 / Math.max(probUnder25, 0.01)).toFixed(2)} · Min +3%{' '}
            {minOddsUnder25 ? minOddsUnder25.toFixed(2) : '--'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Model Edge vs Market</p>
          <p
            className={`text-2xl font-mono font-bold tabular-nums ${
              effectiveEdgePct !== null && effectiveEdgePct > 3
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-950 dark:text-slate-100'
            }`}
          >
            {effectiveEdgePct !== null && (hasCustomOdds || analysis.marketOdds !== null)
              ? `${effectiveEdgePct > 0 ? '+' : ''}${effectiveEdgePct.toFixed(1)}%`
              : '--'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {effectiveImpliedPct !== null
              ? `Implied ${effectiveImpliedPct.toFixed(1)}%${evPct !== null ? ` · EV ${evPct > 0 ? '+' : ''}${evPct.toFixed(1)}%` : ''}`
              : 'No market odds quoted'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Expected Goals (λ / μ)</p>
          <p className="text-2xl font-mono font-bold text-slate-950 dark:text-slate-50 tabular-nums">
            {analysis.homeExpectedGoals.toFixed(2)} / {analysis.awayExpectedGoals.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Sample confidence: {analysis.isLowConfidence ? 'Low (<6 matches)' : 'Standard'}
          </p>
        </div>
      </div>

      {/* Bookmaker Odds & Fractional Kelly Evaluator */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
            Market Edge & Fractional Kelly Calculator
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Compare decimal bookmaker odds against Dixon-Coles fair probabilities (0.35× Kelly, 5.0% cap, 3.0% min edge).
          </p>
        </div>

        <div className="flex flex-wrap gap-4 shrink-0">
          <div className="space-y-1.5">
            <label htmlFor="calc-over-odds" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
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
              className="w-28 min-h-[40px] bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="calc-under-odds" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
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
              className="w-28 min-h-[40px] bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="calc-bankroll" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Bankroll (Units)
            </label>
            <input
              id="calc-bankroll"
              type="number"
              step="50"
              min="1"
              value={bankrollInput}
              onChange={(e) => setBankrollInput(e.target.value)}
              className="w-28 min-h-[40px] bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Multi-Market Fair Odds Table + Top Scorelines & Goals Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {analysis.goalDistribution && analysis.goalDistribution.length > 0 && (
          <div className="lg:col-span-7">
            <GoalDistributionChart
              distribution={analysis.goalDistribution}
              predictionType={effectivePick}
            />
          </div>
        )}

        {analysis.topScorelines && analysis.topScorelines.length > 0 && (
          <div className="lg:col-span-5 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                Most Likely Scorelines
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Top 6 exact score outcomes from joint Poisson grid
              </p>
            </div>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <th className="px-6 py-2.5">Scoreline</th>
                    <th className="px-4 py-2.5 text-right">Prob</th>
                    <th className="px-4 py-2.5 text-right">Fair Odds</th>
                    <th className="px-6 py-2.5 text-right">O/U 2.5</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                  {analysis.topScorelines.map((s) => (
                    <tr key={`${s.home}-${s.away}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-6 py-3 font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {s.home} – {s.away}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-200 tabular-nums">
                        {(s.probability * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-400 tabular-nums">
                        {(1 / Math.max(s.probability, 0.001)).toFixed(2)}
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-slate-600 dark:text-slate-400">
                        {s.home + s.away > 2.5 ? 'Over' : 'Under'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Derived Multi-Market Probabilities */}
      {marketRows.length > 0 && (
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                Derived Multi-Market Fair Probabilities
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Coherent 1X2, alternative goal lines, and BTTS pricing from the same Dixon-Coles matrix
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800/70">
            {[
              marketRows.slice(0, 3),
              marketRows.slice(3, 6),
              marketRows.slice(6, 9),
            ].map((group, gIdx) => (
              <div key={gIdx} className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {group.map((row) => (
                  <div key={row.market} className="px-6 py-3.5 flex items-center justify-between gap-4 text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{row.market}</span>
                    <div className="flex items-center gap-4 font-mono tabular-nums">
                      <span className="font-semibold text-slate-950 dark:text-slate-100">
                        {(row.prob * 100).toFixed(1)}%
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 w-12 text-right">
                        {(1 / Math.max(row.prob, 0.005)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.scoreMatrix && (
        <ScoreHeatmap
          matrix={analysis.scoreMatrix}
          homeTeam={homeLabel}
          awayTeam={awayLabel}
        />
      )}

      {/* Fitted Model Diagnostics */}
      {analysis.diagnostics && (
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
              Fitted Model Diagnostics
            </h3>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              ρ = {analysis.diagnostics.rho.toFixed(4)} · Home Adv γ = {analysis.diagnostics.homeAdvantage.toFixed(3)}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{homeLabel} (Home)</p>
                <p className="text-slate-500 dark:text-slate-400 tabular-nums">
                  Sample: {analysis.diagnostics.homeSampleMatches} matches
                </p>
              </div>
              <div className="text-right font-mono tabular-nums space-y-0.5">
                <p className="text-slate-800 dark:text-slate-200">
                  Attack α: <span className="font-semibold">{analysis.diagnostics.homeAttack.toFixed(3)}</span>
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Defense β: <span className="font-semibold">{analysis.diagnostics.homeDefense.toFixed(3)}</span>
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{awayLabel} (Away)</p>
                <p className="text-slate-500 dark:text-slate-400 tabular-nums">
                  Sample: {analysis.diagnostics.awaySampleMatches} matches
                </p>
              </div>
              <div className="text-right font-mono tabular-nums space-y-0.5">
                <p className="text-slate-800 dark:text-slate-200">
                  Attack α: <span className="font-semibold">{analysis.diagnostics.awayAttack.toFixed(3)}</span>
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Defense β: <span className="font-semibold">{analysis.diagnostics.awayDefense.toFixed(3)}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
