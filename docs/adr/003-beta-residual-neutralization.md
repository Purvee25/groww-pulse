# ADR 003 — Beta-Residual Neutralization for Market-Adjusted Signals

**Status:** Accepted  
**Date:** 2026-01-14  
**Author:** Purvee Singh

---

## Context

On a day the broader market (NIFTY 50) rises 1.5%, a high-beta stock like RELIANCE (β ≈ 1.0) is expected to rise ~1.5%. If RELIANCE rises 1.6%, the idiosyncratic move is 0.1% — statistically noise. Without adjustment, every broad market rally floods the watchlist with false HIGH-priority alerts, because every stock's raw return is large relative to its own quiet-day volatility.

## Decision

Subtract the market-explained component before computing the Z-score:

```
Δ_adj = stock_return − (β × NIFTY_return)
```

`β` is fetched from yfinance's `info` dict (key: `beta`) at stock-add time and cached in the `WatchlistItem` table. NIFTY 50 return is polled separately every 60s via `^NSEI` and stored in `MarketIndices`.

If β is unavailable (yfinance returns None), it defaults to 1.0 — conservative, assumes the stock moves with the market.

## Alternatives Considered

| Approach | Why Rejected |
|----------|-------------|
| Raw return Z-score (no β adjustment) | Every broad rally triggers mass false alerts; watchlist becomes noisy and loses user trust |
| Sector-relative adjustment (subtract sector ETF return) | More granular but requires sector ETF data for NSE (unavailable cleanly via yfinance); β is a reasonable first-order proxy |
| Fama-French 3-factor model | Overcomplicated for intraday polling; requires factor returns that aren't readily available at NSE tick frequency |

## Consequences

- **Good:** On a +1.5% NIFTY day, a β=1.0 stock needs to move >1.5% + threshold before it ranks HIGH. Signal quality improves substantially.
- **Good:** Sector-concentrated watchlists (e.g., all banking stocks) don't all light up simultaneously during an RBI rate move.
- **Bad:** β from yfinance is a trailing 5-year estimate — it's not real-time and may not reflect recent regime changes (e.g., a stock becoming more defensive). Accepted as a good-enough approximation for retail use.
- **Bad:** β defaulting to 1.0 for missing data is a pessimistic assumption for low-beta defensive stocks. Mitigated by the narrative showing what adjustment was applied.
