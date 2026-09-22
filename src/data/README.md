# Alpha Terminal Data Layer

Advanced, production-grade data pipeline for football quant research.

## Architecture

- **`src/data/identity/`**: Canonical team registry. Maps IDs across providers (API-Football, Understat, The Odds API) to internal canonical keys (e.g., `MAN_CITY`).
- **`src/data/providers/`**: Uniform adapter interface for external vendors.
- **`src/data/http/`**: Reliability layer with token-bucket rate limiting, exponential backoff, and quota management.
- **`src/data/types.ts`**: Strict TypeScript domain models with full provenance tracking.

## Sources & Provenance

| Provider | Data | License | Quota (Daily) | Quality |
|----------|------|---------|---------------|---------|
| [API-Football](https://www.api-football.com/) | Fixtures, Results, Team Stats | Commercial | 100 reqs | High |
| [The Odds API](https://the-odds-api.com/) | Live & Historical Odds | Commercial | 50 reqs | High |
| [Understat](https://understat.com/) | Shot-based xG | Public | 200 reqs | High |

## Reliability Features

1. **Token-Bucket Rate Limiter**: Prevents HTTP 429 errors by throttling requests per provider.
2. **Exponential Backoff**: Handles transient network failures with jittered retries.
3. **Quota Hard-Stop**: Prevents silent budget burn during large backtests.
4. **Data Quality Gates**: Outlier detection and missingness checks on every record.

## Proxy Configuration

Secrets are managed server-side. To use a custom proxy for vendor requests, set:
```env
# .env
VITE_DATA_PROXY_URL=https://your-proxy.com/api
```

## Team Identity Resolution

Resolution follows a strict hierarchy:
1. Exact Canonical ID Match
2. Registered Provider ID Match
3. Alias Map Match
4. (Forbidden) No fuzzy "guess" matching allowed for core quant logic.
