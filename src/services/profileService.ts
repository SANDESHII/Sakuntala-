import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { TeamStyleProfile, MatchHistory } from '../types';

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
            const isElite = ["MAN_CITY", "LIVERPOOL", "ARSENAL", "REAL_MADRID", "BARCELONA", "BAYERN_MUNICH"].includes(id);
            const isStrong = ["CHELSEA", "TOTTENHAM", "MAN_UTD", "ATLETICO_MADRID", "B_DORTMUND"].includes(id);
            
            return {
                name: teamName,
                npxG: isElite ? 2.15 : (isStrong ? 1.75 : 1.35),
                avgXGA: isElite ? 0.85 : (isStrong ? 1.15 : 1.45),
                defensiveStability: isElite ? 0.85 : (isStrong ? 0.75 : 0.6),
                purity: 0.1, // Mark as low fidelity (Archetype)
                form: [0.5, 0.5, 0.5, 0.5, 0.5],
                cleanSheets: isElite ? 0.4 : 0.2,
                redCardPropensity: 0.05,
                clinicalEdge: isElite ? 0.15 : 0.05
            };
        }
        
        let weightedGS = 0, weightedGA = 0, totalWeight = 0;
        let cleanSheets = 0, totalReds = 0, totalDelta = 0;
        
        const CONVERSION: Record<string, number> = {
            'EPL': 0.33, 'LA_LIGA': 0.31, 'SERIE_A': 0.29, 'BUNDESLIGA': 0.35, 'LIGUE_1': 0.30, 'STANDARD': 0.31
        };

        rel.forEach(m => {
            const weight = (m as any).weight || 1.0;
            const isH = m.homeTeam === id;
            const scored = isH ? m.homeGoals : m.awayGoals;
            const conceded = isH ? m.awayGoals : m.homeGoals;
            const reds = isH ? (m.homeRedCards || 0) : (m.awayRedCards || 0);
            const sot = isH ? (m.homeShotsOnTarget || 0) : (m.awayShotsOnTarget || 0);
            const realXG = isH ? m.homeXG : m.awayXG;
            
            const rate = CONVERSION[m.league || 'STANDARD'] || CONVERSION.STANDARD;
            const xG = realXG ?? (sot * rate);

            weightedGS += scored * weight;
            weightedGA += conceded * weight;
            totalWeight += weight;
            
            totalReds += reds;
            // Clinical Edge: Actual - Real xG (or calibrated proxy)
            totalDelta += (scored - xG);

            if (conceded === 0) cleanSheets++;
        });
        
        // Calculate League Baseline (to determine relative strength)
        const leagueGS = matches.reduce((acc, m) => acc + m.homeGoals + m.awayGoals, 0);
        const leagueAvg = matches.length > 0 ? (leagueGS / (matches.length * 2)) : 1.35;

        const avgScored = weightedGS / totalWeight;
        const avgConceded = weightedGA / totalWeight;

        return { 
            name: teamName, 
            npxG: avgScored, 
            avgXGA: avgConceded, 
            // Defensive Stability is inverse of Conceded performance relative to league
            defensiveStability: Math.max(0.3, Math.min(0.9, 1 - (avgConceded / (leagueAvg * 2)))), 
            purity: 0.95,
            redCardPropensity: totalReds / rel.length,
            clinicalEdge: totalDelta / rel.length,
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
