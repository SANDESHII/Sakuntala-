import { FC, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { MODEL_CONFIG, TIME_DECAY_PHI, REG_LAMBDA, BASE_GOALS, DEFAULT_RHO, XG_BLEND_WEIGHT } from '../core/constants';

interface HealthStatus {
  status: string;
  services: {
    apiFootball: string;
    theOddsApi: string;
  };
  timestamp: string;
}

export const MethodologyView: FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  const checkHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        setHealth(await res.json());
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="space-y-8 page-transition">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">
            01. Dixon-Coles Bivariate Poisson Model
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Match scorelines are modeled as correlated Poisson random variables with home expected goals{' '}
            <span className="font-mono text-slate-900 dark:text-slate-100">λ = α_H · β_A · γ · BASE_L</span> and away expected goals{' '}
            <span className="font-mono text-slate-900 dark:text-slate-100">μ = α_A · β_H · BASE_L</span>, where{' '}
            <span className="font-mono">BASE_L</span> scales by each league&apos;s goal rate.
            The low-score dependence parameter <span className="font-mono">ρ</span> adjusts joint probabilities on{' '}
            <span className="font-mono">0–0, 0–1, 1–0, 1–1</span> outcomes to correct independent Poisson draw bias.
          </p>
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-4 text-xs font-mono tabular-nums">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Base Goals Constant</span>
              <span className="text-slate-900 dark:text-slate-100 font-semibold">{BASE_GOALS}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Prior Correlation (ρ)</span>
              <span className="text-slate-900 dark:text-slate-100 font-semibold">{DEFAULT_RHO}</span>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">
            02. Time-Decayed Shot-Quality MLE &amp; L2 Shrinkage
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Team attack (<span className="font-mono">α</span>) and defense (<span className="font-mono">β</span>) strengths blend goals with a causal shot-quality xG proxy (<span className="font-mono">{(XG_BLEND_WEIGHT * 100).toFixed(0)}%</span> weight when shots on target are available), fit via exponentially weighted MLE{' '}
            <span className="font-mono text-slate-900 dark:text-slate-100">w(t) = exp(−φ · Δdays)</span> with mean-centered L2 shrinkage to prevent small-sample overfitting.
          </p>
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-4 text-xs font-mono tabular-nums">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Decay Rate (φ / day)</span>
              <span className="text-slate-900 dark:text-slate-100 font-semibold">{TIME_DECAY_PHI.toFixed(6)}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">L2 Shrinkage (λ)</span>
              <span className="text-slate-900 dark:text-slate-100 font-semibold">{REG_LAMBDA}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">xG Shot Blend</span>
              <span className="text-slate-900 dark:text-slate-100 font-semibold">{(XG_BLEND_WEIGHT * 100).toFixed(0)}%</span>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">
            03. Fractional Kelly Staking & Edge Gate
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            When two-way bookmaker odds are quoted, pure Dixon-Coles probabilities are shrunk toward the no-vig market prior (
            <span className="font-mono text-slate-900 dark:text-slate-100">
              {(MODEL_CONFIG.BAYESIAN_MODEL_WEIGHT * 100).toFixed(0)}% model / {((1 - MODEL_CONFIG.BAYESIAN_MODEL_WEIGHT) * 100).toFixed(0)}% prior
            </span>
            ) to guard against unmodeled lineup or injury news. Wagers trigger only when Bayesian edge exceeds{' '}
            <span className="font-mono text-slate-900 dark:text-slate-100">{(MODEL_CONFIG.EDGE_THRESHOLD * 100).toFixed(1)}%</span> and both clubs satisfy ≥ 6 prior matches, sized at{' '}
            <span className="font-mono text-slate-900 dark:text-slate-100">{MODEL_CONFIG.KELLY_FRACTION}×</span> Kelly capped at{' '}
            <span className="font-mono text-slate-900 dark:text-slate-100">{(MODEL_CONFIG.MAX_KELLY_STAKE * 100).toFixed(1)}%</span>.
          </p>
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-4 text-xs font-mono tabular-nums">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Min Edge Gate</span>
              <span className="text-slate-900 dark:text-slate-100 font-semibold">{(MODEL_CONFIG.EDGE_THRESHOLD * 100).toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Kelly Fraction</span>
              <span className="text-slate-900 dark:text-slate-100 font-semibold">{MODEL_CONFIG.KELLY_FRACTION}×</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Max Stake Cap</span>
              <span className="text-slate-900 dark:text-slate-100 font-semibold">{(MODEL_CONFIG.MAX_KELLY_STAKE * 100).toFixed(1)}%</span>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">
              04. Data Feeds & Provider Connectivity
            </h2>
            <button
              type="button"
              onClick={checkHealth}
              disabled={loadingHealth}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHealth ? 'animate-spin' : ''}`} />
              Check Feeds
            </button>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            When live API credentials are configured, upcoming schedules and market odds stream from API-Football and The Odds API. Without API keys, the engine automatically fits MLE parameters using public historical match archives from football-data.co.uk.
          </p>
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">API-Football</span>
              <span className="text-slate-900 dark:text-slate-100 font-semibold">
                {health?.services?.apiFootball || 'Checking...'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">The Odds API</span>
              <span className="text-slate-900 dark:text-slate-100 font-semibold">
                {health?.services?.theOddsApi || 'Checking...'}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
