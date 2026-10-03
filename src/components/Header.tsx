import { FC } from 'react';
import { ShieldCheck } from 'lucide-react';

export const Header: FC = () => {
    return (
        <header className="fixed top-0 left-0 right-0 h-20 border-b border-neutral-900 bg-black/50 backdrop-blur-xl z-50">
            <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
                {/* Zone 1: Brand Wordmark (Single Element) */}
                <div className="flex items-center gap-4">
                    <span className="text-sm font-black text-white uppercase tracking-[0.4em]">Alpha Terminal</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                {/* Zone 2: Navigation Links (Muted/Editorial) */}
                <nav className="hidden lg:flex items-center gap-8 text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                    <a href="#" className="hover:text-emerald-500 transition-colors">Documentation</a>
                    <a href="#" className="hover:text-emerald-500 transition-colors">API Status</a>
                    <a href="#" className="hover:text-emerald-500 transition-colors">Legal</a>
                </nav>

                {/* Zone 3: Primary Actions */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Secured Node</span>
                    </div>
                </div>
            </div>
        </header>
    );
};
