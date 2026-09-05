from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


# --- Auth ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    token: str
    email: EmailStr


# --- Watchlist ---
class WatchlistAdd(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    watchlist_id: int | None = None


class ThesisUpdate(BaseModel):
    thesis: str = Field(max_length=500)


ThesisResponseValue = Literal["supports", "challenges", "uncertain"]


class ThesisResponseCreate(BaseModel):
    response: ThesisResponseValue


Priority = Literal["HIGH", "MEDIUM", "LOW"]
Freshness = Literal["live", "delayed", "stale"]


class StockOut(BaseModel):
    symbol: str
    price: float
    stock_return_pct: float
    attention_score: float
    priority: Priority
    narrative: str
    why: str
    freshness: Freshness
    is_market_open: bool
    thesis: str | None = None
    thesis_verdict: Literal["SUPPORTED", "CHALLENGED", "NEUTRAL"] | None = None
    thesis_verdict_reason: str | None = None
    regime: Literal["NORMAL", "HIGH_VOLATILITY_EXPANSION"] = "NORMAL"
    vix: float | None = None
    thesis_updated_at: datetime | None = None
    thesis_stale: bool = False
    week_52_high: float | None = None
    week_52_low: float | None = None
    sector_adjusted: bool = False
    sensitivity: str = "normal"
    quiet_for_ms: int | None = None
    last_seen_price: float | None = None
    last_seen_at: datetime | None = None
    added_at: datetime


class WatchlistOut(BaseModel):
    stocks: list[StockOut]
    last_checkpoint: datetime | None = None


class CheckpointOut(BaseModel):
    checkpoint_time: datetime
    stocks_updated: int


# --- Named watchlists ---
class SensitivityUpdate(BaseModel):
    sensitivity: Literal["quiet", "normal", "loud"]


class WatchlistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)


class WatchlistUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=40)


class WatchlistResponse(BaseModel):
    id: int
    name: str
    created_at: datetime
    item_count: int


# --- Checkpoint history ---
class CheckpointHistoryItem(BaseModel):
    id: int
    symbol: str
    price: float
    attention_score: float | None
    checkpoint_at: datetime
