import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runPrediction } from '../src/core/engine';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const home = (req.method === 'POST' ? req.body?.homeTeam : req.query.home) as string;
    const away = (req.method === 'POST' ? req.body?.awayTeam : req.query.away) as string;
    const league = (req.method === 'POST' ? req.body?.league : req.query.league) as string;

    if (!home || !away || !league) {
      return res.status(400).json({ error: 'home, away and league are required' });
    }

    const result = await runPrediction(home, away, league);

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Predict Error:', error);
    return res.status(500).json({ error: error.message || 'Prediction failed' });
  }
}
