# ADR 004 — Trading-Hours Elapsed Time for Z-Score Time Decay

**Status:** Accepted  
**Date:** 2026-01-18  
**Author:** Purvee Singh

---

## Context

The Z-score denominator includes `√n` where `n` is elapsed time (ticks). If `n` is wall-clock time, a checkpoint set Friday at 3:29pm checked Monday at 9:16am would have ~64 hours of elapsed time — making the denominator large and deflating the Z-score, causing real Monday-morning moves to appear statistically unremarkable.

NSE is only open Monday–Friday, 9:15am–3:30pm IST. Weekend and off-hours gaps are not market time and should not dilute the signal.

## Decision

`elapsed_trading_seconds()` in `backend/services/attention_score.py` counts only IST market-open seconds between two timestamps:

- Skips weekends (Saturday, Sunday)
- Skips time outside 9:15am–3:30pm IST each day
- Caps at 30 days (~1.08M trading seconds) to prevent underflow

The function is iterative (day-by-day loop) rather than a closed-form formula to correctly handle partial days, public holidays are not modeled (data gap).

## Alternatives Considered

| Approach | Why Rejected |
|----------|-------------|
| Wall-clock elapsed seconds | 64-hour weekend gaps massively deflate Monday scores; the entire concept of "what changed since I last checked" breaks down |
| Fixed 1-day elapsed time | Ignores how long the user was actually away; a 2-minute vs 2-week absence should produce different Z-scores |
| Approximate (0.275 × wall-clock, assuming 6.25hr/day open) | Accurate on average but wrong on day-boundaries and for short elapsed times like a few minutes |

## Consequences

- **Good:** A checkpoint from Friday afternoon checked Monday morning correctly shows ~1 minute of elapsed time, not 64 hours. Signal is preserved across weekends.
- **Good:** The Time Machine feature correctly replays "what would Pulse have shown if I'd been away since that checkpoint" — the elapsed time drives the score authentically.
- **Bad:** Public holidays are not modeled. On holidays, the market is closed but the code treats them as open. This produces slightly inflated elapsed times on holiday-adjacent checkpoints. Low-frequency edge case; accepted for now.
