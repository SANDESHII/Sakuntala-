export class DixonColes {
    static poisson(k:number, l:number):number { if (l <= 0) return k === 0 ? 1 : 0; if (k < 0) return 0; let logFact = 0; for (let i = 2; i <= k; i++) logFact += Math.log(i); return Math.exp(k * Math.log(l) - l - logFact); }
    static tau(x:number, y:number, l:number, m:number, r:number):number { let v = 1; if (x === 0 && y === 0) v = 1 - (l * m * r); else if (x === 0 && y === 1) v = 1 + (l * r); else if (x === 1 && y === 0) v = 1 + (m * r); else if (x === 1 && y === 1) v = 1 - r; return Math.max(0.0001, v); }
    static calculateScoreMatrix(hL:number, aM:number, r:number = -0.11, max:number = 8, hPhi?: number, aPhi?: number):number[][] { 
        const m = Array.from({ length: max + 1 }, (_, h) => Array.from({ length: max + 1 }, (_, a) => {
            const pH = hPhi ? GoalDistribution.negativeBinomial(h, hL, hPhi) : this.poisson(h, hL);
            const pA = aPhi ? GoalDistribution.negativeBinomial(a, aM, aPhi) : this.poisson(a, aM);
            return pH * pA * this.tau(h, a, hL, aM, r);
        })); 
        const s = m.reduce((acc, row) => acc + row.reduce((ra, p) => ra + p, 0), 0);
        return m.map(row => row.map(p => p / (s || 1)));
    }
    static calculateOverUnder(m:number[][], t:number):number { return m.reduce((acc, row, h) => acc + row.reduce((ra, p, a) => ra + (h + a > t ? p : 0), 0), 0); }
    static fitRho(matches:{x:number, y:number, lambda:number, mu:number, weight?:number}[]):{rho:number, sigmaRho:number} {
        let r = -0.11, fC = 0;
        for (let i = 0; i < 50; i++) {
            let g = 0, c = 0;
            for (const { x, y, lambda: l, mu: m, weight = 1.0 } of matches) {
                const t = this.tau(x, y, l, m, r); let d1 = 0, d2 = 0;
                if (x === 0 && y === 0) { d1 = -l * m / t; d2 = -Math.pow(l * m, 2) / (t * t); } else if (x === 0 && y === 1) { d1 = l / t; d2 = -(l * l) / (t * t); } else if (x === 1 && y === 0) { d1 = m / t; d2 = -(m * m) / (t * t); } else if (x === 1 && y === 1) { d1 = -1 / t; d2 = -1 / (t * t); }
                g += (d1 * weight); c += (d2 * weight);
            }
            fC = c; if (Math.abs(c) < 1e-10) break; const delta = g / c; r = Math.max(-0.25, Math.min(0.25, r - delta)); if (Math.abs(delta) < 1e-6) break;
        }
        return { rho: r, sigmaRho: fC < 0 ? Math.sqrt(-1 / fC) : 0.05 };
    }
}

export class BivariatePoisson {
    static calculateScoreMatrix(l1: number, l2: number, l3: number, max: number = 8): number[][] {
        const matrix = Array.from({ length: max + 1 }, () => new Array(max + 1).fill(0));
        for (let x = 0; x <= max; x++) {
            for (let y = 0; y <= max; y++) {
                let prob = 0;
                for (let k = 0; k <= Math.min(x, y); k++) {
                    prob += (DixonColes.poisson(x - k, l1) * DixonColes.poisson(y - k, l2) * DixonColes.poisson(k, l3));
                }
                matrix[x][y] = prob;
            }
        }
        const sum = matrix.reduce((s, row) => s + row.reduce((rs, p) => rs + p, 0), 0);
        return matrix.map(row => row.map(p => p / (sum || 1)));
    }
}

export class GoalDistribution {
    static logGamma(z: number): number {
        const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
        let x = z, y = z, tmp = x + 5.5;
        tmp -= (x + 0.5) * Math.log(tmp);
        let ser = 1.000000000190015;
        for (let i = 0; i < 6; i++) ser += c[i] / ++y;
        return -tmp + Math.log(2.5066282746310005 * ser / x);
    }
    static negativeBinomial(k: number, mu: number, phi: number): number {
        if (mu <= 0) return k === 0 ? 1 : 0;
        if (phi <= 0) return DixonColes.poisson(k, mu);
        const logP = this.logGamma(k + phi) - this.logGamma(k + 1) - this.logGamma(phi)
            + phi * Math.log(phi / (mu + phi))
            + k * Math.log(mu / (mu + phi));
        return Math.exp(logP);
    }
}
export class MonteCarloSimulator {
    static run(hL:number, aM:number, threshold:number = 1.5, isUnder:boolean = false, rho:number = -0.11, iters:number = 10000) {
        const matrix = DixonColes.calculateScoreMatrix(hL, aM, rho);
        const flat: { hit: boolean, p: number }[] = [];
        for (let h = 0; h <= 8; h++) {
            for (let a = 0; a <= 8; a++) {
                flat.push({ hit: isUnder ? (h + a < threshold) : (h + a > threshold), p: matrix[h][a] });
            }
        }
        let hits = 0;
        for (let i = 0; i < iters; i++) {
            const r = Math.random(); let c = 0;
            for (const cell of flat) {
                c += cell.p;
                if (r <= c) { if (cell.hit) hits++; break; }
            }
        }
        const m = hits / iters;
        const ci95 = 1.96 * Math.sqrt((m * (1 - m)) / iters);
        return { mean: m, median: m, confidenceInterval: [m - ci95, m + ci95] };
    }
}

