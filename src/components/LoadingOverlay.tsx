import React from 'react';
import { Activity } from 'lucide-react';

interface LoadingOverlayProps {
    loading: boolean;
    stage: number;
    messages: string[];
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ loading, stage, messages }) => (
    loading ? (
        <div className="fixed inset-0 z-[100] bg-neutral-950 flex flex-col items-center justify-center space-y-12">
            <div className="relative flex items-center justify-center">
                <div className="w-32 h-32 border border-neutral-900 rounded-full" />
                <div className="absolute inset-0 border-t border-emerald-500 rounded-full animate-spin [animation-duration:1s]" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-white animate-pulse" />
                </div>
            </div>
            <div className="text-center space-y-4">
                <p className="text-[10px] font-bold tracking-[0.4em] text-white uppercase opacity-40">
                    {messages[stage]}
                </p>
                <div className="flex gap-2 justify-center">
                    {messages.map((_, i) => (
                        <div key={i} className={`h-[1px] transition-all duration-500 ${i === stage ? 'bg-emerald-500 w-8' : 'bg-neutral-900 w-2'}`} />
                    ))}
                </div>
            </div>
        </div>
    ) : null
);
