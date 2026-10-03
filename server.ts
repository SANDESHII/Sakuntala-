import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { runBacktest, runArenaPrediction } from './src/core/engine';
import { getUpcomingFixtures, getLiveOdds } from './src/services/freeDataService';
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const port = 3000;

  // AI Setup
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });

  app.use(express.json());

  // ======================
  // API ROUTES (Local Dev)
  // ======================

    // Predict
    app.post('/api/predict', async (req, res) => {
        try {
            const { homeTeam, awayTeam, league, arenaConfig, adaptiveThresholdContext } = req.body;

            if (!homeTeam || !awayTeam || !league) {
                return res.status(400).json({ error: 'Required fields missing' });
            }

            const result = await runArenaPrediction(
                homeTeam, 
                awayTeam, 
                league, 
                arenaConfig || { enableArena: false, cardCount: 0 },
                null,
                null,
                adaptiveThresholdContext
            );
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message || 'Prediction failed' });
        }
    });

    // Briefing
    app.post('/api/briefing', async (req, res) => {
        try {
            const { analysis } = req.body;
            if (!analysis) return res.status(400).json({ error: 'Analysis data required' });

            const prompt = `
                Act as a professional sports betting quant analyst. 
                Analyze this football match data and provide a concise, high-density briefing.
                
                Match: ${analysis.homeStats.name} vs ${analysis.awayStats.name}
                League: ${analysis.context.league}
                Expected Goals: ${analysis.homeExpectedGoals.toFixed(2)} (H) - ${analysis.awayExpectedGoals.toFixed(2)} (A)
                Market Type: ${analysis.predictionType}
                Model Probability: ${(analysis.probability * 100).toFixed(1)}%
                Market Edge: ${analysis.edge ? (analysis.edge * 100).toFixed(1) : 'N/A'}%
                Stake Recommendation: ${analysis.recommendedStake.toFixed(2)} units (Kelly Fraction: 0.35)
                Model Source: ${analysis.modelSource}

                Briefing Requirements:
                1. 2-3 sentences max.
                2. Professional, cold, technical tone.
                3. Focus on value discrepancy between model and market.
                4. Mention if the "Dixon-Coles MLE" model finds specific weakness in defensive form.
                5. No fluff, no "Good luck".
            `;

            const aiResponse = await ai.models.generateContent({
                model: "gemini-3.8-flash",
                contents: prompt,
            });

            res.json({ text: aiResponse.text });
        } catch (error: any) {
            res.status(500).json({ error: error.message || 'Briefing generation failed' });
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
