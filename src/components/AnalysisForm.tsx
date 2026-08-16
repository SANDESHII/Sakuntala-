
import React from 'react';

interface AnalysisFormProps {
    home: string;
    setHome: (v: string) => void;
    away: string;
    setAway: (v: string) => void;
    league: string;
    setLeague: (v: string) => void;
    time: string;
    setTime: (v: string) => void;
    onAnalyze: () => void;
    loading: boolean;
    isSearchEnabled: boolean;
    setIsSearchEnabled: (v: boolean) => void;
}

export const AnalysisForm: React.FC<AnalysisFormProps> = ({ 
    home, setHome, away, setAway, league, setLeague, time, setTime, 
    onAnalyze, loading, isSearchEnabled, setIsSearchEnabled
}) => (
    <form 
        onSubmit={(e) => { e.preventDefault(); if (!loading && home && away) onAnalyze(); }} 
        className="bg-neutral-900/50 p-12 rounded-3xl border border-neutral-800 shadow-2xl max-w-5xl mx-auto backdrop-blur-xl"
    >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12">
            {[
                { label: 'Home Side', val: home, set: setHome, placeholder: 'ARSENAL' },
                { label: 'Away Side', val: away, set: setAway, placeholder: 'CHELSEA' },
                { label: 'League Code', val: league, set: setLeague, placeholder: 'EPL' },
                { label: 'Market Time', val: time, set: setTime, placeholder: '19:45' }
            ].map((f, i) => (
                <div key={i} className="space-y-4">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{f.label}</label>
                    <input 
                        type="text" 
                        value={f.val} 
                        onChange={(e) => f.set(e.target.value.toUpperCase())} 
                        className="w-full bg-transparent border-b border-neutral-800 px-0 py-4 text-4xl text-white focus:outline-none focus:border-emerald-500 transition-all font-bold placeholder:text-neutral-800 uppercase tracking-tighter" 
                        placeholder={f.placeholder} 
                    />
                </div>
            ))}
        </div>
        <div className="mt-16 flex items-center justify-between p-6 bg-neutral-950/50 rounded-2xl border border-neutral-800">
            <div className="space-y-1">
                <span className="text-xs font-bold text-white uppercase tracking-tight">AI Neural Research</span>
                <p className="text-[10px] text-neutral-500 font-medium uppercase">Enable real-time tactical signal grounding</p>
            </div>
            <button 
                type="button" 
                onClick={() => setIsSearchEnabled(!isSearchEnabled)} 
                className={`relative w-11 h-6 rounded-full transition-all duration-300 ${isSearchEnabled ? 'bg-emerald-500' : 'bg-neutral-800'}`}
            >
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${isSearchEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
        </div>
        <button 
            type="submit" 
            disabled={loading || !home || !away} 
            className={`w-full mt-16 py-8 rounded-2xl font-bold tracking-tight text-lg transition-all ${loading || !home || !away ? 'bg-neutral-800 text-neutral-600' : 'bg-white text-black hover:bg-emerald-500 hover:text-black'}`}
        >
            {loading ? 'CALCULATING VARIANCES...' : 'GENERATE REPORT'}
        </button>
    </form>
);
