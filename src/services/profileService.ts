import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { TeamStyleProfile, MatchHistory } from '../types';
import { LEAGUE_CONVERSION_RATES, DATA_CONSTANTS } from '../core/constants';
import { ELITE_TEAMS, STRONG_TEAMS, ARCHETYPE_STATS } from '../core/archetypes';

export class ProfileService {
    private static readonly MAP: Record<string, string[]> = {
        "MAN_CITY": ["Man City", "Manchester City"], "MAN_UTD": ["Man United", "Manchester United", "Man Utd"],
        "LIVERPOOL": ["Liverpool"], "ARSENAL": ["Arsenal"], "CHELSEA": ["Chelsea"],
        "TOTTENHAM": ["Tottenham", "Spurs"], "BARCELONA": ["Barcelona"], "REAL_MADRID": ["Real Madrid"], "BAYERN_MUNICH": ["Bayern Munich"]
    };
    static canonicalize(name: string) {
        if (!name) return { id: "UNKNOWN", isMapped: false };
        const n = name.trim().toLowerCase();
        for (const [id, al] of Object.entries(this.MAP)) if (id.toLowerCase() === n || al.some(a => a.toLowerCase() === n)) return { id, isMapped: true };
        return { id: name.toUpperCase().replace(/\s+/g, '_'), isMapped: false };
    }
    static getDisplayName(id: string) { return this.MAP[id]?.[0] || id; }
    static computeBaseline(name: string, matches: MatchHistory[]) {
        const { id } = this.canonicalize(name), rel = matches.filter(m => m.homeTeam === id || m.awayTeam === id);
        if (!rel.length) {
            const e = ELITE_TEAMS.includes(id), s = STRONG_TEAMS.includes(id), st = e ? ARCHETYPE_STATS.ELITE : (s ? ARCHETYPE_STATS.STRONG : ARCHETYPE_STATS.STANDARD);
            return { name, npxG: st.npxG, avgXGA: st.avgXGA, defensiveStability: st.defensiveStability, purity: 0.1, form: [0.5, 0.5, 0.5, 0.5, 0.5], cleanSheets: st.cleanSheets, redCardPropensity: 0.05, clinicalEdge: st.clinicalEdge };
        }
        let wGS = 0, wGA = 0, tW = 0, cs = 0, tR = 0, tD = 0;
        rel.forEach(m => {
            const w = (m as any).weight || 1, h = m.homeTeam === id, sc = h ? m.homeGoals : m.awayGoals, co = h ? m.awayGoals : m.homeGoals, r = h ? (m.homeRedCards || 0) : (m.awayRedCards || 0), s = h ? (m.homeShotsOnTarget || 0) : (m.awayShotsOnTarget || 0);
            const rate = LEAGUE_CONVERSION_RATES[m.league || 'STANDARD'] || LEAGUE_CONVERSION_RATES.STANDARD, xG = (h ? m.homeXG : m.awayXG) ?? (s * rate);
            wGS += sc * w; wGA += co * w; tW += w; tR += r; tD += (sc - xG); if (co === 0) cs++;
        });
        const lAvg = matches.length ? (matches.reduce((a, m) => a + m.homeGoals + m.awayGoals, 0) / (matches.length * 2)) : DATA_CONSTANTS.DEFAULT_LEAGUE_AVG;
        const avgS = wGS / tW, avgC = wGA / tW;
        return { 
            name, npxG: avgS, avgXGA: avgC, defensiveStability: Math.max(0.3, Math.min(0.9, 1 - (avgC / (lAvg * 2)))), purity: 0.95, redCardPropensity: tR / rel.length, clinicalEdge: tD / (rel.length + DATA_CONSTANTS.SHRINKAGE_K),
            form: rel.slice(-5).map(m => {
                const h = m.homeTeam === id, sc = h ? m.homeGoals : m.awayGoals, co = h ? m.awayGoals : m.homeGoals;
                return sc > co ? 1 : sc === co ? 0.5 : 0;
            }), cleanSheets: cs / rel.length
        };
    }
    static async getStyle(id: string): Promise<TeamStyleProfile | null> { const s = await getDoc(doc(db, 'team_style_profiles', id)); return s.exists() ? s.data() as TeamStyleProfile : null; }
    static async saveStyle(p: TeamStyleProfile) { await setDoc(doc(db, 'team_style_profiles', p.teamId), p, { merge: true }); }
}
