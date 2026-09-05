import logging
from datetime import datetime, timezone
from collections import defaultdict
from services.attention_score import trading_seconds_elapsed as _trading_seconds

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
import numpy as np

from auth import get_current_user
from database import get_db
from models import CheckpointHistory, PriceSnapshot, SymbolEvent, SymbolMetadata, SymbolStats, ThesisResponse, User, Watchlist, WatchlistItem
from schemas import (
    CheckpointHistoryItem,
    CheckpointOut,
    SensitivityUpdate,
    StockOut,
    ThesisResponseCreate,
    ThesisUpdate,
    WatchlistAdd,
    WatchlistOut,
)
from services.attention_score import (
    classify_priority,
    compute_attention_score,
    compute_avg_volume,
    compute_volatility,
    compute_z_score,
    explain_why,
    narrate,
    thesis_watchdog,
)
from services.market_data import classify_freshness, fetch_quote, is_market_open
from services.market_stats import compute_beta, compute_index_return_since, compute_residual_return, get_latest_vix
from services.scenarios import SCENARIOS
from services.sector_service import get_sector_return

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/watchlist", tags=["watchlist"])

THESIS_STALE_DAYS = 60

SENSITIVITY_MULTIPLIER: dict[str, float] = {"quiet": 1.75, "normal": 1.0, "loud": 0.6}


def _get_quiet_for_ms(db: Session, user_id: int, symbol: str, current_score: float, priority: str, now: datetime) -> int | None:
    """Second clock: returns how long (ms) since this symbol last had a notable
    event. Upserts SymbolEvent when a new significant crossing is detected.
    Returns None when there's no prior event on record (first ever)."""
    event = db.query(SymbolEvent).filter(
        SymbolEvent.user_id == user_id,
        SymbolEvent.symbol == symbol,
    ).first()

    is_significant = priority in ("HIGH", "MEDIUM")
    quiet_for_ms: int | None = None

    if is_significant:
        if event is None:
            # First ever notable event for this symbol+user
            db.add(SymbolEvent(
                user_id=user_id, symbol=symbol,
                last_event_at=now, last_event_z=current_score,
                last_event_as_of=now,
            ))
        else:
            quiet_for_ms = int((now - event.last_event_at).total_seconds() * 1000) if event.last_event_at else None
            # Update only when score is genuinely higher (new peak of attention)
            if current_score > (event.last_event_z or 0):
                event.last_event_at = now
                event.last_event_z = current_score
                event.last_event_as_of = now
                event.retracted_at = None
        try:
            db.commit()
        except Exception:
            db.rollback()

    return quiet_for_ms


def _is_thesis_stale(thesis: str | None, thesis_updated_at: datetime | None) -> bool:
    """A thesis with no timestamp (set before this column existed, or never
    re-validated) is treated as stale rather than exempt — silently
    trusting undated reasoning forever is the exact behavioral trap this
    feature exists to catch."""
    if not thesis:
        return False
    if thesis_updated_at is None:
        return True
    age_days = (datetime.now(timezone.utc) - thesis_updated_at).total_seconds() / 86400
    return age_days > THESIS_STALE_DAYS


def _latest_snapshot(db: Session, symbol: str) -> PriceSnapshot | None:
    return (
        db.query(PriceSnapshot)
        .filter(PriceSnapshot.symbol == symbol)
        .order_by(PriceSnapshot.fetched_at.desc())
        .first()
    )


def _compute_score_fields(
    db: Session,
    symbol: str,
    current_price: float,
    checkpoint_price: float,
    current_volume: float,
    last_seen_at: datetime | None,
    elapsed_seconds_override: float | None = None,
    thesis: str | None = None,
    vix_override: float | None = None,
    skip_market_adjustment: bool = False,
    sensitivity: str = "normal",
) -> dict:
    """The one place that turns (prices, volatility, elapsed time) into a
    score/priority/narrative. Shared by the real /watchlist read and the
    Time-Machine /simulate endpoint so the two can never compute the same
    thing two different ways — see DECISIONS.md on why that class of bug
    is worth guarding against explicitly."""
    stock_return = (current_price - checkpoint_price) / checkpoint_price if checkpoint_price > 0 else 0.0
    stock_return_pct = stock_return * 100

    volatility = compute_volatility(db, symbol)
    avg_volume = compute_avg_volume(db, symbol)
    volume_ratio = current_volume / avg_volume if avg_volume > 0 else 1.0

    elapsed_seconds = (
        elapsed_seconds_override
        if elapsed_seconds_override is not None
        else (_trading_seconds(last_seen_at) if last_seen_at else None)
    )

    if skip_market_adjustment:
        # A scenario's stock_return is already the illustrative event
        # magnitude, not a real checkpoint diff — beta-adjusting it against
        # the *real*, currently-calm index would subtract a systemic move
        # that didn't actually happen in this replay, producing a residual
        # that means nothing. Use it as-is instead of silently mismatching
        # fake and real inputs.
        excess_return, sector_adjusted = stock_return, False
    else:
        beta = compute_beta(db, symbol)
        index_return = compute_index_return_since(db, last_seen_at)
        excess_return, sector_adjusted = compute_residual_return(stock_return, beta, index_return)

        # Sector adjustment: if we have a sector index for this symbol, use
        # whichever adjustment (broad or sector) is more conservative so we
        # don't double-penalize a move that was clearly sector-wide.
        if last_seen_at is not None:
            sector_ret = get_sector_return(symbol, last_seen_at)
            if sector_ret is not None:
                sector_ret_frac = sector_ret / 100
                sector_excess = stock_return - sector_ret_frac
                # Take the smaller absolute residual — more conservative signal
                if abs(sector_excess) < abs(excess_return):
                    excess_return = sector_excess
                    sector_adjusted = True
    vix = vix_override if vix_override is not None else get_latest_vix(db)

    sens_mult = SENSITIVITY_MULTIPLIER.get(sensitivity, 1.0)
    score = compute_attention_score(excess_return, volatility, current_volume, avg_volume, elapsed_seconds, vix)
    # Sensitivity: scale the effective score threshold, not the raw score,
    # so "loud" users see more items and "quiet" users see fewer.
    adjusted_score = score / sens_mult
    priority = classify_priority(adjusted_score)
    z_score, regime = compute_z_score(excess_return, volatility, elapsed_seconds, vix)
    score = adjusted_score  # expose adjusted score in return dict
    stats = db.query(SymbolStats).filter(SymbolStats.symbol == symbol).first()
    week_52_high = stats.week_52_high if stats else None
    week_52_low = stats.week_52_low if stats else None
    narrative_str = narrate(
        stock_return_pct, z_score, volume_ratio, current_price,
        week_52_high=week_52_high, week_52_low=week_52_low, sector_adjusted=sector_adjusted,
    )
    why_str = explain_why(priority, stock_return_pct, z_score, sector_adjusted=sector_adjusted, volume_ratio=volume_ratio)
    verdict, verdict_reason = thesis_watchdog(thesis, priority, stock_return_pct, z_score)

    return {
        "week_52_high": week_52_high,
        "week_52_low": week_52_low,
        "stock_return_pct": round(stock_return_pct, 2),
        "attention_score": score,
        "priority": priority,
        "narrative": narrative_str,
        "why": why_str,
        "z_score": round(z_score, 2),
        "regime": regime,
        "vix": vix,
        "thesis_verdict": verdict,
        "thesis_verdict_reason": verdict_reason,
        "sector_adjusted": sector_adjusted,
    }


def _build_stock_out(db: Session, item: WatchlistItem) -> StockOut:
    snapshot = _latest_snapshot(db, item.symbol)
    now_utc = datetime.now(timezone.utc)
    market_open = is_market_open(now_utc)

    if snapshot is None:
        return StockOut(
            symbol=item.symbol,
            price=0.0,
            stock_return_pct=0.0,
            attention_score=0.0,
            priority="LOW",
            narrative="No price data yet",
            why="Not flagged: no price history yet — check back after the next market update.",
            freshness="stale",
            is_market_open=market_open,
            thesis=item.thesis,
            last_seen_price=item.last_seen_price,
            last_seen_at=item.last_seen_at,
            added_at=item.added_at,
        )

    current_price = snapshot.price
    current_volume = snapshot.volume
    freshness = classify_freshness(snapshot.fetched_at, now_utc)
    checkpoint_price = item.last_seen_price or current_price

    # When markets are closed and the checkpoint equals the current price
    # (stock hasn't moved since last weekend fetch), use the most recent
    # historically distinct price as the baseline — this shows the last
    # real trading-day signal rather than all-zeros, which is meaningless.
    if not market_open and abs(current_price - checkpoint_price) < 0.01:
        distinct_snap = (
            db.query(PriceSnapshot)
            .filter(
                PriceSnapshot.symbol == item.symbol,
                PriceSnapshot.price != current_price,
            )
            .order_by(PriceSnapshot.fetched_at.desc())
            .first()
        )
        if distinct_snap and distinct_snap.price > 0:
            checkpoint_price = distinct_snap.price

    sensitivity = getattr(item, "sensitivity", "normal") or "normal"
    fields = _compute_score_fields(
        db, item.symbol, current_price, checkpoint_price, current_volume,
        item.last_seen_at, thesis=item.thesis, sensitivity=sensitivity,
    )

    quiet_for_ms = _get_quiet_for_ms(
        db, item.user_id, item.symbol, fields["attention_score"], fields["priority"], now_utc
    )

    return StockOut(
        symbol=item.symbol,
        price=current_price,
        stock_return_pct=fields["stock_return_pct"],
        attention_score=fields["attention_score"],
        priority=fields["priority"],
        narrative=fields["narrative"],
        why=fields["why"],
        freshness=freshness,
        week_52_high=fields["week_52_high"],
        week_52_low=fields["week_52_low"],
        sector_adjusted=fields.get("sector_adjusted", False),
        sensitivity=sensitivity,
        quiet_for_ms=quiet_for_ms,
        is_market_open=market_open,
        thesis=item.thesis,
        thesis_verdict=fields["thesis_verdict"],
        thesis_verdict_reason=fields["thesis_verdict_reason"],
        regime=fields["regime"],
        vix=fields["vix"],
        thesis_updated_at=item.thesis_updated_at,
        thesis_stale=_is_thesis_stale(item.thesis, item.thesis_updated_at),
        last_seen_price=item.last_seen_price,
        last_seen_at=item.last_seen_at,
        added_at=item.added_at,
    )


@router.get("", response_model=WatchlistOut)
def get_watchlist(
    watchlist_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WatchlistOut:
    q = db.query(WatchlistItem).filter(WatchlistItem.user_id == current_user.id)
    if watchlist_id is not None:
        q = q.filter(WatchlistItem.watchlist_id == watchlist_id)
    items = q.all()
    stocks = [_build_stock_out(db, item) for item in items]
    stocks.sort(key=lambda s: s.attention_score, reverse=True)

    last_cp = None
    for item in items:
        if item.last_seen_at and (last_cp is None or item.last_seen_at > last_cp):
            last_cp = item.last_seen_at

    return WatchlistOut(stocks=stocks, last_checkpoint=last_cp)


@router.get("/{symbol}/simulate")
def simulate_elapsed_time(
    symbol: str,
    away_seconds: int = Query(..., ge=0, le=60 * 60 * 24 * 30, description="Hypothetical seconds since checkpoint"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Time-Machine: recompute this stock's attention score as if the user
    had been away `away_seconds` instead of however long they've actually
    been away — without touching the real checkpoint. Live-demo device for
    the time-decay claim in DECISIONS.md: same price, same checkpoint, only
    the elapsed-time input changes, and the score visibly moves."""
    item = (
        db.query(WatchlistItem)
        .filter(WatchlistItem.user_id == current_user.id, WatchlistItem.symbol == symbol)
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Symbol not in watchlist")

    snapshot = _latest_snapshot(db, item.symbol)
    if snapshot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No price data yet for this symbol")

    checkpoint_price = item.last_seen_price or snapshot.price
    fields = _compute_score_fields(
        db, item.symbol, snapshot.price, checkpoint_price, snapshot.volume, item.last_seen_at,
        elapsed_seconds_override=float(away_seconds), thesis=item.thesis,
    )
    return {"symbol": item.symbol, "away_seconds": away_seconds, **fields}


@router.get("/{symbol}/history")
def get_price_history(
    symbol: str,
    points: int = Query(20, ge=2, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Recent price points for a sparkline. Ownership isn't checked against
    the caller's watchlist — PriceSnapshot is shared market data, not
    per-user state, same as the live quote every other endpoint here reads."""
    snapshots = (
        db.query(PriceSnapshot)
        .filter(PriceSnapshot.symbol == symbol)
        .order_by(PriceSnapshot.fetched_at.desc())
        .limit(points)
        .all()
    )
    ordered = list(reversed(snapshots))
    return {
        "symbol": symbol,
        "points": [{"price": s.price, "fetched_at": s.fetched_at} for s in ordered],
    }


@router.get("/scenario/{scenario_key}")
def replay_scenario(
    scenario_key: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Black-Swan replay: runs every symbol in the user's real watchlist
    (real thesis included) through the same scoring pipeline as live data,
    fed a historically-shaped return/VIX/elapsed-time instead of an actual
    checkpoint diff. Guarantees a dramatic demo moment without depending
    on the live market moving on cue — explicitly marked is_replay so
    nothing here is mistaken for a live quote. See services/scenarios.py."""
    scenario = SCENARIOS.get(scenario_key)
    if scenario is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown scenario. Available: {', '.join(SCENARIOS.keys())}",
        )

    items = db.query(WatchlistItem).filter(WatchlistItem.user_id == current_user.id).all()
    stocks = []
    for item in items:
        snapshot = _latest_snapshot(db, item.symbol)
        if snapshot is None:
            continue
        base_price = snapshot.price
        synthetic_price = base_price * (1 + scenario.stock_return_pct / 100)
        fields = _compute_score_fields(
            db, item.symbol, synthetic_price, base_price, snapshot.volume, item.last_seen_at,
            elapsed_seconds_override=scenario.elapsed_hours * 3600,
            thesis=item.thesis,
            vix_override=scenario.vix,
            skip_market_adjustment=True,
        )
        stocks.append({
            "symbol": item.symbol,
            "price": round(synthetic_price, 2),
            "thesis": item.thesis,
            **fields,
        })
    stocks.sort(key=lambda s: s["attention_score"], reverse=True)

    return {
        "is_replay": True,
        "scenario": scenario.key,
        "label": scenario.label,
        "description": scenario.description,
        "vix": scenario.vix,
        "stocks": stocks,
    }


@router.get("/scenarios")
def list_scenarios() -> dict:
    return {
        "scenarios": [
            {"key": s.key, "label": s.label, "description": s.description}
            for s in SCENARIOS.values()
        ]
    }


@router.post("/add", response_model=StockOut, status_code=status.HTTP_201_CREATED)
def add_symbol(
    payload: WatchlistAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StockOut:
    symbol = payload.symbol.strip().upper()
    if not symbol.endswith(".NS"):
        symbol = f"{symbol}.NS"

    existing = (
        db.query(WatchlistItem)
        .filter(WatchlistItem.user_id == current_user.id, WatchlistItem.symbol == symbol)
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{symbol} already in watchlist")

    quote = fetch_quote(symbol)
    if quote is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Could not resolve symbol {symbol}")

    # Validate watchlist_id belongs to the user if supplied
    if payload.watchlist_id is not None:
        wl = db.query(Watchlist).filter(
            Watchlist.id == payload.watchlist_id,
            Watchlist.user_id == current_user.id,
            Watchlist.is_archived == False,  # noqa: E712
        ).first()
        if not wl:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Watchlist not found")

    now = datetime.now(timezone.utc)
    item = WatchlistItem(
        user_id=current_user.id,
        watchlist_id=payload.watchlist_id,
        symbol=symbol,
        last_seen_price=quote["price"],
        last_seen_at=now,
    )
    db.add(item)

    # Monotonic upsert: only insert a fresh snapshot if it's newer than the
    # latest stored one — guards against late/duplicate ticks regressing price.
    existing_snap = _latest_snapshot(db, symbol)
    if existing_snap is None or existing_snap.fetched_at < now:
        db.add(PriceSnapshot(
            symbol=symbol, price=quote["price"], volume=quote["volume"], fetched_at=now,
        ))
    else:
        logger.debug("Ignored stale snapshot for %s (existing: %s >= new: %s)", symbol, existing_snap.fetched_at, now)

    db.commit()
    db.refresh(item)
    return _build_stock_out(db, item)


@router.delete("/{symbol}", status_code=status.HTTP_204_NO_CONTENT)
def remove_symbol(
    symbol: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    item = (
        db.query(WatchlistItem)
        .filter(WatchlistItem.user_id == current_user.id, WatchlistItem.symbol == symbol)
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Symbol not in watchlist")
    db.delete(item)
    db.commit()


@router.patch("/{symbol}/sensitivity")
def update_sensitivity(
    symbol: str,
    payload: SensitivityUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Update per-symbol sensitivity (quiet/normal/loud). Adjusts how aggressively
    this symbol's attention score translates to HIGH/MEDIUM priority."""
    item = (
        db.query(WatchlistItem)
        .filter(WatchlistItem.user_id == current_user.id, WatchlistItem.symbol == symbol)
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Symbol not in watchlist")
    item.sensitivity = payload.sensitivity
    db.commit()
    return {"symbol": symbol, "sensitivity": payload.sensitivity}


@router.post("/checkpoint/mark", response_model=CheckpointOut)
def mark_caught_up(
    watchlist_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CheckpointOut:
    q = db.query(WatchlistItem).filter(WatchlistItem.user_id == current_user.id)
    if watchlist_id is not None:
        q = q.filter(WatchlistItem.watchlist_id == watchlist_id)
    items = q.all()
    now = datetime.now(timezone.utc)
    count = 0

    for item in items:
        snapshot = _latest_snapshot(db, item.symbol)
        if snapshot:
            item.last_seen_price = snapshot.price
            item.last_seen_at = now
            count += 1
            # Append an immutable checkpoint record so the Time Machine
            # can replay "what the brief looked like at this instant."
            db.add(CheckpointHistory(
                user_id=current_user.id,
                watchlist_id=item.watchlist_id,
                symbol=item.symbol,
                price=snapshot.price,
                checkpoint_at=now,
            ))

    db.commit()
    return CheckpointOut(checkpoint_time=now, stocks_updated=count)


@router.post("/{symbol}/thesis", response_model=StockOut)
def update_thesis(
    symbol: str,
    payload: ThesisUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StockOut:
    item = (
        db.query(WatchlistItem)
        .filter(WatchlistItem.user_id == current_user.id, WatchlistItem.symbol == symbol)
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Symbol not in watchlist")
    item.thesis = payload.thesis
    item.thesis_updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return _build_stock_out(db, item)


@router.post("/{symbol}/thesis/revalidate", response_model=StockOut)
def revalidate_thesis(
    symbol: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StockOut:
    """Resets the staleness clock without changing the thesis text — for
    "I re-read this and it still holds," as distinct from actually editing
    it. Refuses on a stock with no thesis at all rather than silently
    stamping a timestamp onto nothing."""
    item = (
        db.query(WatchlistItem)
        .filter(WatchlistItem.user_id == current_user.id, WatchlistItem.symbol == symbol)
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Symbol not in watchlist")
    if not item.thesis:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No thesis set to re-validate")
    item.thesis_updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return _build_stock_out(db, item)


@router.get("/{symbol}/checkpoint-history", response_model=list[CheckpointHistoryItem])
def get_checkpoint_history(
    symbol: str,
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CheckpointHistoryItem]:
    """Chronological list of past checkpoints for a symbol — used to populate
    the Time Machine picker and the expandable history panel in BriefCard."""
    # Verify ownership
    item = db.query(WatchlistItem).filter(
        WatchlistItem.user_id == current_user.id,
        WatchlistItem.symbol == symbol,
    ).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Symbol not in your watchlist")

    rows = (
        db.query(CheckpointHistory)
        .filter(
            CheckpointHistory.user_id == current_user.id,
            CheckpointHistory.symbol == symbol,
        )
        .order_by(CheckpointHistory.checkpoint_at.desc())
        .limit(limit)
        .all()
    )
    return [
        CheckpointHistoryItem(
            id=r.id,
            symbol=r.symbol,
            price=r.price,
            attention_score=r.attention_score,
            checkpoint_at=r.checkpoint_at,
        )
        for r in rows
    ]


@router.get("/portfolio/risk")
def get_portfolio_risk(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    """Analyze portfolio risk: sector concentration, volatility, alerts."""
    items = db.query(WatchlistItem).filter(WatchlistItem.user_id == current_user.id).all()

    if not items:
        return {
            "total_stocks": 0,
            "sectors": {},
            "portfolio_volatility": 0.0,
            "alerts": [],
            "summary": "Empty watchlist",
        }

    # Sector breakdown
    sector_stocks = defaultdict(list)
    volatilities = []

    for item in items:
        metadata = db.query(SymbolMetadata).filter(SymbolMetadata.symbol == item.symbol).first()
        sector = metadata.sector if metadata else "Other"
        sector_stocks[sector].append(item.symbol)

        vol = compute_volatility(db, item.symbol)
        volatilities.append(vol)

    # Sector concentration percentages
    total = len(items)
    sectors_breakdown = {}
    alerts = []

    for sector, symbols in sorted(sector_stocks.items()):
        pct = (len(symbols) / total) * 100
        sectors_breakdown[sector] = {
            "count": len(symbols),
            "percentage": round(pct, 1),
            "stocks": symbols,
        }

        # Alert if any sector > 35%
        if pct > 35:
            alerts.append(
                {
                    "type": "concentration",
                    "message": f"⚠️ {sector} is {pct:.1f}% of your portfolio — consider diversifying",
                }
            )

    # Portfolio volatility (average)
    portfolio_vol = float(np.mean(volatilities)) if volatilities else 0.0

    return {
        "total_stocks": total,
        "sectors": sectors_breakdown,
        "portfolio_volatility": round(portfolio_vol, 4),
        "volatility_category": (
            "High" if portfolio_vol > 0.03 else "Medium" if portfolio_vol > 0.015 else "Low"
        ),
        "alerts": alerts,
        "summary": f"Portfolio: {total} stocks across {len(sectors_breakdown)} sectors",
    }


@router.post("/{symbol}/response", status_code=status.HTTP_201_CREATED)
def record_thesis_response(
    symbol: str,
    payload: ThesisResponseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    item = (
        db.query(WatchlistItem)
        .filter(WatchlistItem.user_id == current_user.id, WatchlistItem.symbol == symbol)
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Symbol not in watchlist")

    stock = _build_stock_out(db, item)
    response = ThesisResponse(
        watchlist_item_id=item.id,
        response=payload.response,
        attention_score_at_time=stock.attention_score,
    )
    db.add(response)
    db.commit()
    return {"status": "recorded", "response": payload.response}
