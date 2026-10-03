import { useState, useEffect, FC } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, LayoutDashboard, History } from 'lucide-react';
import { AnalysisResult, BacktestSummary, ArenaConfig } from './types';
import { Header } from './components/Header';
import { LoadingOverlay } from './components/LoadingOverlay';
import { AnalysisForm } from './components/AnalysisForm';
import { ResultGrid } from './components/ResultDisplay';
import { GroundingLog } from './components/GroundingLog';
import { BacktestDisplay } from './components/BacktestDisplay';

export const App: FC = () => {
    const [inputs, setInputs] = useState({ home: '', away: '', league: 'EPL' });
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'terminal' | 'backtest'>('terminal');
    const [backtestSummary, setBacktestSummary] = useState<BacktestSummary | null>(null);
    const [arenaConfig, setArenaConfig] = useState<ArenaConfig>({ enableArena: false, cardCount: 12 });

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
                    league: inputs.league,
                    adaptiveThresholdContext: backtestSummary?.edgeSegments,
                    arenaConfig: arenaConfig
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
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">Proprietary Dixon-Coles Engine</span>
                            {backtestSummary && (
                                <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-[8px] font-black text-purple-500 uppercase tracking-widest">Adaptive V2</span>
                            )}
                        </motion.div>
                        <h2 className="text-6xl md:text-8xl font-black tracking-tighter text-white leading-none uppercase">
                            Terminal<span className="text-emerald-500">_</span>
                        </h2>
                    </div>
                    <nav className="flex items-center p-1.5 bg-neutral-900/50 border border-neutral-800/50 backdrop-blur-md rounded-2xl">
                        {[
                            { id: 'terminal', label: 'Analysis', icon: LayoutDashboard },
                            { id: 'backtest', label: 'Historical Audit', icon: History }
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id as 'terminal' | 'backtest')}
                                className={`flex items-center gap-3 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-black shadow-2xl' : 'text-neutral-500 hover:text-neutral-300'}`}>
                                <tab.icon className="w-3.5 h-3.5" />{tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'terminal' ? (
                        <motion.div key="terminal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="space-y-16">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                                <div className="lg:col-span-7 space-y-12">
                                    <AnalysisForm
                                        home={inputs.home} setHome={(v) => setInputs(prev => ({ ...prev, home: v }))}
                                        away={inputs.away} setAway={(v) => setInputs(prev => ({ ...prev, away: v }))}
                                        league={inputs.league} setLeague={(v) => setInputs(prev => ({ ...prev, league: v }))}
                                        onAnalyze={handleAnalyze} loading={loadingAnalysis} />
                                    {error && (
                                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                                            className="p-5 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-start gap-4 text-red-400">
                                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                            <div className="flex-1 space-y-1">
                                                <p className="text-sm font-bold uppercase tracking-wide">Error</p>
                                                <p className="text-xs font-medium opacity-80 leading-relaxed">{error}</p>
                                            </div>
                                            <button onClick={() => setError(null)} className="text-[10px] font-black uppercase hover:text-white transition-colors ml-auto">Dismiss</button>
                                        </motion.div>
                                    )}
                                </div>
                                <div className="lg:col-span-5 space-y-8">
                                    {/* Arena Toggle */}
                                    <div className="p-8 bg-neutral-900/30 border border-neutral-800 rounded-[32px] space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-2xl ${arenaConfig.enableArena ? 'bg-emerald-500/10 text-emerald-500' : 'bg-neutral-800 text-neutral-500'}`}>
                                                    <LayoutDashboard className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Arena Mode</h3>
                                                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-tight">Multi-Strategy Consensus</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => setArenaConfig(prev => ({ ...prev, enableArena: !prev.enableArena }))}
                                                className={`w-12 h-6 rounded-full relative transition-colors ${arenaConfig.enableArena ? 'bg-emerald-500' : 'bg-neutral-800'}`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${arenaConfig.enableArena ? 'left-7' : 'left-1'}`} />
                                            </button>
                                        </div>

                                        {arenaConfig.enableArena && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-6 border-t border-neutral-800 space-y-4 overflow-hidden">
                                                <div className="flex justify-between items-center text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                                                    <span>Parallel Strategies</span>
                                                    <span className="text-white">{arenaConfig.cardCount} Cards</span>
                                                </div>
                                                <input 
                                                    type="range" min="4" max="24" step="4"
                                                    value={arenaConfig.cardCount}
                                                    onChange={(e) => setArenaConfig(prev => ({ ...prev, cardCount: Number(e.target.value) }))}
                                                    className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                                />
                                                <p className="text-[10px] text-neutral-500 font-medium leading-relaxed">
                                                    Runs multiple Dixon-Coles instances with unique reasoning/workflow cards to find true consensus.
                                                </p>
                                            </motion.div>
                                        )}
                                    </div>

                                    {!analysis && !loadingAnalysis && (
                                        <div className="p-12 text-center space-y-4 border-2 border-dashed border-neutral-900 rounded-[40px]">
                                            <LayoutDashboard className="w-12 h-12 text-neutral-800 mx-auto" />
                                            <p className="text-xs font-bold text-neutral-600 uppercase tracking-[0.2em]">Enter teams to analyze</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {analysis && !loadingAnalysis && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-24">
                                    <ResultGrid analysis={analysis} />
                                    <GroundingLog analysis={analysis} />
                                </motion.div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div key="backtest" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                            {backtestSummary ? <BacktestDisplay summary={backtestSummary} /> : (
                                <div className="p-24 text-center"><p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest animate-pulse">Initializing historical audit...</p></div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
            <footer className="max-w-7xl mx-auto px-6 py-24 border-t border-neutral-900 text-[10px] text-neutral-600 font-black tracking-[0.2em] uppercase text-center md:text-left">
                &copy; 2025 ALPHA TERMINAL
            </footer>
            </div>
        </div>
    );
};
