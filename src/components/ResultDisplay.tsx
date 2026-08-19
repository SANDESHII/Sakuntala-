
import React from 'react';
import { Zap, Shield, Target, Activity, TrendingUp, LucideIcon, Binary } from 'lucide-react';
import { AnalysisResult, AnalysisConfidence } from '../types';

interface ResultGridProps {
    analysis: AnalysisResult;
    surety: AnalysisConfidence;
}

const StatCard: React.FC<{ label: string; value: string | number; subValue?: string; icon: LucideIcon }> = ({ label, value, subValue, icon: Icon }) => (
    <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 flex flex-col justify-between space-y-4 group transition-all hover:border-emerald-500/30">
        <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">{label}</span>
            <Icon className="w-4 h-4 text-neutral-600 group-hover:text-emerald-500 transition-colors" />
        </div>
        <div className="space-y-1">
            <h4 className="text-3xl font-bold text-white tracking-tight">{value}</h4>
            <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-tight">{subValue}</p>
        </div>
    </div>
);

export const ResultGrid: React.FC<ResultGridProps> = ({ analysis, surety }) => {
    return (
        <div className="space-y-16">
            {/* Header Status */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 pb-12 border-b border-neutral-900">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold tracking-widest text-neutral-500 uppercase">
                            {analysis.dataSource === 'LIVE' ? 'Live Neural Mode' : 'Tactical Archetype Mode'}
                        </span>
                    </div>
                    <h2 className="text-6xl font-bold text-white tracking-tighter leading-none uppercase">
                        {analysis.predictionLabel}
                    </h2>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <span className="text-8xl font-black text-emerald-500 tracking-tighter leading-none">{analysis.probability}%</span>
                    <span className="text-xs font-bold text-neutral-600 uppercase tracking-widest">Confidence Score</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-8 space-y-12">
                    {/* Primary Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard label="Min Expectancy" value={analysis.minimumExpectancy?.toFixed(2) || '0.00'} subValue="Conservative Floor" icon={Shield} />
                        <StatCard label="Max Expectancy" value={analysis.potentialCeiling?.toFixed(2) || '0.00'} subValue="Theoretical Ceiling" icon={TrendingUp} />
                        <StatCard label="Signal Strength" value={`${(analysis.signalStrength * 100).toFixed(0)}%`} subValue="Data Purity" icon={Zap} />
                    </div>

                    {/* Team Deep Dive */}
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-10">
                        <div className="flex items-center gap-2 mb-10">
                            <Binary className="w-4 h-4 text-emerald-500" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Scoring Baselines</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            {[
                                { team: analysis.homeStats, xG: analysis.homeXG },
                                { team: analysis.awayStats, xG: analysis.awayXG }
                            ].map((item, idx) => (
                                <div key={idx} className="space-y-8">
                                    <h4 className="text-lg font-bold text-white">{item.team.name}</h4>
                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-neutral-500 font-bold uppercase">Adjusted xG</span>
                                            <p className="text-2xl font-bold text-white">{item.xG.toFixed(2)}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-neutral-500 font-bold uppercase">Stability</span>
                                            <p className="text-2xl font-bold text-emerald-500">{item.team.defensiveStability.toFixed(2)}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-neutral-500 font-bold uppercase">Clinical Edge</span>
                                            <p className="text-2xl font-bold text-white">{(item.team.clinicalEdge * 100).toFixed(1)}%</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tactical Narrative */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-neutral-500" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Tactical Reasoning</h3>
                        </div>
                        <p className="text-lg text-neutral-400 leading-relaxed max-w-3xl italic">
                            "{analysis.summary}"
                        </p>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-8">
                    {/* Verdict Card */}
                    <div className="bg-emerald-500 p-10 rounded-2xl text-neutral-950 space-y-8">
                        <div className="space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">System Verdict</span>
                            <h2 className="text-5xl font-black tracking-tighter uppercase leading-none">
                                {analysis.isSureshot ? 'Sureshot' : surety.verdict}
                            </h2>
                        </div>
                        <p className="text-sm font-medium leading-relaxed">
                            {analysis.isSureshot 
                                ? "Mathematical convergence exceeds 82% threshold. High-fidelity signal detected."
                                : "Standard statistical variance applies. Position sizing should remain disciplined."}
                        </p>
                    </div>

                    {/* Audit Info */}
                    <div className="p-8 border border-neutral-900 rounded-2xl space-y-8">
                        <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                            <Target className="w-3 h-3" /> Technical Audit
                        </h4>
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-bold uppercase text-neutral-400">
                                    <span>Signal Purity</span>
                                    <span>{analysis.purity}%</span>
                                </div>
                                <div className="h-1 bg-neutral-900 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${analysis.purity}%` }} />
                                </div>
                            </div>
                            {analysis.context.referee && (
                                <div className="pt-6 border-t border-neutral-900 space-y-4">
                                    <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Referee Influence</span>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-white">{analysis.context.referee.name}</span>
                                        <span className="text-[10px] px-2 py-1 bg-neutral-900 rounded text-neutral-400 font-bold uppercase tracking-tight">
                                            {analysis.context.referee.tendency}
                                        </span>
                                    </div>
                                </div>
                            )}
                            {analysis.context.audit && (
                                <div className="pt-6 border-t border-neutral-900 grid grid-cols-2 gap-y-6 gap-x-4">
                                    {[
                                        { label: 'Signal Integrity', value: analysis.context.audit.signalIntegrity },
                                        { label: 'Variance Mode', value: analysis.context.audit.redCardRegime },
                                        { label: 'Recency Alpha', value: analysis.context.audit.alphaAdjustment },
                                        { label: 'Data Fidelity', value: analysis.context.audit.dataReliability }
                                    ].map((item, i) => (
                                        <div key={i} className="space-y-1">
                                            <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest block leading-none">{item.label}</span>
                                            <p className="text-[10px] font-bold text-neutral-400 leading-tight">{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

