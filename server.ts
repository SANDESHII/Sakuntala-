import express from "express"; import path from "path"; import { createServer as createViteServer } from "vite"; import { BacktestService } from "./src/services/backtestService"; import { DataService } from "./src/services/dataService";
import { AnalysisPipeline } from "./src/services/pipeline";
import { fetchUpcomingFixtures } from "./src/services/geminiService";
async function startServer() {
  const app = express(), PORT = 3000; app.use(express.json());
  app.get("/api/health", (_, res) => res.json({ status: "ok" }));
  app.get("/api/fixtures", async (req, res) => { try { res.json(await fetchUpcomingFixtures(req.query.league as string)); } catch (e) { res.status(500).json({ error: "Discovery Failed" }); } });
  app.post("/api/ingest", async (req, res) => { try { const { league } = req.body; const { matches } = await DataService.getLeagueContext(league || 'EPL'); res.json({ success: true, count: matches.length }); } catch (e) { res.status(500).json({ error: "Sync Failed" }); } });
  app.post("/api/analyze", async (req, res) => { try { res.json(await AnalysisPipeline.execute(req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); } });
  app.get("/api/backtest", async (_, res) => { try { res.json(await BacktestService.runBacktest()); } catch (e) { res.status(500).json({ error: "Audit Failed" }); } });
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true, hmr: false }, appType: "spa" }); app.use(vite.middlewares);
    app.get("*all", async (req, res, next) => { if (req.url.startsWith("/api")) return next(); try { const fs = await import("fs"), html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf-8"), content = await vite.transformIndexHtml(req.url, html); res.status(200).set({ "Content-Type": "text/html" }).end(content); } catch (e) { vite.ssrFixStacktrace(e as Error); next(e); } });
  } else {
    const d = path.join(process.cwd(), "dist"); app.use(express.static(d)); app.get("*all", (_, res) => res.sendFile(path.join(d, "index.html")));
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`[SERVER] active on port ${PORT}`));
}
startServer().catch(e => { console.error(e); process.exit(1); });
