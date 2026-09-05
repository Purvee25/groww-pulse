# ADR 001 — Statistical Z-Score Over Threshold-Based Alerts

**Status:** Accepted  
**Date:** 2026-01-10  
**Author:** Purvee Singh

---

## Context

Every retail watchlist (Groww, Zerodha, Kite) shows raw percentage change. The problem: a 2% move means nothing without context. HDFCBANK moving 2% on a day its 30-day daily σ is 0.2% is a 10σ event — extraordinary. BHARTIARTL moving 2% on a day its σ is 1.1% is 1.8σ — unremarkable.

The naive alternative (threshold-based alerts like "flag if >3%") produces false positives on volatile stocks and misses statistically significant moves on low-volatility ones.

## Decision

Use a rolling-window Z-score calibrated to each stock's own volatility, normalized by elapsed trading time:

```
z = Δ_adj / (σ × √n)
```

where:
- `Δ_adj` is the beta-neutralized residual return (stock return minus β × index return)
- `σ` is per-tick volatility from the last 100 price snapshots
- `n` is elapsed trading ticks (IST market hours only, capped at ~30 days)

Priority bands: HIGH ≥ 2.0σ, MEDIUM ≥ 1.0σ, LOW < 1.0σ.

## Alternatives Considered

| Approach | Why Rejected |
|----------|-------------|
| Fixed % threshold (e.g., flag >3%) | False positives on high-volatility stocks; misses meaningful moves on low-volatility ones |
| RSI / MACD | Require longer time series than intraday polling provides; don't answer "has anything changed since I last checked" |
| Absolute price deviation | Stock-specific — ₹10 means different things for a ₹100 and ₹5,000 stock |

## Consequences

- **Good:** Every alert is self-calibrating — HDFCBANK and RELIANCE get appropriately different thresholds automatically.
- **Good:** Z-score is interpretable: "1.8σ" means the move is 1.8 standard deviations above this stock's typical move over the elapsed period.
- **Bad:** Requires enough price history (≥30 snapshots) to compute a meaningful σ. New stocks produce wide confidence intervals. Mitigated by returning a LOW priority with a "building history" narrative until ≥30 snapshots exist.
