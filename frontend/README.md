# Groww Pulse — Smart Stock Watchlist

**An intelligent watchlist companion for Groww users** that answers one question: *What changed enough to matter?*

Built for the **Code, by Groww** hackathon.

## The Problem

Traditional watchlists show raw price changes — every stock screams for attention equally. A 2% drop in a volatile stock means nothing, but the same move in a quiet stock might signal something real. Users waste time checking stocks that haven't meaningfully changed.

## The Solution

Groww Pulse uses **statistical attention scoring** to surface only what deserves your attention:

- **Z-score based scoring** — each move is weighed against the stock's own historical volatility and its sector's baseline
- **"Second clock" memory** — tracks when you last checked each stock, so a quiet stock that suddenly moves gets flagged even if the absolute change is small
- **Sensitivity tuning** — mark stocks as Quiet (flag sooner), Normal, or Loud (flag less) based on your thesis
- **Decision journal** — record your thesis for each stock and let the market tell you if you were right

## Features

| Page | What it does |
|------|-------------|
| **Dashboard** | Editorial hero showing what deserves attention. AttentionDeck with narrative cards, "N worth a look" badges, inline stock chips |
| **Watchlist** | Groww-style table with priority filtering (HIGH/MEDIUM/LOW), avatar initials, verdict chips, sensitivity controls |
| **Portfolio Risk** | Sector concentration bar, volatility stats, diversification alerts |
| **Journal** | Thesis tracker with SUPPORTED/CHALLENGED/NEUTRAL verdicts auto-checked against price action |

### Bonus Features

- **Time Machine** — simulate "what if I was away for N hours?" to see how scores shift
- **Scenario Replay** — replay historical market events (COVID crash, budget day) through the scoring engine
- **Live WebSocket updates** — real-time price streaming with visual connection status
- **Dark mode** — follows system preference with manual toggle

## Architecture

```
┌─────────────────────────────────────────┐
│              nginx (port 80)            │
│  static files + /api proxy + /ws proxy  │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐    ┌────────────────┐  │
│  │   React +   │    │   FastAPI +    │  │
│  │   Vite      │    │   SQLAlchemy   │  │
│  │   (static)  │    │   (port 8001)  │  │
│  └─────────────┘    └───────┬────────┘  │
│                             │           │
│                    ┌────────▼────────┐  │
│                    │   PostgreSQL    │  │
│                    │   (port 5432)   │  │
│                    └────────────────┘   │
└─────────────────────────────────────────┘
```

**Frontend:** React 18 + TypeScript + Vite  
**Backend:** FastAPI + SQLAlchemy + JWT auth  
**Database:** PostgreSQL 15  
**Deployment:** Docker Compose with nginx reverse proxy

## Quick Start

### With Docker (recommended)

```bash
git clone https://github.com/yourusername/groww-pulse.git
cd groww-pulse
docker compose up --build
```

Open [http://localhost](http://localhost) — that's it.

### Local Development

**Backend:**
```bash
cd groww-pulse-backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8001 --reload
```

**Frontend:**
```bash
cd groww-pulse-frontend
npm install
npm run dev  # starts on port 5180
```

The Vite dev server proxies `/api` and `/ws` to the backend automatically.

## How the Scoring Works

1. Fetch latest price for each stock in user's watchlist
2. Compute z-score: `(current_change - mean_change) / std_dev`
3. Adjust for sector: if the whole sector moved similarly, dampen the signal
4. Apply sensitivity multiplier: `{quiet: 1.75, normal: 1.0, loud: 0.6}`
5. Factor in time since user last checked ("second clock")
6. Classify: HIGH (z > 2.0), MEDIUM (z > 1.0), LOW (z ≤ 1.0)

The result: only statistically unusual moves surface. A quiet IT stock twitching 1.5% when IT normally moves 0.3% ranks higher than a volatile energy stock dropping 3% when energy regularly swings 4%.

## Security

- JWT authentication with configurable expiry
- Security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- Rate limiting (60 req/min per IP)
- CORS restricted to configured origin
- No secrets in Docker images — all config via environment variables

## License

MIT
