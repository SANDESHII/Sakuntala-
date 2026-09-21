import { FC } from 'react';
import { motion } from 'motion/react';
import { Database, Search, ShieldCheck, Globe, AlertTriangle } from 'lucide-react';
import { AnalysisResult } from '../types';

interface GroundingLogProps {
  analysis: AnalysisResult;
}

export const GroundingLog: FC<GroundingLogProps> = ({ analysis }) => {
  const context = analysis.context;
  
  // Real Integrity Check: verify sane bounds and non-null critical values
  const checkIntegrity = () => {
    const issues = [];
    if (analysis.probability < 0 || analysis.probability > 100) issues.push('PROB_OOB');
    if (analysis.marketOdds <= 1.0) issues.push('ODDS_ERR');
    if (!analysis.homeStats.avgXG || !analysis.awayStats.avgXG) issues.push('STATS_NULL');
    if (Math.abs(analysis.edge) > 100) issues.push('EDGE_EXTREME');
    
    return issues.length === 0;
  };

  const isIntegrityPassed = checkIntegrity();

  return (
    <div className="space-y-12">
      <div className="flex items-center gap-4">
        <Database className="w-4 h-4 text-emerald-500" />
        <h3 className="text-xs font-black text-white uppercase tracking-[0.4em]">Grounding & Contextual Audit</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { label: 'Data Source', value: context.league || 'GLOBAL', icon: Globe },
          { label: 'Market Status', value: analysis.usedRealOdds ? 'LIVE ODDS' : 'NO ODDS', icon: Search },
          { 
            label: 'Integrity Check', 
            value: isIntegrityPassed ? 'PASSED' : 'FAILED', 
            icon: isIntegrityPassed ? ShieldCheck : AlertTriangle,
            color: isIntegrityPassed ? 'text-neutral-700' : 'text-red-500'
          },
          { label: 'Model Date', value: context.date || 'REALTIME', icon: Database },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-8 bg-neutral-900/20 border border-neutral-900 rounded-2xl space-y-4"
          >
            <item.icon className={`w-4 h-4 ${item.color || 'text-neutral-700'}`} />
            <div className="space-y-1">
              <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">{item.label}</p>
              <p className={`text-sm font-bold uppercase ${item.value === 'FAILED' ? 'text-red-500' : 'text-neutral-300'}`}>{item.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="p-8 bg-neutral-900/10 border border-neutral-900/50 rounded-[32px]">
        <p className="text-[10px] font-medium text-neutral-500 leading-relaxed uppercase tracking-tight">
          Predictions are derived from a composite analysis of the Dixon-Coles Poisson model, 
          historical performance vectors, and live market inefficiencies. 
          {isIntegrityPassed ? ' Current audit confirms statistical integrity within expected variance.' : ' ⚠️ Warning: Potential data inconsistency detected in current analysis.'}
        </p>
      </div>
    </div>
  );
};
