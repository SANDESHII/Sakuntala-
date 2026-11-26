import 'dotenv/config';
import express, { Request, Response } from 'express';
import compression from 'compression';
import { runPrediction, runBacktest, getLeagueRatings } from './src/core/engine';
import { getUpcomingFixtures, checkApiHealth } from './src/services/freeDataService';
import { LEAGUE_CONFIGS, BACKTEST_CONFIG } from './src/core/constants';
import { getTeamsForLeague } from './src/data/teamIds';
import { logger } from './src/services/logger';
import { BacktestSummary } from './src/types';

function getCliArg(flag: string): string | undefined {
  const prefix = `${flag}=`;
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === flag && i + 1 < process.argv.length) return process.argv[i + 1];
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
  }
  return undefined;
}

async function startServer() {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';
  const cliPort = Number(getCliArg('--port'));
  const port = Number.isFinite(cliPort) && cliPort > 0
    ? cliPort
    : isProd
      ? Number(process.env.PORT) || 3000
      : Number(process.env.DEFAULT_APP_PORT) || 3000;
  const host = getCliArg('--host') || '0.0.0.0';

  app.use(compression());
  app.use(express.json());

  let lastHealthCheck: { data: Record<string, unknown>; ts: number } | null = null;
  app.get('/api/health', async (_req: Request, res: Response) => {
    try {
      if (lastHealthCheck && Date.now() - lastHealthCheck.ts < 60000) {
        return res.json(lastHealthCheck.data);
      }

      const [football, odds] = await Promise.all([
        checkApiHealth('api-football'),
        checkApiHealth('the-odds-api'),
      ]);
      const healthData = {
        status: football && odds ? 'OPERATIONAL' : 'DEGRADED',
        services: {
          apiFootball: football ? 'HEALTHY' : 'DOWN',
          theOddsApi: odds ? 'HEALTHY' : 'DOWN',
        },
        timestamp: new Date().toISOString(),
      };
      lastHealthCheck = { data: healthData, ts: Date.now() };
      res.json(healthData);
    } catch (error: unknown) {
      res.status(500).json({ status: 'ERROR', message: (error as Error).message });
    }
  });

  app.get('/api/teams', (req: Request, res: Response) => {
    const league = ((req.query.league as string) || 'EPL').toUpperCase().replace(/ /g, '_');
    if (!LEAGUE_CONFIGS[league] && league !== 'STANDARD') {
      return res.status(400).json({ error: `Unsupported league: ${league}` });
    }
    return res.json({ league, teams: getTeamsForLeague(league) });
  });

  app.get('/api/ratings', async (req: Request, res: Response) => {
    try {
      const league = ((req.query.league as string) || 'EPL').toUpperCase().replace(/ /g, '_');
      if (!LEAGUE_CONFIGS[league]) {
        return res.status(400).json({ error: `Unsupported league: ${league}` });
      }
      const ratings = await getLeagueRatings(league);
      res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
      res.json(ratings);
    } catch (error: unknown) {
      logger.error('GET /api/ratings', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: (error as Error).message || 'Failed to compute league ratings' });
    }
  });

  app.post('/api/predict', async (req: Request, res: Response) => {
    try {
      const { homeTeam, awayTeam, league, asOfDate } = req.body || {};

      if (typeof homeTeam !== 'string' || typeof awayTeam !== 'string' || typeof league !== 'string') {
        return res.status(400).json({ error: 'Invalid input types' });
      }

      if (!homeTeam.trim() || !awayTeam.trim()) {
        return res.status(400).json({ error: 'Home and away teams are required' });
      }

      if (homeTeam.trim().toUpperCase() === awayTeam.trim().toUpperCase()) {
        return res.status(400).json({ error: 'Home and away teams must be different' });
      }

      if (asOfDate) {
        const date = new Date(asOfDate);
        if (isNaN(date.getTime())) return res.status(400).json({ error: 'Invalid asOfDate format' });
        if (date > new Date()) return res.status(400).json({ error: 'asOfDate cannot be in the future' });
      }

      const leagueKey = league.toUpperCase().replace(/ /g, '_');
      if (!LEAGUE_CONFIGS[leagueKey] && leagueKey !== 'STANDARD') {
        return res.status(400).json({ error: `Unsupported league: ${league}` });
      }

      const result = await runPrediction(homeTeam, awayTeam, leagueKey, null, asOfDate);
      res.json(result);
    } catch (error: unknown) {
      const { homeTeam, awayTeam, league } = req.body || {};
      logger.error('POST /api/predict', error instanceof Error ? error : new Error(String(error)), { homeTeam, awayTeam, league });
      res.status(500).json({ error: (error as Error).message || 'Prediction failed' });
    }
  });

  app.get('/api/fixtures', async (req: Request, res: Response) => {
    try {
      const league = (req.query.league as string) || 'EPL';
      const limit = Math.min(Number(req.query.limit) || 10, 50);

      const leagueKey = league.toUpperCase().replace(/ /g, '_');
      if (!LEAGUE_CONFIGS[leagueKey] && leagueKey !== 'STANDARD') {
        return res.status(400).json({ error: `Unsupported league: ${league}` });
      }

      const fixtures = await getUpcomingFixtures(leagueKey, limit);
      res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
      res.json(fixtures);
    } catch (error: unknown) {
      logger.error('GET /api/fixtures', error instanceof Error ? error : new Error(String(error)), { query: req.query });
      res.status(500).json({ error: (error as Error).message || 'Failed to fetch fixtures' });
    }
  });

  const backtestCache = new Map<string, { result: BacktestSummary; ts: number }>();
  const inFlightBacktest = new Map<string, Promise<BacktestSummary>>();
  const BACKTEST_CACHE_TTL = 6 * 60 * 60 * 1000;

  app.get('/api/backtest', async (req: Request, res: Response) => {
    try {
      const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
      const leaguesParam = typeof req.query.leagues === 'string' && req.query.leagues.trim()
        ? req.query.leagues
            .split(',')
            .map((l) => l.trim().toUpperCase())
            .filter((l) => BACKTEST_CONFIG.LEAGUES.includes(l))
        : [...BACKTEST_CONFIG.LEAGUES];

      const selectedLeagues = leaguesParam.length > 0 ? leaguesParam : [...BACKTEST_CONFIG.LEAGUES];
      const cacheKey = [...selectedLeagues].sort().join(',');

      const cached = backtestCache.get(cacheKey);
      if (!forceRefresh && cached && Date.now() - cached.ts < BACKTEST_CACHE_TTL) {
        return res.json(cached.result);
      }

      let pending = inFlightBacktest.get(cacheKey);
      if (!pending) {
        pending = runBacktest({ leagues: selectedLeagues });
        inFlightBacktest.set(cacheKey, pending);
      }

      let result: BacktestSummary;
      try {
        result = await pending;
      } finally {
        inFlightBacktest.delete(cacheKey);
      }

      if (result && result.totalMatches > 0) {
        backtestCache.set(cacheKey, { result, ts: Date.now() });
      }
      res.json(result);
    } catch (error: unknown) {
      logger.error('GET /api/backtest', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({
        totalMatches: 0,
        totalPnl: 0,
        totalYield: 0,
        avgClv: 0,
        clvCoverage: 0,
        avgClvNoVig: 0,
        brierScore: 0,
        marketBrier: null,
        brierVsMarket: null,
        clvStats: null,
        roi95CI: { low: 0, high: 0, stdErr: 0, nBets: 0 },
        maxDrawdown: 0,
        modelBreakdown: { mleFitted: 0, heuristicFallback: 0, d4Mismatches: 0 },
        dataLineage: { source: 'football-data.co.uk', seasons: [], leagues: [], matchesDownloaded: 0, matchesEvaluated: 0 },
        verdict: { status: 'INCONCLUSIVE', failingConditions: ['Backtest failed'] },
        over25Accuracy: 0,
        under25Accuracy: 0,
        edgeSegments: [],
        leagueBreakdown: [],
        equityCurve: [],
        matches: [],
        error: (error as Error).message || 'Backtest failed',
      });
    }
  });

  let viteServer: { close: () => Promise<void> } | null = null;
  let viteReady: Promise<{ middlewares: express.RequestHandler; close: () => Promise<void> }> | null = null;

  if (isProd) {
    app.use(express.static('dist'));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  } else {
    viteReady = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        server: { middlewareMode: true, hmr: false, ws: false, allowedHosts: true },
        appType: 'spa',
      })
    );
    app.use((req: Request, res: Response, next: express.NextFunction) => {
      viteReady!
        .then((vite) => vite.middlewares(req, res, next))
        .catch(next);
    });
  }

  const httpServer = app.listen(port, host, () => {
    logger.info('Server', `Quantitative Football AI active on http://${host}:${port} (${process.env.NODE_ENV || 'development'})`);
  });

  if (viteReady) {
    viteReady
      .then((vite) => {
        viteServer = vite;
      })
      .catch((err: unknown) => {
        logger.error('ViteInit', err instanceof Error ? err : new Error(String(err)));
        httpServer.close(() => process.exit(1));
        setTimeout(() => process.exit(1), 1000).unref();
      });
  }

  httpServer.on('error', (err: Error) => {
    logger.error('Server', err);
    process.exit(1);
  });

  const shutdown = () => {
    httpServer.close(() => {
      if (viteServer) {
        viteServer.close().finally(() => process.exit(0));
      } else {
        process.exit(0);
      }
    });
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

startServer().catch((err: unknown) => {
  logger.error('startServer', err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});
