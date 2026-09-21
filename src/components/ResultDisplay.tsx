import { FC } from 'react';
import { Zap, Shield, Target, Activity, LucideIcon, Binary } from 'lucide-react';
import { AnalysisResult } from '../types';

interface ResultGridProps {
    analysis: AnalysisResult;
}

const StatCard: FC<{ label: string; value: string | number; subValue?: string; icon: LucideIcon }> = ({ label, value, subValue, icon: Icon }) => (
    <div className="bg-neutral-900/40 p-10 rounded-[32px] border border-neutral-800/50 flex flex-col justify-between space-y-10 hover:bg-neutral-900/60 transition-all group shadow-sm">
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.25em]">{label}</span>
            <div className="p-2 bg-neutral-800/50 rounded-xl group-hover:bg-emerald-500/10 transition-colors">
                <Icon className="w-4 h-4 text-neutral-600 group-hover:text-emerald-500 transition-colors" />
            </div>
        </div>
        <div className="space-y-3">
            <h4 className="text-6xl font-black text-white tracking-tighter tabular-nums leading-none">{value}</h4>
            <p className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] leading-none">{subValue}</p>
        </div>
    </div>
);

export const ResultGrid: FC<ResultGridProps> = ({ analysis }) => {
    return (
        <div className="space-y-24">
            {/* Header Status */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-12 pb-16 border-b border-neutral-900">
                <div className="space-y-8">
                    <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                            analysis.dataSource === 'LIVE' 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                            : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                        }`}>
                            {analysis.dataSource === 'LIVE' ? 'Live API Feed' : 'Historical Fallback'}
                        </span>
                        <span className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.4em]">Prediction Engine</span>
                    </div>
                    <h2 className="text-7xl md:text-8xl font-black text-white tracking-tighter leading-[0.8] uppercase max-w-2xl">
                        {analysis.predictionLabel}
                    </h2>
                </div>
                <div className="flex flex-col items-end gap-4">
                    <div className="text-right">
                        <span className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.3em] block mb-2">Probability</span>
                        <span className="text-9xl font-black text-white tracking-tighter leading-none">{analysis.probability}%</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                <div className="lg:col-span-8 space-y-20">
                    {/* Primary Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <StatCard label="Model Edge" value={`${analysis.edge > 0 ? '+' : ''}${analysis.edge}%`} subValue="vs Market" icon={Zap} />
                        <StatCard label="Stake" value={`${analysis.recommendedStake}%`} subValue="Kelly Criterion" icon={Shield} />
                        <StatCard label="Odds" value={analysis.marketOdds?.toFixed(2) || '0.00'} subValue="Market Price" icon={Target} />
                    </div>

                    {/* Team Deep Dive */}
                    <div className="bg-neutral-900/30 border border-neutral-800 rounded-[48px] p-12 lg:p-16">
                        <div className="flex items-center justify-between mb-16">
                            <div className="flex items-center gap-4">
                                <Binary className="w-5 h-5 text-emerald-500" />
                                <h3 className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.3em]">Team Statistics</h3>
                            </div>
                            <span className="text-[10px] font-bold text-neutral-700 uppercase tracking-widest">Dixon-Coles Model</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
                            {[
                                { team: analysis.homeStats, xG: analysis.homeXG, role: 'HOME' },
                                { team: analysis.awayStats, xG: analysis.awayXG, role: 'AWAY' }
                            ].map((item, idx) => (
                                <div key={idx} className="space-y-12">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/30" />
                                            <span className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">{item.role} SIDE</span>
                                        </div>
                                        <h4 className="text-4xl font-black text-white tracking-tighter uppercase">{item.team.name}</h4>
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-12 gap-x-8">
                                        <div className="space-y-3 p-6 bg-neutral-800/20 rounded-3xl border border-neutral-800/50">
                                            <span className="text-[10px] text-neutral-500 font-black uppercase tracking-widest block">Expected Goals</span>
                                            <p className="text-4xl font-black text-white tabular-nums tracking-tighter">{item.xG?.toFixed(2) || '0.00'}</p>
                                        </div>
                                        <div className="space-y-3 p-6 bg-neutral-800/20 rounded-3xl border border-neutral-800/50">
                                            <span className="text-[10px] text-neutral-500 font-black uppercase tracking-widest block">Defense</span>
                                            <p className="text-4xl font-black text-emerald-500 tabular-nums tracking-tighter">{item.team.defensiveStability?.toFixed(2) || '0.00'}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tactical Summary */}
                    <div className="p-12 bg-[#0a0a0a] rounded-[40px] border border-neutral-900 space-y-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Activity className="w-32 h-32 text-white" />
                        </div>
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <h3 className="text-xs font-black text-white uppercase tracking-widest">Analysis Summary</h3>
                        </div>
                        <p className="text-xl text-neutral-400 leading-relaxed max-w-3xl font-medium relative z-10 italic">
                            "{analysis.summary}"
                        </p>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-10">
                    {/* Verdict Card */}
                    <div className="bg-emerald-500 p-12 rounded-[40px] text-neutral-950 space-y-10 shadow-2xl shadow-emerald-500/10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6">
                            <Zap className="w-12 h-12 text-black/5" />
                        </div>
                        <div className="space-y-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Verdict</span>
                            <h2 className="text-6xl font-black tracking-tighter uppercase leading-none">
                                {analysis.verdict === 'EXECUTE_BET' ? 'EXECUTE' : 'HOLD'}
                            </h2>
                        </div>
                        <p className="text-sm font-bold leading-relaxed uppercase tracking-tight">
                            {analysis.verdict === 'EXECUTE_BET'
                                ? `Positive edge detected. Recommended allocation: ${analysis.recommendedStake}% of bankroll.`
                                : "No measurable edge found. Market is efficient."}
                        </p>

                        {analysis.verdict === 'EXECUTE_BET' && (
                            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-black/10">
                                <div>
                                    <span className="text-[10px] font-black uppercase opacity-60 tracking-widest block mb-1">Edge</span>
                                    <p className="text-3xl font-black tabular-nums">+{analysis.edge}%</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase opacity-60 tracking-widest block mb-1">Odds</span>
                                    <p className="text-3xl font-black tabular-nums">{analysis.marketOdds?.toFixed(2) || '0.00'}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Technical Details */}
                    <div className="p-10 border border-neutral-800 bg-neutral-900/20 rounded-[40px] space-y-10">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] flex items-center gap-2">
                                <Target className="w-3 h-3" /> Model Details
                            </h4>
                        </div>
                        <div className="space-y-8">
                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-black uppercase text-neutral-400 tracking-widest">
                                    <span>Signal Quality</span>
                                    <span>{analysis.dataSource === 'LIVE' ? 'VERIFIED' : 'FALLBACK'}</span>
                                </div>
                                <div className="h-1 bg-neutral-900 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" style={{ width: analysis.dataSource === 'LIVE' ? '100%' : '60%' }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
