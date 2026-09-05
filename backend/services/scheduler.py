import logging
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler

from database import SessionLocal
from models import PriceSnapshot, WatchlistItem, MarketIndices, SymbolStats
from services.market_data import fetch_quote, fetch_index_quote, fetch_symbol_stats
from services.circuit_breaker import fetch_with_breaker, get_circuit_state

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()

_IST = ZoneInfo("Asia/Kolkata")
_MARKET_OPEN = time(9, 15)
_GAP_OPEN_THRESHOLD = 0.02  # 2% overnight gap triggers a flag


def _is_market_open_ist() -> bool:
    now = datetime.now(_IST)
    return now.weekday() < 5 and _MARKET_OPEN <= now.time() <= time(15, 30)


def _detect_gap_open(db, symbol: str, current_price: float) -> float | None:
    """Return the overnight gap % if this is the first tick of the trading day
    and the price gapped >2% vs. yesterday's last snapshot. Returns None otherwise.

    Gap-opens (price jumps before market opens due to overnight news, RBI decisions,
    global cues, earnings pre-market) are a distinct signal from intraday volatility
    and should be flagged separately — they represent information that arrived while
    the market was closed and the user was not watching.
    """
    now_ist = datetime.now(_IST)
    if now_ist.time() > time(9, 45):  # only check in the first 30 min of trading
        return None
    yesterday = now_ist.date() - timedelta(days=1)
    prev_snap = (
        db.query(PriceSnapshot)
        .filter(
            PriceSnapshot.symbol == symbol,
            PriceSnapshot.fetched_at < datetime.combine(now_ist.date(), time(9, 0), tzinfo=_IST),
        )
        .order_by(PriceSnapshot.fetched_at.desc())
        .first()
    )
    if not prev_snap or prev_snap.price <= 0:
        return None
    gap = (current_price - prev_snap.price) / prev_snap.price
    return gap if abs(gap) >= _GAP_OPEN_THRESHOLD else None


def get_watched_symbols() -> list[str]:
    db = SessionLocal()
    try:
        rows = db.query(WatchlistItem.symbol).distinct().all()
        return [row[0] for row in rows]
    finally:
        db.close()


def poll_prices() -> None:
    symbols = get_watched_symbols()
    if not symbols:
        return

    db = SessionLocal()
    try:
        market_open = _is_market_open_ist()
        for symbol in symbols:
            quote, source = fetch_with_breaker(fetch_quote, symbol)
            if quote is None:
                logger.warning("No quote for %s (source=%s)", symbol, source)
                continue
            if source == "CACHED_FALLBACK":
                logger.info("Circuit breaker active — serving cached snapshot for %s", symbol)

            snap = PriceSnapshot(
                symbol=symbol,
                price=quote["price"],
                volume=quote["volume"],
                fetched_at=datetime.now(timezone.utc),
            )

            # Gap-open detection: flag if price jumped >2% overnight at market open
            if market_open:
                gap = _detect_gap_open(db, symbol, quote["price"])
                if gap is not None:
                    direction = "up" if gap > 0 else "down"
                    logger.info(
                        "GAP_OPEN detected: %s gapped %s %.1f%% at open",
                        symbol, direction, abs(gap) * 100,
                    )
                    if hasattr(snap, "gap_open_pct"):
                        snap.gap_open_pct = round(gap * 100, 2)

            db.add(snap)
        db.commit()
        logger.info("Polled prices for %d symbols", len(symbols))
    except Exception:
        logger.exception("poll_prices failed")
        db.rollback()
    finally:
        db.close()


def poll_indices() -> None:
    """Poll top market indices: NIFTY, SENSEX, BANKNIFTY, etc."""
    indices = ["^NSEI", "^BSESN", "^NSMIDCAP", "^NSEBANK", "^INDIAVIX"]
    index_names = {
        "^NSEI": "NIFTY",
        "^BSESN": "SENSEX",
        "^NSMIDCAP": "NIFTY MIDCAP",
        "^NSEBANK": "NIFTY BANK",
        "^INDIAVIX": "INDIA VIX",
    }

    db = SessionLocal()
    try:
        for symbol in indices:
            quote = fetch_index_quote(symbol)
            if quote is None:
                logger.warning("No quote for index %s", symbol)
                continue

            index_name = index_names.get(symbol, symbol)
            db.add(
                MarketIndices(
                    index_name=index_name,
                    current_price=quote["price"],
                    change_pct=quote["change_pct"],
                    fetched_at=datetime.now(timezone.utc),
                )
            )
        db.commit()
        logger.info("Polled indices")
    except Exception:
        logger.exception("poll_indices failed")
        db.rollback()
    finally:
        db.close()


def poll_symbol_stats() -> None:
    """52-week high/low is a slow-moving figure — a 1-year yfinance history
    call per symbol is too heavy to run on the 30s price-poll cadence, so
    this runs far less often on its own schedule."""
    symbols = get_watched_symbols()
    if not symbols:
        return

    db = SessionLocal()
    try:
        for symbol in symbols:
            stats = fetch_symbol_stats(symbol)
            if stats is None:
                logger.warning("No stats for %s", symbol)
                continue
            existing = db.query(SymbolStats).filter(SymbolStats.symbol == symbol).first()
            if existing:
                existing.week_52_high = stats["week_52_high"]
                existing.week_52_low = stats["week_52_low"]
                existing.updated_at = datetime.now(timezone.utc)
            else:
                db.add(SymbolStats(
                    symbol=symbol,
                    week_52_high=stats["week_52_high"],
                    week_52_low=stats["week_52_low"],
                    updated_at=datetime.now(timezone.utc),
                ))
        db.commit()
        logger.info("Polled symbol stats for %d symbols", len(symbols))
    except Exception:
        logger.exception("poll_symbol_stats failed")
        db.rollback()
    finally:
        db.close()


def start_scheduler() -> None:
    scheduler.add_job(poll_prices, "interval", seconds=30, id="poll_prices", replace_existing=True)
    scheduler.add_job(poll_indices, "interval", seconds=60, id="poll_indices", replace_existing=True)
    scheduler.add_job(poll_symbol_stats, "interval", hours=6, id="poll_symbol_stats", replace_existing=True)
    scheduler.start()
    poll_prices()
    poll_indices()
    poll_symbol_stats()


def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
