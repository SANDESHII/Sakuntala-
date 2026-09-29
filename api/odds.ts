import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getLiveOdds } from '../src/services/freeDataService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const league = (req.query.league as string) || 'EPL';

    const odds = await getLiveOdds(league);

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    return res.status(200).json(odds);
  } catch (error: any) {
    console.error('Odds Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch odds' });
  }
}
