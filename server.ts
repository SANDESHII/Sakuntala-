import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { BacktestService } from "./src/services/backtestService";
import { DataService } from "./src/services/dataService";
import { performAnalysis } from "./src/services/geminiService";
import { CalibrationService } from "./src/services/calibrationService";
import rateLimit from "express-rate-limit";

async function startServer() {
  const app = express(), PORT = 3000;
  app.set('trust proxy', 1);
  app.use(express.json());

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { error: "Rate limit exceeded. Protocol protection active." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const auth = (req: any, res: any, next: any) => {
    const key = req.headers['x-api-key'];
    const expected = process.env.INTERNAL_API_KEY || process.env.VITE_INTERNAL_API_KEY;
    if (expected && key !== expected) return res.status(401).json({ error: "Unauthorized access attempt logged." });
    next();
  };

  app.get("/api/health", (_, res) => res.json({ status: "active", uptime: process.uptime() }));

  app.post("/api/ingest", auth, async (req, res) => {
    try {
      const { league } = req.body;
      const { matches } = await DataService.getLeagueContext(league || 'EPL');
      res.json({ success: true, count: matches.length });
    } catch (e) {
      res.status(500).json({ error: "Ingestion failed." });
    }
  });

  app.post("/api/analyze", limiter, auth, async (req, res) => {
    try {
      res.json(await performAnalysis(req.body));
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Analysis failure." });
    }
  });

  app.get("/api/backtest", auth, async (req, res) => {
    try {
      res.json(await BacktestService.runBacktest((req.query.league as string) || 'EPL'));
    } catch (e) {
      res.status(500).json({ error: "Audit sequence failed." });
    }
  });

  app.get("/api/calibrate", auth, async (req, res) => {
    try {
      res.json(await CalibrationService.calibrate((req.query.league as string) || 'EPL'));
    } catch (e) {
      res.status(500).json({ error: "Calibration sequence failed." });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true, hmr: false }, appType: "spa" });
    app.use(vite.middlewares);
    app.get("*all", async (req, res, next) => {
      if (req.url.startsWith("/api")) return next();
      try {
        const fs = await import("fs");
        const html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf-8");
        const content = await vite.transformIndexHtml(req.url, html);
        res.status(200).set({ "Content-Type": "text/html" }).end(content);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const d = path.join(process.cwd(), "dist");
    app.use(express.static(d));
    app.get("*all", (_, res) => res.sendFile(path.join(d, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`[CORE] Node initialized on port ${PORT}`));
}

startServer().catch(e => {
  console.error("[FATAL]", e);
  process.exit(1);
});
