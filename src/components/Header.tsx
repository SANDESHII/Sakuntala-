import React from 'react';
import { Activity } from 'lucide-react';

export const Header: React.FC = () => (
    <header className="fixed top-0 left-0 right-0 z-50 bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-900 px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center">
                    <Activity className="w-5 h-5 text-black" />
                </div>
                <h1 className="text-sm font-bold tracking-tight text-white uppercase">
                    Infallibility <span className="text-neutral-500 font-medium">Pro</span>
                </h1>
            </div>
            <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold text-emerald-500 tracking-[0.2em] uppercase hidden md:block">System Status: Active</span>
            </div>
        </div>
    </header>
);
