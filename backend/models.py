from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    watchlist_items: Mapped[list["WatchlistItem"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    watchlists: Mapped[list["Watchlist"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Watchlist(Base):
    __tablename__ = "watchlists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(40), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    user: Mapped["User"] = relationship(back_populates="watchlists")
    items: Mapped[list["WatchlistItem"]] = relationship(back_populates="watchlist", cascade="all, delete-orphan")


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"
    # watchlist_id nullable for migration safety — existing rows get backfilled
    # by the startup seed before we can set NOT NULL in a later migration.
    __table_args__ = (UniqueConstraint("user_id", "symbol", "watchlist_id", name="uq_user_symbol_list"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    watchlist_id: Mapped[int | None] = mapped_column(ForeignKey("watchlists.id"), nullable=True, index=True)
    symbol: Mapped[str] = mapped_column(String, nullable=False, index=True)
    thesis: Mapped[str | None] = mapped_column(String, nullable=True)
    thesis_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sensitivity: Mapped[str] = mapped_column(String(10), nullable=False, default="normal")

    # Server-side checkpoint: the baseline "what changed since I last looked" compares against.
    last_seen_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship(back_populates="watchlist_items")
    watchlist: Mapped["Watchlist | None"] = relationship(back_populates="items")
    thesis_responses: Mapped[list["ThesisResponse"]] = relationship(
        back_populates="watchlist_item", cascade="all, delete-orphan"
    )


class ThesisResponse(Base):
    __tablename__ = "thesis_responses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    watchlist_item_id: Mapped[int] = mapped_column(
        ForeignKey("watchlist_items.id"), nullable=False
    )
    response: Mapped[str] = mapped_column(String, nullable=False)  # supports | challenges | uncertain
    attention_score_at_time: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    watchlist_item: Mapped["WatchlistItem"] = relationship(back_populates="thesis_responses")


class CheckpointHistory(Base):
    """Immutable record of what each symbol's price was when the user clicked
    'Mark as Caught Up'. Used to power the Time Machine replay feature — we can
    reconstruct what the brief would have shown at any past checkpoint."""

    __tablename__ = "checkpoint_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    watchlist_id: Mapped[int | None] = mapped_column(ForeignKey("watchlists.id"), nullable=True)
    symbol: Mapped[str] = mapped_column(String, nullable=False, index=True)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    attention_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    checkpoint_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class PriceSnapshot(Base):
    """Shared across all users. Written once per poll interval by the background worker.
    Also the source of truth for computing rolling volatility (compute-on-read)."""

    __tablename__ = "price_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    symbol: Mapped[str] = mapped_column(String, nullable=False, index=True)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    volume: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )


class SymbolMetadata(Base):
    """Stock metadata: company name, sector, logo, etc."""

    __tablename__ = "symbol_metadata"

    symbol: Mapped[str] = mapped_column(String, primary_key=True, unique=True, index=True)
    company_name: Mapped[str] = mapped_column(String, nullable=False)
    sector: Mapped[str | None] = mapped_column(String, nullable=True)
    market_cap: Mapped[str | None] = mapped_column(String, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    last_updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SymbolStats(Base):
    """52-week high/low per symbol, refreshed periodically from yfinance's
    1-year history — a real (if slow-moving) figure, not a hardcoded range.
    One row per symbol; None fields mean the daily refresh hasn't reached
    this symbol yet, not that the stock has no range."""

    __tablename__ = "symbol_stats"

    symbol: Mapped[str] = mapped_column(String, primary_key=True)
    week_52_high: Mapped[float | None] = mapped_column(Float, nullable=True)
    week_52_low: Mapped[float | None] = mapped_column(Float, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SymbolEvent(Base):
    """Second clock: per (user, symbol) record of the last time this symbol
    did something statistically notable — independent of any visit checkpoint.
    Enables "quiet for N days, just woke up" narrative in the attention deck."""

    __tablename__ = "symbol_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    symbol: Mapped[str] = mapped_column(String, nullable=False, index=True)
    last_event_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_event_z: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_event_as_of: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    retracted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class MarketIndices(Base):
    """Top market indices: NIFTY, SENSEX, BANKNIFTY, etc."""

    __tablename__ = "market_indices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    index_name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    current_price: Mapped[float] = mapped_column(Float, nullable=False)
    change_pct: Mapped[float] = mapped_column(Float, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
