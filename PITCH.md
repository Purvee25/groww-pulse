# Groww Pulse — Hackathon Pitch

## The One-Line Problem

Groww users watch too many stocks and miss the ones that actually moved for a reason.

## Why This Is Real

Open any watchlist right now. You'll see 15–20 stocks, all with green/red percentage numbers. Which one deserves your attention? The 1.5% mover that's normally a +/-0.1% stock? Or the 3% mover that regularly swings 4%?

Current watchlists have no opinion. They show everything equally.

**Result:** Users either check every stock manually (time-consuming) or miss signals because they tune out the noise.

## The Insight

Every stock has its own *expected* volatility. A move that's unusual for *this* stock — not unusual for *all* stocks — is the signal.

A quiet IT stock twitching 1.5% when IT normally moves 0.3% = **5σ event. Flag it.**  
An energy stock dropping 3% when energy regularly swings 4% = **0.75σ. Noise.**

This is basic statistics applied to a real user problem.

## What Groww Pulse Does Differently

| Feature | Typical Watchlist | Groww Pulse |
|---------|------------------|-------------|
| Signal ranking | % change | Z-score vs own history |
| Time awareness | None | Flags stocks quiet too long |
| User thesis | None | Journal entry + auto-verdict |
| Sensitivity | Same threshold for all | Per-stock quiet/normal/loud |
| Sector context | None | Dampens signal if whole sector moved |

## The User Journey

1. Add stocks to watchlist (same as Groww today)
2. Mark each as **Quiet** (flag me early), **Normal**, or **Loud** (I know it's volatile)
3. Each morning, open Pulse. See `3 HIGH attention stocks` — not 20 green/red numbers
4. Each HIGH stock shows: `+2.3% · 3.1σ vs sector · 2.1× volume` — you know *why* it flagged
5. Record your thesis ("watching for FII outflow reversal"), come back, see if the market proved you right

## Why This Wins the Hackathon

**It's a real feature Groww could ship tomorrow.** Not a prototype. Not a demo.

- The scoring engine is pure math — auditable, no ML black box
- The Docker Compose setup deploys to any cloud in one command
- The UI matches Groww's design language — a user on groww.in would recognize it instantly
- The thesis journal teaches users to think in terms of bets, not just watches

**The competition shipped a UI.** We shipped a **system** — scoring engine + WebSocket live updates + decision journal + Docker deployment + tests + documented decisions.

## Technical Credibility

```
GET /api/watchlist → z-score ranked list, computed per-user
WS  /ws/brief     → live updates every 5s, only pushes diffs
GET /api/markets/movers → batch-fetched, sector-adjusted
```

Z-score formula: `z = (stock_return - 0) / (volatility × sqrt(elapsed_ticks))`

Time factor: elapsed time since the user last checked. Second-clock memory.

VIX regime: India VIX > 15 expands expected volatility, so alerts are less sensitive in market-wide volatility events (not your stock, it's the tape).

## The One Thing Judges Should Remember

**Most watchlist moves are noise. Pulse only shows you when it's signal.**
