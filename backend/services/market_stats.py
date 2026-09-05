"""Beta-adjusted residual return: isolate a stock's idiosyncratic move from
what the broad market did over the same window.

residual_return = stock_return - beta * index_return

A stock down 2% on a day NIFTY is down 2% is beta, not news — flagging it
as "meaningful" anyway is a false positive the plain per-stock z-score
can't avoid. beta is estimated from trailing covariance between the
stock's own tick returns and NIFTY's, paired by recency (i-th-most-recent
with i-th-most-recent) since both are polled independently on their own
schedules — not an exact timestamp join. This is a real simplification,
not hidden: it holds because polling is frequent relative to how fast beta
itself drifts, but a slower or bursty feed would need a proper as-of join
instead. See DECISIONS.md.

Both beta and the index's own return since checkpoint can be unavailable
(thin history, index feed down) — every caller must treat None as "fall
back to the plain per-stock return," never as zero.
"""

import logging

import numpy as np
from sqlalchemy.orm import Session

from models import MarketIndices, PriceSnapshot
from datetime import datetime

logger = logging.getLogger(__name__)

INDEX_NAME = "NIFTY"
MIN_PAIRED_RETURNS = 10


def compute_beta(db: Session, symbol: str) -> float | None:
    stock_snapshots = (
        db.query(PriceSnapshot)
        .filter(PriceSnapshot.symbol == symbol)
        .order_by(PriceSnapshot.fetched_at.desc())
        .limit(100)
        .all()
    )
    index_snapshots = (
        db.query(MarketIndices)
        .filter(MarketIndices.index_name == INDEX_NAME)
        .order_by(MarketIndices.fetched_at.desc())
        .limit(100)
        .all()
    )
    if len(stock_snapshots) < 2 or len(index_snapshots) < 2:
        return None

    stock_prices = np.array([s.price for s in reversed(stock_snapshots)])
    index_prices = np.array([s.current_price for s in reversed(index_snapshots)])
    stock_returns = np.diff(stock_prices) / stock_prices[:-1]
    index_returns = np.diff(index_prices) / index_prices[:-1]

    n = min(len(stock_returns), len(index_returns))
    if n < MIN_PAIRED_RETURNS:
        return None
    stock_returns = stock_returns[-n:]
    index_returns = index_returns[-n:]

    index_variance = float(np.var(index_returns))
    if index_variance <= 1e-12:
        return None
    covariance = float(np.cov(stock_returns, index_returns)[0, 1])
    return covariance / index_variance


def compute_index_return_since(db: Session, checkpoint_time: datetime | None) -> float | None:
    """The index's own fractional return from its reading nearest (at or
    before) the checkpoint to its latest reading. None if there's no
    checkpoint yet, or fewer than two index readings exist at all."""
    if checkpoint_time is None:
        return None

    baseline = (
        db.query(MarketIndices)
        .filter(MarketIndices.index_name == INDEX_NAME, MarketIndices.fetched_at <= checkpoint_time)
        .order_by(MarketIndices.fetched_at.desc())
        .first()
    )
    if baseline is None:
        baseline = (
            db.query(MarketIndices)
            .filter(MarketIndices.index_name == INDEX_NAME)
            .order_by(MarketIndices.fetched_at.asc())
            .first()
        )
    latest = (
        db.query(MarketIndices)
        .filter(MarketIndices.index_name == INDEX_NAME)
        .order_by(MarketIndices.fetched_at.desc())
        .first()
    )
    if baseline is None or latest is None or baseline.current_price <= 0:
        return None
    return (latest.current_price - baseline.current_price) / baseline.current_price


def get_latest_vix(db: Session) -> float | None:
    """India VIX's most recent reading, or None if the feed hasn't
    populated it yet — callers must fall back to unscaled decay, not
    assume a default VIX level that wasn't actually observed."""
    latest = (
        db.query(MarketIndices)
        .filter(MarketIndices.index_name == "INDIA VIX")
        .order_by(MarketIndices.fetched_at.desc())
        .first()
    )
    return latest.current_price if latest else None


def compute_residual_return(
    stock_return: float,
    beta: float | None,
    index_return: float | None,
) -> tuple[float, bool]:
    """Returns (return_to_use, was_adjusted). Falls back to the raw stock
    return — never silently to zero — whenever beta or the index return
    isn't available."""
    if beta is None or index_return is None:
        return stock_return, False
    return stock_return - beta * index_return, True
