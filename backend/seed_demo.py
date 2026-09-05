"""
Seed a demo user with a realistic populated watchlist showing HIGH/MEDIUM signals.

Called automatically on startup. Idempotent — safe to run multiple times.

Demo credentials:
    Email:    demo@groww.in
    Password: demo1234

Design: last_seen_price is set to the price from 3 days ago so stock_return
is non-zero even when markets are closed (weekend). RELIANCE and TCS have
seeded spike returns that push z-score above 2.0 → HIGH.
"""

import random
from datetime import datetime, timedelta, timezone

from database import SessionLocal, engine, Base
from models import User, WatchlistItem, PriceSnapshot
from auth import hash_password

DEMO_EMAIL = "demo@groww.in"
DEMO_PASSWORD = "demo1234"

# Realistic watchlist: last 20 daily returns (%), current_price, sensitivity
# Last 3 entries are the recent move — checkpoint set to price[index -3]
# so stock_return = (price[-1] - price[-3]) / price[-3] across 3 days
DEMO_STOCKS = [
    {
        "symbol": "RELIANCE.NS",
        "sensitivity": "normal",
        # Normal volatility ≈ ±0.3%/day; 3-day cumulative signal = +6.1%
        # checkpoint_offset = -6.1% from current (set explicitly in seed)
        "daily_vol_pct": 0.3,
        "signal_3d_pct": 6.1,   # checkpoint set to current / (1 + 6.1/100)
        "hist_returns": [0.3, -0.2, 0.1, 0.4, -0.3, 0.2, -0.1, 0.3, 0.2, -0.2,
                         0.1, 0.3, -0.2, 0.4, 0.1, -0.3, 0.2, 0.1, 2.8, 3.1],
    },
    {
        "symbol": "TCS.NS",
        "sensitivity": "quiet",
        "daily_vol_pct": 0.15,
        "signal_3d_pct": 4.2,
        "hist_returns": [0.1, -0.1, 0.2, 0.1, -0.2, 0.1, 0.0, 0.1, -0.1, 0.2,
                         0.1, -0.1, 0.1, 0.2, -0.1, 0.1, 0.0, -0.1, 1.9, 2.2],
    },
    {
        "symbol": "INFY.NS",
        "sensitivity": "normal",
        "daily_vol_pct": 0.4,
        "signal_3d_pct": 2.1,
        "hist_returns": [0.4, -0.3, 0.5, -0.2, 0.3, 0.4, -0.5, 0.2, 0.3, -0.4,
                         0.2, 0.5, -0.3, 0.4, 0.2, -0.5, 0.3, 0.4, 0.8, 1.1],
    },
    {
        "symbol": "HDFCBANK.NS",
        "sensitivity": "quiet",
        "daily_vol_pct": 0.2,
        "signal_3d_pct": 0.3,   # quiet stock, barely moved — LOW
        "hist_returns": [0.2, -0.1, 0.3, -0.2, 0.1, 0.2, -0.1, 0.2, 0.1, -0.2,
                         0.1, 0.2, -0.1, 0.3, 0.2, -0.2, 0.1, 0.2, -0.1, 0.2],
    },
    {
        "symbol": "BHARTIARTL.NS",
        "sensitivity": "loud",
        "daily_vol_pct": 1.1,
        "signal_3d_pct": 1.5,   # loud stock, big vol → LOW despite visible move
        "hist_returns": [1.2, -1.1, 1.5, -0.8, 1.0, 1.3, -1.2, 0.9, 1.1, -1.0,
                         1.2, -0.9, 1.4, -1.1, 1.0, 1.2, -0.8, 1.3, -1.0, 1.1],
    },
    {
        "symbol": "SBIN.NS",
        "sensitivity": "normal",
        "daily_vol_pct": 0.5,
        "signal_3d_pct": 3.0,
        "hist_returns": [0.4, -0.5, 0.6, -0.3, 0.5, 0.4, -0.6, 0.5, 0.4, -0.5,
                         0.3, 0.5, -0.4, 0.6, 0.5, -0.3, 0.4, 0.5, 1.2, 1.5],
    },
]


def _apply_migrations():
    """Add columns that may be missing from an older schema."""
    migrations = [
        "ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS watchlist_id INTEGER REFERENCES watchlists(id)",
        "ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS sensitivity VARCHAR(10) NOT NULL DEFAULT 'normal'",
        "ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS last_seen_price FLOAT",
        "ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ",
        "ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS thesis TEXT",
        "ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS thesis_updated_at TIMESTAMPTZ",
        "ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ",
    ]
    with engine.connect() as conn:
        raw = conn.connection
        cur = raw.cursor()
        for stmt in migrations:
            try:
                cur.execute(stmt)
            except Exception:
                raw.rollback()
        raw.commit()
        cur.close()


def _build_prices(current_price: float, daily_returns: list[float]) -> list[float]:
    """Reconstruct price series from current price and daily returns (newest last).

    Returns a list where prices[-1] == current_price and each earlier entry
    is back-computed from the corresponding daily return.
    """
    prices = [current_price]
    for ret in reversed(daily_returns):
        prices.insert(0, round(prices[0] / (1 + ret / 100), 2))
    return prices


def seed_demo():
    Base.metadata.create_all(bind=engine)
    _apply_migrations()
    db = SessionLocal()
    try:
        # ── Demo user ─────────────────────────────────────────────────────────
        user = db.query(User).filter(User.email == DEMO_EMAIL).first()
        if not user:
            user = User(
                email=DEMO_EMAIL,
                hashed_password=hash_password(DEMO_PASSWORD),
            )
            db.add(user)
            db.flush()
            print(f"Created demo user: {DEMO_EMAIL}")
        else:
            print(f"Demo user already exists: {DEMO_EMAIL}")

        now = datetime.now(timezone.utc)

        for stock in DEMO_STOCKS:
            symbol = stock["symbol"]

            # Anchor to the real live price so synthetic history never diverges
            # from reality — otherwise returns show nonsensical ±60% values.
            live_snap = (
                db.query(PriceSnapshot)
                .filter(PriceSnapshot.symbol == symbol)
                .order_by(PriceSnapshot.fetched_at.desc())
                .first()
            )
            anchor_price = live_snap.price if live_snap and live_snap.price > 0 else 1000.0
            current_price = anchor_price

            # Checkpoint is set to (current / (1 + signal%)) so the 3-day
            # stock_return_pct = signal_3d_pct exactly, regardless of anchor.
            # This is deterministic and doesn't depend on the hist_returns series.
            signal_pct = stock["signal_3d_pct"]
            checkpoint_price = round(current_price / (1 + signal_pct / 100), 2)
            checkpoint_time = now - timedelta(days=3)

            # Build historical snapshot series using hist_returns for volatility
            # estimation (compute_volatility reads these via PriceSnapshot).
            prices = _build_prices(current_price, stock["hist_returns"])

            # ── Watchlist item ────────────────────────────────────────────────
            existing = (
                db.query(WatchlistItem)
                .filter(WatchlistItem.user_id == user.id, WatchlistItem.symbol == symbol)
                .first()
            )
            if existing:
                # Update checkpoint so return is non-zero
                existing.last_seen_price = round(checkpoint_price, 2)
                existing.last_seen_at = checkpoint_time
                existing.sensitivity = stock["sensitivity"]
            else:
                item = WatchlistItem(
                    user_id=user.id,
                    symbol=symbol,
                    sensitivity=stock["sensitivity"],
                    added_at=now - timedelta(days=20),
                    last_seen_price=round(checkpoint_price, 2),
                    last_seen_at=checkpoint_time,
                )
                db.add(item)
                db.flush()
                existing = item

            # ── Price snapshots ───────────────────────────────────────────────
            # Always (re)seed the historical price series so the weekend-fallback
            # logic in _build_stock_out can find a distinct price and show a
            # real signal. Delete only old historical entries (> 1 day ago) and
            # re-insert so the scheduler's live snapshots are preserved.
            db.query(PriceSnapshot).filter(
                PriceSnapshot.symbol == symbol,
                PriceSnapshot.fetched_at < now - timedelta(hours=6),
            ).delete()
            for i, price in enumerate(prices[:-1]):  # skip last — scheduler owns it
                ts = now - timedelta(days=len(prices) - 1 - i)
                snap = PriceSnapshot(
                    symbol=symbol,
                    price=round(price, 2),
                    volume=random.randint(500_000, 5_000_000),
                    fetched_at=ts,
                )
                db.add(snap)

        db.commit()
        print(f"Seeded demo watchlist: {len(DEMO_STOCKS)} stocks with realistic attention signals")
    except Exception as e:
        print(f"Error seeding demo data: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo()
