import { FC } from 'react';
import { motion } from 'motion/react';
import { BacktestSummary } from '../types';
import { TrendingUp, Target, BarChart3, ShieldAlert } from 'lucide-react';

interface BacktestDisplayProps {
    summary: BacktestSummary;
}

export const BacktestDisplay: FC<BacktestDisplayProps> = ({ summary }) => {
    const metrics = [
        { label: 'Total Matches', value: summary.totalMatches, icon: Target, color: 'text-white' },
        { label: 'Total PnL', value: `${summary.totalPnl > 0 ? '+' : ''}${summary.totalPnl}u`, icon: TrendingUp, color: summary.totalPnl > 0 ? 'text-emerald-500' : 'text-red-500' },
        { label: 'Model Yield', value: `${summary.totalYield.toFixed(2)}%`, icon: BarChart3, color: summary.totalYield > 0 ? 'text-emerald-500' : 'text-neutral-400' },
        { label: 'Brier Score', value: summary.brierScore.toFixed(4), icon: ShieldAlert, color: 'text-neutral-400' }
    ];

    return (
        <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {metrics.map((m, i) => (
                    <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-3xl space-y-4"
                    >
                        <m.icon className="w-5 h-5 text-neutral-600" />
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">{m.label}</p>
                            <p className={`text-3xl font-black ${m.color}`}>{m.value}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-8 space-y-8">
                    <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">Historical Performance Segments</h3>
                    <div className="bg-neutral-900/30 border border-neutral-900 rounded-[40px] overflow-hidden">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-neutral-900">
                                    <th className="px-8 py-6 text-[10px] font-black text-neutral-600 uppercase tracking-widest">Edge Segment</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-neutral-600 uppercase tracking-widest">Sample</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-neutral-600 uppercase tracking-widest">Hit Rate</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-neutral-600 uppercase tracking-widest">Avg CLV</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-900">
                                {summary.edgeSegments.map((seg, i) => (
                                    <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                                        <td className="px-8 py-6">
                                            <span className="text-xs font-black text-white uppercase">{seg.segment}</span>
                                        </td>
                                        <td className="px-8 py-6 text-xs font-bold text-neutral-500">{seg.count} matches</td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-black text-emerald-500">{(seg.hitRate * 100).toFixed(1)}%</span>
                                                <div className="w-16 h-1 bg-neutral-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-500" style={{ width: `${seg.hitRate * 100}%` }} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-xs font-black text-neutral-400">
                                            {seg.avgClv > 0 ? '+' : ''}{seg.avgClv.toFixed(2)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-8">
                    <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">System Audit Notes</h3>
                    <div className="p-8 bg-neutral-950 border border-neutral-900 rounded-[40px] space-y-6">
                        <div className="space-y-2">
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Grounding Status</p>
                            <p className="text-xs text-neutral-500 leading-relaxed font-medium italic">
                                Model performance is verified against historical closing prices from Pinnacle and Betfair. Analysis includes temporal decay weighting (phi=0.003).
                            </p>
                        </div>
                        {summary.error && (
                            <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                                <p className="text-[10px] font-black text-red-500 uppercase mb-1">Execution Warning</p>
                                <p className="text-[10px] font-medium text-red-400/70 uppercase leading-relaxed">{summary.error}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
