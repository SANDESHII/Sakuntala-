/**
 * CORE PREDICTION MATHEMATICS
 * Consolidated Dixon-Coles and Monte Carlo Simulation logic.
 */

export class DixonColes {
    static poisson(k: number, l: number): number {
        if (l <= 0) return k === 0 ? 1 : 0;
        let r = 1; for (let i = 2; i <= k; i++) r *= i;
        return (Math.exp(-l) * Math.pow(l, k)) / r;
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
        let s = 0;
        const m = Array.from({ length: max + 1 }, (_, h) => Array.from({ length: max + 1 }, (_, a) => {
            const p = this.poisson(h, hL) * this.poisson(a, aM) * this.tau(h, a, hL, aM, r);
            s += p; return p;
        }));
        return s > 0 ? m.map(row => row.map(p => p / s)) : m;
    }

    static calculateOverUnder(m: number[][], t: number): number {
        return m.reduce((acc, row, h) => acc + row.reduce((ra, p, a) => ra + (h + a > t ? p : 0), 0), 0);
    }

    static calculateMatchOutcomes(m: number[][]): { home: number; draw: number; away: number } {
        const res = { home: 0, draw: 0, away: 0 };
        m.forEach((row, h) => row.forEach((p, a) => {
            if (h > a) res.home += p; else if (h === a) res.draw += p; else res.away += p;
        }));
        return res;
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
    static run(hL: number, aM: number, hV: number, aV: number, threshold: number = 1.5, isUnder: boolean = false, rho: number = -0.11, sR: number = 0.05, iters: number = 5000) {
        const hSD = Math.sqrt(hV), aSD = Math.sqrt(aV);
        const ps = Array.from({ length: iters }, () => {
            const hLS = Math.max(0.1, this.sampleNormal(hL, hSD)), aMS = Math.max(0.1, this.sampleNormal(aM, aSD)), rS = Math.max(-0.25, Math.min(0.25, this.sampleNormal(rho, sR)));
            const m = DixonColes.calculateScoreMatrix(hLS, aMS, rS), pO = DixonColes.calculateOverUnder(m, threshold);
            return isUnder ? 1 - pO : pO;
        });
        const s = [...ps].sort((a, b) => a - b), m = ps.reduce((a, b) => a + b, 0) / iters;
        return { mean: m, median: s[Math.floor(iters / 2)], confidenceInterval: [s[Math.floor(iters * 0.05)], s[Math.floor(iters * 0.95)]] };
    }
    private static sampleNormal(m: number, sd: number): number {
        const u1 = Math.random(), u2 = Math.random();
        return m + sd * Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    }
}

export class EdgeCalculator {
    static impliedProb = (o: number) => 1 / o;
    static removeVig = (ps: number[]) => {
        const sum = ps.reduce((a, b) => a + b, 0);
        return ps.map(p => p / sum);
    };
    static calculateEdge = (mp: number, tp: number) => mp - tp;
    static analyze(mO15: number, mU35: number, odds: any) {
        const [tO15] = this.removeVig([this.impliedProb(odds.over15), this.impliedProb(odds.under15)]);
        const [, tU35] = this.removeVig([this.impliedProb(odds.over35), this.impliedProb(odds.under35)]);
        return {
            odds, impliedProb: { over15: tO15, under35: tU35 },
            edge: { over15: this.calculateEdge(mO15, tO15), under35: this.calculateEdge(mU35, tU35) },
            source: 'Market',
            isSimulated: !!odds.isSimulated
        };
    }
}
