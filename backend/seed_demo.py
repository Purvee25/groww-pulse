"""
Seed a demo user with a realistic populated watchlist.

Called automatically on startup. Idempotent — safe to run multiple times.

Demo credentials:
    Email:    demo@groww.in
    Password: demo1234
"""

import random
from datetime import datetime, timedelta, timezone

from database import SessionLocal, engine, Base
from models import User, WatchlistItem, PriceSnapshot
from auth import hash_password

DEMO_EMAIL = "demo@groww.in"
DEMO_PASSWORD = "demo1234"

# Realistic watchlist with varied signals
DEMO_STOCKS = [
    {
        "symbol": "RELIANCE.NS",
        "sensitivity": "normal",
        "snapshots": [
            # last 20 days of daily returns (%) — normally quiet, then a spike
            0.3, -0.2, 0.1, 0.4, -0.3, 0.2, -0.1, 0.3, 0.2, -0.2,
            0.1, 0.3, -0.2, 0.4, 0.1, -0.3, 0.2, 0.1, 2.8, 3.1,
        ],
        "current_price": 1447.50,
    },
    {
        "symbol": "TCS.NS",
        "sensitivity": "quiet",
        "snapshots": [
            0.1, -0.1, 0.2, 0.1, -0.2, 0.1, 0.0, 0.1, -0.1, 0.2,
            0.1, -0.1, 0.1, 0.2, -0.1, 0.1, 0.0, -0.1, 1.9, 2.2,
        ],
        "current_price": 4312.80,
    },
    {
        "symbol": "INFY.NS",
        "sensitivity": "normal",
        "snapshots": [
            0.5, -0.4, 0.6, -0.3, 0.4, 0.5, -0.6, 0.3, 0.4, -0.5,
            0.3, 0.6, -0.4, 0.5, 0.3, -0.6, 0.4, 0.5, -0.3, 0.4,
        ],
        "current_price": 1823.40,
    },
    {
        "symbol": "HDFCBANK.NS",
        "sensitivity": "quiet",
        "snapshots": [
            0.2, -0.1, 0.3, -0.2, 0.1, 0.2, -0.1, 0.2, 0.1, -0.2,
            0.1, 0.2, -0.1, 0.3, 0.2, -0.2, 0.1, 0.2, -0.1, 0.2,
        ],
        "current_price": 1892.65,
    },
    {
        "symbol": "BHARTIARTL.NS",
        "sensitivity": "loud",
        "snapshots": [
            1.2, -1.1, 1.5, -0.8, 1.0, 1.3, -1.2, 0.9, 1.1, -1.0,
            1.2, -0.9, 1.4, -1.1, 1.0, 1.2, -0.8, 1.3, -1.0, 1.1,
        ],
        "current_price": 1678.90,
    },
    {
        "symbol": "SBIN.NS",
        "sensitivity": "normal",
        "snapshots": [
            0.4, -0.5, 0.6, -0.3, 0.5, 0.4, -0.6, 0.5, 0.4, -0.5,
            0.3, 0.5, -0.4, 0.6, 0.5, -0.3, 0.4, 0.5, -0.4, 0.5,
        ],
        "current_price": 882.30,
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
        "ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS last_checkpoint TIMESTAMPTZ",
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


def seed_demo():
    # Ensure tables + columns exist (idempotent)
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

        # ── Watchlist items ───────────────────────────────────────────────────
        for stock in DEMO_STOCKS:
            symbol = stock["symbol"]
            existing = (
                db.query(WatchlistItem)
                .filter(WatchlistItem.user_id == user.id, WatchlistItem.symbol == symbol)
                .first()
            )
            if not existing:
                item = WatchlistItem(
                    user_id=user.id,
                    symbol=symbol,
                    sensitivity=stock["sensitivity"],
                    added_at=datetime.now(timezone.utc),
                )
                db.add(item)
                db.flush()

                # ── Price snapshots (historical returns → reconstructed prices) ──
                base_price = stock["current_price"]
                prices = [base_price]
                for ret in reversed(stock["snapshots"][:-1]):
                    prices.insert(0, prices[0] / (1 + ret / 100))

                now = datetime.now(timezone.utc)
                for i, price in enumerate(prices):
                    ts = now - timedelta(days=len(prices) - 1 - i)
                    snap = PriceSnapshot(
                        symbol=symbol,
                        price=round(price, 2),
                        volume=random.randint(500_000, 5_000_000),
                        fetched_at=ts,
                    )
                    db.add(snap)

        db.commit()
        print(f"Seeded demo watchlist: {len(DEMO_STOCKS)} stocks with price history")
    except Exception as e:
        print(f"Error seeding demo data: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo()
