import { HistoricalMatch } from '../types';
import { BACKTEST_CONFIG, DECISION_LEAD_MS } from '../core/constants';
import { resolveTeam } from '../data/teamIds';
import { getRecentCsvSeasons } from '../data/utils';
import { logger } from './logger';

export interface CsvHistoricalMatch extends HistoricalMatch {
  season: string;
}

const csvCache = new Map<string, { rows: CsvHistoricalMatch[]; ts: number }>();
const CSV_TTL = 6 * 60 * 60 * 1000; // 6 hours

export function clearCsvCache(): void {
  csvCache.clear();
}

export function assertDistinctSnapshots(
  takenPrices: HistoricalMatch['takenPrices'] | null | undefined,
  closingPrices: HistoricalMatch['closingPrices'] | null | undefined,
  takenAt?: string,
  closedAt?: string
): void {
  if (!closingPrices) return;
  if (!takenAt || !closedAt || takenAt === closedAt) {
    throw new Error(`[CLV Sentinel] closingPrices must come from a distinct timestamp (takenAt=${takenAt}, closedAt=${closedAt}).`);
  }
  if (takenPrices && closingPrices === takenPrices) {
    throw new Error('[CLV Sentinel] closingPrices cannot reference the same object as takenPrices.');
  }
}

const OPENING_OVER_COLS = ['P>2.5', 'Max>2.5', 'B365>2.5', 'Avg>2.5'] as const;
const OPENING_UNDER_COLS = ['P<2.5', 'Max<2.5', 'B365<2.5', 'Avg<2.5'] as const;
const CLOSING_OVER_COLS = ['PC>2.5', 'PSC>2.5', 'MaxC>2.5', 'B365C>2.5', 'AvgC>2.5'] as const;
const CLOSING_UNDER_COLS = ['PC<2.5', 'PSC<2.5', 'MaxC<2.5', 'B365C<2.5', 'AvgC<2.5'] as const;

const MATCHED_BOOKMAKER_PAIRS = [
  { openOver: 'P>2.5', openUnder: 'P<2.5', closeOver: 'PC>2.5', closeUnder: 'PC<2.5' },
  { openOver: 'P>2.5', openUnder: 'P<2.5', closeOver: 'PSC>2.5', closeUnder: 'PSC<2.5' },
  { openOver: 'Max>2.5', openUnder: 'Max<2.5', closeOver: 'MaxC>2.5', closeUnder: 'MaxC<2.5' },
  { openOver: 'B365>2.5', openUnder: 'B365<2.5', closeOver: 'B365C>2.5', closeUnder: 'B365C<2.5' },
  { openOver: 'Avg>2.5', openUnder: 'Avg<2.5', closeOver: 'AvgC>2.5', closeUnder: 'AvgC<2.5' },
] as const;

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseFootballDataDate(dateStr: string, timeStr?: string): string | null {
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;
  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const yearRaw = Number(parts[2]);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(yearRaw)) return null;

  const year = parts[2].trim().length === 2 ? (yearRaw <= 50 ? 2000 + yearRaw : 1900 + yearRaw) : yearRaw;

  let hh = 0;
  let mm = 0;
  if (timeStr && /^\d{1,2}:\d{2}$/.test(timeStr.trim())) {
    const [hStr, mStr] = timeStr.trim().split(':');
    const hNum = Number(hStr);
    const mNum = Number(mStr);
    if (hNum >= 0 && hNum <= 23 && mNum >= 0 && mNum <= 59) {
      hh = hNum;
      mm = mNum;
    }
  }

  const dt = new Date(Date.UTC(year, month - 1, day, hh, mm, 0));
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return dt.toISOString();
}

function pickFirstValidPrice(
  row: string[],
  headerIndex: Map<string, number>,
  cols: readonly string[]
): number | undefined {
  for (const col of cols) {
    const idx = headerIndex.get(col);
    if (idx === undefined || idx >= row.length) continue;
    const raw = row[idx];
    if (!raw) continue;
    const val = Number(raw);
    if (Number.isFinite(val) && val > 1.0) {
      return val;
    }
  }
  return undefined;
}

/**
 * Parse a football-data.co.uk CSV text by header name into canonical HistoricalMatch rows.
 */
export function parseFootballDataCsv(
  csvText: string,
  league: string,
  season: string
): CsvHistoricalMatch[] {
  const cleaned = csvText.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const headerIndex = new Map<string, number>();
  headers.forEach((h, i) => {
    const key = h.trim();
    if (key && !headerIndex.has(key)) headerIndex.set(key, i);
  });

  const getField = (row: string[], col: string): string => {
    const idx = headerIndex.get(col);
    return idx !== undefined && idx < row.length ? row[idx] : '';
  };

  const leagueKey = league.toUpperCase().replace(/ /g, '_');
  const matches: CsvHistoricalMatch[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length < 4) continue;

    const dateIso = parseFootballDataDate(getField(row, 'Date'), getField(row, 'Time'));
    const homeRaw = getField(row, 'HomeTeam');
    const awayRaw = getField(row, 'AwayTeam');
    const fthgRaw = getField(row, 'FTHG');
    const ftagRaw = getField(row, 'FTAG');

    if (!dateIso || !homeRaw || !awayRaw) continue;
    if (!/^\d+$/.test(fthgRaw) || !/^\d+$/.test(ftagRaw)) continue;

    const homeGoals = Number(fthgRaw);
    const awayGoals = Number(ftagRaw);
    const home = resolveTeam(homeRaw).id;
    const away = resolveTeam(awayRaw).id;

    const hsRaw = getField(row, 'HS');
    const asRaw = getField(row, 'AS');
    const hstRaw = getField(row, 'HST');
    const astRaw = getField(row, 'AST');
    const hrRaw = getField(row, 'HR');
    const arRaw = getField(row, 'AR');
    const homeShots = /^\d+$/.test(hsRaw) ? Number(hsRaw) : undefined;
    const awayShots = /^\d+$/.test(asRaw) ? Number(asRaw) : undefined;
    const homeShotsOnTarget = /^\d+$/.test(hstRaw) ? Number(hstRaw) : undefined;
    const awayShotsOnTarget = /^\d+$/.test(astRaw) ? Number(astRaw) : undefined;
    const hasRedCard =
      (/^\d+$/.test(hrRaw) && Number(hrRaw) > 0) ||
      (/^\d+$/.test(arRaw) && Number(arRaw) > 0);

    let openOver: number | undefined;
    let openUnder: number | undefined;
    let closeOver: number | undefined;
    let closeUnder: number | undefined;

    for (const pair of MATCHED_BOOKMAKER_PAIRS) {
      const oo = pickFirstValidPrice(row, headerIndex, [pair.openOver]);
      const ou = pickFirstValidPrice(row, headerIndex, [pair.openUnder]);
      const co = pickFirstValidPrice(row, headerIndex, [pair.closeOver]);
      const cu = pickFirstValidPrice(row, headerIndex, [pair.closeUnder]);
      if (oo && ou && co && cu) {
        openOver = oo;
        openUnder = ou;
        closeOver = co;
        closeUnder = cu;
        break;
      }
    }

    if (!openOver) openOver = pickFirstValidPrice(row, headerIndex, OPENING_OVER_COLS);
    if (!openUnder) openUnder = pickFirstValidPrice(row, headerIndex, OPENING_UNDER_COLS);
    if (!closeOver) closeOver = pickFirstValidPrice(row, headerIndex, CLOSING_OVER_COLS);
    if (!closeUnder) closeUnder = pickFirstValidPrice(row, headerIndex, CLOSING_UNDER_COLS);

    const kickoffMs = new Date(dateIso).getTime();
    const match: CsvHistoricalMatch = {
      home,
      away,
      homeGoals,
      awayGoals,
      ...(homeShots !== undefined ? { homeShots } : {}),
      ...(awayShots !== undefined ? { awayShots } : {}),
      ...(homeShotsOnTarget !== undefined ? { homeShotsOnTarget } : {}),
      ...(awayShotsOnTarget !== undefined ? { awayShotsOnTarget } : {}),
      ...(hasRedCard ? { hasRedCard: true } : {}),
      date: dateIso,
      league: leagueKey,
      season,
      closingPrices: null,
    };

    if (openOver || openUnder) {
      match.takenPrices = {
        over25: openOver,
        under25: openUnder,
        over25NoVig: openOver && openUnder ? 1 + openOver / openUnder : undefined,
        under25NoVig: openOver && openUnder ? 1 + openUnder / openOver : undefined,
      };
      match.takenAt = new Date(kickoffMs - DECISION_LEAD_MS).toISOString();
    }

    if (closeOver || closeUnder) {
      match.closingPrices = {
        over25: closeOver,
        under25: closeUnder,
        over25NoVig: closeOver && closeUnder ? 1 + closeOver / closeUnder : undefined,
        under25NoVig: closeOver && closeUnder ? 1 + closeUnder / closeOver : undefined,
      };
      match.closedAt = dateIso;
    }

    matches.push(match);
  }

  return matches;
}

async function fetchCsvWithRetry(
  url: string,
  retries: number = BACKTEST_CONFIG.CSV_RETRIES,
  timeoutMs: number = BACKTEST_CONFIG.CSV_TIMEOUT_MS
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AlphaTerminal-Backtest/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} downloading ${url}`);
      }

      const text = await res.text();
      if (!text.includes('HomeTeam') || !text.includes('FTHG')) {
        throw new Error(`Invalid CSV payload received from ${url}`);
      }

      return text;
    } catch (err: unknown) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        logger.warn('footballDataCsv', `Retry ${attempt + 1}/${retries} for ${url}: ${lastError.message}`);
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }

  throw new Error(`[CSV Download Failed] ${url}: ${lastError?.message || 'Unknown error'}`);
}

export async function fetchLeagueSeasonCsv(league: string, season: string): Promise<CsvHistoricalMatch[]> {
  const leagueKey = league.toUpperCase().replace(/ /g, '_');
  const division = BACKTEST_CONFIG.DIVISION_MAP[leagueKey];
  if (!division) {
    throw new Error(`Unsupported league for football-data.co.uk CSV: ${league}`);
  }

  const cacheKey = `${season}_${division}`;
  const cached = csvCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CSV_TTL) return cached.rows;

  const url = `${BACKTEST_CONFIG.CSV_BASE_URL}/${season}/${division}.csv`;
  const csvText = await fetchCsvWithRetry(url);
  const parsed = parseFootballDataCsv(csvText, leagueKey, season);

  if (parsed.length === 0) {
    throw new Error(`[CSV Parse Error] Zero completed matches parsed from ${url}`);
  }

  csvCache.set(cacheKey, { rows: parsed, ts: Date.now() });
  return parsed;
}

/**
 * Load recent historical match CSVs for a single league (rolling 3 seasons) for MLE fitting.
 * Gracefully degrades if any individual season is unavailable.
 */
export async function loadRecentLeagueCsvMatches(league: string): Promise<CsvHistoricalMatch[]> {
  const leagueKey = league.toUpperCase().replace(/ /g, '_');
  if (!BACKTEST_CONFIG.DIVISION_MAP[leagueKey]) return [];

  const candidateSeasons = getRecentCsvSeasons(3, leagueKey);
  const settled = await Promise.allSettled(
    candidateSeasons.map((s) => fetchLeagueSeasonCsv(leagueKey, s))
  );

  const combined: CsvHistoricalMatch[] = [];
  for (const res of settled) {
    if (res.status === 'fulfilled') {
      combined.push(...res.value);
    }
  }

  combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return combined;
}

export async function loadBacktestDataset(
  seasons: readonly string[],
  leagues: readonly string[]
): Promise<{
  matchesByLeague: Record<string, CsvHistoricalMatch[]>;
  matchesDownloaded: number;
}> {
  const matchesByLeague: Record<string, CsvHistoricalMatch[]> = {};
  let matchesDownloaded = 0;

  const jobs: Promise<void>[] = [];
  for (const league of leagues) {
    matchesByLeague[league] = [];
    for (const season of seasons) {
      jobs.push(
        fetchLeagueSeasonCsv(league, season).then((rows) => {
          matchesByLeague[league].push(...rows);
          matchesDownloaded += rows.length;
        })
      );
    }
  }

  await Promise.all(jobs);

  for (const league of leagues) {
    matchesByLeague[league].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  return { matchesByLeague, matchesDownloaded };
}
