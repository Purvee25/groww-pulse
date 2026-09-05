"""Upstream resilience: circuit breaker wrapping yfinance fetches.

States
------
CLOSED  — normal; every call goes to yfinance.
OPEN    — tripped; calls are served from the offline snapshot cache.
HALF_OPEN — cooldown expired; next real call probes the feed.
            If it succeeds → CLOSED. If it fails → OPEN again.

Trip conditions
---------------
* fetch_quote raises any exception (network timeout, HTTP 429, etc.)
* fetch_quote returns None (symbol not found or empty response)

The offline snapshot is loaded from data/offline_snapshot.json on first
access and cached in memory. It ships realistic NSE prices, sector tags,
and beta values for the six demo watchlist stocks.

API health info
---------------
get_circuit_state() → {"state": "CLOSED"|"OPEN"|"HALF_OPEN",
                        "failure_count": int,
                        "tripped_at": ISO str | None,
                        "source": "LIVE_FEED"|"CACHED_FALLBACK"}
"""

from __future__ import annotations

import json
import logging
import threading
import time as _time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_FAILURE_THRESHOLD = 3    # consecutive failures before tripping
_COOLDOWN_SECONDS = 60    # seconds before HALF_OPEN probe attempt

_OFFLINE_SNAPSHOT_PATH = Path(__file__).parent.parent / "data" / "offline_snapshot.json"

_lock = threading.Lock()
_state: dict[str, Any] = {
    "status": "CLOSED",         # CLOSED | OPEN | HALF_OPEN
    "failure_count": 0,
    "tripped_at": None,         # monotonic timestamp
    "tripped_wall": None,       # UTC datetime for reporting
}
_offline_cache: dict[str, dict] | None = None


def _load_offline_cache() -> dict[str, dict]:
    global _offline_cache
    if _offline_cache is not None:
        return _offline_cache
    try:
        with _OFFLINE_SNAPSHOT_PATH.open() as f:
            data = json.load(f)
        _offline_cache = {row["symbol"]: row for row in data["quotes"]}
        logger.info("Loaded offline snapshot: %d symbols", len(_offline_cache))
    except Exception as exc:
        logger.error("Cannot load offline snapshot: %s — returning empty cache", exc)
        _offline_cache = {}
    return _offline_cache


def _should_probe() -> bool:
    if _state["status"] != "OPEN":
        return False
    if _state["tripped_at"] is None:
        return False
    return (_time.monotonic() - _state["tripped_at"]) >= _COOLDOWN_SECONDS


def _record_success() -> None:
    with _lock:
        _state["status"] = "CLOSED"
        _state["failure_count"] = 0
        _state["tripped_at"] = None
        _state["tripped_wall"] = None


def _record_failure() -> None:
    with _lock:
        _state["failure_count"] += 1
        if _state["status"] == "HALF_OPEN" or _state["failure_count"] >= _FAILURE_THRESHOLD:
            if _state["status"] != "OPEN":
                logger.warning(
                    "Circuit breaker TRIPPED after %d failures — switching to offline snapshot",
                    _state["failure_count"],
                )
            _state["status"] = "OPEN"
            _state["tripped_at"] = _time.monotonic()
            _state["tripped_wall"] = datetime.now(timezone.utc).isoformat()


def fetch_with_breaker(fetch_fn, symbol: str) -> tuple[dict | None, str]:
    """Call fetch_fn(symbol) with circuit-breaker protection.

    Returns
    -------
    (result, source) where source is "LIVE_FEED" or "CACHED_FALLBACK".
    result is None when no data is available at all (offline cache miss).
    """
    with _lock:
        current = _state["status"]

    if current == "OPEN":
        if _should_probe():
            with _lock:
                _state["status"] = "HALF_OPEN"
            logger.info("Circuit breaker entering HALF_OPEN — probing feed for %s", symbol)
            return _try_live(fetch_fn, symbol)
        return _serve_offline(symbol)

    return _try_live(fetch_fn, symbol)


def _try_live(fetch_fn, symbol: str) -> tuple[dict | None, str]:
    start = _time.monotonic()
    try:
        result = fetch_fn(symbol)
    except Exception as exc:
        logger.warning("fetch_fn(%s) raised %s — recording failure", symbol, exc)
        _record_failure()
        return _serve_offline(symbol)

    latency_ms = int((_time.monotonic() - start) * 1000)

    if result is None:
        _record_failure()
        return _serve_offline(symbol)

    _record_success()
    result["_latency_ms"] = latency_ms
    return result, "LIVE_FEED"


def _serve_offline(symbol: str) -> tuple[dict | None, str]:
    cache = _load_offline_cache()
    row = cache.get(symbol)
    if row is None:
        logger.warning("Offline cache miss for %s", symbol)
        return None, "CACHED_FALLBACK"
    return dict(row), "CACHED_FALLBACK"


def get_circuit_state() -> dict:
    with _lock:
        return {
            "state": _state["status"],
            "failure_count": _state["failure_count"],
            "tripped_at": _state["tripped_wall"],
            "source": "CACHED_FALLBACK" if _state["status"] == "OPEN" else "LIVE_FEED",
        }
