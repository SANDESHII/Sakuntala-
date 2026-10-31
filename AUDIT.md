# Phase 1 - Reachability Audit

## Import Graph Summary
- **Entry Points**: `server.ts`, `index.html` -> `src/main.tsx`, `vite.config.ts`.
- **Status**: All source files are reachable from at least one entry point.

## File Audit

| Path | Lines | Purpose | Reachable? | Verdict | Proof |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `server.ts` | 130 | API Layer & Static Serving | YES (Entry) | KEEP | Entry point |
| `index.html` | 21 | Web Entry Point | YES (Entry) | KEEP | Entry point |
| `src/main.tsx` | 11 | React Hydration | YES (Entry) | KEEP | Loaded by index.html |
| `vite.config.ts` | 8 | Build Configuration | YES (Entry) | KEEP | Entry point |
| `src/App.tsx` | 204 | UI Router & Root State | YES | KEEP | Imported by main.tsx |
| `src/index.css` | 65 | Global Styles (Tailwind) | YES | KEEP | Imported by main.tsx |
| `src/types.ts` | 188 | Shared Type Definitions | YES | EDIT | Imported by App, Engine, etc. Unused exports found. |
| `src/core/engine.ts` | 269 | Prediction Orchestrator | YES | EDIT | Imported by server.ts. Legacy params removal needed. |
| `src/core/math.ts` | 131 | Poisson & Dixon-Coles Math | YES | KEEP | Imported by engine.ts |
| `src/core/calibration.ts`| 261 | MLE Optimization Logic | YES | EDIT | Imported by engine.ts. Internalization candidate. |
| `src/core/features.ts` | 81 | Point-in-time Feature Engine | YES | EDIT | Imported by engine.ts. Param cleanup needed. |
| `src/core/constants.ts` | 77 | Model & League Constants | YES | EDIT | Imported by server.ts, engine.ts. Unused exports. |
| `src/services/logger.ts` | 13 | Unified Logging Utility | YES | KEEP | Imported by server.ts, engine.ts. |
| `src/services/freeDataService.ts` | 325 | API Data Integrations | YES | EDIT | Imported by server.ts, engine.ts. |
| `src/data/teamIds.ts` | 196 | Canonical ID Mapping | YES | EDIT | Imported by engine.ts. Internalization candidate. |
| `src/data/utils.ts` | 18 | Season/League Helpers | YES | KEEP | Imported by freeDataService.ts. |
| `src/components/AnalysisForm.tsx` | 197 | Prediction Input UI | YES | EDIT | Imported by App.tsx. Contains code clone. |
| `src/components/BacktestDisplay.tsx`| 92 | Historical Audit UI | YES | KEEP | Imported by App.tsx (lazy). |
| `src/components/BaseInput.tsx` | 17 | Atomic Input Component | YES | KEEP | Imported by AnalysisForm.tsx. |
| `src/components/GroundingLog.tsx` | 54 | Data Integrity UI | YES | KEEP | Imported by App.tsx. |
| `src/components/Header.tsx` | 37 | Status & Identity UI | YES | KEEP | Imported by App.tsx. |
| `src/components/LoadingOverlay.tsx` | 63 | System Processing UI | YES | KEEP | Imported by App.tsx. |
| `src/components/ResultDisplay.tsx` | 166 | Statistical Output UI | YES | KEEP | Imported by App.tsx. |
| `src/components/ScoreHeatmap.tsx` | 83 | Probability Matrix UI | YES | KEEP | Imported by ResultDisplay.tsx. |
| `src/vite-env.d.ts` | 2 | Vite Environment Types | YES | KEEP | Automatic TS inclusion. |

## Unused Exported Symbols
| Symbol | Location | Status |
| :--- | :--- | :--- |
| `EDGE_THRESHOLD` | `src/core/constants.ts` | DELETE (Redundant with MODEL_CONFIG) |
| `MatchContext` | `src/types.ts` | KEEP (Nested property of AnalysisResult) |
| `GoalDistribution` | `src/types.ts` | KEEP (Nested property of AnalysisResult) |
| `BacktestError` | `src/types.ts` | KEEP (Used in server.ts error handling) |
| `BacktestResponse` | `src/types.ts` | DELETE (Unused union type) |

## Duplicate Blocks (jscpd)
- `src/components/AnalysisForm.tsx`: Lines 158-167 vs 173-182 (UI markup for home/away logos).

## Reachability Proof
- `server.ts` -> `engine.ts` -> `math.ts`, `calibration.ts`, `features.ts`, `teamIds.ts`, `logger.ts`.
- `main.tsx` -> `App.tsx` -> `Header.tsx`, `LoadingOverlay.tsx`, `AnalysisForm.tsx`, `ResultDisplay.tsx`, `GroundingLog.tsx`, `BacktestDisplay.tsx`.
- `ResultDisplay.tsx` -> `ScoreHeatmap.tsx`.
- `AnalysisForm.tsx` -> `BaseInput.tsx`.
- `freeDataService.ts` -> `utils.ts`, `teamIds.ts`.
