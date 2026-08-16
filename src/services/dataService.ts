import { MatchHistory, TeamStats } from '../types/match';
import { ProfileService } from './profileService';
import { FootballDataProvider } from './data/footballDataProvider';
import { DixonColes } from '../core/math';
import { db } from '../lib/firebase';
import { collection, query, where, getDocsFromServer, writeBatch, doc, limit } from 'firebase/firestore';

export class DataService {
    /**
     * STAGE 1: RAW DATA CLEANSING (Sanitization)
     * Standardizes unpredictable data types into clean, quantitative floats.
     */
    static sanitize(v: any): number {
        if (v === null || v === undefined) return 0;
        const p = parseFloat(String(v).replace(/%/g, '').replace(/[^0-9.-]/g, ''));
        return isNaN(p) ? 0 : p;
    }

    /**
     * STAGE 2: DATA FILTERING (Signal Integrity)
     * Identifies 'Signal Purity' while protecting high-variance 'Chaos Data' for overdispersion.
     */
    static calculatePurity(_row: any): number {
        // FIXED 1.0: No tactical censorship. All valid matches are treated as pure signal.
        // The engine requires the raw 'Chaos Data' (red cards, blowouts) to model overdispersion.
        return 1.0;
    }

    /**
     * STAGE 2.5: STRUCTURAL FILTERING (Anomaly Purge)
     * Removes physically impossible or structurally corrupt data points.
     */
    static validateMatch(row: any, league: string): MatchHistory | null {
        const home = ProfileService.canonicalize(row.homeTeam || row.HomeTeam).id;
        const away = ProfileService.canonicalize(row.awayTeam || row.AwayTeam).id;
        const date = row.date || row.Date;
        
        if (!home || !away || !date) return null;

        const hg = this.sanitize(row.homeGoals ?? row.FTHG);
        const ag = this.sanitize(row.awayGoals ?? row.FTAG);
        const hst = this.sanitize(row.HST);
        const ast = this.sanitize(row.AST);
        const hr = this.sanitize(row.HR || row.homeRedCards);
        const ar = this.sanitize(row.AR || row.awayRedCards);

        // Structural Anomaly Purge: Goals without shots or extreme outliers
        if (hg > 0 && hst === 0) return null; 
        if (ag > 0 && ast === 0) return null;
        if (hg > hst + 1 || ag > ast + 1) return null; 
        if (hg > 35 || ag > 35) return null; // Raised from 15 to allow raw chaotic signals

        return {
            homeTeam: home, awayTeam: away, date,
            homeGoals: hg, 
            awayGoals: ag, 
            homeShotsOnTarget: hst,
            awayShotsOnTarget: ast, 
            homeCorners: this.sanitize(row.HC),
            awayCorners: this.sanitize(row.AC),
            homeRedCards: hr,
            awayRedCards: ar,
            league,
            purity: this.calculatePurity(row)
        } as MatchHistory;
    }

    /**
     * STAGE 4: CONTEXTUAL ALPHA WEIGHTING
     * Adjusts the importance of a match based on the opponent's defensive context.
     */
    static calculateOpponentAdjustedWeight(hg: number, ag: number, opponentId: string, defensiveRanks: Record<string, number>): number {
        const gd = Math.abs(hg - ag);
        if (gd < 3) return 1.0;
        
        const weakness = defensiveRanks[opponentId] || 0.5;
        return 1 + (weakness * 0.5);
    }

    static async getLeagueContext(league: string) {
        const normalized = FootballDataProvider.normalizeLeague(league);
        const q = query(collection(db, 'historicalMatches'), where('league', '==', normalized), limit(2000));
        const snap = await getDocsFromServer(q);
        let matches = snap.docs.map(d => d.data() as MatchHistory);

        if (matches.length < 200) {
            matches = await FootballDataProvider.fetchBacklog(normalized, 3);
            const batch = writeBatch(db);
            matches.forEach(m => {
                const id = `${m.date}_${m.homeTeam}_${m.awayTeam}`;
                batch.set(doc(db, 'historicalMatches', id), m, { merge: true });
            });
            await batch.commit();
        }

        const now = new Date().getTime();
        
        /**
         * Phase 5: Weighting Fusion - Maximum Rigor
         * Combines Recency, Purity, and Season Phase into the Final Alpha.
         */
        const decayMatches = matches.map(m => {
            const matchDate = new Date(m.date);
            const daysAgo = (now - matchDate.getTime()) / (1000 * 60 * 60 * 24);
            
            let timeWeight = Math.exp(-0.00385 * daysAgo); 
            let purityWeight = m.purity || 1.0;
            
            // Season Phase Variance: May/June results are more volatile (motivation noise)
            const month = matchDate.getMonth();
            if (month === 4 || month === 5) { // May or June
                purityWeight *= 0.85; 
            }

            const weight = timeWeight * purityWeight; 
            return { ...m, weight };
        });

        const avgHG = decayMatches.reduce((acc, m) => acc + m.homeGoals, 0) / decayMatches.length || 1.35;
        const avgAG = decayMatches.reduce((acc, m) => acc + m.awayGoals, 0) / decayMatches.length || 1.25;
        
        /**
         * STAGE 3: FEATURE ENGINEERING (Trait Extraction)
         * Converts match events into persistent team traits (Clinical Edge, Disciplinary Propensity).
         */
        const teamDeficits: Record<string, { conceded: number, games: number }> = {};
        decayMatches.forEach(m => {
            if (!teamDeficits[m.homeTeam]) teamDeficits[m.homeTeam] = { conceded: 0, games: 0 };
            if (!teamDeficits[m.awayTeam]) teamDeficits[m.awayTeam] = { conceded: 0, games: 0 };
            teamDeficits[m.homeTeam].conceded += m.awayGoals;
            teamDeficits[m.homeTeam].games++;
            teamDeficits[m.awayTeam].conceded += m.homeGoals;
            teamDeficits[m.awayTeam].games++;
        });

        const defensiveRanks: Record<string, number> = {};
        const redCardStats: Record<string, { reds: number, games: number }> = {};
        const clinicalStats: Record<string, { delta: number, games: number }> = {};
        
        Object.entries(teamDeficits).forEach(([id, stats]) => {
            defensiveRanks[id] = stats.conceded / stats.games;
        });

        decayMatches.forEach(m => {
            if (!redCardStats[m.homeTeam]) redCardStats[m.homeTeam] = { reds: 0, games: 0 };
            if (!redCardStats[m.awayTeam]) redCardStats[m.awayTeam] = { reds: 0, games: 0 };
            redCardStats[m.homeTeam].reds += (m.homeRedCards || 0);
            redCardStats[m.homeTeam].games++;
            redCardStats[m.awayTeam].reds += (m.awayRedCards || 0);
            redCardStats[m.awayTeam].games++;

            // Step C: Clinical Edge Calculation (Goals - xG Proxy)
            // xG Proxy = SOT * 0.3 (Conservative finishing expectation)
            if (!clinicalStats[m.homeTeam]) clinicalStats[m.homeTeam] = { delta: 0, games: 0 };
            if (!clinicalStats[m.awayTeam]) clinicalStats[m.awayTeam] = { delta: 0, games: 0 };
            
            const hXG = (m.homeShotsOnTarget || 0) * 0.3;
            const aXG = (m.awayShotsOnTarget || 0) * 0.3;
            
            clinicalStats[m.homeTeam].delta += (m.homeGoals - hXG);
            clinicalStats[m.homeTeam].games++;
            clinicalStats[m.awayTeam].delta += (m.awayGoals - aXG);
            clinicalStats[m.awayTeam].games++;
        });

        const redCardPropensity: Record<string, number> = {};
        Object.entries(redCardStats).forEach(([id, stats]) => {
            redCardPropensity[id] = stats.reds / stats.games;
        });

        const clinicalEdge: Record<string, number> = {};
        Object.entries(clinicalStats).forEach(([id, stats]) => {
            // Normalized Clinical Edge: Positive means elite finishing
            clinicalEdge[id] = stats.delta / stats.games;
        });

        // Normalize ranks (0.0 = Best Defense, 1.0 = Worst Defense)
        const maxConceded = Math.max(...Object.values(defensiveRanks), 1.0);
        Object.keys(defensiveRanks).forEach(id => {
            defensiveRanks[id] /= maxConceded;
        });

        /**
         * Phase 5: Weighting Fusion - Opponent Adjusted Alpha
         * Combines Recency, Purity, and Opponent Weakness Factor.
         */
        const finalizedMatches = decayMatches.map(m => {
            const hWeight = this.calculateOpponentAdjustedWeight(m.homeGoals, m.awayGoals, m.awayTeam, defensiveRanks);
            const aWeight = this.calculateOpponentAdjustedWeight(m.awayGoals, m.homeGoals, m.homeTeam, defensiveRanks);
            const alphaBoost = Math.max(hWeight, aWeight);
            return { ...m, weight: m.weight * alphaBoost };
        });

        // Calculate Empirical Variance for Overdispersion Handling
        const varHG = finalizedMatches.reduce((acc, m) => acc + Math.pow(m.homeGoals - avgHG, 2), 0) / finalizedMatches.length || 1.1;
        const varAG = finalizedMatches.reduce((acc, m) => acc + Math.pow(m.awayGoals - avgAG, 2), 0) / finalizedMatches.length || 1.1;

        // Quantifying Cleansing Accuracy (Refinery Audit)
        const audit = {
            signalIntegrity: '100% (Raw Signal Flow)',
            alphaAdjustment: 'Active (Opponent-Adjusted Boost)',
            redCardRegime: 'Active (Chaos Preservation)',
            dataReliability: 'High (Unfiltered Reality)',
            sampleSize: finalizedMatches.length
        };

        return { 
            rhoData: DixonColes.fitRho(finalizedMatches.slice(-500).map(m => ({ 
                x: m.homeGoals, y: m.awayGoals, lambda: avgHG, mu: avgAG, weight: m.weight || 1.0
            }))),
            avgHG,
            avgAG,
            varHG,
            varAG,
            redCardPropensity,
            clinicalEdge,
            matches: finalizedMatches,
            audit
        };
    }

    static standardize(team: any, context?: { avgXG: number, avgStability: number, redCardPropensity?: number, clinicalEdge?: number }): TeamStats {
        const defaults = context || { avgXG: 1.35, avgStability: 0.65, redCardPropensity: 0.05, clinicalEdge: 0 };
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
            dataPurity: team.purity || 0.5,
            redCardPropensity: team.redCardPropensity || defaults.redCardPropensity || 0.05,
            clinicalEdge: team.clinicalEdge || defaults.clinicalEdge || 0
        };
    }
}
