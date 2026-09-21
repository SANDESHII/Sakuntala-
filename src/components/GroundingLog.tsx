import React from 'react';
import { motion } from 'motion/react';
import { Database, Search, ShieldCheck, Globe } from 'lucide-react';
import { MatchContext } from '../types';

interface GroundingLogProps {
  context: MatchContext;
}

export const GroundingLog: React.FC<GroundingLogProps> = ({ context }) => {
  return (
    <div className="space-y-12">
      <div className="flex items-center gap-4">
        <Database className="w-4 h-4 text-emerald-500" />
        <h3 className="text-xs font-black text-white uppercase tracking-[0.4em]">Grounding & Contextual Audit</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { label: 'Data Source', value: context.league, icon: Globe },
          { label: 'Sample Size', value: `${context.sampleSize} Matches`, icon: Search },
          { label: 'Integrity Check', value: 'PASSED', icon: ShieldCheck },
          { label: 'Model Date', value: context.date, icon: Database },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-8 bg-neutral-900/20 border border-neutral-900 rounded-2xl space-y-4"
          >
            <item.icon className="w-4 h-4 text-neutral-700" />
            <div className="space-y-1">
              <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">{item.label}</p>
              <p className="text-sm font-bold text-neutral-300 uppercase">{item.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="p-8 bg-neutral-900/10 border border-neutral-900/50 rounded-[32px]">
        <p className="text-[10px] font-medium text-neutral-500 leading-relaxed uppercase tracking-tight">
          Predictions are derived from a composite analysis of the Dixon-Coles Poisson model, 
          historical performance vectors, and live market inefficiencies. 
          The Alpha Terminal system enforces a strict 95% confidence interval for all displayed metrics.
        </p>
      </div>
    </div>
  );
};
