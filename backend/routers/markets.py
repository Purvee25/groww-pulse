"""Market data endpoints: indices, metadata, movers."""

import asyncio
import yfinance as yf
from sqlalchemy import desc
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends

from database import get_db
from models import MarketIndices, SymbolMetadata

router = APIRouter(prefix="/api/markets", tags=["markets"])


@router.get("/indices")
def get_market_indices(db: Session = Depends(get_db)):
    """Get latest market indices (NIFTY, SENSEX, etc.)."""
    # Get the latest fetch for each index
    indices_list = (
        db.query(MarketIndices)
        .distinct(MarketIndices.index_name)
        .order_by(MarketIndices.index_name, desc(MarketIndices.fetched_at))
        .all()
    )

    return {
        "indices": [
            {
                "name": idx.index_name,
                "price": idx.current_price,
                "change_pct": idx.change_pct,
                "fetched_at": idx.fetched_at.isoformat(),
            }
            for idx in indices_list
        ]
    }


@router.get("/symbol-metadata/{symbol}")
def get_symbol_metadata(symbol: str, db: Session = Depends(get_db)):
    """Get metadata for a symbol (company name, sector, logo, etc.)."""
    metadata = db.query(SymbolMetadata).filter(SymbolMetadata.symbol == symbol).first()
    if not metadata:
        return {"symbol": symbol, "company_name": symbol, "sector": None, "logo_url": None}

    return {
        "symbol": metadata.symbol,
        "company_name": metadata.company_name,
        "sector": metadata.sector,
        "market_cap": metadata.market_cap,
        "logo_url": metadata.logo_url,
        "description": metadata.description,
    }


_NSE100_SYMBOLS = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "BHARTIARTL.NS", "ICICIBANK.NS",
    "INFOSYS.NS", "SBIN.NS", "HINDUNILVR.NS", "ITC.NS", "LT.NS",
    "KOTAKBANK.NS", "AXISBANK.NS", "MARUTI.NS", "SUNPHARMA.NS", "TITAN.NS",
    "BAJFINANCE.NS", "WIPRO.NS", "NTPC.NS", "ONGC.NS", "POWERGRID.NS",
    "M&M.NS", "TATAMOTORS.NS", "ADANIENT.NS", "HCLTECH.NS", "TECHM.NS",
    "ULTRACEMCO.NS", "JSWSTEEL.NS", "TATASTEEL.NS", "COALINDIA.NS", "BAJAJFINSV.NS",
]


def _fetch_mover(sym: str):
    try:
        info = yf.Ticker(sym).fast_info
        price = getattr(info, "last_price", None) or getattr(info, "previous_close", None)
        prev = getattr(info, "previous_close", None)
        if not price or not prev or prev == 0:
            return None
        change_pct = (price - prev) / prev * 100
        return {"symbol": sym.replace(".NS", ""), "price": round(float(price), 2), "change_pct": round(float(change_pct), 2)}
    except Exception:
        return None


@router.get("/movers")
async def get_market_movers():
    """Top gainers and losers from NSE large-cap universe."""
    results = await asyncio.gather(*[asyncio.to_thread(_fetch_mover, s) for s in _NSE100_SYMBOLS])
    valid = [r for r in results if r is not None]
    valid.sort(key=lambda x: x["change_pct"], reverse=True)
    return {
        "gainers": valid[:5],
        "losers": list(reversed(valid[-5:])),
    }


@router.get("/all-metadata")
def get_all_metadata(db: Session = Depends(get_db)):
    """Get metadata for all tracked symbols."""
    metadata_list = db.query(SymbolMetadata).all()
    return {
        "metadata": [
            {
                "symbol": m.symbol,
                "company_name": m.company_name,
                "sector": m.sector,
                "logo_url": m.logo_url,
            }
            for m in metadata_list
        ]
    }
