import { FC } from 'react';
import { Zap, Shield, Target, Activity, LucideIcon, Binary, BarChart3 } from 'lucide-react';
import { AnalysisResult } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
                        {analysis.isThresholdAdaptive && (
                            <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-purple-500/10 border-purple-500/20 text-purple-500">
                                Adaptive Threshold
                            </span>
                        )}
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
                        <StatCard label="Min Expectancy" value={analysis.minimumExpectancy.toFixed(2)} subValue="Base Poisson Sum" icon={Shield} />
                        <StatCard label="Goal Ceiling" value={analysis.heuristicCeiling.toFixed(2)} subValue="Heuristic Peak" icon={Activity} />
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
                                { team: analysis.homeStats, expGoals: analysis.homeExpectedGoals, role: 'HOME' },
                                { team: analysis.awayStats, expGoals: analysis.awayExpectedGoals, role: 'AWAY' }
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
                                            <p className="text-4xl font-black text-white tabular-nums tracking-tighter">{item.expGoals?.toFixed(2) || '0.00'}</p>
                                        </div>
                                        <div className="space-y-3 p-6 bg-neutral-800/20 rounded-3xl border border-neutral-800/50">
                                            <span className="text-[10px] text-neutral-500 font-black uppercase tracking-widest block">Defensive Rating</span>
                                            <p className="text-4xl font-black text-emerald-500 tabular-nums tracking-tighter">{item.team.defensiveRatingHeuristic?.toFixed(2) || '0.00'}</p>
                                            <span className="text-[8px] text-neutral-700 font-bold uppercase tracking-tight block mt-1">Heuristic Metric</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Goal Distribution Chart */}
                    {analysis.goalDistribution && (
                        <div className="bg-neutral-900/30 border border-neutral-800 rounded-[48px] p-12 lg:p-16 space-y-12">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <BarChart3 className="w-5 h-5 text-emerald-500" />
                                    <h3 className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.3em]">Goal Distribution Probability</h3>
                                </div>
                                <span className="text-[10px] font-bold text-neutral-700 uppercase tracking-widest">Total Match Goals</span>
                            </div>
                            
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analysis.goalDistribution} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f1f" />
                                        <XAxis 
                                            dataKey="goals" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#525252', fontSize: 10, fontWeight: 800 }} 
                                            dy={10}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#525252', fontSize: 10, fontWeight: 800 }}
                                            tickFormatter={(val) => `${val}%`}
                                        />
                                        <Tooltip 
                                            cursor={{ fill: '#171717' }}
                                            contentStyle={{ 
                                                backgroundColor: '#0a0a0a', 
                                                border: '1px solid #262626', 
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                fontWeight: 'bold'
                                            }}
                                            itemStyle={{ color: '#10b981' }}
                                        />
                                        <Bar dataKey="probability" radius={[8, 8, 0, 0]}>
                                            {analysis.goalDistribution.map((_, index) => (
                                                <Cell 
                                                    key={`cell-${index}`} 
                                                    fill={
                                                        (analysis.predictionType === 'OVER_25' && (index >= 3)) ||
                                                        (analysis.predictionType === 'UNDER_25' && (index <= 2))
                                                        ? '#10b981' : '#262626'
                                                    } 
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            
                            <div className="flex gap-8 items-center pt-8 border-t border-neutral-800/50">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Prediction Zone</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm bg-neutral-800" />
                                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Baseline</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Score Probability Matrix Heatmap */}
                    {analysis.scoreMatrix && (
                        <div className="bg-neutral-900/30 border border-neutral-800 rounded-[48px] p-12 lg:p-16 space-y-12">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Binary className="w-5 h-5 text-emerald-500" />
                                    <h3 className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.3em]">Score Probability Matrix</h3>
                                </div>
                                <span className="text-[10px] font-bold text-neutral-700 uppercase tracking-widest">Dixon-Coles Heatmap</span>
                            </div>

                            <div className="overflow-x-auto pb-4">
                                <div className="min-w-[600px]">
                                    <div className="grid grid-cols-7 gap-2">
                                        <div className="flex flex-col items-center justify-center">
                                            <span className="text-[8px] font-black text-neutral-700 uppercase tracking-tighter">H \ A</span>
                                        </div>
                                        {[0, 1, 2, 3, 4, '5+'].map((goals, i) => (
                                            <div key={i} className="flex flex-col items-center justify-center py-2 bg-neutral-950/50 rounded-xl border border-neutral-900">
                                                <span className="text-[10px] font-black text-neutral-500">{goals}</span>
                                            </div>
                                        ))}
                                        {analysis.scoreMatrix.map((row, h) => (
                                            <div key={h} className="contents">
                                                <div className="flex items-center justify-center bg-neutral-950/50 rounded-xl border border-neutral-900">
                                                    <span className="text-[10px] font-black text-neutral-500">{h === 5 ? '5+' : h}</span>
                                                </div>
                                                {row.map((prob, a) => {
                                                    const isOver25 = (h + a) > 2.5;
                                                    const isMatch = (analysis.predictionType === 'OVER_25' && isOver25) || (analysis.predictionType === 'UNDER_25' && !isOver25);
                                                    return (
                                                        <div 
                                                            key={`${h}-${a}`}
                                                            className={`relative aspect-square rounded-xl border flex flex-col items-center justify-center group transition-all ${
                                                                isMatch ? 'border-emerald-500/10' : 'border-neutral-900'
                                                            }`}
                                                            style={{ 
                                                                backgroundColor: `rgba(16, 185, 129, ${prob * 4})`,
                                                            }}
                                                        >
                                                            <span className={`text-[10px] font-black tabular-nums transition-colors ${
                                                                prob > 0.08 ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-300'
                                                            }`}>
                                                                {(prob * 100).toFixed(1)}%
                                                            </span>
                                                            {prob > 0.05 && (
                                                                <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/5 pointer-events-none" />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-8 items-center pt-8 border-t border-neutral-800/50">
                                <div className="flex items-center gap-2">
                                    <div className="w-16 h-2 rounded-full bg-gradient-to-r from-neutral-900 to-emerald-500" />
                                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Density Map</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm border border-emerald-500/20" />
                                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Target Zone Bound</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Monte Carlo Uncertainty Analysis */}
                    {analysis.monteCarlo && (
                        <div className="bg-neutral-900/30 border border-neutral-800 rounded-[48px] p-12 lg:p-16 space-y-12">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Activity className="w-5 h-5 text-blue-500" />
                                    <h3 className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.3em]">Monte Carlo Uncertainty Propagation</h3>
                                </div>
                                <span className="text-[10px] font-bold text-neutral-700 uppercase tracking-widest">{analysis.monteCarlo.iterations.toLocaleString()} Iterations</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="space-y-8">
                                    <p className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em]">Analytical vs Simulated</p>
                                    <div className="space-y-6">
                                        {[
                                            { 
                                                label: 'Over 2.5 Goals', 
                                                analytical: analysis.predictionType === 'OVER_25' ? analysis.probability : Math.round(analysis.probability * 0.9), 
                                                simulated: Math.round(analysis.monteCarlo.probOver25 * 100)
                                            },
                                            { 
                                                label: 'Under 2.5 Goals', 
                                                analytical: analysis.predictionType === 'UNDER_25' ? analysis.probability : Math.round(analysis.probability * 1.1), 
                                                simulated: Math.round(analysis.monteCarlo.probUnder25 * 100)
                                            }
                                        ].map((item, idx) => (
                                            <div key={idx} className="space-y-4 p-8 bg-neutral-950/50 rounded-3xl border border-neutral-800/50">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs font-black text-white uppercase tracking-tight">{item.label}</span>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Diff</span>
                                                        <span className={`text-xs font-black tabular-nums ${Math.abs(item.analytical - item.simulated) < 2 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                            {Math.abs(item.analytical - item.simulated)}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <span className="text-[8px] font-black text-neutral-700 uppercase">Analytical</span>
                                                        <p className="text-xl font-black text-white tabular-nums">{item.analytical}%</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-[8px] font-black text-neutral-700 uppercase">Simulated (MC)</span>
                                                        <p className="text-xl font-black text-blue-500 tabular-nums">{item.simulated}%</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <p className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em]">Confidence Intervals</p>
                                    <div className="p-8 bg-blue-500/5 border border-blue-500/10 rounded-[32px] space-y-6 h-full">
                                        <div className="flex items-center gap-3">
                                            <Shield className="w-4 h-4 text-blue-500" />
                                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Statistical Variance</span>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Model σ</span>
                                                <span className="text-lg font-black text-white">{analysis.monteCarlo.stdDev.toFixed(3)}</span>
                                            </div>
                                            <p className="text-[10px] text-neutral-500 leading-relaxed uppercase tracking-tight">
                                                Uncertainty factor of {(analysis.monteCarlo.uncertainty * 100).toFixed(0)}% was propagated through λ, μ, and ρ using {analysis.monteCarlo.iterations.toLocaleString()} trials. 
                                                Low variance between analytical and simulated outcomes indicates model stability.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

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
                                : analysis.isLowConfidence
                                    ? "Bet withheld: Insufficient data for reliable fitting."
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
                                <div>
                                    <span className="text-[10px] font-black uppercase opacity-60 tracking-widest block mb-1">Stake</span>
                                    <p className="text-3xl font-black tabular-nums">{analysis.recommendedStake}%</p>
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
                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-black uppercase text-neutral-400 tracking-widest">
                                    <span>Model Method</span>
                                    <span>{analysis.modelSource === 'MLE_FITTED' ? 'MLE FITTED' : 'HEURISTIC'}</span>
                                </div>
                                <div className="h-1 bg-neutral-900 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" style={{ width: analysis.modelSource === 'MLE_FITTED' ? '100%' : '40%' }} />
                                </div>
                                {analysis.modelSpecification && (
                                    <p className="text-[8px] text-neutral-600 font-bold uppercase tracking-tight leading-relaxed">
                                        Spec: {analysis.modelSpecification}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-black uppercase text-neutral-400 tracking-widest">
                                    <span>Sample Confidence</span>
                                    <span>{analysis.isLowConfidence ? 'LOW' : 'HIGH'}</span>
                                </div>
                                <div className="h-1 bg-neutral-900 rounded-full overflow-hidden">
                                    <div className={`h-full ${analysis.isLowConfidence ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: analysis.isLowConfidence ? '30%' : '100%' }} />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-black uppercase text-neutral-400 tracking-widest">
                                    <span>Attack Rating</span>
                                    <span>HEURISTIC: {analysis.context.homeAttackRating}v{analysis.context.awayAttackRating}</span>
                                </div>
                                <div className="h-1 bg-neutral-900 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.3)]" style={{ width: `${(analysis.context.homeAttackRating / 10) * 100}%` }} />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-black uppercase text-neutral-400 tracking-widest">
                                    <span>Adaptive Threshold</span>
                                    <span>{analysis.isThresholdAdaptive ? 'ENABLED' : 'NONE'}</span>
                                </div>
                                <div className="h-1 bg-neutral-900 rounded-full overflow-hidden">
                                    <div className={`h-full ${analysis.isThresholdAdaptive ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]' : 'bg-neutral-800'}`} style={{ width: analysis.isThresholdAdaptive ? '100%' : '10%' }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
