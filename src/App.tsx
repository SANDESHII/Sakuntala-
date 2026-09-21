import { useState, useEffect, FC } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, LayoutDashboard, History } from 'lucide-react';
import { AnalysisResult, BacktestSummary } from './types';
import { Header } from './components/Header';
import { LoadingOverlay } from './components/LoadingOverlay';
import { AnalysisForm } from './components/AnalysisForm';
import { ResultGrid } from './components/ResultDisplay';
import { GroundingLog } from './components/GroundingLog';
import { BacktestDisplay } from './components/BacktestDisplay';

export const App: FC = () => {
    const [inputs, setInputs] = useState({ home: '', away: '', league: 'EPL', time: '' });
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
            const { runPrediction } = await import('./core/engine');
            const result = await runPrediction(inputs.home, inputs.away, inputs.league);
            setAnalysis(result);
        } catch (err: any) { 
            setError(err.message || 'ANALYSIS FAILED'); 
        } finally { 
            setLoadingAnalysis(false); 
        }
    };

    const loadBacktest = async () => {
        const { runBacktest } = await import('./core/engine');
        const summary = await runBacktest();
        setBacktestSummary(summary);
    };

    useEffect(() => {
        if (activeTab === 'backtest' && !backtestSummary) loadBacktest();
    }, [activeTab, backtestSummary]);

    return (
        <div className="min-h-screen bg-[#050505] text-neutral-400 font-sans antialiased selection:bg-emerald-500/20">
            <Header />
            <LoadingOverlay loading={loadingAnalysis} />
            <main className="max-w-7xl mx-auto px-6 pt-32 pb-24 space-y-12">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16">
                    <div className="space-y-1">
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.3em]">Football Prediction System</span>
                        </motion.div>
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-none uppercase">Alpha Terminal</h2>
                    </div>
                    <nav className="flex items-center p-1 bg-neutral-900 border border-neutral-800 rounded-xl">
                        {[
                            { id: 'terminal', label: 'Analysis', icon: LayoutDashboard },
                            { id: 'backtest', label: 'Backtest', icon: History }
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id as 'terminal' | 'backtest')}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}>
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
                                        time={inputs.time} setTime={(v) => setInputs(prev => ({ ...prev, time: v }))}
                                        onAnalyze={handleAnalyze} loading={loadingAnalysis} />
                                    {error && (
                                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                                            className="p-5 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-start gap-4 text-red-400">
                                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                            <div className="flex-1 space-y-1">
                                                <p className="text-sm font-bold uppercase tracking-wide">Error</p>
                                                <p className="text-xs font-medium opacity-80 leading-relaxed">{error}</p>
                                            </div>
                                            <button onClick={() => setError(null)} className="text-[10px] font-black uppercase hover:text-white transition-colors">Dismiss</button>
                                        </motion.div>
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
            <footer className="max-w-7xl mx-auto px-6 py-24 border-t border-neutral-900 text-[10px] text-neutral-600 font-black tracking-[0.2em] uppercase">
                <div className="flex flex-col md:flex-row justify-between items-center gap-12"><div className="flex items-center gap-4"><span>&copy; 2025 ALPHA TERMINAL</span></div></div>
            </footer>
        </div>
    );
};
