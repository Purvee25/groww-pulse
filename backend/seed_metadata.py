"""Seed SymbolMetadata with popular Indian stocks."""

from datetime import datetime, timezone

from database import SessionLocal
from models import SymbolMetadata

# Popular Indian stocks with metadata
STOCKS = [
    {
        "symbol": "RELIANCE.NS",
        "company_name": "Reliance Industries",
        "sector": "Energy",
        "market_cap": "₹18.5 Lakh Cr",
        "logo_url": "https://logo.clearbit.com/reliance.com",
    },
    {
        "symbol": "TCS.NS",
        "company_name": "Tata Consultancy Services",
        "sector": "IT",
        "market_cap": "₹15.2 Lakh Cr",
        "logo_url": "https://logo.clearbit.com/tcs.co.in",
    },
    {
        "symbol": "INFY.NS",
        "company_name": "Infosys",
        "sector": "IT",
        "market_cap": "₹8.4 Lakh Cr",
        "logo_url": "https://logo.clearbit.com/infosys.com",
    },
    {
        "symbol": "WIPRO.NS",
        "company_name": "Wipro",
        "sector": "IT",
        "market_cap": "₹3.8 Lakh Cr",
        "logo_url": "https://logo.clearbit.com/wipro.com",
    },
    {
        "symbol": "HDFCBANK.NS",
        "company_name": "HDFC Bank",
        "sector": "Banking",
        "market_cap": "₹12.8 Lakh Cr",
        "logo_url": "https://logo.clearbit.com/hdfcbank.com",
    },
    {
        "symbol": "ICICIBANK.NS",
        "company_name": "ICICI Bank",
        "sector": "Banking",
        "market_cap": "₹6.2 Lakh Cr",
        "logo_url": "https://logo.clearbit.com/icicibank.com",
    },
    {
        "symbol": "AXISBANK.NS",
        "company_name": "Axis Bank",
        "sector": "Banking",
        "market_cap": "₹4.8 Lakh Cr",
        "logo_url": "https://logo.clearbit.com/axisbank.com",
    },
    {
        "symbol": "BHARTIARTL.NS",
        "company_name": "Bharti Airtel",
        "sector": "Telecom",
        "market_cap": "₹6.5 Lakh Cr",
        "logo_url": "https://logo.clearbit.com/airtel.in",
    },
    {
        "symbol": "MARUTI.NS",
        "company_name": "Maruti Suzuki",
        "sector": "Auto",
        "market_cap": "₹2.1 Lakh Cr",
        "logo_url": "https://logo.clearbit.com/marutisuzuki.com",
    },
    {
        "symbol": "SBIN.NS",
        "company_name": "State Bank of India",
        "sector": "Banking",
        "market_cap": "₹6.8 Lakh Cr",
        "logo_url": "https://logo.clearbit.com/sbi.co.in",
    },
]


def seed_metadata():
    db = SessionLocal()
    try:
        # Clear existing metadata
        db.query(SymbolMetadata).delete()
        db.commit()

        # Add new metadata
        for stock in STOCKS:
            metadata = SymbolMetadata(
                symbol=stock["symbol"],
                company_name=stock["company_name"],
                sector=stock["sector"],
                market_cap=stock["market_cap"],
                logo_url=stock["logo_url"],
                last_updated=datetime.now(timezone.utc),
            )
            db.add(metadata)

        db.commit()
        print(f"Seeded {len(STOCKS)} symbols into SymbolMetadata")
    except Exception as e:
        print(f"Error seeding metadata: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_metadata()
