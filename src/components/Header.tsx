import React from 'react';
import { Activity, ShieldCheck } from 'lucide-react';

export const Header: React.FC = () => (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-neutral-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-center shadow-inner">
                    <Activity className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="flex flex-col -space-y-1">
                    <h1 className="text-xs font-black tracking-[0.2em] text-white uppercase">
                        Alpha Terminal
                    </h1>
                    <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Quant Research</span>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2.5 px-4 py-1.5 bg-neutral-900/50 border border-neutral-800 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-black text-neutral-400 tracking-[0.1em] uppercase">System: Active</span>
                </div>
                <div className="hidden md:flex items-center gap-2 p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                </div>
            </div>
        </div>
    </header>
);
