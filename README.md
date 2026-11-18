# Quantitative Football AI

Dixon-Coles bivariate Poisson model with Maximum Likelihood Estimation (MLE), fractional Kelly staking, Closing Line Value (CLV) tracking, and walk-forward historical backtesting on Over/Under 2.5 goals.

## Quantitative Core
- **Score Model**: Dixon-Coles bivariate Poisson with low-score correlation (`rho`) and time-decay weighted gradient ascent MLE (`phi = 0.0065`, L2 shrinkage `REG_LAMBDA = 0.5`).
- **Staking**: Fractional Kelly Criterion (`0.35` fraction, `5%` max stake, `3.0%` minimum edge threshold).
- **Walk-Forward Backtest**: Chronological matchday refits strictly prior to kickoff across `football-data.co.uk` CSVs (`2122`–`2425` across EPL, La Liga, Bundesliga, Serie A, Ligue 1), benchmarked against no-vig closing market Brier score, closing CLV, and 95% confidence intervals.

## API Endpoints
- `GET /api/health` — Live data provider health check.
- `GET /api/fixtures?league=EPL` — Upcoming fixtures schedule.
- `POST /api/predict` — Match prediction (`homeTeam`, `awayTeam`, `league`, optional `asOfDate`).
- `GET /api/backtest` — Walk-forward historical backtest summary.

## Environment Variables
- `API_FOOTBALL_KEY`: API key for live fixtures, match results, and team stats.
- `ODDS_API_KEY`: API key for live Over/Under 2.5 bookmaker odds.
