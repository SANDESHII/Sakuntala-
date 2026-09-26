import { FC, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

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

    return (
        <AnimatePresence>
            {loading && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-8"
                >
                    <div className="max-w-md w-full space-y-16">
                        <div className="relative flex items-center justify-center">
                            <motion.div 
                                animate={{ rotate: 360 }}
                                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                className="w-48 h-48 border-[0.5px] border-neutral-900 rounded-full"
                            />
                            <motion.div 
                                animate={{ rotate: -360 }}
                                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                                className="absolute w-32 h-32 border-[0.5px] border-emerald-500/20 rounded-full"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <motion.div 
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="w-1.5 h-1.5 bg-emerald-500 rounded-full"
                                />
                            </div>
                        </div>

                        <div className="space-y-8 font-mono">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <p className="text-[10px] font-black tracking-[0.4em] text-white uppercase">System Processing</p>
                            </div>
                            
                            <div className="space-y-2 h-12 overflow-hidden">
                                <motion.p 
                                    key={logIdx}
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest"
                                >
                                    {LOGS[logIdx]}
                                </motion.p>
                            </div>

                            <div className="h-0.5 bg-neutral-900 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: "0%" }}
                                    animate={{ width: "100%" }}
                                    transition={{ duration: 6, ease: "easeInOut" }}
                                    className="h-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                                />
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
