import { useState, useEffect, FC, useRef, lazy, Suspense, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import { AnalysisResult, BacktestSummary } from './types';
import { Header } from './components/Header';
import { AnalysisForm } from './components/AnalysisForm';
import { ResultGrid } from './components/ResultDisplay';

const BacktestDisplay = lazy(() =>
  import('./components/BacktestDisplay').then((m) => ({ default: m.BacktestDisplay }))
);

export const App: FC = () => {
  const [inputs, setInputs] = useState({
    home: '',
    away: '',
    league: 'EPL',
    kickoff: '',
  });
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'terminal' | 'backtest'>('terminal');
  const [backtestSummary, setBacktestSummary] = useState<BacktestSummary | null>(null);
  const [loadingBacktest, setLoadingBacktest] = useState(false);
  const [backtestError, setBacktestError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleAnalyze = useCallback(async () => {
    if (loadingAnalysis || !inputs.home.trim() || !inputs.away.trim()) return;

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
          homeTeam: inputs.home.toUpperCase().trim(),
          awayTeam: inputs.away.toUpperCase().trim(),
          league: inputs.league,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Analysis failed');
      }

      const result: AnalysisResult = await response.json();
      setAnalysis({ ...result, kickoff: inputs.kickoff });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoadingAnalysis(false);
    }
  }, [inputs, loadingAnalysis]);

  const loadBacktest = useCallback(async (forceRefresh = false) => {
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
  }, [backtestSummary]);

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

  return (
    <div id="top" className="min-h-screen bg-[#0a0c10] text-slate-200 font-sans antialiased flex flex-col">
      <Header activeTab={activeTab} onSelectTab={setActiveTab} />

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-10 space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div className="space-y-1.5">
            <p className="text-xs text-slate-400">
              Dixon-Coles MLE · Over/Under 2.5 Goals
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-50 tracking-tight">
              {activeTab === 'terminal' ? 'Match Analysis' : 'Historical Audit'}
            </h1>
          </div>

          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('terminal')}
              className={`px-4 py-1.5 min-h-[36px] rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'terminal'
                  ? 'bg-slate-800 text-slate-50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Analysis
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('backtest')}
              className={`px-4 py-1.5 min-h-[36px] rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'backtest'
                  ? 'bg-slate-800 text-slate-50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Historical Audit
            </button>
          </div>
        </div>

        {activeTab === 'terminal' ? (
          <div className="space-y-10">
            <AnalysisForm
              home={inputs.home}
              setHome={(v) => setInputs((prev) => ({ ...prev, home: v }))}
              away={inputs.away}
              setAway={(v) => setInputs((prev) => ({ ...prev, away: v }))}
              league={inputs.league}
              setLeague={(v) => setInputs((prev) => ({ ...prev, league: v }))}
              kickoff={inputs.kickoff}
              setKickoff={(v) => setInputs((prev) => ({ ...prev, kickoff: v }))}
              onAnalyze={handleAnalyze}
              loading={loadingAnalysis}
            />

            {error && (
              <div className="max-w-5xl mx-auto p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-300">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
                <div className="flex-1 space-y-0.5">
                  <p className="text-sm font-semibold text-red-200">Prediction Error</p>
                  <p className="text-xs text-red-300/80">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-xs font-medium text-red-300 hover:text-white cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {loadingAnalysis && (
              <div className="max-w-5xl mx-auto space-y-4" aria-busy="true" aria-label="Calculating match probabilities">
                <div className="h-32 rounded-2xl bg-slate-900/50 border border-slate-800 animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 rounded-xl bg-slate-900/50 border border-slate-800 animate-pulse" />
                  ))}
                </div>
              </div>
            )}

            {!loadingAnalysis && analysis && <ResultGrid analysis={analysis} />}
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="h-48 rounded-2xl bg-slate-900/50 border border-slate-800 animate-pulse" />
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
      </main>

      <footer className="w-full max-w-6xl mx-auto px-6 py-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <span>&copy; {new Date().getFullYear()} Alpha Terminal</span>
        <span>Dixon-Coles Poisson · Over/Under 2.5</span>
      </footer>
    </div>
  );
};
