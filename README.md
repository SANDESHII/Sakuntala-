# Quantitative Football AI

Dixon-Coles bivariate Poisson analytical terminal with Maximum Likelihood Estimation (MLE), multi-market pricing (Over/Under 1.5/2.5/3.5, 1X2, BTTS), fractional Kelly staking, Closing Line Value (CLV) tracking, league power ratings, and walk-forward historical backtesting.

## Run Locally
- Requires Node >= 20
- Install dependencies: `npm install`
- Copy `.env.example` to `.env` and fill in `API_FOOTBALL_KEY` and `ODDS_API_KEY`
- Start the server: `npm run dev` (open the printed URL)
- Checks and build scripts: `npm run typecheck`, `npm run build`, `npm run verify:backtest`, `npm run verify:xg`

## Quantitative Core
- **Score Model**: Dixon-Coles bivariate Poisson with low-score correlation (`rho`) and time-decay weighted gradient ascent MLE (`phi = 0.0065` per half-week, L2 shrinkage `REG_LAMBDA = 0.5`).
- **Multi-Market Derivation**: Derives Over/Under 1.5, 2.5, 3.5, 1X2 probabilities, BTTS Yes/No, and exact scoreline distributions from the unified bivariate Poisson matrix.
- **Staking**: Fractional Kelly Criterion (`0.35×` fraction, `5%` max stake, `3.0%` minimum edge threshold).
- **Walk-Forward Backtest**: Chronological matchday refits strictly prior to kickoff across `football-data.co.uk` CSVs (`2122`–`2425` across EPL, La Liga, Bundesliga, Serie A, Ligue 1), benchmarked against no-vig closing market Brier score, closing CLV, and 95% confidence intervals.

## API Endpoints
- `GET /api/health` — Live data provider health check.
- `GET /api/teams?league=EPL` — Canonical team registry for a league.
- `GET /api/ratings?league=EPL` — Fitted Dixon-Coles attack/defense power multipliers.
- `GET /api/fixtures?league=EPL` — Upcoming fixtures schedule (when live API keys are configured).
- `POST /api/predict` — Match prediction (`homeTeam`, `awayTeam`, `league`, optional `asOfDate`).
- `GET /api/backtest` — Walk-forward historical backtest summary, equity curve, and league breakdown.

## Environment Variables
- `API_FOOTBALL_KEY`: API key for live fixtures, match results, and team stats.
- `ODDS_API_KEY`: API key for live Over/Under 2.5 bookmaker odds.
