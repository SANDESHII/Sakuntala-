import { useState, useEffect, FC, useRef, lazy, Suspense, useCallback } from 'react';
import { AlertCircle, Moon, Sun } from 'lucide-react';
import { AnalysisResult, BacktestSummary } from './types';
import { Header, AppTab } from './components/Header';
import { AnalysisForm } from './components/AnalysisForm';
import { ResultGrid } from './components/ResultDisplay';

const BacktestDisplay = lazy(() =>
  import('./components/BacktestDisplay').then((m) => ({ default: m.BacktestDisplay }))
);
const LeagueRatingsView = lazy(() =>
  import('./components/LeagueRatingsView').then((m) => ({ default: m.LeagueRatingsView }))
);
const MethodologyView = lazy(() =>
  import('./components/MethodologyView').then((m) => ({ default: m.MethodologyView }))
);

const TAB_TITLES: Record<AppTab, { kicker: string; title: string }> = {
  terminal: {
    kicker: 'Dixon-Coles Bivariate Poisson · Over/Under 2.5 & Multi-Market Pricing',
    title: 'Match Analysis',
  },
  ratings: {
    kicker: 'Maximum Likelihood Estimation · Attack & Defense Multipliers',
    title: 'League Power Ratings',
  },
  backtest: {
    kicker: 'Walk-Forward Causal Audit · 2022–2026 European Seasons',
    title: 'Historical Audit',
  },
  methodology: {
    kicker: 'Quantitative Architecture · Risk Sizing & Feed Status',
    title: 'Model Methodology',
  },
};

export const App: FC = () => {
  const [inputs, setInputs] = useState({
    home: 'ARSENAL',
    away: 'MAN_CITY',
    league: 'EPL',
    kickoff: '',
    asOfDate: '',
  });
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AppTab>('terminal');
  const [backtestSummary, setBacktestSummary] = useState<BacktestSummary | null>(null);
  const [loadingBacktest, setLoadingBacktest] = useState(false);
  const [backtestError, setBacktestError] = useState<string | null>(null);

  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('alpha_terminal_theme');
      if (saved === 'light') return false;
    } catch {
      // Ignore storage errors
    }
    return true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem('alpha_terminal_theme', isDark ? 'dark' : 'light');
    } catch {
      // Ignore storage errors
    }
  }, [isDark]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleAnalyze = useCallback(
    async (overrideHome?: string, overrideAway?: string, overrideKickoff?: string) => {
      const targetHome = (overrideHome ?? inputs.home).toUpperCase().trim();
      const targetAway = (overrideAway ?? inputs.away).toUpperCase().trim();
      const targetKickoff = overrideKickoff ?? inputs.kickoff;

      if (loadingAnalysis || !targetHome || !targetAway || targetHome === targetAway) return;

      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      setError(null);
      setLoadingAnalysis(true);

      try {
        const response = await fetch('/api/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortControllerRef.current.signal,
          body: JSON.stringify({
            homeTeam: targetHome,
            awayTeam: targetAway,
            league: inputs.league,
            asOfDate: inputs.asOfDate || undefined,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Analysis failed');
        }

        const result: AnalysisResult = await response.json();
        setAnalysis({ ...result, kickoff: targetKickoff || inputs.asOfDate || 'Scheduled' });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Analysis failed');
      } finally {
        setLoadingAnalysis(false);
      }
    },
    [inputs, loadingAnalysis]
  );

  const loadBacktest = useCallback(
    async (forceRefresh = false) => {
      if (!forceRefresh && backtestSummary) return;

      setLoadingBacktest(true);
      setBacktestError(null);
      try {
        const response = await fetch(forceRefresh ? '/api/backtest?refresh=1' : '/api/backtest');
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Backtest request failed');
        }

        const summary: BacktestSummary = await response.json();
        setBacktestSummary(summary);

        if (summary && summary.dataLineage?.matchesEvaluated > 0) {
          const today = new Date().toISOString().split('T')[0];
          try {
            sessionStorage.setItem(
              `alpha_terminal_backtest_${today}`,
              JSON.stringify({ summary, ts: Date.now() })
            );
          } catch {
            // Ignore storage quota errors
          }
        }
      } catch (err: unknown) {
        setBacktestError(err instanceof Error ? err.message : 'Historical audit failed to load');
      } finally {
        setLoadingBacktest(false);
      }
    },
    [backtestSummary]
  );

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const cached = sessionStorage.getItem(`alpha_terminal_backtest_${today}`);
    if (!cached) return;
    try {
      const { summary, ts } = JSON.parse(cached);
      if (
        summary &&
        'marketBrier' in summary &&
        'verdict' in summary &&
        Date.now() - ts < 12 * 60 * 60 * 1000
      ) {
        setBacktestSummary(summary);
      }
    } catch {
      sessionStorage.removeItem(`alpha_terminal_backtest_${today}`);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'backtest' && !backtestSummary && !loadingBacktest && !backtestError) {
      loadBacktest();
    }
  }, [activeTab, backtestSummary, loadingBacktest, backtestError, loadBacktest]);

  const handlePickTeamFromRatings = (side: 'home' | 'away', teamId: string, league: string) => {
    setInputs((prev) => ({
      ...prev,
      league,
      [side]: teamId,
    }));
    setActiveTab('terminal');
  };

  const handleHeaderPrimaryAction = () => {
    if (activeTab !== 'terminal') {
      setActiveTab('terminal');
      return;
    }
    if (inputs.home.trim() && inputs.away.trim() && inputs.home.trim() !== inputs.away.trim()) {
      handleAnalyze();
    } else {
      setInputs((prev) => ({ ...prev, home: 'ARSENAL', away: 'MAN_CITY', league: 'EPL' }));
      handleAnalyze('ARSENAL', 'MAN_CITY');
    }
  };

  const pageHeader = TAB_TITLES[activeTab];

  return (
    <div id="top" className="min-h-screen bg-slate-50 dark:bg-[#0a0c10] text-slate-900 dark:text-slate-200 font-sans antialiased flex flex-col">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onPrimaryAction={handleHeaderPrimaryAction}
        primaryActionLabel={activeTab === 'terminal' ? 'Run Analysis' : 'Match Terminal'}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-10 space-y-8">
        <div className="pb-6 border-b border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {pageHeader.kicker}
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-950 dark:text-slate-50 tracking-tight">
              {pageHeader.title}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setIsDark((prev) => !prev)}
            className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/70 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
            {isDark ? 'Light Theme' : 'Dark Theme'}
          </button>
        </div>

        {activeTab === 'terminal' && (
          <div className="space-y-8">
            <AnalysisForm
              home={inputs.home}
              setHome={(v) => setInputs((prev) => ({ ...prev, home: v }))}
              away={inputs.away}
              setAway={(v) => setInputs((prev) => ({ ...prev, away: v }))}
              league={inputs.league}
              setLeague={(v) => setInputs((prev) => ({ ...prev, league: v }))}
              kickoff={inputs.kickoff}
              setKickoff={(v) => setInputs((prev) => ({ ...prev, kickoff: v }))}
              asOfDate={inputs.asOfDate}
              setAsOfDate={(v) => setInputs((prev) => ({ ...prev, asOfDate: v }))}
              onAnalyze={handleAnalyze}
              loading={loadingAnalysis}
            />

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-700 dark:text-red-300">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500 dark:text-red-400" />
                <div className="flex-1 space-y-0.5">
                  <p className="text-sm font-semibold text-red-900 dark:text-red-200">Prediction Error</p>
                  <p className="text-xs text-red-700 dark:text-red-300/80">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-xs font-medium text-red-700 dark:text-red-300 hover:underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {loadingAnalysis && (
              <div className="space-y-4" aria-busy="true" aria-label="Calculating match probabilities">
                <div className="h-32 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 animate-pulse" />
                  ))}
                </div>
              </div>
            )}

            {!loadingAnalysis && !analysis && !error && (
              <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="space-y-1.5">
                  <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">
                    Ready to Price a Match
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl">
                    Select any competition and two clubs above—or click a featured matchup—to run Dixon-Coles bivariate Poisson estimation, exact score matrices, 1X2 & BTTS fair odds, and fractional Kelly edge sizing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAnalyze('ARSENAL', 'MAN_CITY')}
                  className="px-4 py-2.5 min-h-[42px] rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Run Featured Match (Arsenal vs Man City)
                </button>
              </div>
            )}

            {!loadingAnalysis && analysis && <ResultGrid analysis={analysis} />}
          </div>
        )}

        {activeTab === 'ratings' && (
          <Suspense
            fallback={
              <div className="h-64 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 animate-pulse" />
            }
          >
            <LeagueRatingsView
              selectedLeague={inputs.league}
              onSelectLeague={(l) => setInputs((prev) => ({ ...prev, league: l }))}
              onPickTeam={handlePickTeamFromRatings}
            />
          </Suspense>
        )}

        {activeTab === 'backtest' && (
          <Suspense
            fallback={
              <div className="h-64 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 animate-pulse" />
            }
          >
            <BacktestDisplay
              summary={backtestSummary}
              loading={loadingBacktest}
              error={backtestError}
              onRefresh={() => loadBacktest(true)}
            />
          </Suspense>
        )}

        {activeTab === 'methodology' && (
          <Suspense
            fallback={
              <div className="h-64 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 animate-pulse" />
            }
          >
            <MethodologyView />
          </Suspense>
        )}
      </main>

      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span>&copy; {new Date().getFullYear()} Alpha Terminal</span>
        <span>Dixon-Coles Poisson · Over/Under 2.5 · Walk-Forward Audit</span>
      </footer>
    </div>
  );
};
