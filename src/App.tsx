import { useState, useEffect, FC } from 'react';
import { AlertCircle, LayoutDashboard, History } from 'lucide-react';
import { AnalysisResult, BacktestSummary } from './types';
import { Header } from './components/Header';
import { LoadingOverlay } from './components/LoadingOverlay';
import { AnalysisForm } from './components/AnalysisForm';
import { ResultGrid } from './components/ResultDisplay';
import { GroundingLog } from './components/GroundingLog';
import { lazy, Suspense } from 'react';

const BacktestDisplay = lazy(() => import('./components/BacktestDisplay').then(m => ({ default: m.BacktestDisplay })));

export const App: FC = () => {
    const [inputs, setInputs] = useState({ home: '', away: '', league: 'EPL' });
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'terminal' | 'backtest'>('terminal');
    const [backtestSummary, setBacktestSummary] = useState<BacktestSummary | null>(null);

    const handleAnalyze = async () => {
        if (loadingAnalysis || !inputs.home || !inputs.away) return;
        
        setError(null); 
        setLoadingAnalysis(true); 
        setAnalysis(null);

        try {
            const response = await fetch('/api/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    homeTeam: inputs.home.toUpperCase().trim(),
                    awayTeam: inputs.away.toUpperCase().trim(),
                    league: inputs.league
                })
            });
            
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'ANALYSIS FAILED');
            }
            
            const result = await response.json();
            setAnalysis(result);
        } catch (err: any) { 
            setError(err.message || 'ANALYSIS FAILED'); 
        } finally { 
            setLoadingAnalysis(false); 
        }
    };

    const loadBacktest = async (isManual = false) => {
        if (!isManual && backtestSummary) return;
        
        try {
            const response = await fetch('/api/backtest');
            if (!response.ok) throw new Error('BACKTEST FAILED');
            
            const summary = await response.json();
            setBacktestSummary(summary);
            
            if (summary && summary.totalMatches > 0) {
                const today = new Date().toISOString().split('T')[0];
                sessionStorage.setItem(`alpha_terminal_backtest_${today}`, JSON.stringify({
                    summary,
                    ts: Date.now()
                }));
            }
        } catch (err) {
            // Silently fail or use telemetry in production for background loads
        }
    };

    useEffect(() => {
        const initializeAdaptiveThresholding = async () => {
            const today = new Date().toISOString().split('T')[0];
            const cached = sessionStorage.getItem(`alpha_terminal_backtest_${today}`);
            if (cached) {
                const { summary, ts } = JSON.parse(cached);
                if (Date.now() - ts < 12 * 60 * 60 * 1000) {
                    setBacktestSummary(summary);
                    return;
                }
            }
            // Do NOT auto-load on mount if no cache. Let the user trigger it or wait for the tab.
        };
        initializeAdaptiveThresholding();
    }, []);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleAnalyze();
            if ((e.metaKey || e.ctrlKey) && e.key === 'b') setActiveTab('backtest');
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [inputs, loadingAnalysis, activeTab]);

    useEffect(() => {
        if (activeTab === 'backtest' && !backtestSummary) {
            loadBacktest();
        }
    }, [activeTab, backtestSummary]);

    return (
        <div className="min-h-screen bg-[#050505] text-neutral-400 font-sans antialiased selection:bg-emerald-500/20 relative">
            {/* Terminal Background Effects */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.02)_0%,transparent_50%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0.1)_1px,transparent_1px)] bg-[size:40px_40px]" />
                <div className="absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(5,5,5,0.4)_50%,transparent_100%)] animate-[scan_8s_linear_infinite]" />
            </div>

            <div className="relative z-10">
                <Header />
                <LoadingOverlay loading={loadingAnalysis} />
                <main className="max-w-7xl mx-auto px-6 pt-32 pb-24 space-y-12">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-24">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 transition-all duration-300">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">Proprietary Dixon-Coles Engine</span>
                        </div>
                        <h2 className="text-6xl md:text-8xl font-black tracking-tighter text-white leading-none uppercase">
                            Terminal<span className="text-emerald-500">_</span>
                        </h2>
                    </div>
                    <nav className="flex items-center p-1.5 bg-neutral-900/50 border border-neutral-800/50 backdrop-blur-md rounded-2xl w-full md:w-auto overflow-x-auto no-scrollbar">
                        {[
                            { id: 'terminal', label: 'Analysis', icon: LayoutDashboard },
                            { id: 'backtest', label: 'Historical Audit', icon: History }
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id as 'terminal' | 'backtest')}
                                className={`flex items-center justify-center gap-3 px-8 py-4 min-h-[44px] flex-1 md:flex-none rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-black shadow-2xl' : 'text-neutral-500 hover:text-neutral-300'}`}>
                                <tab.icon className="w-4 h-4" />{tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="transition-all duration-300 page-transition" key={activeTab}>
                    {activeTab === 'terminal' ? (
                        <div className="space-y-16 transition-all duration-300">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                                <div className="lg:col-span-7 space-y-12">
                                    <AnalysisForm
                                        home={inputs.home} setHome={(v) => setInputs(prev => ({ ...prev, home: v }))}
                                        away={inputs.away} setAway={(v) => setInputs(prev => ({ ...prev, away: v }))}
                                        league={inputs.league} setLeague={(v) => setInputs(prev => ({ ...prev, league: v }))}
                                        onAnalyze={handleAnalyze} loading={loadingAnalysis} />
                                    {error && (
                                        <div className="p-5 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-start gap-4 text-red-400 transition-all duration-300">
                                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                            <div className="flex-1 space-y-1">
                                                <p className="text-sm font-bold uppercase tracking-wide">Error</p>
                                                <p className="text-xs font-medium opacity-80 leading-relaxed">{error}</p>
                                            </div>
                                            <button onClick={() => setError(null)} className="text-[10px] font-black uppercase hover:text-white transition-colors ml-auto">Dismiss</button>
                                        </div>
                                    )}
                                </div>
                                <div className="lg:col-span-5 space-y-8">
                                    {!analysis && !loadingAnalysis && (
                                        <div className="p-12 text-center space-y-4 border-2 border-dashed border-neutral-900 rounded-[40px]">
                                            <LayoutDashboard className="w-12 h-12 text-neutral-800 mx-auto" />
                                            <p className="text-xs font-bold text-neutral-600 uppercase tracking-[0.2em]">Enter teams to analyze</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {analysis && !loadingAnalysis && (
                                <div className="space-y-24 transition-all duration-300 page-transition">
                                    <ResultGrid analysis={analysis} />
                                    <GroundingLog analysis={analysis} />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="transition-all duration-300">
                            <Suspense fallback={<div className="p-24 text-center"><p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest animate-pulse">Loading Audit Module...</p></div>}>
                                {backtestSummary ? <BacktestDisplay summary={backtestSummary} /> : (
                                    <div className="p-24 text-center"><p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest animate-pulse">Initializing historical audit...</p></div>
                                )}
                            </Suspense>
                        </div>
                    )}
                </div>
            </main>
            <footer className="max-w-7xl mx-auto px-6 py-24 border-t border-neutral-900 text-[10px] text-neutral-600 font-black tracking-[0.2em] uppercase text-center md:text-left">
                &copy; 2025 ALPHA TERMINAL
            </footer>
            </div>
        </div>
    );
};
