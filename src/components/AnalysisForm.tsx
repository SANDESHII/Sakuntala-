import { FC, type FormEvent, useState, useEffect, memo } from 'react';
import { Calendar } from 'lucide-react';
import { FixtureMatch } from '../types';
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

const LEAGUES = [
  { id: 'EPL', name: 'Premier League' },
  { id: 'LA_LIGA', name: 'La Liga' },
  { id: 'BUNDESLIGA', name: 'Bundesliga' },
  { id: 'SERIE_A', name: 'Serie A' },
  { id: 'LIGUE_1', name: 'Ligue 1' },
];

const TeamRow = ({ logo, name }: { logo?: string | null; name: string }) => (
  <div className="flex items-center gap-2">
    <div className="w-4 h-4 flex items-center justify-center bg-slate-800 rounded-sm overflow-hidden shrink-0">
      {logo ? (
        <img
          src={logo}
          alt={name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <span className="w-1.5 h-1.5 bg-slate-500 rounded-full" />
      )}
    </div>
    <span className="text-xs font-semibold text-slate-100 truncate">{name}</span>
  </div>
);

export const AnalysisForm: FC<AnalysisFormProps> = memo(({
  home,
  setHome,
  away,
  setAway,
  league,
  setLeague,
  kickoff,
  setKickoff,
  onAnalyze,
  loading,
}) => {
  const [fixtures, setFixtures] = useState<FixtureMatch[]>([]);
  const [loadingFixtures, setLoadingFixtures] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      if (!league || league.length < 3) return;
      setLoadingFixtures(true);
      try {
        const response = await fetch(`/api/fixtures?league=${encodeURIComponent(league)}&limit=8`);
        if (!response.ok) throw new Error('Failed to fetch fixtures');
        const data = await response.json();
        if (!cancelled) setFixtures(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setFixtures([]);
      } finally {
        if (!cancelled) setLoadingFixtures(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [league]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!loading && home.trim() && away.trim()) onAnalyze();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 md:p-10 max-w-5xl mx-auto space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
        <div className="space-y-2">
          <label htmlFor="league-select" className="block text-xs font-medium text-slate-400">
            Competition (League)
          </label>
          <select
            id="league-select"
            value={league}
            disabled={loading}
            onChange={(e) => setLeague(e.target.value)}
            className="w-full min-h-[44px] bg-slate-900/70 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-100 focus:outline-none focus:border-emerald-500 disabled:opacity-50 cursor-pointer"
          >
            {LEAGUES.map((l) => (
              <option key={l.id} value={l.id} className="bg-slate-900 text-slate-100">
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <BaseInput
          label="Home Team"
          value={home}
          onChange={(e) => setHome(e.target.value.toUpperCase())}
          placeholder="ARSENAL"
          disabled={loading}
          autoComplete="off"
        />

        <BaseInput
          label="Away Team"
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
        disabled={loading || !home.trim() || !away.trim()}
        className={`w-full min-h-[48px] py-3.5 px-6 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
          loading || !home.trim() || !away.trim()
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
            : 'bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60'
        }`}
      >
        {loading ? 'Analyzing Match...' : 'Run Analysis'}
      </button>

      <div className="pt-6 border-t border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Upcoming Fixtures
          </h2>
        </div>

        {loadingFixtures ? (
          <p className="text-xs text-slate-500">Syncing league schedule...</p>
        ) : fixtures.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {fixtures.map((f) => (
              <button
                key={f.fixtureId}
                type="button"
                onClick={() => {
                  setHome(f.homeTeam);
                  setAway(f.awayTeam);
                  const time = new Date(f.kickoff).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  });
                  setKickoff(time);
                }}
                className="p-4 bg-slate-950/60 border border-slate-800 text-left hover:border-emerald-500/50 hover:bg-slate-900 rounded-xl space-y-2.5 cursor-pointer"
              >
                <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                  {new Date(f.kickoff).toLocaleDateString()} ·{' '}
                  {new Date(f.kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <TeamRow logo={f.homeLogo} name={f.homeTeam} />
                <TeamRow logo={f.awayLogo} name={f.awayTeam} />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            No upcoming fixtures detected in live API feed.
          </p>
        )}
      </div>
    </form>
  );
});
