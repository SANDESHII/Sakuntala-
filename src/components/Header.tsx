import { FC, useState, useEffect } from 'react';

export const Header: FC = () => {
    const [healthStatus, setHealthStatus] = useState<'OPERATIONAL' | 'DEGRADED' | 'ERROR'>('OPERATIONAL');

    useEffect(() => {
        const check = async () => {
            try {
                const res = await fetch('/api/health');
                const data = await res.json();
                setHealthStatus(data.status);
            } catch {
                setHealthStatus('ERROR');
            }
        };
        check();
        const interval = setInterval(check, 60000);
        return () => clearInterval(interval);
    }, []);

    return (
        <header className="fixed top-0 left-0 right-0 h-20 border-b border-neutral-900 bg-black/50 backdrop-blur-xl z-50">
            <div className="max-w-7xl mx-auto h-full px-6 flex items-center">
                <div className="flex items-center gap-4">
                    <span className="text-sm font-black text-white uppercase tracking-[0.4em]">Alpha Terminal</span>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900/50 rounded-full border border-neutral-800">
                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                            healthStatus === 'OPERATIONAL' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                            healthStatus === 'DEGRADED' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                        }`} />
                        <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">{healthStatus}</span>
                    </div>
                </div>
            </div>
        </header>
    );
};
