import { FC, type FormEvent, useState, useEffect, memo, useId } from 'react';
import { ArrowLeftRight, Calendar } from 'lucide-react';
import { FixtureMatch, TeamOption } from '../types';
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
  asOfDate: string;
  setAsOfDate: (v: string) => void;
  onAnalyze: (overrideHome?: string, overrideAway?: string, overrideKickoff?: string) => void;
  loading: boolean;
}

const LEAGUES = [
  { id: 'EPL', name: 'Premier League' },
  { id: 'LA_LIGA', name: 'La Liga' },
  { id: 'BUNDESLIGA', name: 'Bundesliga' },
  { id: 'SERIE_A', name: 'Serie A' },
  { id: 'LIGUE_1', name: 'Ligue 1' },
];

const FEATURED_MATCHUPS: Record<string, { home: string; away: string; label: string }[]> = {
  EPL: [
    { home: 'ARSENAL', away: 'MAN_CITY', label: 'Title Clash' },
    { home: 'LIVERPOOL', away: 'CHELSEA', label: 'Classic Tie' },
    { home: 'NEWCASTLE', away: 'ASTON_VILLA', label: 'Top-6 Race' },
    { home: 'TOTTENHAM', away: 'MAN_UTD', label: 'High Tempo' },
  ],
  LA_LIGA: [
    { home: 'REAL_MADRID', away: 'BARCELONA', label: 'El Clasico' },
    { home: 'ATLETICO', away: 'REAL_MADRID', label: 'Madrid Derby' },
    { home: 'ATHLETIC_BILBAO', away: 'REAL_SOCIEDAD', label: 'Basque Derby' },
    { home: 'GIRONA', away: 'VILLARREAL', label: 'Attacking Matchup' },
  ],
  BUNDESLIGA: [
    { home: 'BAYERN', away: 'DORTMUND', label: 'Der Klassiker' },
    { home: 'LEVERKUSEN', away: 'BAYERN', label: 'Title Six-Pointer' },
    { home: 'RB_LEIPZIG', away: 'STUTTGART', label: 'Top-4 Duel' },
    { home: 'FRANKFURT', away: 'FREIBURG', label: 'European Spot' },
  ],
  SERIE_A: [
    { home: 'INTER', away: 'MILAN', label: 'Derby della Madonnina' },
    { home: 'NAPOLI', away: 'JUVENTUS', label: 'Scudetto Test' },
    { home: 'ATALANTA', away: 'ROMA', label: 'Tactical Clash' },
    { home: 'LAZIO', away: 'FIORENTINA', label: 'Top-6 Battle' },
  ],
  LIGUE_1: [
    { home: 'PSG', away: 'MARSEILLE', label: 'Le Classique' },
    { home: 'MONACO', away: 'LILLE', label: 'Champions Race' },
    { home: 'LYON', away: 'NICE', label: 'Riviera Clash' },
    { home: 'LENS', away: 'RENNES', label: 'Mid-Table Test' },
  ],
};

const TeamRow = ({ logo, name }: { logo?: string | null; name: string }) => (
  <div className="flex items-center gap-2">
    <div className="w-4 h-4 flex items-center justify-center bg-slate-200 dark:bg-slate-800 rounded-sm overflow-hidden shrink-0">
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
    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{name}</span>
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
  asOfDate,
  setAsOfDate,
  onAnalyze,
  loading,
}) => {
  const [fixtures, setFixtures] = useState<FixtureMatch[]>([]);
  const [loadingFixtures, setLoadingFixtures] = useState(false);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const homeListId = useId();
  const awayListId = useId();

  useEffect(() => {
    let cancelled = false;
    const fetchLeagueContext = async () => {
      if (!league || league.length < 3) return;
      setLoadingFixtures(true);
      try {
        const [fixRes, teamsRes] = await Promise.all([
          fetch(`/api/fixtures?league=${encodeURIComponent(league)}&limit=8`),
          fetch(`/api/teams?league=${encodeURIComponent(league)}`),
        ]);
        if (!cancelled) {
          if (fixRes.ok) {
            const fixData = await fixRes.json();
            setFixtures(Array.isArray(fixData) ? fixData : []);
          } else {
            setFixtures([]);
          }
          if (teamsRes.ok) {
            const teamsData = await teamsRes.json();
            setTeams(Array.isArray(teamsData?.teams) ? teamsData.teams : []);
          }
        }
      } catch {
        if (!cancelled) setFixtures([]);
      } finally {
        if (!cancelled) setLoadingFixtures(false);
      }
    };

    const timeoutId = setTimeout(fetchLeagueContext, 150);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [league]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!loading && home.trim() && away.trim()) onAnalyze();
  };

  const handleSwap = () => {
    const prevHome = home;
    setHome(away);
    setAway(prevHome);
  };

  const sameTeam = home.trim().length > 0 && home.trim().toUpperCase() === away.trim().toUpperCase();
  const featured = FEATURED_MATCHUPS[league] || FEATURED_MATCHUPS.EPL;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 space-y-7"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        <div className="md:col-span-3 space-y-1.5">
          <label htmlFor="league-select" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            Competition
          </label>
          <select
            id="league-select"
            value={league}
            disabled={loading}
            onChange={(e) => setLeague(e.target.value)}
            className="w-full min-h-[44px] bg-white dark:bg-slate-900/70 border border-slate-300 dark:border-slate-800 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 disabled:opacity-50 cursor-pointer"
          >
            {LEAGUES.map((l) => (
              <option key={l.id} value={l.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-4">
          <BaseInput
            label="Home Team"
            list={homeListId}
            value={home}
            onChange={(e) => setHome(e.target.value.toUpperCase())}
            placeholder="ARSENAL"
            disabled={loading}
            autoComplete="off"
          />
          <datalist id={homeListId}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.displayName}
              </option>
            ))}
          </datalist>
        </div>

        <div className="md:col-span-1 flex justify-center">
          <button
            type="button"
            onClick={handleSwap}
            disabled={loading}
            title="Swap home and away teams"
            aria-label="Swap home and away teams"
            className="min-h-[44px] w-full md:w-11 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 text-slate-600 dark:text-slate-300 hover:border-emerald-500/60 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer disabled:opacity-50"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        </div>

        <div className="md:col-span-4">
          <BaseInput
            label="Away Team"
            list={awayListId}
            value={away}
            onChange={(e) => setAway(e.target.value.toUpperCase())}
            placeholder="CHELSEA"
            disabled={loading}
            autoComplete="off"
          />
          <datalist id={awayListId}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.displayName}
              </option>
            ))}
          </datalist>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        <div className="md:col-span-3">
          <BaseInput
            label="Kickoff Time (Optional)"
            value={kickoff}
            onChange={(e) => setKickoff(e.target.value)}
            placeholder="19:45"
            disabled={loading}
            autoComplete="off"
          />
        </div>

        <div className="md:col-span-4">
          <BaseInput
            label="As-Of Cutoff Date (Optional Backtest Replay)"
            type="date"
            max={new Date().toISOString().split('T')[0]}
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="md:col-span-5">
          <button
            type="submit"
            disabled={loading || !home.trim() || !away.trim() || sameTeam}
            className={`w-full min-h-[44px] py-2.5 px-6 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              loading || !home.trim() || !away.trim() || sameTeam
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60'
            }`}
          >
            {loading ? 'Fitting Dixon-Coles MLE...' : sameTeam ? 'Select Distinct Teams' : 'Run Match Analysis'}
          </button>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {fixtures.length > 0 ? 'Upcoming League Fixtures' : 'Quick-Load League Matchups'}
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Click a fixture to populate and run prediction
          </span>
        </div>

        {loadingFixtures ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : fixtures.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {fixtures.map((f) => (
              <button
                key={f.fixtureId}
                type="button"
                onClick={() => {
                  const time = new Date(f.kickoff).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  });
                  setHome(f.homeTeam);
                  setAway(f.awayTeam);
                  setKickoff(time);
                  onAnalyze(f.homeTeam, f.awayTeam, time);
                }}
                className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-left hover:border-emerald-500/60 hover:bg-white dark:hover:bg-slate-900 rounded-xl space-y-2 cursor-pointer"
              >
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  {new Date(f.kickoff).toLocaleDateString()} ·{' '}
                  {new Date(f.kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <TeamRow logo={f.homeLogo} name={f.homeTeam} />
                <TeamRow logo={f.awayLogo} name={f.awayTeam} />
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {featured.map((m) => (
              <button
                key={`${m.home}-${m.away}`}
                type="button"
                onClick={() => {
                  setHome(m.home);
                  setAway(m.away);
                  onAnalyze(m.home, m.away, kickoff);
                }}
                className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-left hover:border-emerald-500/60 hover:bg-white dark:hover:bg-slate-900 rounded-xl space-y-2 cursor-pointer"
              >
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {m.label}
                </div>
                <TeamRow name={m.home.replace(/_/g, ' ')} />
                <TeamRow name={m.away.replace(/_/g, ' ')} />
              </button>
            ))}
          </div>
        )}
      </div>
    </form>
  );
});
