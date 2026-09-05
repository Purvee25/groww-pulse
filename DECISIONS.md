# Technical Decisions

Every non-obvious choice in Groww Pulse with the reasoning behind it.

## Why z-score, not raw percentage change?

**The problem:** A 2% drop in HDFC Bank is noise. A 2% drop in a boring, slow-moving utility stock might be the signal of a decade. Raw percentage treats them identically.

**The solution:** Normalize each move by that stock's own historical volatility.

```
z = stock_return / (historical_volatility × sqrt(elapsed_ticks))
```

This means a 1% move in a stock with 0.2% daily volatility scores **5σ** — rare, worth attention. The same 1% move in a stock with 1.5% daily volatility scores **0.67σ** — noise, ignore it.

**Alternative considered:** Bollinger Bands. Rejected because they're designed for visual chart reading, not ranking. Z-scores are unit-free so we can rank across all stocks with a single threshold.

## Why the time-decay (sqrt elapsed)?

Stock returns scale with `sqrt(time)` under the random-walk / geometric Brownian motion model — the same model options pricing uses. If a stock normally moves ±0.5% per day, after 4 days of silence you'd expect it to have moved up to ±1% (0.5 × √4). So "unchanged for 4 days then moving 1%" is not actually unusual — our expected volatility window grows accordingly.

This prevents alert fatigue: a stock you haven't checked in a week doesn't suddenly become HIGH priority just because it moved the amount you'd expect over a week.

## Why sensitivity multipliers (`quiet: 1.75, normal: 1.0, loud: 0.6`)?

Not every stock deserves the same alert threshold. A user watching a volatile small-cap for trading should get fewer alerts (loud: 0.6×). A user watching a safe blue-chip for portfolio balance should get earlier warnings (quiet: 1.75×).

The multipliers are applied to the **effective** score before classification, not to the raw price data — this way, the scoring engine stays purely statistical while user preferences live in a separate layer.

The values 1.75 / 1.0 / 0.6 were chosen so:
- Quiet (1.75×): a 1.3σ move classifies as HIGH instead of MEDIUM
- Loud (0.6×): a 2.5σ move classifies as MEDIUM instead of HIGH

## Why FastAPI over Django/Flask?

- Async I/O by default — critical for yfinance batch fetches and WebSocket connections that run concurrently
- Pydantic schemas are the request/response contract, not an afterthought — prevents the ORM model leaking into the API
- OpenAPI docs generated automatically — free dev tooling
- Type checking at the boundary catches bugs before they reach the DB

Flask was considered; rejected for lack of native async. Django REST Framework was rejected as too heavyweight for a focused microservice.

## Why yfinance?

Free, no API key, Python-native. For a hackathon judged on the idea, paying for a Bloomberg terminal or Alpha Vantage subscription adds friction with no benefit to the demo.

The known limitation: yfinance has rate limits and occasionally returns stale data. The scheduler runs every 5 minutes and caches results in PostgreSQL, so the UI is always serving DB data, not live yfinance calls per request.

## Why PostgreSQL over SQLite?

SQLite is fine for local dev but breaks under concurrent writes — two WebSocket clients updating the same watchlist row simultaneously would lock. PostgreSQL's row-level locking handles this correctly and is the standard for production deployments. The Docker Compose setup provisions it automatically, so the dev experience is identical.

## Why nginx as reverse proxy?

Single origin for the browser: `/api/*` proxies to FastAPI, `/ws` proxies to the WebSocket handler, everything else serves the React SPA from static files. This means:
- No CORS headers needed in FastAPI (same origin)
- WebSocket upgrade is handled cleanly at the nginx layer
- Static serving is fast (nginx's job) vs. FastAPI serving files (not its job)

## Why second clock memory?

The user's last-checked timestamp per stock is stored as `last_checkpoint`. Elapsed time since that checkpoint feeds directly into the time-decay calculation. This means:
- A stock the user checked 10 minutes ago needs a bigger move to surface
- A stock unchecked for 3 days surfaces with a much lower move threshold

This is the "second clock" — it makes the attention score personal, not just statistical. Two users watching the same stock see different priorities based on when they last looked.

## Why NOT to use ML for scoring?

Considered: train a classifier to predict "worth looking at" from historical data.

Rejected because:
1. The label is subjective — "worth looking at" depends on the user's thesis
2. It would require labeled training data we don't have
3. The z-score is explainable — users can see *why* something is flagged ("+2.3% · 3.1σ vs sector")
4. ML models are black boxes that judges at a hackathon can't verify

The statistical model earns its complexity by being auditable.
