# Engineering Decisions

Every non-obvious design choice in Groww Pulse — what we chose, what we rejected, and why.

---

## 1. Z-score over raw percentage change

**Decision:** Rank stocks by `z = Δ_adj / (σ × √n)`, not by `|Δ%|`.

**Why:** Raw percentage change is magnitude without context. A 2% move on HDFCBANK (daily σ ≈ 0.2%) is 10σ — extraordinary. A 2% move on BHARTIARTL (σ ≈ 1.1%) is under 2σ — unremarkable. Every standard watchlist shows the same number for both. Groww Pulse shows you which one actually changed.

**What we rejected:** Simple threshold rules ("flag anything > X%") are constant regardless of the stock's historical behavior. They produce noise on volatile stocks and miss signals on stable ones. Percentile-rank across the portfolio was considered but collapses to one always being "highest" even when nothing moved.

---

## 2. Trading-hours elapsed time, not wall-clock

**Decision:** `elapsed_seconds` passed to `compute_z_score` counts only IST market-hours seconds (9:15am–3:30pm, Mon–Fri). Nights, weekends, and holidays count as zero.

**Why:** The Z-score time-decay term `σ × √n` models how far a random walk is expected to drift over `n` ticks. But a stock can't drift when the exchange is closed — the price is frozen. A checkpoint set Friday at 3:29pm and checked Monday at 9:16am has one trading minute of elapsed market time, not 64 hours. Using wall-clock time would deflate the Z-score for every Monday-morning check-in, making the system systematically under-sensitive after weekends and holidays — exactly when the most important overnight news arrives.

**Implementation:** `trading_seconds_elapsed(since, until)` in `services/attention_score.py` iterates day-by-day, accumulating only the intersection of each calendar day with the `[9:15, 15:30]` IST window.

---

## 3. Beta-residual neutralization

**Decision:** Score the beta-adjusted residual `Δ_adj = Δ_stock − (β × Δ_NIFTY)`, not the raw stock return.

**Why:** On a day NIFTY rises 1.5% and RELIANCE (β ≈ 1.0) rises 1.6%, the raw return looks like a signal. But 1.5% of that move is just the market. The idiosyncratic component is 0.1% — which is noise, not a signal. Without beta adjustment, every broad market rally produces a flood of false HIGH alerts across the entire watchlist. With it, only stocks that moved **more or less than their beta predicts** rank high.

**What we rejected:** Equal-weighting every stock's return against its own volatility (without subtracting market beta) is mathematically simpler but conflates market-driven and stock-driven moves. Sector-relative adjustment was also implemented as a fallback (`get_sector_return` in `services/market_stats.py`) but used only when beta data is unavailable.

---

## 4. Circuit breaker over retry loops

**Decision:** Three-state machine (CLOSED → OPEN → HALF_OPEN) that serves `data/offline_snapshot.json` during outages, not a retry loop.

**Why:** yfinance rate-limits at ~2000 requests/day. Under load or during NSE maintenance windows, the naive retry approach hammers the API, exhausts the quota, and makes every subsequent request fail. The circuit breaker trips after 3 consecutive failures, stops sending requests entirely for 60 seconds, then probes with a single request before fully reopening. Total API calls during a 60-second outage: **1** (the probe), not hundreds.

**State design:** HALF_OPEN exists to prevent the thundering-herd problem — if every instance probed simultaneously on cooldown expiry, you'd just re-trigger the outage. Only one probe goes out; on success, CLOSED is restored for everyone.

**What we rejected:** Exponential backoff with jitter is correct for transient failures but doesn't have a "stop sending" mode. The circuit breaker is strictly superior when you need to protect a shared third-party rate limit rather than a personal endpoint.

---

## 5. 30-day elapsed time cap (MAX_ELAPSED_SECONDS)

**Decision:** Cap elapsed trading time at `30 × 24 × 3600` seconds (30 calendar days), regardless of actual checkpoint age.

**Why:** `σ × √n` grows without bound. A checkpoint left untouched for 6 months produces an enormous `expected_volatility`, which drives Z-scores toward zero for every move — the system concludes nothing is ever significant because it's been "long enough for anything to happen." The 30-day cap says: a checkpoint older than a month is treated as maximally stale. Any move is then scored against the same (high) expected volatility floor, which is conservative — you may miss some signals, but you won't miss them because of unbounded time-decay.

**Why 30 days, not 7 or 90:** 30 days covers one full earnings cycle. Beyond that, the user's original thesis is almost certainly stale regardless of price. The cap is a forcing function to review old positions, not a concession to the math.

---

## 6. Formal invariant test suite over coverage-based tests

**Decision:** Write 5 mathematical invariants (`tests/test_invariants.py`) instead of aiming for line coverage.

**Why:** Coverage tells you which lines ran. It doesn't tell you whether the math is correct. The invariants test properties the system must hold forever:
- Idempotency: same inputs always produce same outputs
- Variance clamping: elapsed > 30d is always capped
- Tenant isolation: compute layer has no cross-user state
- Beta neutrality: a stock moving exactly with its beta always scores LOW
- Degraded fallback: zero vol / None elapsed / network failure never crashes

A test suite that achieves 100% coverage but doesn't test any of these properties can still ship a system that gives different users different scores for the same stock (tenant isolation violation), or crashes on a valid edge input (zero volatility division).

---

## 7. Decision Journal as a first-class feature

**Decision:** Store a thesis per watchlist item and generate a deterministic verdict (`SUPPORTED / CHALLENGED / NEUTRAL`) when the attention score fires.

**Why:** Watchlists typically answer "what moved?" Groww Pulse answers "did what moved matter **to you**?" The thesis field turns a passive price alert into an active reasoning check. The verdict is explicitly a **heuristic, not AI** — the system never reads the thesis text, only checks move direction and significance. This is documented in the code (`thesis_watchdog` in `attention_score.py`) to prevent any misrepresentation.

**What we rejected:** LLM-based thesis evaluation was considered but rejected: it introduces an external API dependency, latency, cost, and unpredictable outputs for a function that only needs to ask "did the stock go up or down by a lot?" The deterministic rule is correct, auditable, and always consistent.

---

## 8. Gap-open detection at market open

**Decision:** In the scheduler, compare the first price snapshot after 9:15am IST to the previous session's last snapshot. If the gap exceeds ±2%, log a `GAP_OPEN` event.

**Why:** Overnight gap-opens in Indian markets are a qualitatively different event from intraday volatility. They represent information that arrived while the exchange was closed — earnings releases, RBI announcements, global cues from US/EU markets. A stock that gaps up 3% at open has not been "volatile" in the intraday sense; it has been re-priced by the market consensus at a single point. The Z-score time-decay (which models continuous drift) understates the significance of a gap. Flagging it separately ensures the user sees it even if the intraday Z-score hasn't crossed a threshold yet.

**Threshold — why 2%:** NSE circuit limits for large-caps are typically 5–20%. A 2% gap is economically meaningful (larger than most large-cap daily σ) without being so sensitive that normal open-price oscillations trigger it.

---

## 9. Seed checkpoint anchored to live price, not hardcoded

**Decision:** `seed_demo.py` computes `checkpoint_price = anchor_price / (1 + signal_3d_pct / 100)` where `anchor_price` is the latest actual `PriceSnapshot` from the DB.

**Why:** The original seed used hardcoded prices (RELIANCE = ₹2840, TCS = ₹3890, etc.) and computed checkpoint as `prices[-4]` from a synthetic price series. When live yfinance prices arrived (RELIANCE ≈ ₹1322), the return was computed as `(1322 − 2840) / 2840 = −53%` — a crash, not a signal. By anchoring checkpoint to the actual live price, the 3-day signal is always exactly `signal_3d_pct` regardless of what the live market price is.

---

## 10. Rate limiting at 60 req/min per IP without Redis

**Decision:** In-memory `defaultdict(list)` with sliding-window eviction in `main.py`, not Redis + token bucket.

**Why:** For a single-instance Docker deployment, in-process rate limiting is correct and zero-dependency. Redis would be correct for a horizontally-scaled fleet where rate limits need to be coordinated across instances. For this deployment topology, adding Redis just to rate-limit adds one more infrastructure component that can fail. The trade-off is explicit: if you scale to multiple instances, replace this with Redis + Lua script.
