import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import { runPrediction, runBacktest } from './src/core/engine';
import { getUpcomingFixtures, getLiveOdds } from './src/services/freeDataService';

async function startServer() {
  const app = express();
  const port = 3000;

  app.use(compression());
  app.use(express.json());

  // ======================
  // API ROUTES (Local Dev)
  // ======================

    // Predict
    app.post('/api/predict', async (req, res) => {
        try {
            const { homeTeam, awayTeam, league, asOfDate } = req.body;

            if (!homeTeam || !awayTeam || !league) {
                return res.status(400).json({ error: 'Required fields missing' });
            }

            const result = await runPrediction(
                homeTeam, 
                awayTeam, 
                league, 
                null,
                null,
                asOfDate
            );
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message || 'Prediction failed' });
        }
    });

    // Fixtures
    app.get('/api/fixtures', async (req, res) => {
        try {
            const league = (req.query.league as string) || 'EPL';
            const limit = Number(req.query.limit) || 10;

            const fixtures = await getUpcomingFixtures(league, limit);
            res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
            res.json(fixtures);
        } catch (error: any) {
            res.status(500).json({ error: error.message || 'Failed to fetch fixtures' });
        }
    });

    // Odds
    app.get('/api/odds', async (req, res) => {
        try {
            const league = (req.query.league as string) || 'EPL';
            const odds = await getLiveOdds(league);
            res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
            res.json(odds);
        } catch (error: any) {
            res.status(500).json({ error: error.message || 'Failed to fetch odds' });
        }
    });

  // Backtest Cache
  let backtestCache: { result: any, ts: number } | null = null;
  const BACKTEST_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

    // Backtest
    app.get('/api/backtest', async (_req, res) => {
        try {
            if (backtestCache && Date.now() - backtestCache.ts < BACKTEST_CACHE_TTL) {
                return res.json(backtestCache.result);
            }

            const result = await runBacktest();
            
            if (result && result.totalMatches > 0 && !result.error) {
                backtestCache = { result, ts: Date.now() };
            }

            res.json(result);
        } catch (error: any) {
            res.status(500).json({
                totalMatches: 0,
                totalPnl: 0,
                totalYield: 0,
                avgClv: 0,
                over25Accuracy: 0,
                under25Accuracy: 0,
                edgeSegments: [],
                matches: [],
                error: error.message || 'Backtest failed'
            });
        }
    });

  // ======================
  // Frontend Serving
  // ======================

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
