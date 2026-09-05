"""Market data endpoints: indices, metadata, movers."""

import asyncio
from sqlalchemy import desc
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends

from database import get_db
from models import MarketIndices, SymbolMetadata
from services.market_data import fetch_quote

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


@router.get("/movers")
async def get_market_movers():
    """Top gainers and losers from NSE large-cap universe."""
    async def _fetch(sym: str):
        try:
            q = await asyncio.to_thread(fetch_quote, sym)
            if q and q.get("price"):
                return {"symbol": sym.replace(".NS", ""), "price": q["price"], "change_pct": q.get("change_pct", 0.0)}
        except Exception:
            pass
        return None

    results = await asyncio.gather(*[_fetch(s) for s in _NSE100_SYMBOLS])
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
