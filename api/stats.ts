import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getTeamStats } from '../src/services/freeDataService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const team = req.query.team as string;
    const league = req.query.league as string;

    if (!team || !league) {
      return res.status(400).json({ error: 'team and league are required' });
    }

    const stats = await getTeamStats(team, league);

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=43200');
    return res.status(200).json(stats);
  } catch (error: any) {
    console.error('Team Stats Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch team stats' });
  }
}
