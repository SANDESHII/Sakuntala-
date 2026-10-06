import { FC } from 'react';

export const Header: FC = () => {
    return (
        <header className="fixed top-0 left-0 right-0 h-20 border-b border-neutral-900 bg-black/50 backdrop-blur-xl z-50">
            <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
                {/* Zone 1: Brand Wordmark (Single Element) */}
                <div className="flex items-center gap-4">
                    <span className="text-sm font-black text-white uppercase tracking-[0.4em]">Alpha Terminal</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                <div />
            </div>
        </header>
    );
};
