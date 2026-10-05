import { FC, useEffect, useState } from 'react';

interface LoadingOverlayProps {
    loading: boolean;
}

const LOGS = [
    "INITIALIZING DIXON-COLES ENGINE...",
    "RESOLVING TEAM IDENTITIES...",
    "FETCHING LIVE MARKET LIQUIDITY...",
    "CALIBRATING POISSON VECTORS...",
    "EXECUTING MLE OPTIMIZATION...",
    "COMPUTING MARGINAL EDGE...",
    "VERIFYING DATA INTEGRITY..."
];

export const LoadingOverlay: FC<LoadingOverlayProps> = ({ loading }) => {
    const [logIdx, setLogIdx] = useState(0);

    useEffect(() => {
        if (!loading) {
            setLogIdx(0);
            return;
        }
        const interval = setInterval(() => {
            setLogIdx(prev => (prev + 1) % LOGS.length);
        }, 800);
        return () => clearInterval(interval);
    }, [loading]);

    if (!loading) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-8 transition-all duration-300">
            <div className="max-w-md w-full space-y-16">
                <div className="relative flex items-center justify-center">
                    <div className="w-48 h-48 border-[0.5px] border-neutral-900 rounded-full animate-[spin_4s_linear_infinite]" />
                    <div className="absolute w-32 h-32 border-[0.5px] border-emerald-500/20 rounded-full animate-[spin_8s_linear_infinite_reverse]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    </div>
                </div>

                <div className="space-y-8 font-mono">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <p className="text-[10px] font-black tracking-[0.4em] text-white uppercase">System Processing</p>
                    </div>
                    
                    <div className="space-y-2 h-12 overflow-hidden">
                        <p key={logIdx} className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest page-transition">
                            {LOGS[logIdx]}
                        </p>
                    </div>
                    
                    <div className="h-0.5 bg-neutral-900 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-[loading_2s_ease-in-out_infinite]" />
                    </div>
                </div>
            </div>
        </div>
    );
};
