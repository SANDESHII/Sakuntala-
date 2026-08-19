/**
 * CORE PREDICTION MATHEMATICS
 * Consolidated Dixon-Coles and Monte Carlo Simulation logic.
 */

export class DixonColes {
    static poisson(k: number, l: number): number {
        if (l <= 0) return k === 0 ? 1 : 0;
        if (k < 0) return 0;
        
        // Log-space calculation for numerical stability:
        // ln(P) = k*ln(l) - l - ln(k!)
        let logFact = 0;
        for (let i = 2; i <= k; i++) logFact += Math.log(i);
        
        const logProb = k * Math.log(l) - l - logFact;
        return Math.exp(logProb);
    }

    static tau(x: number, y: number, l: number, m: number, r: number): number {
        let v = 1;
        if (x === 0 && y === 0) v = 1 - (l * m * r);
        else if (x === 0 && y === 1) v = 1 + (l * r);
        else if (x === 1 && y === 0) v = 1 + (m * r);
        else if (x === 1 && y === 1) v = 1 - r;
        return Math.max(0.0001, v);
    }

    static calculateScoreMatrix(hL: number, aM: number, r: number = -0.11, max: number = 8): number[][] {
        return Array.from({ length: max + 1 }, (_, h) => Array.from({ length: max + 1 }, (_, a) => {
            return this.poisson(h, hL) * this.poisson(a, aM) * this.tau(h, a, hL, aM, r);
        }));
    }

    static calculateOverUnder(m: number[][], t: number): number {
        return m.reduce((acc, row, h) => acc + row.reduce((ra, p, a) => ra + (h + a > t ? p : 0), 0), 0);
    }

    static fitRho(matches: { x: number, y: number, lambda: number, mu: number, weight?: number }[]): { rho: number, sigmaRho: number } {
        let r = -0.11, fC = 0;
        for (let i = 0; i < 50; i++) {
            let g = 0, c = 0;
            for (const { x, y, lambda: l, mu: m, weight = 1.0 } of matches) {
                const t = this.tau(x, y, l, m, r);
                let d1 = 0, d2 = 0;
                if (x === 0 && y === 0) { d1 = -l * m / t; d2 = -Math.pow(l * m, 2) / (t * t); }
                else if (x === 0 && y === 1) { d1 = l / t; d2 = -(l * l) / (t * t); }
                else if (x === 1 && y === 0) { d1 = m / t; d2 = -(m * m) / (t * t); }
                else if (x === 1 && y === 1) { d1 = -1 / t; d2 = -1 / (t * t); }
                
                // ATOM LEVEL: Scale gradients and hessians by time-decay weight
                g += (d1 * weight); 
                c += (d2 * weight);
            }
            fC = c; if (Math.abs(c) < 1e-10) break;
            const delta = g / c;
            r = Math.max(-0.25, Math.min(0.25, r - delta));
            if (Math.abs(delta) < 1e-6) break;
        }
        return { rho: r, sigmaRho: fC < 0 ? Math.sqrt(-1 / fC) : 0.05 };
    }
}

export class MonteCarloSimulator {
    static run(hL: number, aM: number, hV: number, aV: number, threshold: number = 1.5, isUnder: boolean = false, rho: number = -0.11, iters: number = 10000) {
        // Calculate Dispersion Parameters for Negative Binomial (Gamma-Poisson Mixture)
        // phi = lambda^2 / (var - lambda)
        const hPhi = hV > hL ? (hL * hL) / (hV - hL) : 100;
        const aPhi = aV > aM ? (aM * aM) / (aV - aM) : 100;

        const ps = Array.from({ length: iters }, () => {
            // Pure Negative Binomial: Gamma-Poisson mixture
            const hLS = this.sampleGamma(hPhi, hL / hPhi);
            const aMS = this.sampleGamma(aPhi, aM / aPhi);

            let hG, aG;
            let accepted = false;
            let attempts = 0;

            // Dixon-Coles Correlation Correction via Rejection Sampling
            // We use a max_tau constant to normalize the rejection probability.
            const maxTau = 1.5; 

            do {
                hG = this.samplePoisson(hLS);
                aG = this.samplePoisson(aMS);
                
                const tau = DixonColes.tau(hG, aG, hLS, aMS, rho);
                if (Math.random() < (tau / maxTau)) {
                    accepted = true;
                }
                attempts++;
            } while (!accepted && attempts < 5);
            
            const total = hG + aG;
            return isUnder ? total < threshold : total > threshold;
        });

        const m = ps.reduce((acc, v) => acc + (v ? 1 : 0), 0) / iters;
        
        const se = Math.sqrt((m * (1 - m)) / iters);
        const ci95 = 1.96 * se;

        return { 
            mean: m, 
            median: m,
            confidenceInterval: [m - ci95, m + ci95]
        };
    }

    /**
     * Step B: Gamma Sampler (Marsaglia and Tsang Method)
     * Used to create the Negative Binomial mixture.
     */
    private static sampleGamma(k: number, theta: number): number {
        const shape = Math.max(0.0001, k);
        if (shape < 1) return this.sampleGamma(1 + shape, theta) * Math.pow(Math.random(), 1 / shape);
        
        const d = shape - 1 / 3;
        const c = 1 / Math.sqrt(9 * d);
        while (true) {
            let x, v, u;
            do {
                x = this.sampleNormal(0, 1);
                v = 1 + c * x;
            } while (v <= 0);
            v = v * v * v;
            u = Math.random();
            if (u < 1 - 0.0331 * x * x * x * x) return d * v * theta;
            if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * theta;
        }
    }

    private static samplePoisson(lambda: number): number {
        let L = Math.exp(-lambda);
        let p = 1.0;
        let k = 0;
        do {
            k++;
            p *= Math.random();
        } while (p > L);
        return k - 1;
    }
    private static sampleNormal(m: number, sd: number): number {
        const u1 = Math.random(), u2 = Math.random();
        return m + sd * Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    }
}
