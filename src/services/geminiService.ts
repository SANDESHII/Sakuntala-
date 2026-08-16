import { GoogleGenAI } from "@google/genai";
import { MatchEngine } from "./engine";
import { DataService } from "./dataService";
import { ProfileService } from "./profileService";
import { MatchContextService } from "./matchContext";
import { AnalysisResult, MatchContext, RefereeProfile, TeamStyleProfile } from "../types";
import { MODEL, SYSTEM_PROMPT, AI_SCHEMA } from "./aiConfig";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const cache = new Map<string, { result: AnalysisResult, timestamp: number }>();

const getFallback = async (req: any, rhoData: any): Promise<AnalysisResult> => {
    const home = DataService.standardize(ProfileService.computeBaseline(req.homeTeam, []));
    const away = DataService.standardize(ProfileService.computeBaseline(req.awayTeam, []));
    const ctx: MatchContext = { weather: "CLEAR", stakes: "STANDARD" };
    return { ...MatchEngine.calculate(home, away, ctx, rhoData), dataSource: 'FALLBACK_STATIC' };
};

export const performAnalysis = async (rawReq: any): Promise<AnalysisResult> => {
    const hM = ProfileService.canonicalize(rawReq.homeTeam);
    const aM = ProfileService.canonicalize(rawReq.awayTeam);
    const req = { ...rawReq, homeTeam: hM.id, awayTeam: aM.id, homeTeamName: ProfileService.getDisplayName(hM.id), awayTeamName: ProfileService.getDisplayName(aM.id) };

    const cacheKey = `${req.homeTeam}-${req.awayTeam}-${req.league}`.toLowerCase();
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 30000)) return cached.result;

    const [leagueContext] = await Promise.all([
        DataService.getLeagueContext(req.league || 'EPL').catch(() => ({ rhoData: { rho: -0.11, sigmaRho: 0.05 } }))
    ]);

    try {
        const interaction = await ai.interactions.create({
            model: MODEL,
            system_instruction: SYSTEM_PROMPT,
            input: `LEAGUE: ${req.league || 'EPL'} | MATCH: ${req.homeTeamName} vs ${req.awayTeamName} | CURRENT_UTC: ${new Date().toISOString()} | ANALYZE: Verify late team news, lineups, referee assigned, and betting market shifts for this fixture.`,
            tools: [{ type: 'google_search' }],
            response_format: AI_SCHEMA as any
        });

        const parsed = JSON.parse(interaction.output_text || '{}');
        const groundingScore = parsed.groundingConfidence || 0.5;
        console.log(`[Neural Grounding] Confidence: ${groundingScore}`);
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

        const home = DataService.standardize({ ...ProfileService.computeBaseline(req.homeTeam, []), name: req.homeTeamName });
        const away = DataService.standardize({ ...ProfileService.computeBaseline(req.awayTeam, []), name: req.awayTeamName });

        const ctx: MatchContext = { 
            weather: weather.condition, 
            referee: ref, 
            homeStyle, awayStyle, 
            league: req.league,
            homeSeasonXG: parsed.verifiedFacts?.homeSeasonXG,
            awaySeasonXG: parsed.verifiedFacts?.awaySeasonXG,
            homeSeasonXGA: parsed.verifiedFacts?.homeSeasonXGA,
            awaySeasonXGA: parsed.verifiedFacts?.awaySeasonXGA,
            stakes: parsed.verifiedFacts?.matchContext || 'Standard' 
        };

        const result = MatchEngine.calculate(home, away, ctx, (leagueContext as any).rhoData);
        result.summary = parsed.matchSummary || result.summary;
        
        cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
    } catch (e) {
        return getFallback(req, (leagueContext as any).rhoData);
    }
};
