import React, { useMemo, useState, useEffect } from 'react';
import { ELITE_LEAGUES } from '../core/constants';
import { getUpcomingFixtures, FixtureMatch } from '../services/freeDataService';
import { Calendar } from 'lucide-react';

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
    const [fixtures, setFixtures] = useState<FixtureMatch[]>([]);
    const [loadingFixtures, setLoadingFixtures] = useState(false);

    useEffect(() => {
        const fetchFixtures = async () => {
            setLoadingFixtures(true);
            try {
                const data = await getUpcomingFixtures(league, 8);
                setFixtures(data);
            } catch (error) {
                console.error('Fixture Error:', error);
            } finally {
                setLoadingFixtures(false);
            }
        };
        fetchFixtures();
    }, [league]);
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

            {/* Upcoming Fixtures Section */}
            <div className="mt-16 pt-16 border-t border-neutral-900">
                <div className="flex items-center gap-3 mb-8">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">Upcoming Fixtures</h3>
                </div>
                
                {loadingFixtures ? (
                    <div className="text-[10px] text-neutral-600 animate-pulse font-black uppercase tracking-widest">
                        Syncing league schedule...
                    </div>
                ) : fixtures.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {fixtures.map((f, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => {
                                    setHome(f.homeTeam);
                                    setAway(f.awayTeam);
                                    setTime(new Date(f.kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                                }}
                                className="group p-6 bg-neutral-900/50 border border-neutral-900 text-left hover:border-emerald-500/50 transition-all rounded-xl"
                            >
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center text-[8px] font-black text-neutral-600 uppercase tracking-tighter">
                                        <span>{new Date(f.kickoff).toLocaleDateString()}</span>
                                        <span className="text-emerald-500">{new Date(f.kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <img src={f.homeLogo} alt="" className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                                            <span className="text-[10px] font-black text-white truncate">{f.homeTeam}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <img src={f.awayLogo} alt="" className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                                            <span className="text-[10px] font-black text-white truncate">{f.awayTeam}</span>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="text-[10px] text-neutral-700 font-black uppercase tracking-widest">
                        No upcoming fixtures detected in API feed.
                    </div>
                )}
            </div>
        </form>
    );
};
