import { FC, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Terminal as TerminalIcon, ShieldAlert } from 'lucide-react';
import { AnalysisResult } from '../types';

interface BriefingPanelProps {
  analysis: AnalysisResult;
}

export const BriefingPanel: FC<BriefingPanelProps> = ({ analysis }) => {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchBriefing = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBriefing(data.text);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, [analysis.homeStats.name, analysis.awayStats.name]);

  return (
    <div className="p-8 bg-neutral-900/10 border border-neutral-900 rounded-[32px] space-y-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-5">
        <Sparkles className="w-24 h-24 text-emerald-500" />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TerminalIcon className="w-4 h-4 text-emerald-500" />
          <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Automated Analytical Briefing</h3>
        </div>
        {loading && (
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                className="w-1 h-1 bg-emerald-500 rounded-full"
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="h-2 w-3/4 bg-neutral-900 rounded animate-pulse" />
            <div className="h-2 w-1/2 bg-neutral-900 rounded animate-pulse" />
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 text-red-500/50"
          >
            <ShieldAlert className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Briefing System Offline</span>
          </motion.div>
        ) : (
          <motion.p
            key="content"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-medium text-neutral-400 leading-relaxed italic"
          >
            {briefing}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};
