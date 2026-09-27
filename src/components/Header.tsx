import { FC } from 'react';
import { motion } from 'motion/react';
import { Zap, ShieldCheck } from 'lucide-react';

export const Header: FC = () => {
    return (
        <header className="fixed top-0 left-0 right-0 h-20 border-b border-neutral-900 bg-black/50 backdrop-blur-xl z-50">
            <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                        <Zap className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-white uppercase tracking-[0.15em]">Alpha</h1>
                        <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Terminal</p>
                    </div>
                </div>

                <div className="hidden md:flex items-center gap-8">
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-neutral-900/50 border border-neutral-800 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Market Feed Active</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                            <ShieldCheck className="w-4 h-4 text-neutral-600" />
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};
