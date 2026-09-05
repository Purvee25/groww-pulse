# Contributing to Groww Pulse

## Local Setup

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8001 --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Running Tests

```bash
cd backend
pytest tests/ -v
```

All tests are pure-Python unit tests — no database, no network calls, no mocking needed.

## Project Structure

```
backend/
├── services/attention_score.py  ← The core ranking engine (start here)
├── routers/watchlist.py         ← API endpoints + scoring integration
├── routers/markets.py           ← yfinance market data
├── routers/ws_router.py         ← WebSocket live updates
└── tests/                       ← pytest unit tests

frontend/
├── src/pages/                   ← Explore, Watchlist, Journal
├── src/components/              ← AttentionDeck, MarketRail, NavBar
└── src/hooks/                   ← useLiveBrief (WebSocket + REST fusion)
```

## Key Design Invariants

1. The scoring engine (`attention_score.py`) must stay pure — no DB access, no HTTP. Its inputs are numbers; its output is numbers. Tests cover it exhaustively.
2. User-facing scores are always displayed alongside their rationale (`narrate()` output). Never show a number without explaining why.
3. Sensitivity multipliers are applied at the API layer, not in the scoring engine. The engine scores objective volatility; the user preference adjusts classification.

## Environment Variables

Copy `.env.example` to `.env`:

```env
DATABASE_URL=postgresql://pulse:pulse@localhost:5432/pulse
SECRET_KEY=your-secret-here
FRONTEND_ORIGIN=http://localhost:5180
```
