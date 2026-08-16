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

    /**
     * Phase 1: Stochastic Outlier Smoothing (SOS)
     * Caps goals to prevent 'Black Swan' events from ruining the distribution.
     */
    static squashGoals(goals: number): number {
        if (goals <= 3) return goals;
        // Goals above 3 follow a logarithmic dampening to preserve 'Superiority' 
        // without allowing 'Noise' to dominate the solver.
        return 3 + Math.log10(goals - 2);
    }

    /**
     * Phase 2: Game-State Purity Index (GSPI)
     * Calculates the 'Tactical Purity' of a match based on anomalies like Red Cards and Penalty Bias.
     */
    static calculatePurity(row: any): number {
        let purity = 1.0;
        const hr = this.clean(row.HR || row.homeRedCards);
        const ar = this.clean(row.AR || row.awayRedCards);
        const hg = this.clean(row.homeGoals ?? row.FTHG);
        const ag = this.clean(row.awayGoals ?? row.FTAG);
        const hst = this.clean(row.HST);
        const ast = this.clean(row.AST);
        
        // Red cards significantly pollute tactical data
        if (hr > 0 || ar > 0) {
            purity *= 0.45; // Baseline penalty for any red card
            if (hr + ar > 1) purity *= 0.5; // Exponential penalty for multi-red chaos
        }

        // Ghost Goals / Low Density Detection
        // If a team scores 2+ goals with < 3 shots on target, it's likely a fluke/penalty heavy
        if ((hg >= 2 && hst < 3) || (ag >= 2 && ast < 3)) {
            purity *= 0.8;
        }

        return purity;
    }

    static validateMatch(row: any, league: string): MatchHistory | null {
        const home = ProfileService.canonicalize(row.homeTeam || row.HomeTeam).id;
        const away = ProfileService.canonicalize(row.awayTeam || row.AwayTeam).id;
        const date = row.date || row.Date;
        
        // Semantic Gatekeeper: Drop rows with missing core IDs
        if (!home || !away || !date) return null;

        const hg = this.clean(row.homeGoals ?? row.FTHG);
        const ag = this.clean(row.awayGoals ?? row.FTAG);
        const hst = this.clean(row.HST);
        const ast = this.clean(row.AST);

        // Phase 4: Structural Anomaly Detection
        // Physically impossible data points are purged immediately.
        if (hg > 0 && hst === 0) return null; // Goals without shots on target = Corrupt
        if (ag > 0 && ast === 0) return null;
        if (hg > 15 || ag > 15) return null; // Extreme outliers (likely data entry error)

        return {
            homeTeam: home, awayTeam: away, date,
            homeGoals: this.squashGoals(hg), // Apply SOS
            awayGoals: this.squashGoals(ag), // Apply SOS
            homeShotsOnTarget: hst,
            awayShotsOnTarget: ast,
            homeCorners: this.clean(row.HC),
            awayCorners: this.clean(row.AC),
            homeRedCards: this.clean(row.HR),
            awayRedCards: this.clean(row.AR),
            league,
            purity: this.calculatePurity(row) // Attach GSPI
        } as MatchHistory;
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
        
        /**
         * Phase 5: Weighting Fusion
         * Combines Recency (Time-Decay) and Tactical Purity into a single Alpha coefficient.
         */
        const decayMatches = matches.map(m => {
            const daysAgo = (now - new Date(m.date).getTime()) / (1000 * 60 * 60 * 24);
            const timeWeight = Math.exp(-0.00385 * daysAgo); 
            const purityWeight = m.purity || 1.0;
            const weight = timeWeight * purityWeight; // The Final Alpha
            return { ...m, weight };
        });

        const avgHG = decayMatches.reduce((acc, m) => acc + m.homeGoals, 0) / decayMatches.length || 1.35;
        const avgAG = decayMatches.reduce((acc, m) => acc + m.awayGoals, 0) / decayMatches.length || 1.25;

        return { 
            rhoData: DixonColes.fitRho(decayMatches.slice(-500).map(m => ({ 
                x: m.homeGoals, y: m.awayGoals, lambda: avgHG, mu: avgAG, weight: m.weight || 1.0
            }))),
            matches: decayMatches 
        };
    }

    static standardize(team: any, context?: { avgXG: number, avgStability: number }): TeamStats {
        const defaults = context || { avgXG: 1.35, avgStability: 0.65 };
        return {
            name: team.name || 'Unknown',
            goalsScored: team.goalsScored || 0,
            goalsConceded: team.goalsConceded || 0,
            avgXG: team.avgXG || defaults.avgXG,
            avgXGA: team.avgXGA || defaults.avgXG,
            npxG: team.npxG || defaults.avgXG,
            defensiveStability: team.defensiveStability || defaults.avgStability,
            offensiveVolatility: 0.5,
            form: team.form || [0.5],
            cleanSheets: team.cleanSheets || 0,
            dataPurity: team.purity || 0.5
        };
    }
}
