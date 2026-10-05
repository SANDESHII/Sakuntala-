import { FC, memo, useState, useEffect } from 'react';
import { Zap, Shield, Target, Activity, LucideIcon, Binary, BarChart3, Info } from 'lucide-react';
import { AnalysisResult } from '../types';
import { ScoreHeatmap } from './ScoreHeatmap';

const AnimatedNumber = ({ value, duration = 1000 }: { value: number; duration?: number }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        let start = 0;
        const end = value;
        const range = end - start;
        let startTime: number | null = null;

        const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            setDisplayValue(Math.floor(progress * range + start));
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };

        window.requestAnimationFrame(step);
    }, [value, duration]);

    return <>{displayValue}</>;
};

const generateBriefing = (analysis: AnalysisResult) => {
    const { homeStats, awayStats, predictionType, probability, edge, verdict } = analysis;
    const isOver = predictionType === 'OVER_25';
    
    return [
        `Analysis of ${homeStats.name} vs ${awayStats.name} indicates a ${probability}% probability of ${isOver ? 'over' : 'under'} 2.5 goals.`,
        verdict === 'EXECUTE_BET' 
            ? `With a model edge of ${edge}%, this represents a high-value opportunity.`
            : `The market appears efficient with no significant edge detected.`,
        `Home xG: ${analysis.homeExpectedGoals.toFixed(2)}, Away xG: ${analysis.awayExpectedGoals.toFixed(2)}.`
    ].join(' ');
};

const Briefing = ({ analysis }: { analysis: AnalysisResult }) => (
    <div className="bg-neutral-900/30 border border-neutral-800 rounded-[48px] p-12 lg:p-16 space-y-8">
        <div className="flex items-center gap-4">
            <Info className="w-5 h-5 text-emerald-500" />
            <h3 className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.3em]">Strategic Briefing</h3>
        </div>
        <p className="text-sm text-neutral-500 leading-relaxed font-medium">
            {generateBriefing(analysis)}
        </p>
    </div>
);

interface ResultGridProps {
    analysis: AnalysisResult;
}

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
                <div className="flex flex-col items-end gap-6">
                    <div className="text-right space-y-2">
                        <span className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.4em] block">Confidence Level</span>
                        <span className="text-9xl font-black text-white tracking-tighter leading-none">
                            <AnimatedNumber value={analysis.probability} />%
                        </span>
                        {analysis.marketImpliedProb !== null && (
                            <div className="flex items-center justify-end gap-3 pt-4">
                                <span className="text-[10px] font-black text-neutral-700 uppercase tracking-[0.3em]">Market Implied</span>
                                <span className="px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-md text-[10px] font-black text-neutral-500">{analysis.marketImpliedProb}%</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                <div className="lg:col-span-8 space-y-20">
                    {/* Primary Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <StatCard 
                            label="Model Edge" 
                            value={analysis.edge !== null ? `${analysis.edge > 0 ? '+' : ''}${analysis.edge}%` : '--'} 
                            subValue={analysis.context.marketOdds.source !== 'NONE' ? `vs ${analysis.context.marketOdds.source}` : 'No Market Data'} 
                            icon={Zap} 
                        />
                        <StatCard 
                            label="Combined xG" 
                            value={(analysis.homeExpectedGoals + analysis.awayExpectedGoals).toFixed(2)} 
                            subValue="Summed Poisson Mean" 
                            icon={Activity} 
                        />
                        <StatCard 
                            label="System Confidence" 
                            value={analysis.isLowConfidence ? 'LOW' : 'HIGH'} 
                            subValue={analysis.dataSource === 'LIVE' ? 'Verified Feed' : 'Statistical Fallback'} 
                            icon={Shield} 
                        />
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
                            
                            <div className="h-[300px] w-full flex items-end gap-2 px-4 pb-8">
                                {analysis.goalDistribution.map((item, index) => {
                                    const isHighlighted = 
                                        (analysis.predictionType === 'OVER_25' && index >= 3) ||
                                        (analysis.predictionType === 'UNDER_25' && index <= 2);
                                    
                                    return (
                                        <div key={index} className="flex-1 flex flex-col items-center gap-4 group">
                                            <div className="w-full relative flex flex-col justify-end h-[240px]">
                                                <div 
                                                    className={`w-full rounded-t-xl transition-all duration-500 ${isHighlighted ? 'bg-emerald-500' : 'bg-neutral-800'} group-hover:opacity-80`}
                                                    style={{ height: `${item.probability}%` }}
                                                >
                                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                        <span className="text-[10px] font-black text-white bg-neutral-950 px-2 py-1 rounded border border-neutral-800">
                                                            {item.probability.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-black text-neutral-600 uppercase tabular-nums">
                                                {item.goals}
                                            </span>
                                        </div>
                                    );
                                })}
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
                            <ScoreHeatmap 
                                matrix={analysis.scoreMatrix} 
                                homeTeam={analysis.homeStats.name} 
                                awayTeam={analysis.awayStats.name} 
                            />
                        </div>
                    )}

                    {/* Automated Briefing */}
                    <Briefing analysis={analysis} />
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

                        {analysis.verdict === 'EXECUTE_BET' && analysis.marketOdds !== null && (
                            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-black/10">
                                <div>
                                    <span className="text-[10px] font-black uppercase opacity-60 tracking-widest block mb-1">Edge</span>
                                    <p className="text-3xl font-black tabular-nums">+{analysis.edge}%</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase opacity-60 tracking-widest block mb-1">Odds</span>
                                    <p className="text-3xl font-black tabular-nums">{analysis.marketOdds.toFixed(2)}</p>
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
                                    <span>Market Source</span>
                                    <span>{analysis.context.marketOdds.source}</span>
                                </div>
                                <div className="h-1 bg-neutral-900 rounded-full overflow-hidden">
                                    <div className={`h-full ${analysis.context.marketOdds.source === 'NONE' ? 'bg-neutral-800' : 'bg-emerald-500'}`} style={{ width: analysis.context.marketOdds.source === 'NONE' ? '10%' : '100%' }} />
                                </div>
                            </div>
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
});
