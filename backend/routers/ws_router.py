"""WebSocket endpoint for live brief pushes.

Every 30s we re-run the scoring pipeline for the connected user's watchlist
and push the result. If nothing changed from the previous push we send a
lightweight heartbeat instead of the full payload — avoids flooding the client
with redundant data on quiet markets.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session

from config import settings
from database import SessionLocal
from jose import JWTError, jwt
from models import PriceSnapshot, User, WatchlistItem, SymbolStats
from services.attention_score import (
    classify_priority,
    compute_attention_score,
    compute_avg_volume,
    compute_volatility,
    compute_z_score,
    narrate,
    thesis_watchdog,
)
from services.market_data import classify_freshness, is_market_open
from services.market_stats import compute_beta, compute_index_return_since, compute_residual_return, get_latest_vix
from services.sector_service import get_sector_return

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websocket"])

PUSH_INTERVAL_SECONDS = 30


def _build_brief_payload(user_email: str) -> list[dict]:
    """Re-score the user's watchlist synchronously. Called in an executor so
    the event loop is never blocked by yfinance / SQLAlchemy I/O."""
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.email == user_email).first()
        if user is None:
            return []
        items = db.query(WatchlistItem).filter(WatchlistItem.user_id == user.id).all()
        results = []
        now = datetime.now(timezone.utc)
        market_open = is_market_open(now)

        for item in items:
            snapshot = (
                db.query(PriceSnapshot)
                .filter(PriceSnapshot.symbol == item.symbol)
                .order_by(PriceSnapshot.fetched_at.desc())
                .first()
            )
            if snapshot is None:
                continue

            current_price = snapshot.price
            checkpoint_price = item.last_seen_price or current_price
            stock_return = (current_price - checkpoint_price) / checkpoint_price if checkpoint_price > 0 else 0.0

            volatility = compute_volatility(db, item.symbol)
            avg_volume = compute_avg_volume(db, item.symbol)
            volume_ratio = snapshot.volume / avg_volume if avg_volume > 0 else 1.0

            elapsed = (now - item.last_seen_at).total_seconds() if item.last_seen_at else None

            beta = compute_beta(db, item.symbol)
            index_return = compute_index_return_since(db, item.last_seen_at)
            excess_return, sector_adjusted = compute_residual_return(stock_return, beta, index_return)

            if item.last_seen_at is not None:
                sector_ret = get_sector_return(item.symbol, item.last_seen_at)
                if sector_ret is not None:
                    sector_ret_frac = sector_ret / 100
                    sector_excess = stock_return - sector_ret_frac
                    if abs(sector_excess) < abs(excess_return):
                        excess_return = sector_excess
                        sector_adjusted = True

            vix = get_latest_vix(db)
            score = compute_attention_score(excess_return, volatility, snapshot.volume, avg_volume, elapsed, vix)
            priority = classify_priority(score)
            z_score, regime = compute_z_score(excess_return, volatility, elapsed, vix)

            stats = db.query(SymbolStats).filter(SymbolStats.symbol == item.symbol).first()
            w52h = stats.week_52_high if stats else None
            w52l = stats.week_52_low if stats else None
            narrative = narrate(
                stock_return * 100, z_score, volume_ratio, current_price,
                week_52_high=w52h, week_52_low=w52l, sector_adjusted=sector_adjusted,
            )
            verdict, verdict_reason = thesis_watchdog(item.thesis, priority, stock_return * 100, z_score)
            freshness = classify_freshness(snapshot.fetched_at, now)

            results.append({
                "symbol": item.symbol,
                "price": round(current_price, 2),
                "stock_return_pct": round(stock_return * 100, 2),
                "attention_score": round(score, 2),
                "priority": priority,
                "narrative": narrative,
                "freshness": freshness,
                "is_market_open": market_open,
                "thesis": item.thesis,
                "thesis_verdict": verdict,
                "thesis_verdict_reason": verdict_reason,
                "regime": regime,
                "vix": vix,
                "week_52_high": w52h,
                "week_52_low": w52l,
                "last_seen_price": item.last_seen_price,
                "last_seen_at": item.last_seen_at.isoformat() if item.last_seen_at else None,
                "added_at": item.added_at.isoformat(),
                "thesis_stale": False,
                "thesis_updated_at": item.thesis_updated_at.isoformat() if item.thesis_updated_at else None,
            })

        results.sort(key=lambda s: s["attention_score"], reverse=True)
        return results
    finally:
        db.close()


@router.websocket("/brief")
async def ws_brief(websocket: WebSocket, token: str = Query(...)):
    """Authenticate via ?token= query param (same JWT as REST endpoints),
    then push scored brief every 30s. Send heartbeat when scores haven't changed."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_email: str = payload.get("sub")
        if not user_email:
            await websocket.close(code=1008)
            return
    except JWTError:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    logger.info("WS connected for user %s", user_email)

    last_scores: dict[str, float] = {}

    try:
        while True:
            loop = asyncio.get_event_loop()
            brief = await loop.run_in_executor(None, _build_brief_payload, user_email)

            current_scores = {s["symbol"]: s["attention_score"] for s in brief}
            if current_scores != last_scores:
                await websocket.send_text(json.dumps({"type": "brief", "stocks": brief}))
                last_scores = current_scores
            else:
                await websocket.send_text(json.dumps({"type": "heartbeat"}))

            await asyncio.sleep(PUSH_INTERVAL_SECONDS)
    except WebSocketDisconnect:
        logger.info("WS disconnected for user %s", user_email)
    except Exception:
        logger.exception("WS error for user %s", user_email)
        await websocket.close(code=1011)
