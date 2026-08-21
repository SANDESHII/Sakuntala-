import { GoogleGenAI, Type } from "@google/genai";
import { MatchEngine } from "./engine";
import { DataService } from "./dataService";
import { ProfileService } from "./profileService";
import { FootballDataProvider } from "./data/footballDataProvider";
import { MatchContextService } from "./matchContext";
import { AnalysisResult, MatchContext, RefereeProfile, TeamStyleProfile, MatchHistory } from "../types";

const MODEL = 'gemini-3.7-flash', SYSTEM_PROMPT = `Expert Quantitative Football Intelligence Analyst. MISSION: Rigorous Tactical Grounding. 1. OUTLIER JAIL: Discard stats outside reality ranges (npxG/xGA 0.4-3.5). 2. CHECKSUM: Verify (Season Goals / Matches). 3. ADVERSARIAL: Compare FBRef vs Understat. Discard if >10% variance. 4. MARKET SYNC: Sync with Pinnacle/Betfair. 5. NO NARRATIVE: Atoms only. Output strictly valid JSON.`;

const AI_SCHEMA = {
    type: Type.OBJECT, properties: {
        groundingConfidence: { type: Type.NUMBER },
        verifiedFacts: { type: Type.OBJECT, properties: {
            matchContext: { type: Type.STRING }, tacticalDrift: { type: Type.STRING }, verifiedNewsSummary: { type: Type.STRING },
            homeSeasonXG: { type: Type.NUMBER }, awaySeasonXG: { type: Type.NUMBER }, homeSeasonXGA: { type: Type.NUMBER }, awaySeasonXGA: { type: Type.NUMBER },
            pinnacleOver15: { type: Type.NUMBER }, pinnacleUnder35: { type: Type.NUMBER },
            referee: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, avgCards: { type: Type.NUMBER }, avgPenalties: { type: Type.NUMBER } } },
            citations: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { source: { type: Type.STRING }, url: { type: Type.STRING }, value: { type: Type.NUMBER }, timestamp: { type: Type.STRING } } } },
            varianceAlerts: { type: Type.ARRAY, items: { type: Type.STRING } }
        }},
        styleMetrics: { type: Type.OBJECT, properties: {
            home: { type: Type.OBJECT, properties: { ppda: { type: Type.NUMBER }, possessionFinalThird: { type: Type.NUMBER } } },
            away: { type: Type.OBJECT, properties: { ppda: { type: Type.NUMBER }, possessionFinalThird: { type: Type.NUMBER } } }
        }}, matchSummary: { type: Type.STRING }
    }, required: ["matchSummary", "groundingConfidence"]
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' }), cache = new Map<string, { result: AnalysisResult, timestamp: number }>();

const getFallback = async (req: any, matches: MatchHistory[], rho: any): Promise<AnalysisResult> => ({ 
    ...MatchEngine.calculate(DataService.standardize({ ...ProfileService.computeBaseline(req.homeTeam, matches), name: req.homeTeamName }), DataService.standardize({ ...ProfileService.computeBaseline(req.awayTeam, matches), name: req.awayTeamName }), { weatherData: { temperature: 15, condition: 'Stable' }, league: req.league }, rho), 
    dataSource: 'FALLBACK_STATIC' 
});

export const performAnalysis = async (raw: any): Promise<AnalysisResult> => {
    const l = FootballDataProvider.normalizeLeague(raw.league), hM = ProfileService.canonicalize(raw.homeTeam), aM = ProfileService.canonicalize(raw.awayTeam);
    const req = { ...raw, league: l, homeTeam: hM.id, awayTeam: aM.id, homeTeamName: ProfileService.getDisplayName(hM.id), awayTeamName: ProfileService.getDisplayName(aM.id) };
    const key = `${req.homeTeam}-${req.awayTeam}-${req.league}`.toLowerCase(), cached = cache.get(key);
    if (cached && (Date.now() - cached.timestamp < 30000)) return cached.result;

    const ctx = await DataService.getLeagueContext(req.league || 'EPL').catch(() => ({ matches: [], rhoData: { rho: -0.11, sigmaRho: 0.05 } }));
    const matches = (ctx as any).matches || [], rho = (ctx as any).rhoData;

    try {
        const interaction = await ai.interactions.create({
            model: MODEL, system_instruction: SYSTEM_PROMPT,
            input: `MATCH: ${req.homeTeamName} vs ${req.awayTeamName} | KICKOFF: ${req.kickoff || 'UPCOMING'} | MANDATE: CLEAN DATA. Checksum Goals/Matches. FBRef/Understat npxG. Outlier Jail. Market Sync. JSON ONLY.`,
            tools: [{ type: 'google_search' }], response_format: AI_SCHEMA as any
        });
        const p = JSON.parse(interaction.output_text || '{}'), v = MatchContextService.getVenue(req.homeTeam);
        const [w, hS, aS] = await Promise.all([MatchContextService.getWeather(v.lat, v.lon), ProfileService.getStyle(req.homeTeam), ProfileService.getStyle(req.awayTeam)]);
        const ref = p.verifiedFacts?.referee?.name ? { name: p.verifiedFacts.referee.name, avgCardsPerGame: p.verifiedFacts.referee.avgCards || 3.8, avgPenaltiesPerGame: p.verifiedFacts.referee.avgPenalties || 0.2, homeWinRate: 0.45, tendency: (p.verifiedFacts.referee.avgCards > 4) ? 'STRICT' : 'AVERAGE' } : undefined;

        const res = MatchEngine.calculate(DataService.standardize({ ...ProfileService.computeBaseline(req.homeTeam, matches), name: req.homeTeamName }), DataService.standardize({ ...ProfileService.computeBaseline(req.awayTeam, matches), name: req.awayTeamName }), { 
            weatherData: w, referee: ref, homeStyle: { ...(hS || {}), ...(p.styleMetrics?.home || {}), teamId: req.homeTeam, purity: 0.9 }, awayStyle: { ...(aS || {}), ...(p.styleMetrics?.away || {}), teamId: req.awayTeam, purity: 0.9 }, league: req.league,
            homeSeasonXG: p.verifiedFacts?.homeSeasonXG, awaySeasonXG: p.verifiedFacts?.awaySeasonXG, homeSeasonXGA: p.verifiedFacts?.homeSeasonXGA, awaySeasonXGA: p.verifiedFacts?.awaySeasonXGA,
            marketOdds: { pinnacleOver15: p.verifiedFacts?.pinnacleOver15, pinnacleUnder35: p.verifiedFacts?.pinnacleUnder35 },
            groundingLog: { citations: p.verifiedFacts?.citations || [], varianceAlerts: p.verifiedFacts?.varianceAlerts || [] }
        }, rho);

        res.summary = p.matchSummary || res.summary; res.surety.groundingCitations = p.verifiedFacts?.citations;
        cache.set(key, { result: res, timestamp: Date.now() }); return res;
    } catch (e) { return getFallback(req, matches, rho); }
};


