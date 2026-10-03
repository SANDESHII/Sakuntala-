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
- `GET /api/odds?league=EPL` - Fetch live market liquidity
- `POST /api/predict` - Execute full Dixon-Coles analysis
- `GET /api/backtest` - Run historical model grounding
