"""Sector-index return lookup for sector-relative scoring.

The sector adjustment tells whether a stock's move was unusual relative to
its sector peers, not just the broad index. That catches "HDFC Bank fell 3%
but the whole banking sector fell 3%" — which looks like noise once you
adjust, not a signal. Without this, the broad NIFTY adjustment already
handles market-wide moves, but not sector-specific ones.
"""

import time
import logging
from datetime import datetime, timezone

import yfinance as yf

logger = logging.getLogger(__name__)

# NSE sector indices for common large-caps.
# Only covers stocks we're likely to see in Indian retail watchlists.
SECTOR_MAP: dict[str, str] = {
    "HDFCBANK.NS": "^NSEBANK",
    "ICICIBANK.NS": "^NSEBANK",
    "KOTAKBANK.NS": "^NSEBANK",
    "AXISBANK.NS": "^NSEBANK",
    "SBIN.NS": "^NSEBANK",
    "BANKBARODA.NS": "^NSEBANK",
    "INFY.NS": "^CNXIT",
    "TCS.NS": "^CNXIT",
    "WIPRO.NS": "^CNXIT",
    "HCLTECH.NS": "^CNXIT",
    "TECHM.NS": "^CNXIT",
    "LTIM.NS": "^CNXIT",
    "RELIANCE.NS": "^CNXENERGY",
    "ONGC.NS": "^CNXENERGY",
    "BPCL.NS": "^CNXENERGY",
    "IOC.NS": "^CNXENERGY",
    "SUNPHARMA.NS": "^CNXPHARMA",
    "DRREDDY.NS": "^CNXPHARMA",
    "CIPLA.NS": "^CNXPHARMA",
    "DIVISLAB.NS": "^CNXPHARMA",
    "APOLLOHOSP.NS": "^CNXPHARMA",
    "TATASTEEL.NS": "^CNXMETAL",
    "HINDALCO.NS": "^CNXMETAL",
    "JSWSTEEL.NS": "^CNXMETAL",
    "MARUTI.NS": "^CNXAUTO",
    "TATAMOTORS.NS": "^CNXAUTO",
    "BAJAJ-AUTO.NS": "^CNXAUTO",
    "EICHERMOT.NS": "^CNXAUTO",
    "HEROMOTOCO.NS": "^CNXAUTO",
    "NESTLEIND.NS": "^CNXFMCG",
    "HINDUNILVR.NS": "^CNXFMCG",
    "ITC.NS": "^CNXFMCG",
    "DABUR.NS": "^CNXFMCG",
    "TITAN.NS": "^CNXFMCG",
    "ULTRACEMCO.NS": "^CNXINFRA",
    "ADANIPORTS.NS": "^CNXINFRA",
    "POWERGRID.NS": "^CNXINFRA",
    "NTPC.NS": "^CNXINFRA",
    "LT.NS": "^CNXINFRA",
}

# Module-level cache: {index_symbol: (return_pct, expiry_ts)}
_cache: dict[str, tuple[float, float]] = {}
CACHE_TTL_SECONDS = 300  # 5 min is fine for a slow-moving sector index


def get_sector_return(symbol: str, since: datetime) -> float | None:
    """Return the sector index % change since `since`, or None if the symbol
    has no sector mapping. Returns 0.0 on yfinance failure rather than None
    so callers can still apply a (no-op) sector adjustment."""
    sector_index = SECTOR_MAP.get(symbol)
    if sector_index is None:
        return None

    now_ts = time.monotonic()
    cached = _cache.get(sector_index)
    if cached is not None and cached[1] > now_ts:
        return cached[0]

    try:
        since_str = since.astimezone(timezone.utc).strftime("%Y-%m-%d")
        hist = yf.Ticker(sector_index).history(start=since_str)
        if hist.empty or len(hist) < 2:
            return 0.0
        ret = (hist["Close"].iloc[-1] - hist["Close"].iloc[0]) / hist["Close"].iloc[0] * 100
        result = float(ret)
        _cache[sector_index] = (result, now_ts + CACHE_TTL_SECONDS)
        return result
    except Exception:
        logger.warning("Sector return fetch failed for %s", sector_index, exc_info=False)
        return 0.0
