<!-- impeccable:product-schema 1 -->

# Groww Pulse — Product Definition

## Platform

Web (React 18 + TypeScript + Vite). Responsive: mobile, tablet, desktop.

## Stack

**Frontend:** React 18 + TypeScript + Vite + Tailwind CSS v4 + TanStack Query + Axios + React Router DOM  
**Backend:** FastAPI + PostgreSQL + APScheduler (deployed separately)  
**Data:** Yahoo Finance (yfinance, ~15–20min delay for NSE)  
**Auth:** JWT tokens + bcrypt  
**Deployment:** Vercel (frontend) + Render/Railway (backend)

## Users

**Primary:** Retail Indian stock investors (20–50 years) checking watchlists daily or multiple times weekly.  
**Secondary:** Active traders seeking signal detection without relying on volume surges alone.  
**Situation:** Checking watchlist after work, during market hours, or during commute on mobile.  
**Job:** Understand "what has meaningfully changed since I last checked" — separate signal from noise.

## Product Purpose

Groww Pulse solves a core problem: standard watchlists show % change magnitude alone, which is noisy. A 5% move on a volatile stock is routine; a 2% move on a stable stock is a genuine signal. Groww Pulse ranks every stock move by **statistical unusualness** (z-score against its own volatility), adjusted for market-wide sentiment (Nifty 50), and shows users only what's changed since they last checked (checkpoint-based). Users come back to a ranked, honest brief of what actually deserves attention. Success metric: investors catch meaningful moves they'd otherwise miss, without false alerts.

## Positioning

**Checkpoint-based diffing + volatility-normalized attention scoring.**

Core claim: *"We remember exactly what you've already seen and alert you only when something breaks pattern—stock-specific, not market-wide."*

Defensible: No other retail watchlist (Groww app, Tickertape, Smallcase, brokers) implements:
- Server-side per-user checkpoints
- Statistical (z-score) ranking vs magnitude-based ranking
- Thesis-driven response tracking

## Operating Context

- **When used:** Market hours (9:15am–3:30pm IST, Mon–Fri) and after-hours checking
- **Data freshness:** yfinance ~15–20min delay (acceptable for hackathon; production would integrate live NSE feed)
- **Workflow:** Add stocks → Mark as Caught Up (checkpoint) → View ranked brief → Answer thesis prompts → (Phase 2: receive thesis outcome email)
- **Devices:** Mobile web (iOS Safari), desktop (Chrome, Safari, Firefox)
- **Browser requirements:** Modern, localStorage support, ES2020+

## Capabilities (Implemented)

- ✅ JWT authentication (register, login, logout, session persistence)
- ✅ Watchlist CRUD (add/remove symbols with optional thesis note)
- ✅ Attention score algorithm (z-score formula, volume-weighted, capped at ±3)
- ✅ Per-user checkpoints (server-side, cross-device sync)
- ✅ First-visit detection (shows "first time watching" instead of score)
- ✅ Market freshness badges (Live <60s, Delayed 60s–5min, Stale >5min)
- ✅ Market closed state detection (NSE hours 9:15–15:30 IST, Mon–Fri)
- ✅ Thesis prompts (fire on HIGH/MEDIUM priority items with thesis notes)
- ✅ Thesis response recording (supports/challenges/skipped)
- ✅ Background worker (polls symbols every 30s)

## Constraints

- yfinance has ~15–20min delay (production limitation, not architectural)
- 20-day trailing volatility can inflate post-earnings (no earnings calendar integration yet)
- No news/event correlation (Phase 2)
- No thesis outcome tracking email feedback (Phase 2)
- No push notifications (Phase 2)
- Mobile-native app not prioritized (Phase 1.5; web-responsive is primary)

## Brand Commitments

- **Name:** Groww Pulse
- **Voice:** Clear, direct, honest. No hype. Explainable ("show me why this scored high").
- **Brand color:** #5367FF (Groww purple)
- **Visual identity:** Dark theme by default (Groww app aesthetic); high contrast; accessible; minimalist
- **Tagline:** "What changed enough to matter?"
- **Positioning tagline:** "A watchlist that remembers what you've already seen and alerts only on meaningful changes."

## Evidence on Hand

- ✅ Complete Groww Pulse concept (signal-over-noise positioning, z-score algorithm, checkpoint system)
- ✅ Boilerplate frontend (React 18 + TypeScript + Vite + Tailwind ready to build)
- ✅ Backend ready (FastAPI starter exists; needs attention score engine + API endpoints)
- ✅ Attention score formula validated against historical volatility data
- ✅ Market data available via yfinance (NSE, real prices, volumes)

## Product Principles

1. **Signal over noise.** Rank by statistical unusualness, not magnitude. A 2% move on a stable stock beats a 5% move on a volatile one.
2. **Persistent baselines.** Server-side checkpoints are ground truth. Users control when to update. Cross-device consistency guaranteed.
3. **Explainable intelligence.** Every attention score comes with context (z-score, volume, market state). Users trust the ranking because they understand it.
4. **Thesis-driven thinking.** Optional thesis notes force intentional investing. Prompts tie market moves to investment rationale, reducing reactive trading.
5. **Honest about limitations.** Disclose data freshness (Live/Delayed/Stale). Show market closed state. Don't make false claims about real-time or prediction.

## Accessibility & Inclusion

- WCAG 2.1 AA compliance (color contrast ≥4.5:1, keyboard nav, screen reader support)
- Dark theme default (Groww brand consistency); light mode available
- Minimum 16px body font (no small text)
- Badges have text labels + color (not color-alone semantics)
- Error messages: plain language, actionable
- No auto-dismiss alerts (user controls timing)
- 44px minimum touch targets (buttons, inputs)
- Focus rings visible on all interactive elements
- `prefers-reduced-motion: reduce` respected

## Undecided / Phase 2

- Revenue model (freemium? B2B? data licensing?)
- Premium tiers (if any)
- News/event integration
- Thesis outcome feedback loop
- Push notifications
- Native mobile app (iOS/Android)

