import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { runPrediction, runBacktest } from './src/core/engine';
import { getUpcomingFixtures, getLiveOdds, getTeamStats } from './src/services/freeDataService';

async function startServer() {
  const app = express();
  const port = 3000;

  app.use(express.json());

  // ======================
  // API ROUTES (Local Dev)
  // ======================

  // Predict
  app.get('/api/predict', async (req, res) => {
    try {
      const home = req.query.home as string;
      const away = req.query.away as string;
      const league = req.query.league as string;

      if (!home || !away || !league) {
        return res.status(400).json({ error: 'home, away and league are required' });
      }

      const result = await runPrediction(home, away, league);
      res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
      res.json(result);
    } catch (error: any) {
      console.error('Predict Error:', error);
      res.status(500).json({ error: error.message || 'Prediction failed' });
    }
  });

  app.post('/api/predict', async (req, res) => {
    try {
      const { homeTeam, awayTeam, league } = req.body;

      if (!homeTeam || !awayTeam || !league) {
        return res.status(400).json({ error: 'homeTeam, awayTeam and league are required' });
      }

      const result = await runPrediction(homeTeam, awayTeam, league);
      res.json(result);
    } catch (error: any) {
      console.error('Predict Error:', error);
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
      console.error('Fixtures Error:', error);
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
      console.error('Odds Error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch odds' });
    }
  });

  // Team Stats
  app.get('/api/stats', async (req, res) => {
    try {
      const team = req.query.team as string;
      const league = req.query.league as string;

      if (!team || !league) {
        return res.status(400).json({ error: 'team and league are required' });
      }

      const stats = await getTeamStats(team, league);
      res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=43200');
      res.json(stats);
    } catch (error: any) {
      console.error('Team Stats Error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch team stats' });
    }
  });

  // Backtest Cache
  let backtestCache: { result: any, ts: number } | null = null;
  const BACKTEST_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

  // Backtest
  app.get('/api/backtest', async (_req, res) => {
    try {
      // Return cached result if valid
      if (backtestCache && Date.now() - backtestCache.ts < BACKTEST_CACHE_TTL) {
        return res.json(backtestCache.result);
      }

      const result = await runBacktest();
      
      // Only cache successful results with actual matches
      if (result && result.totalMatches > 0 && !result.error) {
        backtestCache = { result, ts: Date.now() };
      }

      res.json(result);
    } catch (error: any) {
      console.error('Backtest Error:', error);
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
