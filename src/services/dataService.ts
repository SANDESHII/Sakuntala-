import { MatchHistory, TeamStats } from '../types';
import { ProfileService } from './profileService';
import { FootballDataProvider } from './data/footballDataProvider';
import { DixonColes } from '../core/math';
import { db } from '../lib/firebase';
import { collection, query, where, getDocsFromServer, writeBatch, doc, limit } from 'firebase/firestore';

export class DataService {
    static sanitize(v: any): number {
        if (v === null || v === undefined) return 0;
        if (typeof v === 'number') return v;
        const p = parseFloat(String(v).replace(/%/g, '').replace(/[^0-9.-]/g, ''));
        return isNaN(p) ? 0 : p;
    }

    static validateMatch(row: any, league: string): MatchHistory | null {
        const home = ProfileService.canonicalize(row.homeTeam || row.HomeTeam).id;
        const away = ProfileService.canonicalize(row.awayTeam || row.AwayTeam).id;
        const date = row.date || row.Date;
        
        if (!home || !away || !date) return null;

        const hg = this.sanitize(row.homeGoals ?? row.FTHG);
        const ag = this.sanitize(row.awayGoals ?? row.FTAG);
        const hst = this.sanitize(row.HST ?? row.homeShotsOnTarget);
        const ast = this.sanitize(row.AST ?? row.awayShotsOnTarget);
        const hxg = row.homeXG ? this.sanitize(row.homeXG) : undefined;
        const axg = row.awayXG ? this.sanitize(row.awayXG) : undefined;

        if ((hg > 0 && hst === 0) || (ag > 0 && ast === 0)) return null; 
        if (hg > hst + 1 || ag > ast + 1) return null; 

        return {
            homeTeam: home, awayTeam: away, date,
            homeGoals: hg, awayGoals: ag, 
            homeXG: hxg, awayXG: axg,
            homeShotsOnTarget: hst, awayShotsOnTarget: ast, 
            homeRedCards: this.sanitize(row.HR ?? row.homeRedCards),
            awayRedCards: this.sanitize(row.AR ?? row.awayRedCards),
            league
        } as MatchHistory;
    }

    static async getLeagueContext(league: string) {
        const normalized = FootballDataProvider.normalizeLeague(league);
        const matches = await this.fetchHistoricalData(normalized);
        const decayMatches = this.applyRecencyWeights(matches);
        const traits = this.extractTacticalTraits(decayMatches);
        
        const finalizedMatches = decayMatches.map(m => {
            const hWeight = this.calculateOpponentAdjustedWeight(m.homeGoals, m.awayGoals, m.awayTeam, traits.defensiveRanks);
            const aWeight = this.calculateOpponentAdjustedWeight(m.awayGoals, m.homeGoals, m.homeTeam, traits.defensiveRanks);
            return { ...m, weight: m.weight * Math.max(hWeight, aWeight) };
        });

        return { 
            ...this.calculateGlobalBaselines(finalizedMatches),
            ...traits,
            matches: finalizedMatches,
            audit: {
                signalIntegrity: '100% (Raw Signal Flow)',
                alphaAdjustment: 'Active (Bayesian Shrinkage)',
                redCardRegime: 'Active (Chaos Preservation)',
                dataReliability: 'High (Shrunk Momentum Model)',
                sampleSize: finalizedMatches.length
            }
        };
    }

    private static async fetchHistoricalData(league: string): Promise<MatchHistory[]> {
        const q = query(collection(db, 'historicalMatches'), where('league', '==', league), limit(2000));
        const snap = await getDocsFromServer(q);
        let matches = snap.docs.map(d => d.data() as MatchHistory);

        if (matches.length < 200) {
            matches = await FootballDataProvider.fetchBacklog(league, 3);
            await this.persistNewMatches(matches);
        } else {
            const latestDateStr = matches.reduce((max, m) => {
                const mDate = new Date(m.date);
                return mDate > new Date(max) ? m.date : max;
            }, matches[0]?.date || '1900-01-01');

            const currentYear = new Date().getFullYear();
            const currentSeason = `${String(currentYear - 1).slice(-2)}${String(currentYear).slice(-2)}`;
            const liveMatches = await FootballDataProvider.fetchSeasonData(league, currentSeason);

            const latestDate = new Date(latestDateStr);
            const deltaMatches = liveMatches.filter(m => new Date(m.date) > latestDate);

            if (deltaMatches.length > 0) {
                console.log(`[DataSync] Ingesting ${deltaMatches.length} new matches for ${league}`);
                await this.persistNewMatches(deltaMatches);
                matches = [...matches, ...deltaMatches];
            }
        }
        return matches;
    }

    private static async persistNewMatches(newMatches: MatchHistory[]) {
        const batch = writeBatch(db);
        newMatches.forEach(m => {
            const id = `${m.date}_${m.homeTeam}_${m.awayTeam}`;
            batch.set(doc(db, 'historicalMatches', id), m, { merge: true });
        });
        await batch.commit();
    }

    private static applyRecencyWeights(matches: MatchHistory[]) {
        const now = Date.now();
        return matches.map(m => {
            const matchDate = new Date(m.date);
            const daysAgo = (now - matchDate.getTime()) / (1000 * 60 * 60 * 24);
            
            let timeWeight = Math.exp(-0.00385 * daysAgo); 
            const month = matchDate.getMonth();
            const purityWeight = (month === 4 || month === 5) ? 0.85 : 1.0; // Seasonal Volatility

            return { ...m, weight: timeWeight * purityWeight };
        });
    }

    private static extractTacticalTraits(matches: any[]) {
        const stats: Record<string, { conceded: number, reds: number, delta: number, games: number }> = {};
        
        // LEAGUE CONVERSION CALIBRATION (SoT Fallback)
        const CONVERSION: Record<string, number> = {
            'EPL': 0.33, 'LA_LIGA': 0.31, 'SERIE_A': 0.29, 'BUNDESLIGA': 0.35, 'LIGUE_1': 0.30, 'STANDARD': 0.31
        };

        matches.forEach(m => {
            [m.homeTeam, m.awayTeam].forEach(id => {
                if (!stats[id]) stats[id] = { conceded: 0, reds: 0, delta: 0, games: 0 };
            });

            const rate = CONVERSION[m.league] || CONVERSION.STANDARD;
            const hXG = m.homeXG ?? (m.homeShotsOnTarget * rate);
            const aXG = m.awayXG ?? (m.awayShotsOnTarget * rate);

            stats[m.homeTeam].conceded += m.awayGoals;
            stats[m.homeTeam].reds += (m.homeRedCards || 0);
            stats[m.homeTeam].delta += (m.homeGoals - hXG);
            stats[m.homeTeam].games++;

            stats[m.awayTeam].conceded += m.homeGoals;
            stats[m.awayTeam].reds += (m.awayRedCards || 0);
            stats[m.awayTeam].delta += (m.awayGoals - aXG);
            stats[m.awayTeam].games++;
        });

        const defensiveRanks: Record<string, number> = {};
        const redCardPropensity: Record<string, number> = {};
        const clinicalEdge: Record<string, number> = {};
        
        // BAYESIAN SHRINKAGE CONSTANT (The "Anchor")
        // We assume it takes ~12 games for a "Clinical Edge" to be statistically significant.
        // Smaller samples are pulled back toward 0.0 (League Mean).
        const SHRINKAGE_K = 12;

        Object.entries(stats).forEach(([id, s]) => {
            defensiveRanks[id] = s.conceded / s.games;
            redCardPropensity[id] = s.reds / s.games;
            
            // Bayesian Shrunk Edge: Delta / (Games + K)
            clinicalEdge[id] = s.delta / (s.games + SHRINKAGE_K);
        });

        // Normalize defensive ranks (0.0 = Best, 1.0 = Worst)
        const maxConceded = Math.max(...Object.values(defensiveRanks), 1.0);
        Object.keys(defensiveRanks).forEach(id => defensiveRanks[id] /= maxConceded);

        return { defensiveRanks, redCardPropensity, clinicalEdge };
    }

    private static calculateGlobalBaselines(matches: any[]) {
        const avgHG = matches.reduce((acc, m) => acc + m.homeGoals, 0) / matches.length || 1.35;
        const avgAG = matches.reduce((acc, m) => acc + m.awayGoals, 0) / matches.length || 1.25;
        
        return {
            avgHG, avgAG,
            varHG: matches.reduce((acc, m) => acc + Math.pow(m.homeGoals - avgHG, 2), 0) / matches.length || 1.1,
            varAG: matches.reduce((acc, m) => acc + Math.pow(m.awayGoals - avgAG, 2), 0) / matches.length || 1.1,
            rhoData: DixonColes.fitRho(matches.slice(-500).map(m => ({ 
                x: m.homeGoals, y: m.awayGoals, lambda: avgHG, mu: avgAG, weight: m.weight || 1.0
            })))
        };
    }

    static calculateOpponentAdjustedWeight(hg: number, ag: number, opponentId: string, defensiveRanks: Record<string, number>): number {
        const weakness = defensiveRanks[opponentId] || 0.5;
        return Math.abs(hg - ag) < 3 ? 1.0 : 1 + (weakness * 0.5);
    }

    static standardize(team: any, context?: any): TeamStats {
        const d = context || { avgXG: 1.35, avgStability: 0.65, redCardPropensity: 0.05, clinicalEdge: 0 };
        return {
            name: team.name || 'Unknown',
            goalsScored: team.goalsScored || 0,
            goalsConceded: team.goalsConceded || 0,
            avgXG: team.avgXG || d.avgXG,
            avgXGA: team.avgXGA || d.avgXG,
            npxG: team.npxG || d.avgXG,
            defensiveStability: team.defensiveStability || d.avgStability,
            form: team.form || [0.5],
            cleanSheets: team.cleanSheets || 0,
            dataPurity: team.purity || 1.0,
            redCardPropensity: team.redCardPropensity || d.redCardPropensity,
            clinicalEdge: team.clinicalEdge || d.clinicalEdge
        };
    }
}
