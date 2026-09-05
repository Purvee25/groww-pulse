"""CRUD for named watchlists. Distinct from the watchlist_items router —
this manages the containers, not their contents."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import User, Watchlist, WatchlistItem
from schemas import WatchlistCreate, WatchlistResponse, WatchlistUpdate

router = APIRouter(prefix="/watchlists", tags=["watchlists"])

MAX_ACTIVE_WATCHLISTS = 10


def _get_or_404(db: Session, list_id: int, user_id: int) -> Watchlist:
    wl = db.query(Watchlist).filter(
        Watchlist.id == list_id,
        Watchlist.user_id == user_id,
    ).first()
    if not wl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist not found")
    return wl


def _to_response(wl: Watchlist) -> WatchlistResponse:
    return WatchlistResponse(
        id=wl.id,
        name=wl.name,
        created_at=wl.created_at,
        item_count=len([i for i in wl.items if True]),
    )


@router.get("", response_model=list[WatchlistResponse])
def list_watchlists(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WatchlistResponse]:
    wls = (
        db.query(Watchlist)
        .filter(Watchlist.user_id == current_user.id, Watchlist.is_archived == False)  # noqa: E712
        .order_by(Watchlist.created_at)
        .all()
    )
    return [_to_response(wl) for wl in wls]


@router.post("", response_model=WatchlistResponse, status_code=status.HTTP_201_CREATED)
def create_watchlist(
    body: WatchlistCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WatchlistResponse:
    active_count = (
        db.query(Watchlist)
        .filter(Watchlist.user_id == current_user.id, Watchlist.is_archived == False)  # noqa: E712
        .count()
    )
    if active_count >= MAX_ACTIVE_WATCHLISTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {MAX_ACTIVE_WATCHLISTS} active watchlists allowed",
        )
    wl = Watchlist(user_id=current_user.id, name=body.name)
    db.add(wl)
    db.commit()
    db.refresh(wl)
    return _to_response(wl)


@router.patch("/{list_id}", response_model=WatchlistResponse)
def rename_watchlist(
    list_id: int,
    body: WatchlistUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WatchlistResponse:
    wl = _get_or_404(db, list_id, current_user.id)
    wl.name = body.name
    db.commit()
    db.refresh(wl)
    return _to_response(wl)


@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_watchlist(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    wl = _get_or_404(db, list_id, current_user.id)

    active_count = (
        db.query(Watchlist)
        .filter(Watchlist.user_id == current_user.id, Watchlist.is_archived == False)  # noqa: E712
        .count()
    )
    if active_count <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot archive your only remaining watchlist",
        )
    wl.is_archived = True
    # Detach items from the archived list — they stay in the DB but lose the FK reference
    db.query(WatchlistItem).filter(WatchlistItem.watchlist_id == list_id).update(
        {WatchlistItem.watchlist_id: None}
    )
    db.commit()
