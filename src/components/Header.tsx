import { FC, useState, useEffect } from 'react';

export const Header: FC = () => {
    const [isHealthy, setIsHealthy] = useState(true);

    useEffect(() => {
        const check = async () => {
            try {
                const res = await fetch('/api/health');
                const data = await res.json();
                setIsHealthy(data.status === 'OPERATIONAL');
            } catch {
                setIsHealthy(false);
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
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isHealthy ? 'bg-emerald-500' : 'bg-red-500'}`} />
                </div>
            </div>
        </header>
    );
};
