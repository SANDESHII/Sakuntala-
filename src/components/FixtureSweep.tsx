
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Search, Play, AlertCircle, ChevronRight } from 'lucide-react';
import { fetchWithTimeout } from '../utils';
import { AnalysisResult, Fixture } from '../types';
import { ELITE_LEAGUES } from '../core/constants';

export const FixtureSweep: React.FC<{ league: string; setLeague: (l: string) => void; onSelectMatch: (analysis: AnalysisResult) => void }> = ({ league, setLeague, onSelectMatch }) => {
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [loading, setLoading] = useState(false);
    const [sweepStatus, setSweepStatus] = useState<string>('');

    const fetchFixtures = async () => {
        setLoading(true);
        setSweepStatus(`Identifying upcoming ${league} fixtures...`);
        try {
            const res = await fetchWithTimeout(`/api/fixtures?league=${league}`);
            const data = await res.json();
            setFixtures(data.map((f: any) => ({ ...f, status: 'IDLE' })));
        } catch (e) {
            console.error('Failed to discover fixtures');
        } finally {
            setLoading(false);
            setSweepStatus('');
        }
    };

    // Reset fixtures when league changes
    useEffect(() => {
        setFixtures([]);
    }, [league]);

    const runBatchAnalysis = async () => {
        const idle = fixtures.filter(f => f.status === 'IDLE' || f.status === 'FAILED');
        if (idle.length === 0) return;

        for (const fixture of idle) {
            setFixtures(prev => prev.map(f => f === fixture ? { ...f, status: 'PENDING' } : f));
            try {
                const res = await fetchWithTimeout('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        homeTeam: fixture.homeTeam,
                        awayTeam: fixture.awayTeam,
                        league: fixture.league,
                        kickoff: fixture.kickoff
                    })
                });
                if (!res.ok) throw new Error();
                const analysis = await res.json();
                setFixtures(prev => prev.map(f => f === fixture ? { ...f, status: 'COMPLETED', analysis } : f));
            } catch (e) {
                setFixtures(prev => prev.map(f => f === fixture ? { ...f, status: 'FAILED' } : f));
            }
            // Small delay to respect rate limits
            await new Promise(r => setTimeout(r, 2000));
        }
    };

    return (
        <div className="space-y-12">
            <div className="flex flex-wrap gap-3 pb-6 border-b border-neutral-900/50">
                {ELITE_LEAGUES.map(l => (
                    <button
                        key={l}
                        onClick={() => setLeague(l)}
                        className={`px-5 py-2 text-[10px] font-bold border transition-all rounded-full tracking-wider ${league === l ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-neutral-950 border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300'}`}
                    >
                        {l.replace('_', ' ')}
                    </button>
                ))}
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-white flex items-center gap-4">
                        <Calendar className="w-6 h-6 text-emerald-500" />
                        Global Fixture Sweep
                    </h3>
                    <p className="text-neutral-500 text-sm leading-relaxed max-w-lg">Automated stochastic audit for the next 7 days of elite action. Leveraging de-censored data for high-signal discovery.</p>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <button 
                        onClick={fetchFixtures}
                        disabled={loading}
                        className="flex-1 md:flex-none px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 border border-neutral-800 disabled:opacity-50 tracking-tight"
                    >
                        <Search className="w-4 h-4" />
                        DISCOVER SIGNAL
                    </button>
                    {fixtures.length > 0 && (
                        <button 
                            onClick={runBatchAnalysis}
                            className="flex-1 md:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 tracking-tight"
                        >
                            <Play className="w-4 h-4" />
                            EXECUTE BATCH
                        </button>
                    )}
                </div>
            </div>

            {sweepStatus && (
                <div className="flex items-center gap-3 text-emerald-500 text-xs font-medium animate-pulse">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                    {sweepStatus}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                    {fixtures.map((f, i) => (
                        <motion.div
                            key={`${f.homeTeam}-${f.awayTeam}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className={`p-6 rounded-2xl border transition-all duration-300 ${
                                f.status === 'PENDING' ? 'bg-neutral-900/50 border-emerald-500/40 shadow-lg shadow-emerald-500/5' : 
                                f.status === 'COMPLETED' ? 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/60' :
                                'bg-neutral-950 border-neutral-900'
                            }`}
                        >
                            <div className="flex justify-between items-center gap-8">
                                <div className="space-y-2 flex-1 min-w-0">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] text-neutral-600 font-mono tracking-tighter uppercase">
                                            {new Date(f.kickoff).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {f.status === 'COMPLETED' && (
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md tracking-widest uppercase ${
                                                f.analysis?.verdict === 'EXECUTE_BET' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-neutral-800/50 text-neutral-500 border border-neutral-800'
                                            }`}>
                                                {f.analysis?.predictionLabel}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="text-base font-black text-white truncate">{f.homeTeam}</div>
                                        <div className="text-[10px] text-neutral-800 font-black px-1">/</div>
                                        <div className="text-base font-black text-white text-right truncate">{f.awayTeam}</div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-3">
                                    {f.status === 'PENDING' ? (
                                        <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                                    ) : f.status === 'COMPLETED' ? (
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className="text-[9px] text-neutral-600 font-black uppercase tracking-widest">Signal</div>
                                                <div className="text-base font-black text-emerald-500">{(f.analysis!.probability * 100).toFixed(1)}%</div>
                                            </div>
                                            <button 
                                                onClick={() => onSelectMatch(f.analysis!)}
                                                className="p-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-neutral-500 hover:text-white transition-all border border-neutral-700/50"
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ) : f.status === 'FAILED' ? (
                                        <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                                            <AlertCircle className="w-5 h-5 text-red-500" />
                                        </div>
                                    ) : (
                                        <div className="w-2.5 h-2.5 bg-neutral-900 border border-neutral-800 rounded-full" />
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {fixtures.length === 0 && !loading && (
                <div className="py-20 border border-dashed border-neutral-900 rounded-2xl flex flex-col items-center gap-4 text-center">
                    <div className="p-4 bg-neutral-950 rounded-full border border-neutral-900">
                        <Calendar className="w-8 h-8 text-neutral-800" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-neutral-400 text-sm font-medium">No active fixtures discovered.</p>
                        <p className="text-neutral-600 text-[10px]">Run a discovery scan to identify the next 7 days of matches.</p>
                    </div>
                </div>
            )}
        </div>
    );
};
