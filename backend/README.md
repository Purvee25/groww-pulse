# Groww Pulse Backend

Smart market watchlist API — ranks stocks by statistical unusualness (attention score), not raw % change.

## Setup

```bash
cd groww-pulse-backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Create PostgreSQL database
createdb groww_pulse

# Copy and edit env
cp .env.example .env
# Edit .env with your JWT_SECRET and DATABASE_URL
```

## Run

```bash
source venv/bin/activate
uvicorn main:app --reload --port 8001
```

Tables are created automatically on startup. Swagger UI at http://localhost:8001/docs

## Quick test (curl)

```bash
# Register
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'

# Save the token from response
TOKEN="<paste token here>"

# Add a stock
curl -X POST http://localhost:8001/api/watchlist/add \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"symbol": "RELIANCE"}'

# Get watchlist (ranked by attention score)
curl http://localhost:8001/api/watchlist \
  -H "Authorization: Bearer $TOKEN"

# Mark as caught up
curl -X POST http://localhost:8001/api/watchlist/checkpoint/mark \
  -H "Authorization: Bearer $TOKEN"

# Set thesis
curl -X POST http://localhost:8001/api/watchlist/RELIANCE.NS/thesis \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"thesis": "Strong refining margins will drive Q3 beat"}'

# Record thesis response
curl -X POST http://localhost:8001/api/watchlist/RELIANCE.NS/response \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"response": "supports"}'

# Remove stock
curl -X DELETE http://localhost:8001/api/watchlist/RELIANCE.NS \
  -H "Authorization: Bearer $TOKEN"
```
