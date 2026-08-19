import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { TeamStyleProfile, MatchHistory } from '../types';
import { LEAGUE_CONVERSION_RATES, DATA_CONSTANTS } from '../core/constants';
import { ELITE_TEAMS, STRONG_TEAMS, ARCHETYPE_STATS } from '../core/archetypes';

export class ProfileService {
    private static readonly CANONICAL_MAP: Record<string, string[]> = {
        "MAN_CITY": ["Man City", "Manchester City"],
        "MAN_UTD": ["Man United", "Manchester United", "Man Utd"],
        "LIVERPOOL": ["Liverpool"],
        "ARSENAL": ["Arsenal"],
        "CHELSEA": ["Chelsea"],
        "TOTTENHAM": ["Tottenham", "Spurs"],
        "BARCELONA": ["Barcelona"],
        "REAL_MADRID": ["Real Madrid"],
        "BAYERN_MUNICH": ["Bayern Munich"]
    };

    static canonicalize(name: string) {
        if (!name) return { id: "UNKNOWN", isMapped: false };
        const n = name.trim().toLowerCase();
        for (const [id, aliases] of Object.entries(this.CANONICAL_MAP)) {
            if (id.toLowerCase() === n || aliases.some(a => a.toLowerCase() === n)) return { id, isMapped: true };
        }
        return { id: name.toUpperCase().replace(/\s+/g, '_'), isMapped: false };
    }

    static getDisplayName(id: string) {
        return this.CANONICAL_MAP[id]?.[0] || id;
    }

    static computeBaseline(teamName: string, matches: MatchHistory[]) {
        const { id } = this.canonicalize(teamName);
        const rel = matches.filter(m => m.homeTeam === id || m.awayTeam === id);
        
        if (!rel.length) {
            const isElite = ELITE_TEAMS.includes(id);
            const isStrong = STRONG_TEAMS.includes(id);
            const stats = isElite ? ARCHETYPE_STATS.ELITE : (isStrong ? ARCHETYPE_STATS.STRONG : ARCHETYPE_STATS.STANDARD);
            
            return {
                name: teamName,
                npxG: stats.npxG,
                avgXGA: stats.avgXGA,
                defensiveStability: stats.defensiveStability,
                purity: 0.1, 
                form: [0.5, 0.5, 0.5, 0.5, 0.5],
                cleanSheets: stats.cleanSheets,
                redCardPropensity: 0.05,
                clinicalEdge: stats.clinicalEdge
            };
        }
        
        let weightedGS = 0, weightedGA = 0, totalWeight = 0;
        let cleanSheets = 0, totalReds = 0, totalDelta = 0;
        
        rel.forEach(m => {
            const weight = (m as any).weight || 1.0;
            const isH = m.homeTeam === id;
            const scored = isH ? m.homeGoals : m.awayGoals;
            const conceded = isH ? m.awayGoals : m.homeGoals;
            const reds = isH ? (m.homeRedCards || 0) : (m.awayRedCards || 0);
            const sot = isH ? (m.homeShotsOnTarget || 0) : (m.awayShotsOnTarget || 0);
            const realXG = isH ? m.homeXG : m.awayXG;
            
            const rate = LEAGUE_CONVERSION_RATES[m.league || 'STANDARD'] || LEAGUE_CONVERSION_RATES.STANDARD;
            const xG = realXG ?? (sot * rate);

            weightedGS += scored * weight;
            weightedGA += conceded * weight;
            totalWeight += weight;
            
            totalReds += reds;
            totalDelta += (scored - xG);

            if (conceded === 0) cleanSheets++;
        });
        
        const leagueGS = matches.reduce((acc, m) => acc + m.homeGoals + m.awayGoals, 0);
        const leagueAvg = matches.length > 0 ? (leagueGS / (matches.length * 2)) : DATA_CONSTANTS.DEFAULT_LEAGUE_AVG;

        const avgScored = weightedGS / totalWeight;
        const avgConceded = weightedGA / totalWeight;

        return { 
            name: teamName, 
            npxG: avgScored, 
            avgXGA: avgConceded, 
            defensiveStability: Math.max(0.3, Math.min(0.9, 1 - (avgConceded / (leagueAvg * 2)))), 
            purity: 0.95,
            redCardPropensity: totalReds / rel.length,
            clinicalEdge: totalDelta / (rel.length + DATA_CONSTANTS.SHRINKAGE_K),
            form: rel.slice(-5).map(m => {
                const isH = m.homeTeam === id;
                return (isH ? m.homeGoals : m.awayGoals) > (isH ? m.awayGoals : m.homeGoals) ? 1 : 
                       (isH ? m.homeGoals : m.awayGoals) === (isH ? m.awayGoals : m.homeGoals) ? 0.5 : 0;
            }),
            cleanSheets: cleanSheets / rel.length
        };
    }

    static async getStyle(id: string): Promise<TeamStyleProfile | null> {
        const snap = await getDoc(doc(db, 'team_style_profiles', id));
        return snap.exists() ? snap.data() as TeamStyleProfile : null;
    }

    static async saveStyle(profile: TeamStyleProfile) {
        await setDoc(doc(db, 'team_style_profiles', profile.teamId), profile, { merge: true });
    }
}
