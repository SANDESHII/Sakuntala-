import { FC, useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Search } from 'lucide-react';
import { LeagueRatingsResponse } from '../types';

interface LeagueRatingsViewProps {
  selectedLeague: string;
  onSelectLeague: (league: string) => void;
  onPickTeam: (side: 'home' | 'away', teamId: string, league: string) => void;
}

const LEAGUES = [
  { id: 'EPL', name: 'Premier League' },
  { id: 'LA_LIGA', name: 'La Liga' },
  { id: 'BUNDESLIGA', name: 'Bundesliga' },
  { id: 'SERIE_A', name: 'Serie A' },
  { id: 'LIGUE_1', name: 'Ligue 1' },
];

type SortKey = 'netRating' | 'attack' | 'defense' | 'matchCount';

export const LeagueRatingsView: FC<LeagueRatingsViewProps> = ({
  selectedLeague,
  onSelectLeague,
  onPickTeam,
}) => {
  const [data, setData] = useState<LeagueRatingsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('netRating');
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadRatings = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/ratings?league=${encodeURIComponent(selectedLeague)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to load league ratings');
        }
        const json: LeagueRatingsResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load league ratings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadRatings();
    return () => {
      cancelled = true;
    };
  }, [selectedLeague]);

  const sortedTeams = useMemo(() => {
    if (!data?.teams) return [];
    const q = search.trim().toLowerCase();
    const filtered = data.teams.filter(
      (t) =>
        !q ||
        t.displayName.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
    );
    return [...filtered].sort((a, b) => {
      const diff = a[sortBy] - b[sortBy];
      return sortDesc ? -diff : diff;
    });
  }, [data, search, sortBy, sortDesc]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDesc((prev) => !prev);
    } else {
      setSortBy(key);
      // Lower defense multiplier is stronger defensively
      setSortDesc(key !== 'defense');
    }
  };

  return (
    <div className="space-y-6 page-transition">
      {/* Controls Bar */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
          {LEAGUES.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onSelectLeague(l.id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer ${
                selectedLeague === l.id
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-100'
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {data && (
            <div className="text-xs font-mono text-slate-600 dark:text-slate-400 tabular-nums">
              {data.dataProvider} · {data.matchesUsed} matches · γ={data.homeAdvantage.toFixed(3)} · ρ={data.rho.toFixed(3)}
            </div>
          )}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search club..."
              aria-label="Search club ratings"
              className="pl-8 pr-3 py-1.5 min-h-[38px] rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="h-96 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 animate-pulse" />
      ) : (
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                Dixon-Coles Strength Multipliers
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                1.00 = league average · Higher Attack (α) = more goals scored · Lower Defense (β) = fewer goals conceded
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="px-6 py-3 w-12">#</th>
                  <th className="px-4 py-3">Club</th>
                  <th className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('attack')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      Attack (α)
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('defense')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      Defense (β)
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('netRating')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      Net Ratio (α/β)
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('matchCount')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      Sample
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-right">Load Into Match</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {sortedTeams.map((team, idx) => (
                  <tr key={team.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-6 py-3 font-mono text-slate-400 tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-950 dark:text-slate-100 whitespace-nowrap">
                      {team.displayName}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      <span className={team.attack >= 1.15 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-700 dark:text-slate-200'}>
                        {team.attack.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      <span className={team.defense <= 0.85 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-700 dark:text-slate-200'}>
                        {team.defense.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {team.netRating.toFixed(2)}×
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                      {team.matchCount > 0 ? `${team.matchCount} matches` : 'Prior'}
                    </td>
                    <td className="px-6 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onPickTeam('home', team.id, selectedLeague)}
                          className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                        >
                          Set Home
                        </button>
                        <button
                          type="button"
                          onClick={() => onPickTeam('away', team.id, selectedLeague)}
                          className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                        >
                          Set Away
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
