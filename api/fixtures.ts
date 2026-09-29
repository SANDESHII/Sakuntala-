import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUpcomingFixtures } from '../src/services/freeDataService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const league = (req.query.league as string) || 'EPL';
    const limit = Number(req.query.limit) || 10;

    const fixtures = await getUpcomingFixtures(league, limit);

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json(fixtures);
  } catch (error: any) {
    console.error('Fixtures Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch fixtures' });
  }
}
