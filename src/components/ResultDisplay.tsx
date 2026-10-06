import { FC, memo } from 'react';
import { Zap, Shield, Activity, LucideIcon } from 'lucide-react';
import { AnalysisResult } from '../types';
import { ScoreHeatmap } from './ScoreHeatmap';
import { Briefing } from './BriefingModule';

interface ResultGridProps { analysis: AnalysisResult; }

const StatCard = memo(({ label, value, subValue, icon: Icon }: { label: string; value: string | number; subValue?: string; icon: LucideIcon }) => (
    <div className="bg-neutral-900/40 p-10 rounded-[32px] border border-neutral-800/50 flex flex-col justify-between space-y-10 hover:bg-neutral-900/60 transition-all group shadow-sm hover:scale-105 hover:shadow-emerald-500/5">
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
));

export const ResultGrid: FC<ResultGridProps> = memo(({ analysis }) => {
    return (
        <div className="space-y-24 page-transition">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-12 pb-24 border-b border-neutral-900/50">
                <div className="space-y-10">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${analysis.dataSource === 'LIVE' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} />
                            <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">
                                {analysis.dataSource === 'LIVE' ? 'Authenticated Data Feed' : 'Historical Approximation'}
                            </span>
                        </div>
                        <span className="text-neutral-800 font-black">/</span>
                        <span className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.4em]">Proprietary Engine</span>
                    </div>
                    <h2 className="text-8xl md:text-9xl font-black text-white tracking-tighter leading-[0.75] uppercase max-w-4xl">
                        {analysis.predictionLabel}<span className="text-neutral-800">.</span>
                    </h2>
                </div>
                <div className="text-right space-y-2">
                    <span className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.4em] block">Confidence Level</span>
                    <span className="text-9xl font-black text-white tracking-tighter leading-none">{analysis.probability}%</span>
                    {analysis.marketImpliedProb !== null && (
                        <div className="flex items-center justify-end gap-3 pt-4">
                            <span className="text-[10px] font-black text-neutral-700 uppercase tracking-[0.3em]">Market Implied</span>
                            <span className="px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-md text-[10px] font-black text-neutral-500">{analysis.marketImpliedProb}%</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                <div className="lg:col-span-8 space-y-20">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <StatCard label="Model Edge" value={analysis.edge !== null ? `${analysis.edge > 0 ? '+' : ''}${analysis.edge}%` : '--'} subValue={`vs ${analysis.context.marketOdds.source || 'NONE'}`} icon={Zap} />
                        <StatCard label="Combined xG" value={(analysis.homeExpectedGoals + analysis.awayExpectedGoals).toFixed(2)} subValue="Poisson Mean" icon={Activity} />
                        <StatCard label="Confidence" value={analysis.isLowConfidence ? 'LOW' : 'HIGH'} subValue={analysis.dataSource === 'LIVE' ? 'Verified Feed' : 'Fallback'} icon={Shield} />
                    </div>

                    <div className="bg-neutral-900/30 border border-neutral-800 rounded-[48px] p-12 lg:p-16">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
                            {[ { team: analysis.homeStats, expGoals: analysis.homeExpectedGoals, role: 'HOME' }, { team: analysis.awayStats, expGoals: analysis.awayExpectedGoals, role: 'AWAY' } ].map((item, idx) => (
                                <div key={idx} className="space-y-12">
                                    <h4 className="text-4xl font-black text-white tracking-tighter uppercase">{item.team.name}</h4>
                                    <div className="grid grid-cols-2 gap-y-12 gap-x-8">
                                        <div className="p-6 bg-neutral-800/20 rounded-3xl border border-neutral-800/50">
                                            <span className="text-[10px] text-neutral-500 font-black uppercase tracking-widest block">Exp Goals</span>
                                            <p className="text-4xl font-black text-white tabular-nums tracking-tighter">{item.expGoals?.toFixed(2)}</p>
                                        </div>
                                        <div className="p-6 bg-neutral-800/20 rounded-3xl border border-neutral-800/50">
                                            <span className="text-[10px] text-neutral-500 font-black uppercase tracking-widest block">Def Rating</span>
                                            <p className="text-4xl font-black text-emerald-500 tabular-nums tracking-tighter">{item.team.defensiveRatingHeuristic?.toFixed(2)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {analysis.goalDistribution && (
                        <div className="bg-neutral-900/30 border border-neutral-800 rounded-[48px] p-12 lg:p-16 space-y-12">
                            <div className="h-[240px] w-full flex items-end gap-2 px-4 pb-8">
                                {analysis.goalDistribution.map((item, index) => (
                                    <div key={index} className="flex-1 flex flex-col items-center gap-4 group h-full justify-end">
                                        <div className={`w-full rounded-t-xl transition-all duration-500 ${((analysis.predictionType === 'OVER_25' && index >= 3) || (analysis.predictionType === 'UNDER_25' && index <= 2)) ? 'bg-emerald-500' : 'bg-neutral-800'}`} style={{ height: `${item.probability}%` }} />
                                        <span className="text-[10px] font-black text-neutral-600 uppercase tabular-nums">{item.goals}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {analysis.scoreMatrix && <div className="bg-neutral-900/30 border border-neutral-800 rounded-[48px] p-12 lg:p-16"><ScoreHeatmap matrix={analysis.scoreMatrix} homeTeam={analysis.homeStats.name} awayTeam={analysis.awayStats.name} /></div>}
                    <Briefing analysis={analysis} />
                </div>

                <div className="lg:col-span-4 space-y-10">
                    <div className="bg-emerald-500 p-12 rounded-[40px] text-neutral-950 space-y-10 shadow-2xl relative overflow-hidden">
                        <div className="space-y-3"><span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Verdict</span><h2 className="text-6xl font-black tracking-tighter uppercase leading-none">{analysis.verdict === 'EXECUTE_BET' ? 'EXECUTE' : 'HOLD'}</h2></div>
                        <p className="text-sm font-bold leading-relaxed uppercase tracking-tight">{analysis.verdict === 'EXECUTE_BET' ? `Positive edge detected. Recommended stake: ${analysis.recommendedStake}% of bankroll.` : "No measurable edge found. Market is efficient."}</p>
                        {analysis.verdict === 'EXECUTE_BET' && analysis.marketOdds !== null && (
                            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-black/10">
                                <div><span className="text-[10px] font-black uppercase opacity-60 block mb-1">Edge</span><p className="text-3xl font-black tabular-nums">+{analysis.edge}%</p></div>
                                <div><span className="text-[10px] font-black uppercase opacity-60 block mb-1">Odds</span><p className="text-3xl font-black tabular-nums">{analysis.marketOdds.toFixed(2)}</p></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});
