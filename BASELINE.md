# BASELINE

## Verification Outputs

### /api/health
```json
{"status":"DEGRADED","services":{"apiFootball":"DOWN","theOddsApi":"DOWN"},"timestamp":"2026-10-31T03:52:17.895Z"}
```

### /api/fixtures?league=EPL
```json
[]
```

### /api/predict (ARSENAL vs CHELSEA)
```json
{"probability":0,"rawProbability":0.6196654765105726,"summary":"Analysis of ARSENAL vs CHELSEA completed.","homeStats":{"name":"ARSENAL","goalsScored":2.1,"goalsConceded":0.9,"avgGoalsScored":2.1,"avgGoalsConceded":0.9,"defensiveRatingHeuristic":0.45,"form":[3,1,3,1,0],"cleanSheets":9,"homeAwayBias":0.32},"awayStats":{"name":"CHELSEA","goalsScored":1.7,"goalsConceded":1.2,"avgGoalsScored":1.7,"avgGoalsConceded":1.2,"defensiveRatingHeuristic":0.3,"form":[1,3,0,1,3],"cleanSheets":6,"homeAwayBias":0.28},"homeExpectedGoals":2.0370042,"awayExpectedGoals":1.1609325,"predictionType":"NO_BET","predictionLabel":"NO EDGE","marketOdds":null,"marketImpliedProb":null,"edge":0,"recommendedStake":0,"verdict":"NO_BET","context":{"league":"EPL","homeSeasonGoals":42,"awaySeasonGoals":34,"homeSeasonGoalsAgainst":18,"awaySeasonGoalsAgainst":24,"homeAttackRating":0,"awayAttackRating":0,"date":"","marketOdds":{"pinnacleOver25":0,"pinnacleUnder25":0}},"dataSource":"FALLBACK_STATIC","modelSource":"HEURISTIC_FALLBACK","isLowConfidence":false,"scoreMatrix":[[0.05340368718819428,0.034862616269406704,0.027525656170649452,0.010651809610777494,0.0030915079902409867,0.0007178064199760885],[0.07064698737901629,0.10915184348259145,0.05606987722736886,0.021697780914754123,0.006297414760454451,0.0014621746922782563],[0.08474373299956955,0.09838175381052278,0.057107287702817366,0.022099235427017,0.006413930158093856,0.0014892279946522582],[0.057541113347933937,0.06680134857180031,0.038775928300415784,0.015005411793874143,0.0043550675568479495,0.0010111878932880759],[0.029302872390604386,0.034018656901605326,0.01974668220171146,0.007641521711712794,0.002217822726145754,0.0005149484964042408],[0.011938014826345034,0.013859229397385807,0.008044814916190298,0.0031131623642300303,0.0009035428416028702,0.0002097904499918247]]}
```

## Build Artifacts
- `tsc --noEmit`: Success
- `npm run build`: Success (4.21s)
- `Bundle Size`: dist/assets/index-Bg4zOK-0.js 490.32 kB
