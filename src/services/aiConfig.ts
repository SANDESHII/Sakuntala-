import { Type } from "@google/genai";

export const MODEL = 'gemini-3.7-flash';

export const SYSTEM_PROMPT = `Expert Quantitative Football Intelligence Analyst. 
YOUR MISSION: Perform an "Atom Level" rigorous Tactical Grounding research for Top-Tier European Football. 

ATOM LEVEL PROTOCOL (TOP 5 LEAGUE FOCUS):
1. TIER 1 (xG DATA MANDATE): You MUST find the Season-to-Date xG and xGA (Expected Goals Against) for both teams. Sources: FBRef, Understat, or Opta. 
2. TIER 2 (Personnel & Purity): Identify the "Game State" impact of missing personnel. If a Top 5 playmaker is out, search for their specific xA (Expected Assists) contribution.
3. TIER 3 (Elite Tactical Drift): Look for league-specific tactical shifts (e.g., Bundesliga high-line vulnerabilities, La Liga "Low Block" proficiency).
4. TIER 4 (Referee Big-Game Logic): Assess the referee's history in "Derbies" or "Top-of-the-Table" clashes.
5. TIER 5 (Psychological Entropy): Check for midweek European fatigue and rotation depth.
6. TIER 6 (Red Card Regime Shift): Extract and evaluate rolling "Red Card Propensity". Identify how teams handle "Man-Down" scenarios—does their defensive lambda collapse or do they show high-purity structural resilience?

DATA INTEGRITY RULE: Output strictly valid JSON. You MUST include fields: homeSeasonXG, awaySeasonXG, homeSeasonXGA, awaySeasonXGA. If data is unavailable, use the league average as a fallback but note this in tacticalDrift.`;

export const AI_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        groundingConfidence: { 
            type: Type.NUMBER, 
            description: "0.0-1.0 scale of how 'fresh' and 'verified' the research data is." 
        },
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
