import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import { runPrediction, runBacktest } from './src/core/engine';
import { getUpcomingFixtures, checkApiHealth } from './src/services/freeDataService';
import { LEAGUE_CONFIGS } from './src/core/constants';
import { logger } from './src/services/logger';
import { BacktestSummary } from './src/types';

async function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;

  app.use(compression());
  app.use(express.json());

  // --- AUTH & RATE LIMITING (Placeholder for Phase 5/11) ---
  const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['x-api-key'];
    const validKey = process.env.API_KEY;
    if (validKey && authHeader !== validKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  // --- API ROUTES ---

  // Health check with ~60s cache
  let lastHealthCheck: { data: any; ts: number } | null = null;
  app.get('/api/health', async (_req: Request, res: Response) => {
    try {
      if (lastHealthCheck && Date.now() - lastHealthCheck.ts < 60000) {
        return res.json(lastHealthCheck.data);
      }

      const [football, odds] = await Promise.all([
        checkApiHealth('api-football'),
        checkApiHealth('the-odds-api')
      ]);
      const healthData = {
        status: football && odds ? 'OPERATIONAL' : 'DEGRADED',
        services: {
          apiFootball: football ? 'HEALTHY' : 'DOWN',
          theOddsApi: odds ? 'HEALTHY' : 'DOWN'
        },
        timestamp: new Date().toISOString()
      };
      lastHealthCheck = { data: healthData, ts: Date.now() };
      res.json(healthData);
    } catch (error: unknown) {
      res.status(500).json({ status: 'ERROR', message: (error as Error).message });
    }
  });

  app.post('/api/predict', apiKeyAuth, async (req: Request, res: Response) => {
    try {
      const { homeTeam, awayTeam, league, asOfDate } = req.body || {};
      
      // Validation
      if (typeof homeTeam !== 'string' || typeof awayTeam !== 'string' || typeof league !== 'string') {
        return res.status(400).json({ error: 'Invalid input types' });
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

  // Backtest Cache & Deduping
  let backtestCache: { result: BacktestSummary; ts: number } | null = null;
  let inFlightBacktest: Promise<BacktestSummary> | null = null;
  const BACKTEST_CACHE_TTL = 6 * 60 * 60 * 1000;

  app.get('/api/backtest', apiKeyAuth, async (_req: Request, res: Response) => {
    try {
      if (backtestCache && Date.now() - backtestCache.ts < BACKTEST_CACHE_TTL) {
        return res.json(backtestCache.result);
      }

      if (inFlightBacktest) {
        const result = await inFlightBacktest;
        return res.json(result);
      }

      inFlightBacktest = runBacktest();
      const result = await inFlightBacktest;
      inFlightBacktest = null;

      if (result && result.totalMatches > 0) {
        backtestCache = { result, ts: Date.now() };
      }
      res.json(result);
    } catch (error: unknown) {
      inFlightBacktest = null;
      logger.error('GET /api/backtest', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({
        totalMatches: 0, totalPnl: 0, totalYield: 0, avgClv: 0, clvCoverage: 0, avgClvNoVig: 0, brierScore: 0,
        over25Accuracy: 0, under25Accuracy: 0, edgeSegments: [],
        matches: [], error: (error as Error).message || 'Backtest failed'
      });
    }
  });

  // ======================
  // Frontend Serving
  // ======================

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, () => {
    logger.info('Server', `🚀 Quantitative Football AI System Active | Port: ${port} | Env: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch((err: unknown) => {
  logger.error('startServer', err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});
