import 'dotenv/config';
import express from 'express';
import compression from 'compression';

import { runPrediction, runBacktest } from './src/core/engine';
import { getUpcomingFixtures, checkApiHealth } from './src/services/freeDataService';
import { LEAGUE_CONFIGS } from './src/core/constants';
import { logger } from './src/services/logger';

async function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;

  app.use(compression());
  app.use(express.json());

  // --- API ROUTES ---
  app.post('/api/predict', async (req, res) => {
    try {
      const { homeTeam, awayTeam, league, asOfDate } = req.body;
      if (!homeTeam || !awayTeam || !league) {
        return res.status(400).json({ error: 'Required fields missing' });
      }

      const leagueKey = league.toUpperCase().replace(/ /g, '_');
      if (!LEAGUE_CONFIGS[leagueKey] && leagueKey !== 'STANDARD') {
        return res.status(400).json({ error: `Unsupported league: ${league}` });
      }

      const result = await runPrediction(homeTeam, awayTeam, league, null, asOfDate);
      res.json(result);
    } catch (error: unknown) {
      const { homeTeam, awayTeam, league } = req.body;
      logger.error('POST /api/predict', error instanceof Error ? error : new Error(String(error)), { homeTeam, awayTeam, league });
      res.status(500).json({ error: (error as Error).message || 'Prediction failed' });
    }
  });

  app.get('/api/fixtures', async (req, res) => {
    try {
      const league = (req.query.league as string) || 'EPL';
      const limit = Number(req.query.limit) || 10;
      const fixtures = await getUpcomingFixtures(league, limit);
      res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
      res.json(fixtures);
    } catch (error: unknown) {
      logger.error('GET /api/fixtures', error instanceof Error ? error : new Error(String(error)), { query: req.query });
      res.status(500).json({ error: (error as Error).message || 'Failed to fetch fixtures' });
    }
  });

  app.get('/api/health', async (_req, res) => {
    try {
      const [football, odds] = await Promise.all([
        checkApiHealth('api-football'),
        checkApiHealth('the-odds-api')
      ]);
      res.json({
        status: football && odds ? 'OPERATIONAL' : 'DEGRADED',
        services: {
          apiFootball: football ? 'HEALTHY' : 'DOWN',
          theOddsApi: odds ? 'HEALTHY' : 'DOWN'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: unknown) {
      res.status(500).json({ status: 'ERROR', message: (error as Error).message });
    }
  });

  // Backtest Cache
  let backtestCache: { result: any, ts: number } | null = null;
  const BACKTEST_CACHE_TTL = 6 * 60 * 60 * 1000;

  app.get('/api/backtest', async (_req, res) => {
    try {
      if (backtestCache && Date.now() - backtestCache.ts < BACKTEST_CACHE_TTL) {
        return res.json(backtestCache.result);
      }

      const result = await runBacktest();
      if (result && result.totalMatches > 0) {
        backtestCache = { result, ts: Date.now() };
      }
      res.json(result);
    } catch (error: unknown) {
      logger.error('GET /api/backtest', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({
        totalMatches: 0, totalPnl: 0, totalYield: 0, avgClv: 0, brierScore: 0,
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
    app.get('/{*splat}', (_req, res) => {
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
    console.log(`
  🚀 Quantitative Football AI System Active
  ──────────────────────────────
  URL: http://localhost:${port}
  ENV: ${process.env.NODE_ENV || 'development'}
  DB:  Static Fallbacks Pre-loaded
  ──────────────────────────────
    `);
  });
}

startServer().catch((err: unknown) => {
  logger.error('startServer', err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});
