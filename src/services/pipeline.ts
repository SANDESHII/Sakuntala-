import { AnalysisResult } from "../types";
import { DataService } from "./dataService";
import { performAnalysis } from "./geminiService";

export class AnalysisPipeline {
    /**
     * @LAYER_1_INGESTION: Fetches raw context.
     * @LAYER_2_GROUNDING: Enriches with real-time AI/search facts.
     * @LAYER_3_SIMULATION: Executes math models.
     * @LAYER_4_PROJECTION: Finalizes and delivers.
     */
    static async execute(req: any): Promise<AnalysisResult> {
        // L1: Ingestion - Fail early if context is missing
        const context = await DataService.getLeagueContext(req.league);
        if (!context) throw new Error("INGESTION_FAILED: Context unavailable");

        // L2, L3, L4: Orchestrated within the specialized analysis service
        // performAnalysis internally respects the Ground -> Simulate -> Project sequence
        return await performAnalysis({ ...req, context });
    }
}
