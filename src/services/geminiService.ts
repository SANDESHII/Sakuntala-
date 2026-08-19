import { GoogleGenAI, Type } from "@google/genai";
import { MatchEngine } from "./engine";
import { DataService } from "./dataService";
import { ProfileService } from "./profileService";
import { FootballDataProvider } from "./data/footballDataProvider";
import { MatchContextService } from "./matchContext";
import { AnalysisResult, MatchContext, RefereeProfile, TeamStyleProfile, MatchHistory } from "../types";

const MODEL = 'gemini-3.7-flash';

const SYSTEM_PROMPT = `Expert Quantitative Football Intelligence Analyst. 
YOUR MISSION: Perform an "Atom Level" rigorous Tactical Grounding research for Top-Tier European Football. 

ATOM LEVEL PROTOCOL:
1. TIER 1 (xG DATA MANDATE): Find Season-to-Date xG and xGA for both teams.
2. TIER 2 (Market Intel): Find current live Pinnacle/Betfair odds for Over 1.5 and Under 3.5 Goals.
3. TIER 3 (Personnel): Identify missing personnel impact.
4. TIER 4 (Tactical Drift): Look for league-specific shifts.
5. TIER 5 (Referee): Assess referee history.

Output strictly valid JSON. Include fields: homeSeasonXG, awaySeasonXG, homeSeasonXGA, awaySeasonXGA, pinnacleOver15, pinnacleUnder35.`;

const AI_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        groundingConfidence: { type: Type.NUMBER },
        verifiedFacts: {
            type: Type.OBJECT,
            properties: {
                matchContext: { type: Type.STRING },
                tacticalDrift: { type: Type.STRING },
                verifiedNewsSummary: { type: Type.STRING },
                homeSeasonXG: { type: Type.NUMBER },
                awaySeasonXG: { type: Type.NUMBER },
                homeSeasonXGA: { type: Type.NUMBER },
                awaySeasonXGA: { type: Type.NUMBER },
                pinnacleOver15: { type: Type.NUMBER },
                pinnacleUnder35: { type: Type.NUMBER },
                referee: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        avgCards: { type: Type.NUMBER },
                        avgPenalties: { type: Type.NUMBER }
                    }
                }
            }
        },
        styleMetrics: {
            type: Type.OBJECT,
            properties: {
                home: { type: Type.OBJECT, properties: { ppda: { type: Type.NUMBER }, possessionFinalThird: { type: Type.NUMBER } } },
                away: { type: Type.OBJECT, properties: { ppda: { type: Type.NUMBER }, possessionFinalThird: { type: Type.NUMBER } } }
            }
        },
        matchSummary: { type: Type.STRING }
    },
    required: ["matchSummary", "groundingConfidence"]
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const cache = new Map<string, { result: AnalysisResult, timestamp: number }>();

const getFallback = async (req: any, matches: MatchHistory[], rhoData: any): Promise<AnalysisResult> => {
    const home = DataService.standardize({ ...ProfileService.computeBaseline(req.homeTeam, matches), name: req.homeTeamName });
    const away = DataService.standardize({ ...ProfileService.computeBaseline(req.awayTeam, matches), name: req.awayTeamName });
    const ctx: MatchContext = { 
        weatherData: { temperature: 15, condition: 'Stable' },
        league: req.league 
    };
    return { ...MatchEngine.calculate(home, away, ctx, rhoData), dataSource: 'FALLBACK_STATIC' };
};

export const performAnalysis = async (rawReq: any): Promise<AnalysisResult> => {
    const league = FootballDataProvider.normalizeLeague(rawReq.league);
    const hM = ProfileService.canonicalize(rawReq.homeTeam);
    const aM = ProfileService.canonicalize(rawReq.awayTeam);
    const req = { ...rawReq, league, homeTeam: hM.id, awayTeam: aM.id, homeTeamName: ProfileService.getDisplayName(hM.id), awayTeamName: ProfileService.getDisplayName(aM.id) };

    const cacheKey = `${req.homeTeam}-${req.awayTeam}-${req.league}`.toLowerCase();
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 30000)) return cached.result;

    const [leagueContext] = await Promise.all([
        DataService.getLeagueContext(req.league || 'EPL').catch(() => ({ matches: [], rhoData: { rho: -0.11, sigmaRho: 0.05 } }))
    ]);

    const matches = (leagueContext as any).matches || [];

    try {
        const interaction = await ai.interactions.create({
            model: MODEL,
            system_instruction: SYSTEM_PROMPT,
            input: `LEAGUE: ${req.league || 'EPL'} | MATCH: ${req.homeTeamName} vs ${req.awayTeamName} | CURRENT_UTC: ${new Date().toISOString()} | ANALYZE: Verify late team news, lineups, referee assigned, and betting market shifts for this fixture.`,
            tools: [{ type: 'google_search' }],
            response_format: AI_SCHEMA as any
        });

        const parsed = JSON.parse(interaction.output_text || '{}');
        const venue = MatchContextService.getVenue(req.homeTeam);
        const [weather, hS, aS] = await Promise.all([
            MatchContextService.getWeather(venue.lat, venue.lon),
            ProfileService.getStyle(req.homeTeam),
            ProfileService.getStyle(req.awayTeam)
        ]);

        let ref: RefereeProfile | undefined;
        if (parsed.verifiedFacts?.referee?.name) {
            ref = { 
                name: parsed.verifiedFacts.referee.name, 
                avgCardsPerGame: parsed.verifiedFacts.referee.avgCards || 3.8, 
                avgPenaltiesPerGame: parsed.verifiedFacts.referee.avgPenalties || 0.2,
                homeWinRate: 0.45,
                tendency: (parsed.verifiedFacts.referee.avgCards > 4) ? 'STRICT' : 'AVERAGE'
            };
        }

        const homeStyle: TeamStyleProfile = { ...(hS || {}), ...(parsed.styleMetrics?.home || {}), teamId: req.homeTeam, purity: 0.9 };
        const awayStyle: TeamStyleProfile = { ...(aS || {}), ...(parsed.styleMetrics?.away || {}), teamId: req.awayTeam, purity: 0.9 };

        const home = DataService.standardize({ ...ProfileService.computeBaseline(req.homeTeam, matches), name: req.homeTeamName });
        const away = DataService.standardize({ ...ProfileService.computeBaseline(req.awayTeam, matches), name: req.awayTeamName });

        const ctx: MatchContext = { 
            weatherData: weather,
            referee: ref, 
            homeStyle, awayStyle, 
            league: req.league,
            homeSeasonXG: parsed.verifiedFacts?.homeSeasonXG,
            awaySeasonXG: parsed.verifiedFacts?.awaySeasonXG,
            homeSeasonXGA: parsed.verifiedFacts?.homeSeasonXGA,
            awaySeasonXGA: parsed.verifiedFacts?.awaySeasonXGA,
            marketOdds: {
                pinnacleOver15: parsed.verifiedFacts?.pinnacleOver15,
                pinnacleUnder35: parsed.verifiedFacts?.pinnacleUnder35
            }
        };

        const result = MatchEngine.calculate(home, away, ctx, (leagueContext as any).rhoData);
        result.summary = parsed.matchSummary || result.summary;
        
        cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
    } catch (e) {
        return getFallback(req, matches, (leagueContext as any).rhoData);
    }
};
