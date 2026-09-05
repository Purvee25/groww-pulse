import asyncio
import logging
import time
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from config import settings
from database import Base, engine, SessionLocal
from routers.auth import router as auth_router
from routers.watchlist import router as watchlist_router
from routers.watchlists import router as watchlists_router
from routers.markets import router as markets_router
from routers.ws_router import router as ws_router
from services.scheduler import start_scheduler, stop_scheduler
from seed_metadata import seed_metadata

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Simple in-memory rate limiter ────────────────────────────────────────────
# 60 requests/minute per IP. No external dependency — uses stdlib only.
_rate_buckets: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT = 60
RATE_WINDOW = 60.0


def _is_rate_limited(ip: str) -> bool:
    now = time.monotonic()
    bucket = _rate_buckets[ip]
    # Evict timestamps outside the window
    _rate_buckets[ip] = [t for t in bucket if now - t < RATE_WINDOW]
    if len(_rate_buckets[ip]) >= RATE_LIMIT:
        return True
    _rate_buckets[ip].append(now)
    return False


# ── Security headers middleware ───────────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


# ── Rate limiting middleware ──────────────────────────────────────────────────
class RateLimitMiddleware(BaseHTTPMiddleware):
    EXEMPT_PATHS = {"/health", "/api/health"}

    async def dispatch(self, request: Request, call_next):
        if request.url.path in self.EXEMPT_PATHS or request.url.path.startswith("/ws"):
            return await call_next(request)
        ip = request.client.host if request.client else "unknown"
        if _is_rate_limited(ip):
            return Response(
                content='{"detail":"Rate limit exceeded. Try again in a moment."}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": "60"},
            )
        return await call_next(request)


# ── History pruning background task ──────────────────────────────────────────
async def _prune_history_loop():
    """Deletes checkpoint_history rows older than 30 days every 6 hours.
    Bounded batches of 5000 rows, max 10 batches per run — never holds a
    long transaction or stalls ingestion."""
    await asyncio.sleep(300)  # Initial delay — let the app fully start
    while True:
        try:
            db = SessionLocal()
            try:
                total_deleted = 0
                for _ in range(10):
                    result = db.execute(
                        "DELETE FROM checkpoint_history WHERE id IN ("
                        "  SELECT id FROM checkpoint_history"
                        "  WHERE checkpoint_at < now() - interval '30 days'"
                        "  LIMIT 5000"
                        ")"
                    )
                    batch = result.rowcount
                    db.commit()
                    total_deleted += batch
                    if batch < 5000:
                        break
                if total_deleted > 0:
                    logger.info("Pruned %d old checkpoint_history rows", total_deleted)
                # Also prune old symbol_events (keep latest per user+symbol only)
                db.execute(
                    "DELETE FROM symbol_events WHERE last_event_at < now() - interval '90 days'"
                )
                db.commit()
            finally:
                db.close()
        except Exception as exc:
            logger.warning("History prune failed (will retry in 6h): %s", exc)
        await asyncio.sleep(6 * 3600)


# ── ALTER TABLE for new columns ───────────────────────────────────────────────
def _run_migrations(raw_conn):
    """Idempotent schema alterations for columns added after initial create_all."""
    stmts = [
        "ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS sensitivity VARCHAR(10) NOT NULL DEFAULT 'normal'",
        """CREATE TABLE IF NOT EXISTS symbol_events (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            symbol VARCHAR NOT NULL,
            last_event_at TIMESTAMPTZ,
            last_event_z FLOAT,
            last_event_as_of TIMESTAMPTZ,
            retracted_at TIMESTAMPTZ
        )""",
        "CREATE INDEX IF NOT EXISTS ix_symbol_events_user_symbol ON symbol_events(user_id, symbol)",
    ]
    cur = raw_conn.cursor()
    for stmt in stmts:
        cur.execute(stmt)
    raw_conn.commit()
    cur.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Run idempotent ALTER TABLE migrations
    with engine.connect() as conn:
        _run_migrations(conn.connection)
    seed_metadata()
    start_scheduler()
    prune_task = asyncio.create_task(_prune_history_loop())
    yield
    prune_task.cancel()
    stop_scheduler()


app = FastAPI(title="Groww Pulse API", lifespan=lifespan)

# Middleware order: outermost runs last on response, first on request.
# CORS must come before rate limiting so preflight OPTIONS passes.
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(watchlist_router, prefix="/api")
app.include_router(watchlists_router, prefix="/api")
app.include_router(markets_router)
app.include_router(ws_router)


@app.get("/health")
@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
