import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { TeamStyleProfile, MatchHistory } from '../types';
import { LEAGUE_CONVERSION_RATES, DATA_CONSTANTS } from '../core/constants';
import { ELITE_TEAMS, STRONG_TEAMS, ARCHETYPE_STATS } from '../core/archetypes';

export class ProfileService {
    private static readonly MAP: Record<string, string[]> = {
        "MAN_CITY": ["Man City", "Manchester City", "Man City FC"], "MAN_UTD": ["Man United", "Manchester United", "Man Utd", "Man Utd FC"],
        "LIVERPOOL": ["Liverpool", "Liverpool FC"], "ARSENAL": ["Arsenal", "Arsenal FC"], "CHELSEA": ["Chelsea", "Chelsea FC"],
        "TOTTENHAM": ["Tottenham", "Spurs", "Tottenham Hotspur"], "BARCELONA": ["Barcelona", "FC Barcelona", "Barca"], "REAL_MADRID": ["Real Madrid", "Real Madrid CF"], "BAYERN_MUNICH": ["Bayern Munich", "FC Bayern"]
    };
    static canonicalize(name: string) {
        if (!name) return { id: "UNKNOWN", isMapped: false };
        const n = name.trim().toLowerCase();
        for (const [id, al] of Object.entries(this.MAP)) if (id.toLowerCase() === n || al.some(a => a.toLowerCase() === n)) return { id, isMapped: true };
        return { id: name.toUpperCase().replace(/\s+/g, '_'), isMapped: false };
    }
    static getDisplayName(id: string) { return this.MAP[id]?.[0] || id; }
    static computeBaseline(name: string, matches: MatchHistory[], asOfDate?: string) {
        const { id } = this.canonicalize(name);
        const history = asOfDate ? matches.filter(m => new Date(m.date) < new Date(asOfDate)) : matches;
        const rel = history.filter(m => {
            const hId = this.canonicalize(m.homeTeam).id;
            const aId = this.canonicalize(m.awayTeam).id;
            return hId === id || aId === id;
        });
        if (!rel.length) {
            const dyn = this.computeDynamicArchetypes(history);
            const e = ELITE_TEAMS.includes(id), s = STRONG_TEAMS.includes(id), st = e ? dyn.ELITE : (s ? dyn.STRONG : dyn.STANDARD);
            return { name, npxG: st.npxG, avgXGA: st.avgXGA, defensiveStability: st.defensiveStability, purity: 0.1, form: [0.5, 0.5, 0.5, 0.5, 0.5], cleanSheets: st.cleanSheets, redCardPropensity: 0.05, clinicalEdge: st.clinicalEdge };
        }
        let wGS = 0, wGA = 0, tW = 0, cs = 0, tR = 0, tD = 0;
        rel.forEach(m => {
            const w = (m as any).weight || 1, h = m.homeTeam === id, sc = h ? m.homeGoals : m.awayGoals, co = h ? m.awayGoals : m.homeGoals, r = h ? (m.homeRedCards || 0) : (m.awayRedCards || 0), s = h ? (m.homeShotsOnTarget || 0) : (m.awayShotsOnTarget || 0);
            const rate = LEAGUE_CONVERSION_RATES[m.league || 'STANDARD'] || LEAGUE_CONVERSION_RATES.STANDARD, xG = (h ? m.homeXG : m.awayXG) ?? (s * rate);
            wGS += sc * w; wGA += co * w; tW += w; tR += r; tD += (sc - xG); if (co === 0) cs++;
        });
        const isVerified = rel.some((m: any) => m.isVerified);
        const lAvg = history.length ? (history.reduce((a, m) => a + m.homeGoals + m.awayGoals, 0) / (history.length * 2)) : DATA_CONSTANTS.DEFAULT_LEAGUE_AVG;
        const avgS = wGS / tW, avgC = wGA / tW;
        return { 
            name, npxG: avgS, avgXGA: avgC, defensiveStability: Math.max(0.3, Math.min(0.9, 1 - (avgC / (lAvg * 2)))), purity: isVerified ? 0.98 : 0.45, redCardPropensity: tR / rel.length, clinicalEdge: tD / (rel.length + DATA_CONSTANTS.SHRINKAGE_K),
            form: rel.slice(-5).map(m => {
                const h = m.homeTeam === id;
                const rate = LEAGUE_CONVERSION_RATES[m.league || 'STANDARD'] || LEAGUE_CONVERSION_RATES.STANDARD;
                const tXG = (h ? m.homeXG : m.awayXG) ?? ((h ? m.homeShotsOnTarget : m.awayShotsOnTarget) || 0) * rate;
                const oXG = (h ? m.awayXG : m.homeXG) ?? ((h ? m.awayShotsOnTarget : m.homeShotsOnTarget) || 0) * rate;
                // Quantitative form: Dominance in expected goals creation/suppression
                if (tXG > oXG + 0.5) return 1.0;
                if (tXG < oXG - 0.5) return 0.0;
                return 0.5;
            }), cleanSheets: cs / rel.length
        };
    }

    private static computeDynamicArchetypes(matches: MatchHistory[]) {
        if (!matches.length) return ARCHETYPE_STATS;
        const stats: Record<string, { xG: number; xGA: number; games: number; cleanSheets: number; delta: number }> = {};
        const lAvg = matches.reduce((a, m) => a + m.homeGoals + m.awayGoals, 0) / (matches.length * 2) || DATA_CONSTANTS.DEFAULT_LEAGUE_AVG;
        
        matches.forEach(m => {
            const hId = this.canonicalize(m.homeTeam).id, aId = this.canonicalize(m.awayTeam).id;
            const r = LEAGUE_CONVERSION_RATES[m.league || 'STANDARD'] || LEAGUE_CONVERSION_RATES.STANDARD;
            [hId, aId].forEach(id => { if (!stats[id]) stats[id] = { xG: 0, xGA: 0, games: 0, cleanSheets: 0, delta: 0 }; });
            const hXG = m.homeXG ?? ((m.homeShotsOnTarget || 0) * r), aXG = m.awayXG ?? ((m.awayShotsOnTarget || 0) * r);
            stats[hId].xG += hXG; stats[hId].xGA += aXG; stats[hId].games++; if (m.awayGoals === 0) stats[hId].cleanSheets++; stats[hId].delta += (m.homeGoals - hXG);
            stats[aId].xG += aXG; stats[aId].xGA += hXG; stats[aId].games++; if (m.homeGoals === 0) stats[aId].cleanSheets++; stats[aId].delta += (m.awayGoals - aXG);
        });

        const pool = (ids: string[]) => {
            const p = Object.entries(stats).filter(([id, s]) => ids.includes(id) && s.games >= 3).map(([_, s]) => ({ xG: s.xG / s.games, xGA: s.xGA / s.games, cs: s.cleanSheets / s.games, ce: s.delta / s.games }));
            if (!p.length) return null;
            const n = p.length, avgXG = p.reduce((a, v) => a + v.xG, 0) / n, avgXGA = p.reduce((a, v) => a + v.xGA, 0) / n;
            return { npxG: avgXG, avgXGA, defensiveStability: Math.max(0.3, Math.min(0.9, 1 - (avgXGA / (lAvg * 2)))), cleanSheets: p.reduce((a, v) => a + v.cs, 0) / n, clinicalEdge: p.reduce((a, v) => a + v.ce, 0) / n };
        };

        return {
            ELITE: pool(ELITE_TEAMS) || ARCHETYPE_STATS.ELITE,
            STRONG: pool(STRONG_TEAMS) || ARCHETYPE_STATS.STRONG,
            STANDARD: pool(Object.keys(stats).filter(id => !ELITE_TEAMS.includes(id) && !STRONG_TEAMS.includes(id))) || ARCHETYPE_STATS.STANDARD
        };
    }
    static async getStyle(id: string): Promise<TeamStyleProfile | null> { const s = await getDoc(doc(db, 'team_style_profiles', id)); return s.exists() ? s.data() as TeamStyleProfile : null; }
    static async saveStyle(p: TeamStyleProfile) { await setDoc(doc(db, 'team_style_profiles', p.teamId), p, { merge: true }); }
}
