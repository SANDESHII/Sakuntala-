import React, { useMemo } from 'react';
import { ELITE_LEAGUES } from '../core/constants';

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
}

export const AnalysisForm: React.FC<AnalysisFormProps> = ({ 
    home, setHome, away, setAway, league, setLeague, time, setTime, 
    onAnalyze, loading
}) => {
    // 1. Defined Field Schema
    const fields = useMemo(() => [
        { label: 'Home Side', val: home, set: setHome, placeholder: 'ARSENAL' },
        { label: 'Away Side', val: away, set: setAway, placeholder: 'CHELSEA' },
        { label: 'League Code', val: league, set: setLeague, placeholder: 'EPL' },
        { label: 'Market Time', val: time, set: setTime, placeholder: '19:45' }
    ], [home, away, league, time, setHome, setAway, setLeague, setTime]);

    // 2. Action Handlers
    const normalizeLeague = (v: string) => {
        const upper = v.toUpperCase().trim();
        const clean = upper.replace(/ /g, '').replace(/_/g, '');
        if (clean === 'LALIGA' || clean === 'SPAIN') return 'LA_LIGA';
        if (clean === 'SERIEA' || clean === 'ITALY') return 'SERIE_A';
        if (clean === 'LIGUE1' || clean === 'FRANCE') return 'LIGUE_1';
        if (clean === 'EPL' || clean === 'PREMIERLEAGUE' || clean === 'ENGLAND') return 'EPL';
        if (clean === 'BUNDESLIGA' || clean === 'GERMANY') return 'BUNDESLIGA';
        return upper;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!loading && home && away) onAnalyze();
    };

    return (
        <form 
            onSubmit={handleSubmit} 
            className="bg-neutral-950 p-12 lg:p-16 border border-neutral-900 max-w-5xl mx-auto"
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12">
                {fields.map((f, i) => (
                    <div key={i} className="space-y-4">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                            {f.label}
                        </label>
                        <input 
                            type="text" 
                            value={f.val} 
                            onChange={(e) => {
                                const val = e.target.value.toUpperCase();
                                f.set(f.label === 'League Code' ? normalizeLeague(val) : val);
                            }} 
                            className="w-full bg-transparent border-b border-neutral-800 px-0 py-4 text-4xl text-white focus:outline-none focus:border-emerald-500 transition-all font-bold placeholder:text-neutral-800 uppercase tracking-tighter" 
                            placeholder={f.placeholder} 
                            autoComplete="off"
                        />
                        {f.label === 'League Code' && (
                            <div className="flex flex-wrap gap-2 mt-4">
                                {ELITE_LEAGUES.map(l => (
                                    <button
                                        key={l}
                                        type="button"
                                        onClick={() => setLeague(normalizeLeague(l))}
                                        className={`px-3 py-1 text-[8px] font-black border transition-all ${
                                            league === l 
                                                ? 'bg-emerald-500 border-emerald-500 text-white' 
                                                : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700'
                                        }`}
                                    >
                                        {l.replace(/_/g, ' ')}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <button 
                type="submit" 
                disabled={loading || !home || !away} 
                className={`w-full mt-12 py-10 font-black tracking-[0.2em] text-sm uppercase transition-all ${
                    loading || !home || !away 
                        ? 'bg-neutral-900 text-neutral-700 cursor-not-allowed' 
                        : 'bg-white text-black hover:bg-emerald-500'
                }`}
            >
                {loading ? 'PROCESSING...' : 'RUN ANALYSIS'}
            </button>
        </form>
    );
};
