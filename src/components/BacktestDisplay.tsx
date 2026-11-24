import { FC, useMemo, useState } from 'react';
import { RefreshCw, Search, AlertTriangle, CheckCircle2, HelpCircle, XCircle, Download } from 'lucide-react';
import { BacktestSummary, EquityCurvePoint } from '../types';

interface BacktestDisplayProps {
  summary: BacktestSummary | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const EquityCurveChart: FC<{ points: EquityCurvePoint[]; totalPnl: number; maxDrawdown: number }> = ({
  points,
  totalPnl,
  maxDrawdown,
}) => {
  if (!points || points.length < 2) return null;

  const width = 900;
  const height = 220;
  const padX = 44;
  const padY = 24;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const pnls = points.map((p) => p.cumPnl);
  const minVal = Math.min(0, ...pnls);
  const maxVal = Math.max(0.5, ...pnls);
  const span = maxVal - minVal || 1;

  const toX = (idx: number) => padX + (idx / Math.max(points.length - 1, 1)) * plotW;
  const toY = (val: number) => padY + ((maxVal - val) / span) * plotH;

  const zeroY = toY(0);
  const linePath = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(idx).toFixed(1)} ${toY(p.cumPnl).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${toX(points.length - 1).toFixed(1)} ${zeroY.toFixed(1)} L ${toX(0).toFixed(1)} ${zeroY.toFixed(1)} Z`;

  const isPositive = totalPnl >= 0;
  const strokeColor = isPositive ? '#10b981' : '#ef4444';

  return (
    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
            Cumulative Realized PnL Curve
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Chronological fractional-Kelly equity trajectory across placed walk-forward wagers
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
          <span className={isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
            Net: {totalPnl > 0 ? '+' : ''}{totalPnl.toFixed(2)}u
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            Max Drawdown: -{maxDrawdown.toFixed(2)}u
          </span>
        </div>
      </div>

      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-52 overflow-visible"
          role="img"
          aria-label="Cumulative PnL equity curve"
        >
          <line
            x1={padX}
            y1={zeroY}
            x2={width - padX}
            y2={zeroY}
            stroke="currentColor"
            className="text-slate-300 dark:text-slate-700"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <text
            x={padX - 8}
            y={zeroY + 4}
            textAnchor="end"
            className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
          >
            0u
          </text>
          <text
            x={padX - 8}
            y={padY + 4}
            textAnchor="end"
            className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
          >
            {maxVal.toFixed(1)}u
          </text>
          <text
            x={padX - 8}
            y={height - padY}
            textAnchor="end"
            className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
          >
            {minVal.toFixed(1)}u
          </text>

          <path d={areaPath} fill={strokeColor} fillOpacity="0.10" />
          <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums pt-1 border-t border-slate-100 dark:border-slate-800/60">
        <span>Start: {points[0].date}</span>
        <span>{points[points.length - 1].index} placed bets</span>
        <span>End: {points[points.length - 1].date}</span>
      </div>
    </div>
  );
};

export const BacktestDisplay: FC<BacktestDisplayProps> = ({
  summary,
  loading,
  error,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [pickFilter, setPickFilter] = useState<'ALL' | 'OVER_25' | 'UNDER_25' | 'NO_BET'>('ALL');
  const [leagueFilter, setLeagueFilter] = useState<string>('ALL');

  const availableLeagues = useMemo(() => {
    if (!summary?.dataLineage?.leagues) return [];
    return summary.dataLineage.leagues;
  }, [summary]);

  const filteredMatches = useMemo(() => {
    if (!summary?.matches) return [];
    const q = search.trim().toUpperCase();
    return summary.matches.filter((row) => {
      if (pickFilter !== 'ALL' && row.prediction.predictionType !== pickFilter) return false;
      if (leagueFilter !== 'ALL' && row.match.league !== leagueFilter) return false;
      if (!q) return true;
      return (
        row.match.homeTeam.toUpperCase().includes(q) ||
        row.match.awayTeam.toUpperCase().includes(q) ||
        row.match.league.toUpperCase().includes(q)
      );
    });
  }, [summary, search, pickFilter, leagueFilter]);

  const handleExportCsv = () => {
    if (!summary?.matches?.length) return;
    const headers = ['Date', 'League', 'Home', 'Away', 'Score', 'Pick', 'ModelProb', 'ModelSource', 'TakenOdds', 'ClosingOdds', 'CLV_Pct', 'Stake_Pct', 'PnL_Units'];
    const rows = filteredMatches.map((m) => [
      m.date || '',
      m.match.league,
      m.match.homeTeam,
      m.match.awayTeam,
      `${m.match.actualScore[0]}-${m.match.actualScore[1]}`,
      m.prediction.predictionType,
      (m.prediction.rawProbability * 100).toFixed(2),
      m.modelSource || '',
      m.takenOdds ? m.takenOdds.toFixed(2) : '',
      m.closingOdds ? m.closingOdds.toFixed(2) : '',
      m.clv !== null ? m.clv.toFixed(2) : '',
      m.stake.toFixed(2),
      m.pnl.toFixed(3),
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alpha_terminal_backtest_ledger.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !summary) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Running walk-forward backtest">
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">
              Running Walk-Forward Historical Audit...
            </h2>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">football-data.co.uk</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Downloading seasonal CSV files (2223–2526 across EPL, La Liga, Bundesliga, Serie A, and Ligue 1) and fitting Dixon-Coles MLE strictly prior to each matchday. Cold runs take ~60–120 seconds.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 animate-pulse" />
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-red-900 dark:text-red-200">Historical Audit Failed</h2>
            <p className="text-xs text-red-700 dark:text-red-300/80">{error}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-500 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Audit
        </button>
      </div>
    );
  }

  if (!summary) return null;

  const verdictStatus = summary.verdict?.status || 'INCONCLUSIVE';
  const verdictStyle =
    verdictStatus === 'PROMISING'
      ? {
          border: 'border-emerald-500/40 bg-emerald-500/10',
          text: 'text-emerald-700 dark:text-emerald-400',
          label: 'Promising Edge',
          Icon: CheckCircle2,
        }
      : verdictStatus === 'NO_EDGE'
      ? {
          border: 'border-red-500/40 bg-red-500/10',
          text: 'text-red-700 dark:text-red-400',
          label: 'No Edge vs Market',
          Icon: XCircle,
        }
      : {
          border: 'border-amber-500/40 bg-amber-500/10',
          text: 'text-amber-700 dark:text-amber-400',
          label: 'Inconclusive',
          Icon: HelpCircle,
        };

  const brierDiff = summary.brierVsMarket;
  const beatsMarket = brierDiff !== null && brierDiff < 0;

  return (
    <div className="space-y-8 page-transition">
      {/* Verdict & Data Lineage Banner */}
      <div className={`border rounded-2xl p-6 space-y-4 ${verdictStyle.border}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <verdictStyle.Icon className={`w-5 h-5 ${verdictStyle.text}`} />
              <span className={`text-sm font-bold ${verdictStyle.text}`}>
                Audit Verdict: {verdictStyle.label} ({verdictStatus})
              </span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 tabular-nums">
              Source: {summary.dataLineage.source} · Seasons {summary.dataLineage.seasons.join(', ')} ·{' '}
              {summary.dataLineage.leagues.length} leagues · {summary.dataLineage.matchesDownloaded.toLocaleString()} matches downloaded ·{' '}
              {summary.dataLineage.matchesEvaluated.toLocaleString()} evaluated ({summary.totalMatches.toLocaleString()} bets placed)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!filteredMatches.length}
              className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/80 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/80 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Refreshing...' : 'Re-run Audit'}
            </button>
          </div>
        </div>

        {summary.verdict?.failingConditions && summary.verdict.failingConditions.length > 0 && (
          <div className="pt-3 border-t border-slate-300/60 dark:border-white/10">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Failing Edge Gates:</p>
            <ul className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-mono text-slate-700 dark:text-slate-300 tabular-nums">
              {summary.verdict.failingConditions.map((cond) => (
                <li key={cond}>• {cond}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 4-Column Benchmark Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Model Brier vs Market Close</p>
          <p className="text-2xl font-mono font-bold text-slate-950 dark:text-slate-50 tabular-nums">
            {summary.brierScore.toFixed(4)}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
              {' '}vs {summary.marketBrier !== null ? summary.marketBrier.toFixed(4) : '--'}
            </span>
          </p>
          <p className={`text-xs font-mono tabular-nums ${beatsMarket ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {brierDiff !== null
              ? `${brierDiff > 0 ? '+' : ''}${brierDiff.toFixed(5)} (${beatsMarket ? 'beats market' : 'trails market'})`
              : 'Market Brier unavailable'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Average CLV (vs Closing Line)</p>
          <p
            className={`text-2xl font-mono font-bold tabular-nums ${
              summary.avgClv > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {summary.avgClv > 0 ? '+' : ''}
            {summary.avgClv.toFixed(2)}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {summary.clvStats
              ? `95% CI [${summary.clvStats.ci95Low.toFixed(2)}%, ${summary.clvStats.ci95High.toFixed(2)}%] · No-vig ${summary.avgClvNoVig.toFixed(2)}%`
              : `Coverage: ${summary.clvCoverage.toFixed(0)}%`}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Yield (ROI) & Drawdown</p>
          <p
            className={`text-2xl font-mono font-bold tabular-nums ${
              summary.totalYield > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {summary.totalYield > 0 ? '+' : ''}
            {summary.totalYield.toFixed(2)}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            95% CI [{summary.roi95CI.low.toFixed(2)}%, {summary.roi95CI.high.toFixed(2)}%] · PnL {summary.totalPnl > 0 ? '+' : ''}{summary.totalPnl}u · MaxDD {summary.maxDrawdown.toFixed(1)}u
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Fit Integrity & Hit Rates</p>
          <p className="text-2xl font-mono font-bold text-slate-950 dark:text-slate-50 tabular-nums">
            {summary.modelBreakdown.mleFitted.toLocaleString()} MLE
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
              {' '}/ {summary.modelBreakdown.heuristicFallback} fallback
            </span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            D4 mismatches: {summary.modelBreakdown.d4Mismatches} · O2.5 {summary.over25Accuracy.toFixed(1)}% · U2.5 {summary.under25Accuracy.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Equity Curve */}
      {summary.equityCurve && summary.equityCurve.length > 1 && (
        <EquityCurveChart
          points={summary.equityCurve}
          totalPnl={summary.totalPnl}
          maxDrawdown={summary.maxDrawdown}
        />
      )}

      {/* League Breakdown & Edge Segments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {summary.leagueBreakdown && summary.leagueBreakdown.length > 0 && (
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">Performance by Competition</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {summary.leagueBreakdown.length} leagues
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <th className="px-5 py-3">League</th>
                    <th className="px-4 py-3 text-right">Bets</th>
                    <th className="px-4 py-3 text-right">Brier</th>
                    <th className="px-4 py-3 text-right">Avg CLV</th>
                    <th className="px-5 py-3 text-right">Yield</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                  {summary.leagueBreakdown.map((lb) => (
                    <tr key={lb.league} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{lb.league}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                        {lb.bets.toLocaleString()} / {lb.evaluated.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-200 tabular-nums">
                        {lb.brier.toFixed(4)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono tabular-nums ${
                          lb.avgClv > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {lb.avgClv > 0 ? '+' : ''}{lb.avgClv.toFixed(2)}%
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-mono tabular-nums ${
                          lb.yieldPct > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {lb.yieldPct > 0 ? '+' : ''}{lb.yieldPct.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">Performance by Edge Segment</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              CLV coverage: {summary.clvCoverage.toFixed(1)}%
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="px-5 py-3">Edge Segment</th>
                  <th className="px-4 py-3 text-right">Bets</th>
                  <th className="px-4 py-3 text-right">Hit Rate</th>
                  <th className="px-4 py-3 text-right">Avg Edge</th>
                  <th className="px-5 py-3 text-right">Closing CLV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {summary.edgeSegments.map((seg) => (
                  <tr key={seg.segment} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{seg.segment}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                      {seg.count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                      {(seg.hitRate * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                      {seg.avgEdge.toFixed(2)}%
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-mono tabular-nums ${
                        seg.avgClv > 0 ? 'text-emerald-600 dark:text-emerald-400' : seg.avgClv < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {seg.avgClv > 0 ? '+' : ''}
                      {seg.avgClv.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Evaluated Fixtures Sample Ledger */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">Evaluated Fixtures Ledger</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
              Showing {filteredMatches.length} of {summary.matches.length} recent evaluated matches
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter team or league..."
                aria-label="Filter evaluated fixtures"
                className="pl-8 pr-3 py-1.5 min-h-[36px] rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {availableLeagues.length > 1 && (
              <select
                value={leagueFilter}
                onChange={(e) => setLeagueFilter(e.target.value)}
                aria-label="Filter by competition"
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">All Leagues</option>
                {availableLeagues.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            )}

            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
              {(['ALL', 'OVER_25', 'UNDER_25', 'NO_BET'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPickFilter(type)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                    pickFilter === type
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {type === 'ALL' ? 'All' : type}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredMatches.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No evaluated fixtures match the active filter.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-4 py-3">Match</th>
                  <th className="px-4 py-3">League</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3">Pick</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3 text-right">Open / Close</th>
                  <th className="px-4 py-3 text-right">CLV</th>
                  <th className="px-5 py-3 text-right">PnL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {filteredMatches.map((row, idx) => (
                  <tr
                    key={`${row.match.league}-${row.match.homeTeam}-${row.match.awayTeam}-${idx}`}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-5 py-2.5 font-mono text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                      {row.date || '--'}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {row.match.homeTeam} vs {row.match.awayTeam}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{row.match.league}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                      {row.match.actualScore[0]}–{row.match.actualScore[1]}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {row.prediction.predictionType}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {row.modelSource === 'MLE_FITTED' ? 'MLE' : 'Fallback'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                      {row.takenOdds ? row.takenOdds.toFixed(2) : '--'} /{' '}
                      {row.closingOdds ? row.closingOdds.toFixed(2) : '--'}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono tabular-nums ${
                        row.clv === null
                          ? 'text-slate-400 dark:text-slate-500'
                          : row.clv > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {row.clv === null ? '--' : `${row.clv > 0 ? '+' : ''}${row.clv.toFixed(2)}%`}
                    </td>
                    <td
                      className={`px-5 py-2.5 text-right font-mono tabular-nums ${
                        row.pnl > 0 ? 'text-emerald-600 dark:text-emerald-400' : row.pnl < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {row.pnl === 0 ? '0.00' : `${row.pnl > 0 ? '+' : ''}${row.pnl.toFixed(2)}u`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {summary.error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-700 dark:text-red-300">
          Warning: {summary.error}
        </div>
      )}
    </div>
  );
};
