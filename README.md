# Alpha Terminal

Football prediction system using Dixon-Coles statistical modeling. Focused on Over 2.5 and Under 2.5 Goal Markets.

## Core Features
- Dixon-Coles statistical engine
- Monte Carlo simulations
- Kelly criterion stake calculation
- Historical backtesting module
- Live fixtures, odds & team stats via API

## API Endpoints
- `GET /api/fixtures?league=EPL`
- `GET /api/odds?league=EPL`
- `GET /api/stats?team=Arsenal&league=EPL`
- `GET /api/predict?home=Arsenal&away=Chelsea&league=EPL`
