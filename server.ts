import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { runPrediction } from './src/core/engine';

async function startServer() {
  const app = express();
  const port = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json());

  // API Route for Prediction
  app.post('/api/predict', async (req, res) => {
    try {
      const { homeTeam, awayTeam, league, adaptiveThresholdContext } = req.body;
      
      if (!homeTeam || !awayTeam || !league) {
        return res.status(400).json({ error: 'Missing required parameters: homeTeam, awayTeam, league' });
      }

      const result = await runPrediction(homeTeam, awayTeam, league, null, null, adaptiveThresholdContext);
      res.json(result);
    } catch (error: any) {
      console.error('Prediction Error:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  app.get('/api/predict', async (req, res) => {
    try {
      const home = req.query.home as string;
      const away = req.query.away as string;
      const league = req.query.league as string;

      if (!home || !away || !league) {
        return res.status(400).json({ error: 'home, away and league are required' });
      }

      // runPrediction handles team stats and odds resolution internally
      const result = await runPrediction(home, away, league);

      // Cache prediction for 30 minutes (1800s)
      res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
      res.json(result);
    } catch (error: any) {
      console.error('Prediction GET Error:', error);
      res.status(500).json({ error: error.message || 'Prediction failed' });
    }
  });

  let backtestCache: { result: any, ts: number } | null = null;
  const BACKTEST_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

  app.get('/api/backtest', async (_req, res) => {
    try {
      if (backtestCache && Date.now() - backtestCache.ts < BACKTEST_CACHE_TTL) {
        return res.json(backtestCache.result);
      }

      const { runBacktest } = await import('./src/core/engine');
      const result = await runBacktest();
      
      // Only cache if it actually returned some matches (valid results)
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
        edgeSegments: [],
        matches: [],
        error: error.message || 'Backtest failed to execute. Check server logs for details.'
      });
    }
  });

  app.get('/api/fixtures', async (req, res) => {
    try {
      const { getUpcomingFixtures } = await import('./src/services/freeDataService');
      const league = (req.query.league as string) || 'EPL';
      const limit = Number(req.query.limit) || 10;
      
      const fixtures = await getUpcomingFixtures(league, limit);
      
      // Cache for 30 minutes
      res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
      res.json(fixtures);
    } catch (error: any) {
      console.error('Fixtures Error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch fixtures' });
    }
  });

  app.get('/api/odds', async (req, res) => {
    try {
      const { getLiveOdds } = await import('./src/services/freeDataService');
      const league = (req.query.league as string) || 'EPL';

      const odds = await getLiveOdds(league);

      // Cache for 15 minutes (900 seconds)
      res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
      res.json(odds);
    } catch (error: any) {
      console.error('Odds API Error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch odds' });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    // Handle SPA routing
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
