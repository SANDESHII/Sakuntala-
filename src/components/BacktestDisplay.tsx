import React from 'react';
import { motion } from 'motion/react';
import { Activity, CheckCircle2, BarChart3 } from 'lucide-react';
import { BacktestSummary } from '../types';

interface BacktestDisplayProps {
    summary: BacktestSummary;
}

export const BacktestDisplay: React.FC<BacktestDisplayProps> = ({ summary }) => {
    return (
        <div className="space-y-12">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-4 gap-8"
            >
                {summary.brierScore === -1 && (
                    <div className="md:col-span-4 p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                        <p className="text-amber-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            Warning: Backtest utilizes synthetic Poisson-simulated scores. Data does not reflect historical predictive validation.
                        </p>
                    </div>
                )}
                {[
                    { label: 'Matches Analyzed', value: summary.totalMatches, icon: Activity },
                    { label: 'Accuracy Rate', value: `${(((summary.over15Accuracy || 0) + (summary.under35Accuracy || 0)) / 2)?.toFixed(1) || '0.0'}%`, icon: CheckCircle2 },
                    { 
                        label: 'Brier Score', 
                        value: summary.brierScore === -1 ? 'SIMULATED' : (summary.brierScore?.toFixed(4) || '0.0000'), 
                        icon: BarChart3, 
                        detail: summary.brierScore === -1 ? 'Synthetic Projection' : 'Mean Squared Error' 
                    }
                ].map((stat, i) => (
                    <div key={i} className="p-10 bg-zinc-950 border border-zinc-900 rounded-3xl space-y-6 hover:bg-zinc-900 transition-all">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">{stat.label}</span>
                            <stat.icon className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-4xl font-black text-white tracking-tighter tabular-nums leading-none">{stat.value}</p>
                            {stat.detail && <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-tight">{stat.detail}</span>}
                        </div>
                    </div>
                ))}

                <div className="md:col-span-4 p-12 bg-zinc-950 border border-zinc-900 rounded-3xl">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-12">Model Validation</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
                        {summary.edgeSegments.map((seg, i) => (
                            <div key={i} className="space-y-8 p-10 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-all group">
                                <div className="flex justify-between items-start">
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">{seg.segment}</span>
                                    <span className="text-[10px] font-bold uppercase px-3 py-1 bg-zinc-950 border border-zinc-800 text-emerald-500 rounded-lg">
                                        Win Rate: {(seg.hitRate * 100)?.toFixed(1) || '0.0'}%
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">
                                        <span>Matches</span>
                                        <span>{seg.count}</span>
                                    </div>
                                    <div className="h-1 bg-zinc-950 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-emerald-500/30 transition-all duration-1000 group-hover:bg-emerald-500" 
                                            style={{ width: `${(seg.count / summary.totalMatches) * 100}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-6 border-t border-zinc-800/50">
                                    <span className="text-[10px] text-zinc-600 font-bold uppercase">Avg Edge</span>
                                    <span className="text-xl font-bold text-white tabular-nums tracking-tighter">+{(seg.avgEdge * 100)?.toFixed(2) || '0.00'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="md:col-span-4 overflow-hidden border border-zinc-900 rounded-2xl bg-zinc-900/50">
                    <div className="px-8 py-6 bg-zinc-950/50 border-b border-zinc-900">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Backtest Results</h4>
                    </div>
                    <table className="w-full text-left">
                        <thead className="bg-zinc-950/50">
                            <tr>
                                <th className="px-8 py-6 text-[10px] font-bold uppercase text-zinc-500 tracking-widest">Fixture</th>
                                <th className="px-8 py-6 text-[10px] font-bold uppercase text-zinc-500 tracking-widest text-center">Outcome</th>
                                <th className="px-8 py-6 text-[10px] font-bold uppercase text-zinc-500 tracking-widest text-center">Edge</th>
                                <th className="px-8 py-6 text-[10px] font-bold uppercase text-zinc-500 tracking-widest">Prediction</th>
                                <th className="px-8 py-6 text-[10px] font-bold uppercase text-zinc-500 tracking-widest text-right">Result</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900">
                            {summary.matches.map((item, i) => {
                                const predType = item.prediction.predictionType;
                                const isCorrect = predType === 'OVER_15' ? item.isOver15Correct : item.isUnder35Correct;
                                return (
                                    <tr key={i} className="hover:bg-zinc-950/30 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-bold text-white uppercase tracking-tight">{item.match.homeTeam} — {item.match.awayTeam}</span>
                                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded border ${
                                                        item.match.isReal 
                                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                                                        : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                                                    }`}>
                                                        {item.match.isReal ? 'REAL' : 'SIM'}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-zinc-600 font-medium uppercase tracking-widest">{item.match.league}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className="px-3 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs font-bold text-zinc-400 font-mono tracking-tighter">
                                                {item.match.actualScore[0]} : {item.match.actualScore[1]}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className={`text-xs font-bold ${item.marketEdge > 0.05 ? 'text-emerald-500' : 'text-zinc-500'}`}>
                                                {item.marketEdge > 0 ? '+' : ''}{(item.marketEdge * 100).toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold uppercase tracking-tight ${predType === 'OVER_15' ? 'text-emerald-500' : 'text-zinc-500'}`}>
                                                    {predType.replace('_', ' ')}
                                                </span>
                                                <span className="text-xs text-zinc-700 font-medium">{item.prediction.probability}%</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <span className={`text-[10px] font-bold uppercase tracking-widest ${isCorrect ? 'text-emerald-500' : 'text-red-500/50'}`}>
                                                    {isCorrect ? 'Correct' : 'Miss'}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
};
