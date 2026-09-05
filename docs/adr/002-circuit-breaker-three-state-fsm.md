# ADR 002 — Circuit Breaker with 3-State FSM for yfinance Reliability

**Status:** Accepted  
**Date:** 2026-01-14  
**Author:** Purvee Singh

---

## Context

`yfinance` is an unofficial scraper of Yahoo Finance's internal API — not a production data vendor. It fails unpredictably: rate-limits during market hours, DNS timeouts, schema changes after Yahoo deploys updates. During a failure, the price-polling scheduler would repeatedly throw exceptions, log noise, and return stale or missing data to the frontend with no indication of degradation.

The core question: what should the app show users when live data is unavailable?

## Decision

Implement a 3-state circuit breaker (`CLOSED → OPEN → HALF_OPEN`) in `backend/services/circuit_breaker.py`:

- **CLOSED** (normal): all requests pass through to yfinance.
- **OPEN** (tripped): after 3 consecutive yfinance failures, the breaker opens. All price requests immediately return the last known offline snapshot (`data/offline_snapshot.json`) without hitting yfinance. The breaker stays OPEN for 60 seconds.
- **HALF_OPEN** (recovery probe): after 60s, one probe request is allowed through. If it succeeds, the breaker closes. If it fails, it returns to OPEN for another 60s.

The current circuit state is exposed via `GET /api/health/circuit` and polled every 15s by the NavBar, which shows `● LIVE NSE` (green) or `● CB: CACHED` (amber).

## Alternatives Considered

| Approach | Why Rejected |
|----------|-------------|
| Retry with exponential backoff only | Still blocks the scheduler thread during retries; doesn't degrade gracefully for users already on the page |
| Simple on/off flag | No automatic recovery — requires manual intervention to re-enable |
| Show error state to users | Poor UX — users see broken data with no explanation instead of last-known-good data |

## Consequences

- **Good:** Users always see data (live or cached) with a clear visual indicator of which one they're seeing.
- **Good:** The scheduler doesn't hammer a failing API — it short-circuits immediately during OPEN state.
- **Good:** Auto-recovery via HALF_OPEN probe means no manual intervention needed.
- **Bad:** During OPEN state, data is stale. For a financial app, stale prices are potentially misleading. Mitigated by the NavBar status pill making the degraded state prominent and explicit.
- **Bad:** `data/offline_snapshot.json` must be manually refreshed if stock universe changes. Accepted for demo scope.
