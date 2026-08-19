import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { performAnalysis } from "./src/services/geminiService";
import { BacktestService } from "./src/services/backtestService";
import { DataService } from "./src/services/dataService";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/health", (_, res) => res.json({ status: "ok" }));

  app.post("/api/ingest", async (req, res) => {
    try {
      const { league } = req.body;
      const { matches } = await DataService.getLeagueContext(league || 'EPL');
      res.json({ success: true, count: matches.length });
    } catch (error: any) {
      res.status(500).json({ error: "Sync Failed" });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      res.json(await performAnalysis(req.body));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/backtest", async (_, res) => {
    try {
      res.json(await BacktestService.runBacktest());
    } catch (error: any) {
      res.status(500).json({ error: "Audit Failed" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] active on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
