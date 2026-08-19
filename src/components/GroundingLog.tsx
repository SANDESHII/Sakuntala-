
import React from 'react';
import { ExternalLink, AlertTriangle, Database, CheckCircle } from 'lucide-react';
import { MatchContext } from '../types';

interface GroundingLogProps {
    context: MatchContext;
}

export const GroundingLog: React.FC<GroundingLogProps> = ({ context }) => {
    if (!context.groundingLog) return null;

    const { citations, varianceAlerts } = context.groundingLog;

    return (
        <div className="space-y-8 bg-neutral-900/30 border border-neutral-800 rounded-2xl p-8 lg:p-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-emerald-500" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Grounding & Source Verification</h3>
                    </div>
                    <p className="text-xs text-neutral-500 font-medium">Quantitative inputs are verifiably anchored to real-world data feeds.</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-tight">Verified Protocol v2.1</span>
                </div>
            </div>

            {varianceAlerts && varianceAlerts.length > 0 && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-start gap-4">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Statistical Variance Alerts</span>
                        {varianceAlerts.map((alert, i) => (
                            <p key={i} className="text-xs text-red-400/80 leading-relaxed">{alert}</p>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {citations.map((cite, idx) => (
                    <div key={idx} className="bg-neutral-950 p-5 rounded-xl border border-neutral-900 flex flex-col justify-between space-y-4 hover:border-neutral-700 transition-colors group">
                        <div className="space-y-3">
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-tight">{cite.source}</span>
                                <a 
                                    href={cite.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-neutral-500 hover:text-emerald-500 transition-colors"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                            <div className="space-y-1">
                                <span className="text-2xl font-bold text-white tabular-nums">{cite.value}</span>
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-tighter">Live Verification Result</span>
                                </div>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-neutral-900">
                            <span className="text-[9px] font-medium text-neutral-600 italic leading-none">
                                Observed: {cite.timestamp}
                            </span>
                        </div>
                    </div>
                ))}
                
                {citations.length === 0 && (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-neutral-900 rounded-2xl">
                        <p className="text-xs font-bold text-neutral-600 uppercase tracking-widest">No Live Citations Extracted</p>
                    </div>
                )}
            </div>
        </div>
    );
};
