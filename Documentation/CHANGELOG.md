# Build & Commit Guide

> A chronological directory of every commit to Nifty Velocity Alpha. Updated with each code push.

---

## Quick Stats

| Metric | Value |
|--------|-------|
| Total Commits | 23 |
| First Commit | 2026-02-19 |
| Latest Commit | 2026-02-21 |
| Total Files | 60+ source files |
| Lines of Code | ~12,000+ (src/) |
| Contributors | Varun Raghavan, Claude Opus 4.6 |

---

## Commit History

### 1. `27ff0b7` &mdash; 2026-02-19

**Initial commit from Create Next App**

Scaffolded the project with `create-next-app`. Includes default Next.js boilerplate, TypeScript config, Tailwind CSS, and ESLint.

| Files | Insertions |
|-------|-----------|
| 17 | +6,886 |

---

### 2. `0f84d7f` &mdash; 2026-02-19

**Build automated momentum stock screener with 6-phase pipeline and Kite Connect integration**

The foundational commit. Built the entire screener application from scratch:

- 18 technical indicators (EMA, RSI, ADX, MACD, Bollinger, Stochastic, SuperTrend, OBV, MFI, etc.)
- 6-stage screening pipeline: Liquidity, Trend, Momentum, Volume, Volatility, Risk Management
- Zerodha Kite Connect OAuth flow for live NSE market data
- Dashboard, Screener, Signals, and Position Calculator pages
- Live/Demo mode with automatic fallback to mock data
- shadcn/ui components with Recharts visualizations

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 33 | +8,387 | -194 |

**Key files created:** `screener-engine.ts`, `indicators.ts`, `kite-api.ts`, `kite-session.ts`, `live-data-service.ts`, `mock-data.ts`, all page components

---

### 3. `5e49277` &mdash; 2026-02-19

**Fix live Kite data not reaching UI + expand to Nifty 500**

- Removed marketCap filter from Phase 1 (Kite doesn't provide it)
- API returns full `ScreenerResult[]` instead of stripped format
- Expanded stock universe from 34 to ~500 Nifty 500 symbols
- Added concurrent batch processing (3 parallel historical requests)
- Split quote fetching into batches of 250 (Kite API limit)
- Increased `maxDuration` to 300s for Vercel Pro

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 7 | +209 | -116 |

---

### 4. `3ef2c75` &mdash; 2026-02-19

**Add shared state via React Context to persist data across pages**

Screener data (results, mode, Kite status) now lives in a Context provider wrapping the app layout, so navigating between pages retains live data instead of reverting to demo/mock data.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 4 | +185 | -106 |

**Key files created:** `ScreenerContext.tsx`, `client-providers.tsx`

---

### 5. `425f43f` &mdash; 2026-02-19

**Add user authentication with Supabase Auth**

- Email/password sign-up and Google OAuth sign-in
- Password reset flow
- Protected routes via middleware redirect
- User menu with sign-out in navbar
- Supabase client utilities and AuthContext

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 19 | +1,466 | -5 |

**Key files created:** Auth pages (login, register, reset-password, update-password), `AuthContext.tsx`, `supabase/client.ts`, `supabase/server.ts`, `supabase/middleware.ts`, `middleware.ts`

---

### 6. `23459f4` &mdash; 2026-02-20

**Fix auth build: force-dynamic rendering for auth pages**

Prevents prerender failures when Supabase env vars are not available at build time. Removes unused helper function.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 5 | +8 | -13 |

---

### 7. `3deb81f` &mdash; 2026-02-20

**Add paper trade and watchlist features with coordinated price updates**

Major feature commit:

- Paper trade: mock-buy stocks from Dashboard/Screener, track P&L, close positions
- Watchlist: save stocks to monitor with buy/sell targets, inline editing
- Auto-update prices every 3 min during market hours via coordinated polling
- In-process async mutex (`kite-lock`) prevents concurrent Kite API calls
- API routes for CRUD operations on trades and watchlist (Supabase + RLS)
- New contexts: PriceUpdate, PaperTrade, Watchlist with real-time price sync

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 26 | +2,848 | -1 |

**Key files created:** `paper-trade/page.tsx`, `watchlist/page.tsx`, all paper-trade/watchlist API routes, `PaperTradeContext.tsx`, `WatchlistContext.tsx`, `PriceUpdateContext.tsx`, `kite-lock.ts`, `market-hours.ts`, `PaperBuyDialog.tsx`, `CloseTradeDialog.tsx`, `WatchlistButton.tsx`

---

### 8. `80e53c1` &mdash; 2026-02-20

**Harden security: add headers, Zod validation, OAuth CSRF, error sanitization (Security Review #1)**

- Security headers (X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy) in `next.config.ts`
- Kite OAuth CSRF protection with random state token in HttpOnly cookie
- Centralized Zod validation schemas for all API inputs (`validation.ts`)
- UUID validation on all `[id]` route parameters
- Sanitized error responses (generic to client, detailed server-side)
- Record count limits (100 open trades, 200 watchlist items)
- `.strict()` on schemas to prevent prototype pollution
- Documented serverless lock limitation with Redis migration path

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 15 | +351 | -68 |

**Key files created:** `validation.ts`

---

### 9. `187ac59` &mdash; 2026-02-20

**Add tiered RSI scoring, volume trend analysis, and market regime detection**

Two major engine enhancements:

- **Tiered RSI Scoring:** Replaces flat RSI zone check with 5-tier scoring (-3 to +5 pts). Differentiates optimal pullback entries (RSI 45-55) from exhaustion zones (RSI 70-75).
- **Market Regime Detection:** Detects Bull/Bear/Sideways from Nifty 50 indicators. Adaptive thresholds tighten filters in bear/sideways markets (higher ADX, narrower RSI, stricter R:R, elevated signal thresholds).

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 11 | +733 | -74 |

---

### 10. `de71e57` &mdash; 2026-02-20

**Add multi-timeframe confirmation system with weekly trend analysis**

Aggregates daily candles into weekly candles client-side to compute weekly EMA20, RSI(14), and MACD histogram. Stocks with aligned weekly trends get +5 pts; counter-trend setups get -10 pts penalty.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 7 | +265 | -4 |

---

### 11. `8e5a84c` &mdash; 2026-02-20

**Add divergence detection engine and sector rotation ranking**

Two major analytical features:

- **Divergence Detection:** Fractal-based swing point detection with RSI/MACD/OBV/MFI divergence analysis. Bullish divergences +8 pts, bearish up to -15 pts.
- **Sector Rotation:** Computes sector-level momentum using 3M RS, breadth (% above EMA50), and weekly change. Top 3 sectors: +5 pts, bottom 3: -5 pts.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 12 | +834 | -16 |

---

### 12. `6c95a5b` &mdash; 2026-02-20

**Add portfolio analytics dashboard with equity curve and risk metrics**

Adds "Analytics" tab to Paper Trade page:

- 10 metric cards: Sharpe Ratio, Sortino Ratio, Max Drawdown, Profit Factor, Win Rate, Avg Win/Loss, Consecutive Wins/Losses, Avg Hold
- Equity Curve chart (AreaChart with starting capital reference line)
- Drawdown underwater chart
- Monthly Returns heatmap
- Win Rate by Signal and by Sector charts

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 3 | +925 | -4 |

**Key files created:** `portfolio-analytics.ts`

---

### 13. `5eb5994` &mdash; 2026-02-20

**Add screener history and signal performance tracking**

- Auto-save screener run snapshots to Supabase (`screener_snapshots` + `signal_snapshots` tables)
- Retroactively fill in actual prices after 1/3/5/10 trading days
- Performance tab on Signals page with win rate, avg returns, hit rate breakdown, accuracy trend, best/worst signals

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 9 | +1,199 | -6 |

**Key files created:** `signal-performance.ts`, `signal-performance/route.ts`, `previous-signals/route.ts`

---

### 14. `f3b7235` &mdash; 2026-02-20

**Persist live screener data across page reloads via sessionStorage**

Cache live screener results, market regime, thresholds, and sector rankings to `sessionStorage` after each successful Kite refresh. Restore on mount if valid and less than 30 min old.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 1 | +130 | -11 |

---

### 15. `28950e0` &mdash; 2026-02-21

**Wire CCI/Williams %R/A/D Line into scoring and add indicator tooltips (Improvements #1 & #2)**

- **#2 (Wire Underutilized Indicators):** CCI and Williams %R scoring in Phase 3 (+1 to +4 pts), A/D Line in Phase 4 (+3/-3 pts). All three were previously computed but contributed zero weight.
- **#1 (Indicator Tooltips):** Educational hover tooltips on all 24 indicator cards explaining what each indicator measures and screener thresholds.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 5 | +137 | -4 |

---

### 16. `cd04bd4` &mdash; 2026-02-21

**Add phase educational cards and searchable glossary modal (Improvements #4 & #5)**

- **#4 (Phase Educational Cards):** Dashboard framework cards now have expandable "Learn More" sections with phase details.
- **#5 (Glossary Modal):** 33 searchable terms covering indicators, risk concepts, and strategy. Filterable by category with real-time search. Accessible via "?" icon in navbar.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 3 | +457 | 0 |

**Key files created:** `glossary-dialog.tsx`

---

### 17. `205fd0c` &mdash; 2026-02-21

**Add strategy presets for screener config (Improvement #3)**

4 trading strategy presets (Balanced, Indian Favourite, Multi-Signal, Conservative) that adjust screener parameters. Users can manually tweak after selecting a preset.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 2 | +111 | -1 |

---

### 18. `eccf7ea` &mdash; 2026-02-21

**Add signal change alerts showing upgrade/downgrade/NEW badges (Improvement #6)**

Compares current screener signals against the previous snapshot. Shows Up/Down/NEW badges next to each stock's signal badge. New API endpoint fetches second-most-recent snapshot to avoid race conditions.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 5 | +170 | 0 |

---

### 19. `ccb48b7` &mdash; 2026-02-21

**Add backtesting preview with score-tier analytics and sector performance (Improvement #8)**

- Strategy Summary card with natural-language verdict and confidence badges
- Score-Tier Performance chart and table (STRONG_BUY/BUY/WATCH/LOW tiers)
- Sector Performance breakdown ranked by avg 10-day return

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 2 | +434 | -2 |

---

### 20. `df84431` &mdash; 2026-02-21

**Add rebalancing & exit signals to paper-trade page (Improvement #7)**

Cross-references open positions with screener results. Flags 5 exit conditions: signal downgraded, bearish divergence, trend broken, extended hold, stop loss breached. Severity-coded badges and summary alert card.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 3 | +402 | -7 |

**Key files created:** `rebalancing.ts`

---

### 21. `c363558` &mdash; 2026-02-21

**Add portfolio risk dashboard to paper-trade Analytics tab (Improvement #9)**

Live risk visibility for open positions: portfolio heat %, worst-case loss, avg risk:reward, sector concentration donut chart, and 5-item risk checklist. Renders independently of closed-trade analytics.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 3 | +502 | -10 |

---

### 22. `7cedf81` &mdash; 2026-02-21

**Harden security: fix open redirect, add rate limiting, CSP, and auth guards (Security Review #2)**

Addresses 8 findings from comprehensive security audit:

| ID | Severity | Fix |
|----|----------|-----|
| C1 | CRITICAL | Fix open redirect in auth callback (`sanitizeRedirectPath`) |
| H1 | HIGH | Sliding-window rate limiting middleware (auth/screener/API tiers) |
| H2 | HIGH | Remove `KITE_ACCESS_TOKEN` env var fallback |
| H3 | HIGH | Add Content-Security-Policy header |
| M1 | MEDIUM | Sanitize Kite token exchange error messages in logs |
| M2 | MEDIUM | Document flash cookie `httpOnly:false` safety reasoning |
| M3 | MEDIUM | Add Supabase auth guard to `/api/kite/status` |
| M4 | MEDIUM | Add `Cache-Control: no-store, private` to all API responses |

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 8 | +204 | -11 |

**Key files created:** `rate-limit.ts`

---

### 23. `080a586` &mdash; 2026-02-21

**Add comprehensive project documentation: architecture, screening logic, changelog, and user guide**

Four documentation files covering every aspect of the project:

- **ARCHITECTURE.md**: Tech stack, directory structure, data flow diagrams, DB schema, API endpoint catalog, security layers, environment variables, type definitions
- **SCREENING-LOGIC.md**: Complete 6-phase pipeline walkthrough, all indicators with periods and scoring, market regime detection, divergence detection, sector rotation formula, signal assignment logic, strategy presets
- **CHANGELOG.md**: All 23 commits with hashes, dates, descriptions, file counts, insertions/deletions, key files created, and feature timeline
- **USER-GUIDE.md**: Page-by-page UI walkthrough for first-time users, daily workflow guide, 16 trading tips, and 20+ FAQs

| Files | Insertions |
|-------|-----------:|
| 4 | +1,803 |

**Key files created:** `Documentation/ARCHITECTURE.md`, `Documentation/CHANGELOG.md`, `Documentation/SCREENING-LOGIC.md`, `Documentation/USER-GUIDE.md`

---

## Feature Timeline

```
Feb 19  [Core]     Screener engine, 6-phase pipeline, Kite OAuth, 4 pages
        [Fix]      Live data integration, Nifty 500 expansion
        [Infra]    React Context state management
        [Auth]     Supabase email/password + Google OAuth

Feb 20  [Feature]  Paper trading + Watchlist + coordinated price updates
        [Security] Headers, Zod validation, CSRF, error sanitization
        [Engine]   Tiered RSI, volume trends, market regime detection
        [Engine]   Multi-timeframe weekly confirmation (+5/-10 pts)
        [Engine]   Divergence detection + sector rotation ranking
        [Feature]  Portfolio analytics (Sharpe, Sortino, equity curve)
        [Feature]  Signal performance tracking + backtesting foundation
        [Infra]    SessionStorage persistence for live data

Feb 21  [UX]       Indicator tooltips, CCI/Williams %R/A/D scoring
        [UX]       Phase educational cards, searchable glossary (33 terms)
        [UX]       Strategy presets (4 trading styles)
        [UX]       Signal change alerts (upgrade/downgrade/NEW badges)
        [Feature]  Backtesting preview (score-tier analytics)
        [Feature]  Rebalancing & exit signals (5 checks)
        [Feature]  Portfolio risk dashboard (heat, sectors, risk checks)
        [Security] Open redirect fix, rate limiting, CSP, auth guards
        [Docs]     Architecture, screening logic, changelog, user guide
```

---

*This file is maintained with every code push. Update it by appending new commit entries at the bottom.*
