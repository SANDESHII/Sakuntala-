import { FC, type FormEvent, useState, useEffect, memo } from 'react';
import { FixtureMatch } from '../types';
import { Calendar } from 'lucide-react';

import { BaseInput } from './BaseInput';

interface AnalysisFormProps {
    home: string;
    setHome: (v: string) => void;
    away: string;
    setAway: (v: string) => void;
    league: string;
    setLeague: (v: string) => void;
    kickoff: string;
    setKickoff: (v: string) => void;
    onAnalyze: () => void;
    loading: boolean;
}

const TeamRow = ({ logo, name }: { logo?: string | null, name: string }) => (
    <div className="flex items-center gap-2">
        <div className="w-4 h-4 flex items-center justify-center bg-neutral-800 rounded-sm overflow-hidden">
            {logo ? (
                <img 
                    src={logo} 
                    alt="" 
                    className="w-full h-full object-contain opacity-50 group-hover:opacity-100 transition-opacity"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                />
            ) : (
                <div className="w-1.5 h-1.5 bg-neutral-600 rounded-full" />
            )}
        </div>
        <span className="text-[10px] font-black text-white truncate">{name}</span>
    </div>
);

export const AnalysisForm: FC<AnalysisFormProps> = memo(({ 
    home, setHome, away, setAway, league, setLeague, kickoff, setKickoff,
    onAnalyze, loading
}) => {
    const [fixtures, setFixtures] = useState<FixtureMatch[]>([]);
    const [loadingFixtures, setLoadingFixtures] = useState(false);

    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (!league || league.length < 3) return;
            
            setLoadingFixtures(true);
            try {
                const response = await fetch(`/api/fixtures?league=${league}&limit=8`);
                if (!response.ok) throw new Error('Failed to fetch fixtures');
                const data = await response.json();
                setFixtures(data);
            } catch {
                // Fallback
            } finally {
                setLoadingFixtures(false);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [league]);

    const leagues = [
        { id: 'EPL', name: 'Premier League' },
        { id: 'LA_LIGA', name: 'La Liga' },
        { id: 'BUNDESLIGA', name: 'Bundesliga' },
        { id: 'SERIE_A', name: 'Serie A' },
        { id: 'LIGUE_1', name: 'Ligue 1' }
    ];

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!loading && home && away) onAnalyze();
    };

    return (
        <form 
            onSubmit={handleSubmit} 
            className="bg-neutral-950 p-12 lg:p-16 border border-neutral-900 max-w-5xl mx-auto rounded-[40px] shadow-2xl"
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12">
                <div className="space-y-4 group">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest group-focus-within:text-emerald-500 transition-colors">
                        Competition
                    </label>
                    <select 
                        value={league}
                        disabled={loading}
                        onChange={(e) => setLeague(e.target.value)}
                        className="w-full bg-transparent border-b border-neutral-800 px-0 py-4 text-4xl text-white focus:outline-none focus:border-emerald-500 transition-all font-bold uppercase tracking-tighter disabled:opacity-50 appearance-none cursor-pointer"
                    >
                        {leagues.map(l => (
                            <option key={l.id} value={l.id} className="bg-neutral-900 text-sm">{l.name}</option>
                        ))}
                    </select>
                </div>

                <BaseInput 
                    label="Home Side" 
                    value={home} 
                    onChange={(e) => setHome(e.target.value.toUpperCase())}
                    placeholder="ARSENAL"
                    disabled={loading}
                    autoComplete="off"
                />

                <BaseInput 
                    label="Away Side" 
                    value={away} 
                    onChange={(e) => setAway(e.target.value.toUpperCase())}
                    placeholder="CHELSEA"
                    disabled={loading}
                    autoComplete="off"
                />

                <BaseInput 
                    label="Kickoff Time" 
                    value={kickoff} 
                    onChange={(e) => setKickoff(e.target.value)}
                    placeholder="HH:MM"
                    disabled={loading}
                    autoComplete="off"
                />
            </div>

            <button 
                type="submit" 
                disabled={loading || !home || !away} 
                className={`w-full mt-12 py-10 font-black tracking-[0.2em] text-sm uppercase transition-all rounded-2xl active:scale-[0.98] ${
                    loading || !home || !away 
                        ? 'bg-neutral-900 text-neutral-700 cursor-not-allowed' 
                        : 'bg-white text-black hover:bg-emerald-500 hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]'
                }`}
            >
                {loading ? 'PROCESSING...' : 'RUN ANALYSIS'}
            </button>

            {/* Upcoming Fixtures Section */}
            <div className="mt-16 pt-16 border-t border-neutral-900">
                <div className="flex items-center gap-3 mb-8">
                    <div className="relative">
                        <Calendar className="w-4 h-4 text-emerald-500" />
                        <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping opacity-75" />
                    </div>
                    <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">Upcoming Fixtures</h3>
                </div>
                
                {loadingFixtures ? (
                    <div className="text-[10px] text-neutral-600 animate-pulse font-black uppercase tracking-widest">
                        Syncing league schedule...
                    </div>
                ) : fixtures.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {fixtures.map((f) => (
                            <button
                                key={f.fixtureId}
                                type="button"
                                onClick={() => {
                                    setHome(f.homeTeam);
                                    setAway(f.awayTeam);
                                    const time = new Date(f.kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                                    setKickoff(time);
                                }}
                                className="group p-6 bg-neutral-900/30 border border-neutral-900 text-left hover:border-emerald-500/50 hover:bg-neutral-900/50 hover:scale-[1.02] transition-all duration-300 rounded-xl"
                            >
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center text-[8px] font-black text-neutral-600 uppercase tracking-tighter">
                                        <span>{new Date(f.kickoff).toLocaleDateString()} • {new Date(f.kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <TeamRow logo={f.homeLogo} name={f.homeTeam} />
                                    <TeamRow logo={f.awayLogo} name={f.awayTeam} />
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
});

