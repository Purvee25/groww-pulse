# Groww Pulse

**What has meaningfully changed in your watchlist — since you last checked?**

Groww Pulse replaces raw percentage changes with statistically rigorous attention scores. A 2% move on a calm stock is louder than a 5% move on a volatile one. Pulse tells you which one actually matters.

Built for **Code, by Groww 2026**.

---

## Live Demo

```
Email:    demo@groww.in
Password: demo1234
```

Click **"⚡ Try the live demo"** on the login page — no signup required.

---

## The Problem

Every watchlist shows the same number: percentage change. That number has no context.

| Stock | Move | Daily σ | Meaning |
|---|---|---|---|
| HDFCBANK | +2% | 0.2% | **10σ — extraordinary** |
| BHARTIARTL | +2% | 1.1% | **1.8σ — unremarkable** |

A standard watchlist ranks them identically. Pulse ranks HDFCBANK first by a factor of 5.

---

## How It Works

### Attention Score

```
z = Δ_adj / (σ × √n)

Δ_adj  = stock_return − (β × NIFTY_return)   # beta-neutralized residual
σ      = per-tick volatility from 100 price snapshots
n      = elapsed trading ticks (capped at 30 days)
score  = |z| × (1 + 0.2 × min(volume_ratio − 1, 2))
```

**Priority bands:** HIGH ≥ 2.0σ · MEDIUM ≥ 1.0σ · LOW < 1.0σ

### Trading-Hours Elapsed Time

`n` counts only IST market-open seconds (9:15am–3:30pm, Mon–Fri). A checkpoint set Friday at 3:29pm checked Monday at 9:16am has **1 trading minute** of elapsed time, not 64 wall-clock hours. Weekend gaps don't dilute the Z-score.

### Beta-Residual Neutralization

On a day NIFTY rises 1.5% and RELIANCE (β ≈ 1.0) rises 1.6%, the idiosyncratic move is 0.1% — noise. Without beta adjustment, every broad market rally floods the watchlist with false HIGH alerts. With it, only stocks that moved more or less than their beta predicts rank high.

### Gap-Open Detection

At market open (9:15–9:45am IST), Pulse compares the first price tick to the previous session's close. A gap >±2% triggers a `GAP_OPEN` event — overnight news, earnings, RBI announcements, and global cues are qualitatively different from intraday volatility and flagged separately.

---

## Features

### Core
- **Attention Deck** — Watchlist ranked by Z-score, not %. HIGH/MEDIUM/LOW priority badges with narrative ("+6.1% · 1.5σ volatility · 2.1× volume")
- **Beta-Residual Z-Score** — Market-adjusted signal. Only idiosyncratic moves rank HIGH
- **Trading-Hours Elapsed Time** — Z-score time-decay calibrated to actual market exposure
- **VIX Regime Multiplier** — When India VIX > 15, expected volatility expands, reducing false alerts in choppy markets
- **Gap-Open Detection** — Overnight price gaps >2% flagged at market open

### Resilience
- **Circuit Breaker** — 3-state machine (CLOSED → OPEN → HALF_OPEN). Trips after 3 consecutive yfinance failures, serves `data/offline_snapshot.json`, auto-recovers after 60s
- **`GET /api/health/circuit`** — Live circuit state exposed to frontend status pill
- **NavBar Status Pill** — `● LIVE NSE` (green) or `● CB: CACHED` (amber), polled every 15s
- **Offline Snapshot** — Realistic NSE prices for all 6 demo stocks, served during outages

### Decision Journal
- **Thesis per stock** — One-liner: "Expecting Jio Financial spinoff to unlock value"
- **Thesis Watchdog** — Deterministic verdict (SUPPORTED / CHALLENGED / NEUTRAL) when a HIGH/MEDIUM signal fires. Never reads the thesis text — only checks move direction and significance. Documented as a heuristic, not AI
- **Thesis Revalidation** — Force re-check a thesis against current price action

### Time Machine
- **Slider on Stock Detail page** — "What would my attention score be if I hadn't checked for 15min / 1h / 4h / 1 day / 1 week?"
- **Backed by `/simulate` API** — Pure computation, no DB state written. Slider always matches the real ranking engine

### Portfolio Intelligence
- **Portfolio Risk Panel** — Sector concentration (%) across entire watchlist. `STABLE / CONCENTRATED / HIGH_VOLATILITY` badges
- **Sector Breakdown** — Banking / IT / Energy / Telecom allocation with stock list per sector

### Market Data
- **Live NSE Feed** — yfinance `.NS` suffix, polled every 30s per watched symbol
- **Market Indices** — NIFTY, SENSEX, BANK NIFTY, INDIA VIX with real % change (2-day history fallback when market closed)
- **Top Movers** — Gainers/Losers from NSE large-cap universe, batch-fetched every load
- **Symbol Stats** — 20-day trailing volatility, 52-week high/low, average volume, updated every 6 hours

### UX
- **Dark Mode Default** — Applied before first paint (no flash). Toggle persists in localStorage
- **WebSocket Live Updates** — Watchlist prices refresh in real-time via WS, falls back to polling
- **Shimmer Skeleton Loaders** — Indices row and movers carousel animate while loading
- **"⚡ Try Demo" button** — One-click login on the Login page, no signup needed
- **Checkpoint flow** — "Mark as caught up" resets baseline for all stocks at once

---

## Engineering Contracts

Five invariants that the scoring engine guarantees, verified by the test suite:

| Contract | Guarantee |
|---|---|
| **INV-01 Idempotency** | Identical inputs always produce identical Z-scores |
| **INV-02 Variance Clamping** | Elapsed time always capped at 30 days; Z always finite |
| **INV-03 Tenant Isolation** | Compute layer is stateless; no cross-user data possible |
| **INV-04 Beta Neutrality** | Stock moving exactly with its beta always scores LOW |
| **INV-05 Degraded Fallback** | Zero vol / None elapsed / network failure never crashes |

```bash
pytest tests/test_invariants.py -v   # 19/19 passing
```

See [`RESILIENCE.md`](RESILIENCE.md) for the full specification and [`DECISIONS.md`](DECISIONS.md) for every non-obvious engineering choice.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript + Vite, CSS variables (light/dark), WebSocket |
| **Backend** | FastAPI (Python 3.11+), SQLAlchemy ORM, APScheduler |
| **Database** | PostgreSQL 15 |
| **Market Data** | yfinance (NSE `.NS` suffix), 2-day history fallback |
| **Auth** | JWT (HS256) + bcrypt, token in `Authorization: Bearer` header |
| **Infra** | Docker Compose (3 services: db, backend, frontend/nginx) |
| **Rate Limiting** | In-process sliding-window, 60 req/min per IP |
| **Security** | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` headers |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  nginx : 80                          │
│   /api/* → backend:8001    /* → React SPA            │
└────────────┬────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────┐
│              FastAPI Backend : 8001                  │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  Scheduler  │  │   Routers    │  │  Services  │  │
│  │  poll_prices│  │  /watchlist  │  │  Z-score   │  │
│  │  poll_index │  │  /markets    │  │  circuit   │  │
│  │  (30s / 60s)│  │  /auth       │  │  breaker   │  │
│  └──────┬──────┘  └──────┬───────┘  └────────────┘  │
│         │                │                           │
│  ┌──────▼────────────────▼──────────────────────┐    │
│  │         PostgreSQL — PriceSnapshot,          │    │
│  │         WatchlistItem, MarketIndices,        │    │
│  │         CheckpointHistory, SymbolStats       │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
             │
┌────────────▼──────────┐
│   yfinance (NSE live) │  ← Circuit breaker wraps every call
│   Offline snapshot    │  ← Fallback when OPEN
└───────────────────────┘
```

---

## Quick Start

**Requirements:** Docker + Docker Compose

```bash
git clone https://github.com/Purvee25/groww-pulse.git
cd groww-pulse
docker compose up -d --build
```

Open **http://localhost** — the app is live.

Demo credentials are seeded automatically on first startup:

```
Email:    demo@groww.in
Password: demo1234
```

The demo watchlist has 6 NSE stocks pre-seeded with realistic signals, theses, and price history.

---

## API Reference

All endpoints under `/api/`. Protected endpoints require `Authorization: Bearer <token>`.

### Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create account → returns JWT |
| `POST` | `/api/auth/login` | Login → returns JWT |

### Watchlist
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/watchlist` | Full ranked watchlist with Z-scores |
| `POST` | `/api/watchlist/add` | Add a symbol (`{"symbol": "TCS.NS"}`) |
| `POST` | `/api/watchlist/checkpoint/mark` | Reset baseline for all stocks |
| `GET` | `/api/watchlist/{symbol}/simulate` | Time Machine: `?away_seconds=3600` |
| `POST` | `/api/watchlist/{symbol}/thesis` | Set thesis text |
| `POST` | `/api/watchlist/{symbol}/thesis/revalidate` | Re-run thesis verdict |
| `GET` | `/api/watchlist/portfolio/risk` | Sector concentration + volatility |

### Markets
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/markets/indices` | NIFTY / SENSEX / VIX with real % change |
| `GET` | `/api/markets/movers` | Top 5 gainers and losers (NSE large-cap) |

### Health
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | `{"status": "ok"}` |
| `GET` | `/api/health/circuit` | Circuit breaker state + failure count |

---

## Key Design Decisions

Documented in [`DECISIONS.md`](DECISIONS.md). Highlights:

- **Z-score over raw %** — Magnitude without context is noise
- **Trading-hours elapsed time** — Weekends don't accumulate market risk
- **Beta-residual neutralization** — Market-wide moves subtracted before scoring
- **Circuit breaker over retry** — Protects yfinance rate limit (2000 req/day)
- **30-day elapsed cap** — Prevents stale checkpoints from washing all signals to zero
- **Formal invariant tests over coverage** — Tests what matters, not what ran

---

## Project Structure

```
groww-pulse/
├── backend/
│   ├── main.py                    # FastAPI app, middleware, lifespan
│   ├── models.py                  # SQLAlchemy ORM models
│   ├── schemas.py                 # Pydantic request/response schemas
│   ├── auth.py                    # JWT + bcrypt
│   ├── seed_demo.py               # Demo user + watchlist seeder
│   ├── seed_metadata.py           # Symbol metadata seeder
│   ├── routers/
│   │   ├── watchlist.py           # Core watchlist + scoring endpoints
│   │   ├── markets.py             # Indices, movers, metadata
│   │   ├── auth.py                # Login/register
│   │   └── ws_router.py           # WebSocket live price push
│   ├── services/
│   │   ├── attention_score.py     # Z-score, trading-hours, VIX regime
│   │   ├── circuit_breaker.py     # 3-state circuit breaker
│   │   ├── market_data.py         # yfinance integration
│   │   ├── market_stats.py        # Beta, sector returns
│   │   └── scheduler.py           # APScheduler: prices, indices, gap-open
│   ├── data/
│   │   └── offline_snapshot.json  # Fallback prices when circuit OPEN
│   └── tests/
│       └── test_invariants.py     # 19/19 mathematical invariant suite
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Landing.tsx        # Public landing with live indices ticker
│   │   │   ├── Explore.tsx        # Market overview + top movers
│   │   │   ├── Watchlist.tsx      # Attention deck + portfolio risk
│   │   │   ├── Journal.tsx        # Decision journal + thesis verdicts
│   │   │   └── StockPage.tsx      # Stock detail + Time Machine slider
│   │   ├── components/
│   │   │   ├── NavBar.tsx         # Nav + circuit breaker status pill
│   │   │   ├── AttentionDeck.tsx  # Z-score ranked cards
│   │   │   ├── PortfolioRisk.tsx  # Sector concentration panel
│   │   │   └── TimeMachine.tsx    # Elapsed-time slider + live simulate
│   │   └── hooks/
│   │       ├── useLiveBrief.ts    # WebSocket + polling hybrid
│   │       └── useWatchlist.ts    # Watchlist state management
│   └── nginx.conf                 # SPA fallback + API proxy
├── DECISIONS.md                   # 10 non-obvious engineering choices
├── RESILIENCE.md                  # 5 invariant contracts + failure modes
└── docker-compose.yml             # db + backend + frontend
```

---

## Running Tests

```bash
cd backend
pip install -r requirements.txt
pytest tests/test_invariants.py -v
```

Expected output:
```
tests/test_invariants.py::TestInv01Idempotency::test_same_elapsed_gives_same_z       PASSED
tests/test_invariants.py::TestInv01Idempotency::test_elapsed_0_and_30s_both_yield_n1 PASSED
tests/test_invariants.py::TestInv02VarianceClamping::test_1000h_clamped_to_720h      PASSED
tests/test_invariants.py::TestInv02VarianceClamping::test_z_finite_at_extreme_elapsed PASSED
tests/test_invariants.py::TestInv02VarianceClamping::test_cap_constant_is_30_days    PASSED
tests/test_invariants.py::TestInv03TenantIsolation::test_compute_z_score_stateless   PASSED
...
19 passed in 0.51s
```

---

## What Makes This Different

Most watchlist tools answer: **"What moved?"**

Groww Pulse answers: **"What moved in a way that's statistically unusual for *that* stock, adjusted for what the broader market was doing, measured only during hours when the market was actually open, against a thesis you wrote when you added the stock?"**

That's not a feature list. That's a different question.

---

*Built with FastAPI · React · PostgreSQL · Docker · yfinance*
