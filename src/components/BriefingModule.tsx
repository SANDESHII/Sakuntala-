import { AnalysisResult } from '../types';
import { Info } from 'lucide-react';

export const generateBriefing = (analysis: AnalysisResult) => {
    const { homeStats, awayStats, predictionType, probability, edge, verdict } = analysis;
    const isOver = predictionType === 'OVER_25';
    
    return [
        `Analysis of ${homeStats.name} vs ${awayStats.name} indicates a ${probability}% probability of ${isOver ? 'over' : 'under'} 2.5 goals.`,
        verdict === 'EXECUTE_BET' 
            ? `With a model edge of ${edge}%, this represents a high-value opportunity.`
            : `The market appears efficient with no significant edge detected.`,
        `Home xG: ${analysis.homeExpectedGoals.toFixed(2)}, Away xG: ${analysis.awayExpectedGoals.toFixed(2)}.`
    ].join(' ');
};

export const Briefing = ({ analysis }: { analysis: AnalysisResult }) => (
    <div className="bg-neutral-900/30 border border-neutral-800 rounded-[48px] p-12 lg:p-16 space-y-8">
        <div className="flex items-center gap-4">
            <Info className="w-5 h-5 text-emerald-500" />
            <h3 className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.3em]">Strategic Briefing</h3>
        </div>
        <p className="text-sm text-neutral-500 leading-relaxed font-medium">
            {generateBriefing(analysis)}
        </p>
    </div>
);
