# Quantitative Football AI

Professional-grade football analytical terminal utilizing Dixon-Coles Poisson modeling and Maximum Likelihood Estimation (MLE) for Over/Under 2.5 market prediction.

## Technical Core
- **Statistical Engine**: Dixon-Coles model with low-score correction and temporal decay (phi=0.0065).
- **Optimization**: Gradient ascent MLE parameter fitting for team-specific attack and defense strengths.
- **Execution**: Kelly Criterion stake optimization (0.35 fraction) based on calculated model edge vs. market prices.
- **Grounding**: Integrated historical backtesting module to verify model yield and Brier score accuracy.

## Data Sources
- **Fixtures & Stats**: api-football.com (v3)
- **Live & Historical Odds**: the-odds-api.com (v4)

## API Endpoints
- `GET /api/fixtures?league=EPL` - Fetch upcoming league schedule.
- `POST /api/predict` - Run full statistical analysis for a match.
- `GET /api/backtest` - Execute historical performance audit across elite leagues.

## Configuration
The following environment variables are required for live data integration:
- `API_FOOTBALL_KEY`: API key from api-football.com
- `ODDS_API_KEY`: API key from the-odds-api.com
