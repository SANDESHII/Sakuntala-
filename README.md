# Alpha Terminal

Professional-grade football analytical terminal utilizing Dixon-Coles Poisson modeling and MLE parameter fitting for over/under market prediction.

## Core Features
- Dixon-Coles statistical engine
- Maximum Likelihood Estimation (MLE) parameter calibration
- Kelly criterion stake optimization
- Integrated historical audit (backtesting)
- Live fixtures, odds & team stats via unified API layer

## API Endpoints
- `GET /api/fixtures?league=EPL` - Fetch upcoming matches
- `POST /api/predict` - Execute full Dixon-Coles analysis
- `GET /api/backtest` - Run historical model grounding

## Configuration
Requires the following environment variables for live data feeds:
- `API_FOOTBALL_KEY`: From api-football.com
- `ODDS_API_KEY`: From the-odds-api.com
