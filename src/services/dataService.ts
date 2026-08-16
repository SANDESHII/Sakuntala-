import { MatchHistory, TeamStats } from '../types/match';
import { ProfileService } from './profileService';
import { FootballDataProvider } from './data/footballDataProvider';
import { DixonColes } from '../core/math';
import { db } from '../lib/firebase';
import { collection, query, where, getDocsFromServer, writeBatch, doc, limit } from 'firebase/firestore';

export class DataService {
    static clean(v: any): number {
        const p = parseFloat(String(v).replace(/%/g, '').replace(/[^0-9.-]/g, ''));
        return isNaN(p) ? 0 : p;
    }

    static validateMatch(row: any, league: string): MatchHistory | null {
        const home = ProfileService.canonicalize(row.homeTeam || row.HomeTeam).id;
        const away = ProfileService.canonicalize(row.awayTeam || row.AwayTeam).id;
        const date = row.date || row.Date;
        if (!home || !away || !date) return null;

        return {
            homeTeam: home, awayTeam: away, date,
            homeGoals: this.clean(row.homeGoals ?? row.FTHG),
            awayGoals: this.clean(row.awayGoals ?? row.FTAG),
            homeShotsOnTarget: this.clean(row.HST),
            awayShotsOnTarget: this.clean(row.AST),
            homeCorners: this.clean(row.HC),
            awayCorners: this.clean(row.AC),
            homeRedCards: this.clean(row.HR),
            awayRedCards: this.clean(row.AR),
            league
        };
    }

    static async getLeagueContext(league: string) {
        const q = query(collection(db, 'historicalMatches'), where('league', '==', league), limit(2000));
        const snap = await getDocsFromServer(q);
        let matches = snap.docs.map(d => d.data() as MatchHistory);

        if (matches.length < 200) {
            matches = await FootballDataProvider.fetchBacklog(league, 3);
            const batch = writeBatch(db);
            matches.forEach(m => {
                const id = `${m.date}_${m.homeTeam}_${m.awayTeam}`;
                batch.set(doc(db, 'historicalMatches', id), m, { merge: true });
            });
            await batch.commit();
        }

        const now = new Date().getTime();
        const decayMatches = matches.map(m => {
            const daysAgo = (now - new Date(m.date).getTime()) / (1000 * 60 * 60 * 24);
            const weight = Math.exp(-0.00385 * daysAgo); 
            return { ...m, weight };
        });

        return { 
            rhoData: DixonColes.fitRho(decayMatches.slice(-500).map(m => ({ 
                x: m.homeGoals, y: m.awayGoals, lambda: 1.35, mu: 1.25, weight: (m as any).weight || 1.0
            }))),
            matches: decayMatches 
        };
    }

    static standardize(team: any): TeamStats {
        return {
            name: team.name || 'Unknown',
            goalsScored: team.goalsScored || 0,
            goalsConceded: team.goalsConceded || 0,
            avgXG: team.avgXG || 1.3,
            avgXGA: team.avgXGA || 1.3,
            npxG: team.npxG || 1.3,
            defensiveStability: team.defensiveStability || 0.6,
            offensiveVolatility: 0.5,
            form: team.form || [0.5],
            cleanSheets: team.cleanSheets || 0,
            dataPurity: team.purity || 0.5
        };
    }
}
