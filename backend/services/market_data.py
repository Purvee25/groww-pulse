"""yfinance integration + NSE market-hours/freshness logic."""

from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

import yfinance as yf

IST = ZoneInfo("Asia/Kolkata")
MARKET_OPEN = time(9, 15)
MARKET_CLOSE = time(15, 30)
INDEX_SYMBOL = "^NSEI"  # Nifty 50


def is_market_open(now_utc: datetime | None = None) -> bool:
    now = (now_utc or datetime.now(timezone.utc)).astimezone(IST)
    if now.weekday() >= 5:  # Sat, Sun
        return False
    return MARKET_OPEN <= now.time() <= MARKET_CLOSE


def classify_freshness(fetched_at: datetime, now_utc: datetime | None = None) -> str:
    now = now_utc or datetime.now(timezone.utc)
    age_seconds = (now - fetched_at).total_seconds()
    if age_seconds < 60:
        return "live"
    if age_seconds < 300:
        return "delayed"
    return "stale"


def fetch_quote(symbol: str) -> dict | None:
    """Fetch current price + volume for a single NSE symbol via yfinance."""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        price = info.get("lastPrice")
        volume = info.get("lastVolume") or 0
        if price is None:
            return None
        return {"symbol": symbol, "price": float(price), "volume": int(volume)}
    except Exception:
        return None


def fetch_symbol_stats(symbol: str) -> dict | None:
    """20-day trailing daily volatility (%), avg volume, 52w high/low via historical data."""
    try:
        ticker = yf.Ticker(symbol)
        hist_20d = ticker.history(period="1mo")
        hist_1y = ticker.history(period="1y")

        if hist_20d.empty:
            return None

        daily_returns = hist_20d["Close"].pct_change().dropna()
        daily_volatility_pct = float(daily_returns.std() * 100) if len(daily_returns) > 1 else 1.0
        avg_volume_20d = float(hist_20d["Volume"].tail(20).mean())

        week_52_high = float(hist_1y["High"].max()) if not hist_1y.empty else None
        week_52_low = float(hist_1y["Low"].min()) if not hist_1y.empty else None

        return {
            "symbol": symbol,
            "daily_volatility": max(daily_volatility_pct, 0.1),
            "avg_volume_20d": avg_volume_20d,
            "week_52_high": week_52_high,
            "week_52_low": week_52_low,
        }
    except Exception:
        return None


def fetch_index_return_pct(period_days: float = 1.0) -> float:
    """Nifty 50 return over the lookback window, for market-relative adjustment."""
    try:
        ticker = yf.Ticker(INDEX_SYMBOL)
        hist = ticker.history(period="5d")
        if len(hist) < 2:
            return 0.0
        closes = hist["Close"].to_numpy()
        n = max(1, min(len(closes) - 1, round(period_days)))
        return float((closes[-1] - closes[-1 - n]) / closes[-1 - n] * 100)
    except Exception:
        return 0.0


def fetch_index_quote(symbol: str) -> dict | None:
    """Fetch current price + change % for a market index (e.g., ^NSEI, ^BSESN).

    Falls back to 2-day history computation when regularMarketChangePercent is 0
    (weekends, market-closed hours, yfinance cache lag).
    """
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        price = info.get("lastPrice")
        if price is None:
            return None
        change_pct = float(info.get("regularMarketChangePercent", 0.0) or 0.0)
        # When change_pct is 0 (closed market / yfinance stale), compute from history
        if change_pct == 0.0:
            try:
                hist = ticker.history(period="5d", auto_adjust=True)
                closes = hist["Close"].dropna().tolist()
                if len(closes) >= 2:
                    prev, curr = closes[-2], closes[-1]
                    if prev > 0:
                        change_pct = round((curr - prev) / prev * 100, 2)
            except Exception:
                pass
        return {"symbol": symbol, "price": float(price), "change_pct": change_pct}
    except Exception:
        return None
