# Resilience & Invariant Contracts

This document describes the 5 invariants the Groww Pulse scoring engine guarantees,
and the failure modes it handles automatically.

## Invariant Contracts

### INV-01 — Idempotency

**Claim:** Multiple z-score computations with identical inputs (stock_return, volatility,
elapsed_seconds) always produce identical results.

**Why it matters:** If the same stock viewed twice in the same second produced different
attention scores, users would lose trust in the signal. The engine is a pure function with
no side effects or random state.

**Verification:** `tests/test_invariants.py::TestInv01Idempotency`

---

### INV-02 — Variance Clamping (30-day ceiling)

**Claim:** The time-decay component caps elapsed time at `MAX_ELAPSED_SECONDS = 30 × 24 × 3600`
(720 hours). A stock ignored for 6 months and one ignored for 31 days see the same z-score
for the same price move — the 30-day-old checkpoint is "stale enough."

**Why it matters:** Without the cap, `expected_volatility = σ × √(n)` grows without bound,
driving every z-score toward zero. A stock that moved 10% after a year of silence would
report a near-zero signal — the opposite of what a user needs.

**Verification:** `tests/test_invariants.py::TestInv02VarianceClamping`

---

### INV-03 — Tenant Isolation

**Claim:** The scoring compute layer is stateless and carries zero per-user context.
Cross-user data leakage is impossible at the compute layer; it is also prevented at the
REST layer via JWT-scoped DB queries (`WHERE user_id = <current_user.id>`).

**Why it matters:** Groww users must never see another user's thesis, checkpoint, or score.

**Verification:** `tests/test_invariants.py::TestInv03TenantIsolation`

---

### INV-04 — Beta Residual Neutrality

**Claim:** When a stock moves exactly as its beta predicts (Δ_stock = β × Δ_NIFTY),
the residual return Δ_adj ≈ 0 and |Z| < 0.1σ. The stock ranks LOW — it is not unusual.

**Mathematical form:**

```
Δ_adj = Δ_stock − (β × Δ_NIFTY)
```

A stock moving +2% when NIFTY moves +2% and β = 1.0: Δ_adj = 0, Z ≈ 0.

**Why it matters:** A watchlist that flags every stock during a broad market rally
is useless. Beta adjustment surfaces only idiosyncratic moves.

**Verification:** `tests/test_invariants.py::TestInv04BetaResidualNeutrality`

---

### INV-05 — Degraded Price Fallback

**Claim:** Zero prices, None elapsed time, negative returns, and network-failed yfinance
calls never cause NaN, division-by-zero, or uncaught exceptions. All degenerate inputs
produce a valid (possibly zero) score or trigger the circuit breaker fallback.

**Mechanisms:**
- `compute_z_score(ret, vol=0, ...)` → returns `(0.0, "NORMAL")` (guarded division)
- `compute_z_score(ret, vol, elapsed=None)` → falls back to `n = 1` tick
- `fetch_with_breaker(fn, symbol)` → trips to `OPEN` after 3 consecutive failures,
  serves from `data/offline_snapshot.json` without raising

**Verification:** `tests/test_invariants.py::TestInv05DegradedFallback`

---

## Circuit Breaker

`services/circuit_breaker.py` wraps every yfinance call with a three-state machine:

| State     | Behavior                                      | Recovery            |
|-----------|-----------------------------------------------|---------------------|
| CLOSED    | All calls go to yfinance (normal)             | —                   |
| OPEN      | Tripped after 3 consecutive failures; serves `data/offline_snapshot.json` | Auto-probes after 60s cooldown |
| HALF_OPEN | One probe attempt; CLOSED on success, OPEN on failure | —             |

API health exposed at `GET /api/health/circuit`:

```json
{
  "state": "CLOSED",
  "failure_count": 0,
  "tripped_at": null,
  "source": "LIVE_FEED"
}
```

The NavBar displays a live status pill: `● LIVE NSE` (green) or `● CB: CACHED` (amber).

---

## Known Failure Modes

| Failure                       | Handled by                                     |
|-------------------------------|------------------------------------------------|
| yfinance timeout / 429        | Circuit breaker → offline snapshot             |
| Weekend / market-closed price | Weekend fallback logic in `_build_stock_out`   |
| Stale checkpoint (> 30 days)  | INV-02 variance cap                            |
| Zero volatility               | Guard clause in `compute_z_score`              |
| Cross-user data request       | JWT + `WHERE user_id = current_user.id`        |
| Missing price snapshot        | Early return with `narrative="No price data"` |
