"""Attention score: ranks a stock's move by statistical unusualness, not magnitude.

score = abs(z_score) * (1 + 0.2 * min(volume_ratio - 1, 2))
HIGH >= 2.0, MEDIUM >= 1.0, else LOW.

z_score is time-decayed: volatility is measured per polling tick, so raw
per-tick sigma understates how much a price is "allowed" to drift over a
long absence. A 2% move over 5 days is unremarkable for a stock whose
5-minute volatility is 2%; without scaling, both look identically extreme.
Expected volatility over n elapsed ticks grows as sigma * sqrt(n), so z is
divided by that instead of raw sigma. n is capped so a checkpoint left
untouched for months doesn't wash every future move out to z ~ 0.
"""

import logging
from datetime import datetime, time, timezone
from math import sqrt
from zoneinfo import ZoneInfo

import numpy as np
from sqlalchemy.orm import Session

from models import PriceSnapshot

logger = logging.getLogger(__name__)

HIGH_THRESHOLD = 2.0
MEDIUM_THRESHOLD = 1.0

TICK_SECONDS = 30
MAX_ELAPSED_SECONDS = 30 * 24 * 3600

# Trading-hours constants (IST)
_IST = ZoneInfo("Asia/Kolkata")
_MARKET_OPEN = time(9, 15)
_MARKET_CLOSE = time(15, 30)
_TRADING_SECONDS_PER_DAY = int((15 * 3600 + 30 * 60) - (9 * 3600 + 15 * 60))  # 22500s = 6h15m


def trading_seconds_elapsed(since: datetime, until: datetime | None = None) -> float:
    """Count only IST market-open seconds between two UTC datetimes.

    Wall-clock elapsed time is wrong for a watchlist: a stock you haven't
    checked since Friday 3:29pm and one you forgot over the weekend have
    accumulated zero additional 'market risk' during the non-trading hours.
    Using trading seconds means a 48-hour weekend gap counts as 0 elapsed
    ticks — the same as a 10-minute gap during market hours from the
    market's perspective. The Z-score time-decay is therefore calibrated
    to actual market exposure, not clock time.
    """
    if until is None:
        until = datetime.now(timezone.utc)
    since_ist = since.astimezone(_IST)
    until_ist = until.astimezone(_IST)
    if until_ist <= since_ist:
        return 0.0

    total = 0.0
    current = since_ist
    while current.date() <= until_ist.date():
        if current.weekday() < 5:  # Mon-Fri
            day_open = datetime.combine(current.date(), _MARKET_OPEN, tzinfo=_IST)
            day_close = datetime.combine(current.date(), _MARKET_CLOSE, tzinfo=_IST)
            seg_start = max(current, day_open)
            seg_end = min(until_ist, day_close)
            if seg_end > seg_start:
                total += (seg_end - seg_start).total_seconds()
        # advance to next day 00:00
        from datetime import timedelta
        next_day = datetime.combine(current.date(), time(0, 0), tzinfo=_IST) + timedelta(days=1)
        current = next_day
    return min(total, float(MAX_ELAPSED_SECONDS))


def _get_recent_snapshots(db: Session, symbol: str, limit: int = 20) -> list[PriceSnapshot]:
    return (
        db.query(PriceSnapshot)
        .filter(PriceSnapshot.symbol == symbol)
        .order_by(PriceSnapshot.fetched_at.desc())
        .limit(limit)
        .all()
    )


def compute_volatility(db: Session, symbol: str) -> float:
    snapshots = _get_recent_snapshots(db, symbol, limit=100)
    if len(snapshots) < 2:
        return 0.01
    prices = np.array([s.price for s in reversed(snapshots)])
    returns = np.diff(prices) / prices[:-1]
    vol = float(np.std(returns))
    return max(vol, 0.001)


def compute_avg_volume(db: Session, symbol: str) -> float:
    snapshots = _get_recent_snapshots(db, symbol, limit=40)
    if not snapshots:
        return 1.0
    volumes = [s.volume for s in snapshots if s.volume > 0]
    return float(np.mean(volumes)) if volumes else 1.0


VIX_BASELINE = 12.0
VIX_REGIME_THRESHOLD = 15.0


def regime_multiplier(vix: float | None) -> tuple[float, str]:
    """How much faster expected volatility should grow with elapsed time
    when India VIX says the whole market is jumpy, not just this stock.
    A calm-market checkpoint decays at the normal rate; a high-VIX one
    should reach "nothing's wrong" sooner, because more of the tape is
    noise. Returns (multiplier, regime_label); (1.0, "NORMAL") whenever
    VIX isn't available — never a guessed default level."""
    if vix is None or vix <= VIX_REGIME_THRESHOLD:
        return 1.0, "NORMAL"
    return 1.0 + max(vix - VIX_BASELINE, 0) / 10, "HIGH_VOLATILITY_EXPANSION"


def compute_z_score(
    stock_return: float,
    volatility: float,
    elapsed_seconds: float | None,
    vix: float | None = None,
) -> tuple[float, str]:
    """Time-decayed z-score: excess return over expected volatility, where
    expected volatility scales as sigma * sqrt(elapsed ticks). None/0 elapsed
    (e.g. first visit) falls back to n=1 — no decay applied. When India VIX
    is elevated, ticks are treated as "worth more" elapsed time, so the
    same wall-clock absence decays faster in a jumpy market than a calm
    one. Returns (z_score, regime_label)."""
    if volatility <= 0:
        return 0.0, "NORMAL"
    multiplier, regime = regime_multiplier(vix)
    if elapsed_seconds and elapsed_seconds > 0:
        capped = min(elapsed_seconds, MAX_ELAPSED_SECONDS)
        n = max((capped * multiplier) / TICK_SECONDS, 1.0)
    else:
        n = 1.0
    expected_volatility = volatility * sqrt(n)
    return stock_return / expected_volatility, regime


def compute_attention_score(
    excess_return: float,
    volatility: float,
    current_volume: float,
    avg_volume: float,
    elapsed_seconds: float | None = None,
    vix: float | None = None,
) -> float:
    """excess_return is whatever return the caller wants scored — the raw
    stock return, or a beta-adjusted residual return with the market's own
    move subtracted out. This function doesn't know or care which."""
    z_score, _regime = compute_z_score(excess_return, volatility, elapsed_seconds, vix)

    volume_ratio = current_volume / avg_volume if avg_volume > 0 else 1.0
    score = abs(z_score) * (1 + 0.2 * min(max(volume_ratio - 1, 0), 2))
    return round(score, 2)


def classify_priority(score: float) -> str:
    if score >= HIGH_THRESHOLD:
        return "HIGH"
    if score >= MEDIUM_THRESHOLD:
        return "MEDIUM"
    return "LOW"


def narrate(
    stock_return_pct: float,
    z_score: float,
    volume_ratio: float,
    current_price: float = 0,
    week_52_high: float | None = None,
    week_52_low: float | None = None,
    sector_adjusted: bool = False,
) -> str:
    parts = [f"{stock_return_pct:+.1f}%", f"{abs(z_score):.1f}σ" + (" vs sector" if sector_adjusted else " volatility")]
    if volume_ratio >= 1.5:
        parts.append(f"{volume_ratio:.1f}× volume")
    if week_52_high and current_price >= week_52_high:
        parts.append("broke 52w high")
    elif week_52_low and current_price <= week_52_low:
        parts.append("broke 52w low")
    return " · ".join(parts)


def thesis_watchdog(
    thesis: str | None,
    priority: str,
    stock_return_pct: float,
    z_score: float,
) -> tuple[str | None, str | None]:
    """A deterministic rule, not a language model: it never reads what the
    thesis text actually says, only whether a large move happened and which
    direction. Labelled as a heuristic on purpose — claiming it "understood"
    the thesis would be a lie the moment someone reads this function. What
    it genuinely does: turns a passive note into an active prompt to
    re-check your reasoning whenever the move is big enough to matter,
    instead of only when you happen to remember to look.

    Returns (verdict, reason) or (None, None) if there's no thesis to
    evaluate against."""
    if not thesis:
        return None, None

    if priority == "LOW":
        return "NEUTRAL", "Move isn't statistically significant yet — nothing here challenges or confirms your thesis."

    direction = "favorable" if stock_return_pct > 0 else "adverse" if stock_return_pct < 0 else "flat"
    if direction == "favorable":
        return (
            "SUPPORTED",
            f"Favorable move ({stock_return_pct:+.1f}%, {abs(z_score):.1f}σ) since your checkpoint — "
            "consistent with a bullish thesis, but this is a price-direction rule, not a reading of your actual reasoning.",
        )
    if direction == "adverse":
        return (
            "CHALLENGED",
            f"Adverse move ({stock_return_pct:+.1f}%, {abs(z_score):.1f}σ) since your checkpoint — "
            "worth re-reading your thesis against this before assuming it still holds.",
        )
    return "NEUTRAL", "No net move since your checkpoint."
