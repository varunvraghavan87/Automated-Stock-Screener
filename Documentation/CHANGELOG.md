# Build & Commit Guide

> A chronological directory of every commit to Nifty Velocity Alpha. Updated with each code push.

---

## Quick Stats

| Metric | Value |
|--------|-------|
| Total Commits | 42 |
| First Commit | 2026-02-19 |
| Latest Commit | 2026-02-26 |
| Total Files | 90+ source files |
| Lines of Code | ~15,000+ (src/) |
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

### 24. `783141c` &mdash; 2026-02-24

**Add per-user Kite API credentials with encrypted storage**

Each user now manages their own Zerodha Kite API key and secret instead of sharing global credentials:

- Kite Connect Setup dialog in the navbar for entering/updating API credentials
- AES-256-GCM encryption of API secrets at rest using `KITE_CREDENTIALS_ENCRYPTION_KEY`
- Per-user credential CRUD API (`/api/kite/credentials`)
- Kite OAuth and data routes read credentials from the user's stored record
- Zod validation for alphanumeric API key/secret format
- SQL migration for `kite_credentials` table with RLS policies

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 14 | +673 | -34 |

**Key files created:** `kite-credentials.ts`, `KiteCredentialsDialog.tsx`, `/api/kite/credentials/route.ts`, `kite_credentials.sql`

---

### 25. `7e9ed74` &mdash; 2026-02-24

**Add admin-approval user registration with role-based access control**

New users now require administrator approval before accessing the application:

- `user_profiles` table with `role` (user/admin), `approval_status` (pending/approved/rejected), and `rejection_reason`
- Database trigger auto-creates profile on Supabase Auth user creation
- Admin panel page (`/admin`) with user list, approve/reject buttons, and status filters
- Middleware blocks unapproved users from protected routes (redirects to pending page)
- Admin API endpoints for user management (`/api/admin/users`, approve, reject)
- RLS policies on `user_profiles` with `SECURITY DEFINER` helper function

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 12 | +926 | -10 |

**Key files created:** `admin/page.tsx`, `/api/admin/users/route.ts`, `/api/admin/users/[userId]/approve/route.ts`, `/api/admin/users/[userId]/reject/route.ts`, `auth/pending/page.tsx`, `user_profiles.sql`

---

### 26. `9609325` &mdash; 2026-02-24

**Fix RLS infinite recursion on user_profiles with SECURITY DEFINER function**

The RLS policy on `user_profiles` was calling `auth.uid()` which triggered another RLS check, creating infinite recursion. Fixed by using a `SECURITY DEFINER` function to bypass RLS for the admin role check.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 1 | +21 | -15 |

---

### 27. `f68beae` &mdash; 2026-02-24

**Fix admin panel visibility by routing profile queries through server API**

Browser-side Supabase queries for user role were failing due to RLS. Created `/api/auth/profile` endpoint that fetches the user's role and approval status server-side.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 2 | +43 | -15 |

**Key files created:** `/api/auth/profile/route.ts`

---

### 28. `730d419` &mdash; 2026-02-24

**Fix CSP font-src, hydration warning, and profile fetch reliability**

- Added `https://fonts.gstatic.com` to CSP `font-src` to fix Google Fonts loading
- Fixed React hydration mismatch warning in layout
- Improved profile fetch error handling in AuthContext

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 3 | +24 | -12 |

---

### 29. `151b620` &mdash; 2026-02-24

**Fix forgot password flow: route through auth callback for PKCE code exchange**

Password reset emails now redirect through `/auth/callback` which exchanges the PKCE code before forwarding to the update-password page.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 2 | +7 | -3 |

---

### 30. `e933c8a` &mdash; 2026-02-24

**Fix market indicator, add column sorting, and remove duplicate stocks**

- **Market Indicator**: Fixed "Market Open/Closed" badge that was always showing the wrong state
- **Column Sorting**: Added sortable table headers to all data tables (Dashboard, Screener, Signals, Paper Trade, Watchlist) with a reusable `useSortable` hook and `SortableHeader` component
- **Deduplication**: Screener engine now deduplicates stocks by symbol before processing

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 11 | +328 | -78 |

**Key files created:** `useSortable.ts`, `sortable-header.tsx`

---

### 31. `6f120f4` &mdash; 2026-02-25

**Add light theme and make positive/negative indicators more pronounced**

- **Light Theme**: Full light theme support via `next-themes`. Theme toggle in navbar. All chart colors, badges, and indicator cards adapt via `useChartColors` hook.
- **Pronounced Indicators**: Higher contrast greens/reds across both themes.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 9 | +238 | -144 |

**Key files created:** `useChartColors.ts`

---

### 32. `813ca3e` &mdash; 2026-02-25

**Fix live data reverting to demo on page refresh**

ScreenerContext was losing the `isKiteConnected` flag during sessionStorage restoration. Now persists and restores Kite connection state alongside screener results.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 1 | +18 | -6 |

---

### 33. `101bf2c` &mdash; 2026-02-25

**Fix login "Failed to fetch" by broadening CSP and improving auth error handling**

- Added `https://*.supabase.com` to CSP `connect-src`
- Auth pages now show actual error messages instead of silently failing

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 4 | +37 | -13 |

---

### 34. `3f8847c` &mdash; 2026-02-25

**Add Supabase health-check banner on auth pages**

`SupabaseHealthCheck` component pings `/api/auth/profile` and shows a warning banner if the backend is unreachable. Helps diagnose connectivity issues on auth pages.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 2 | +74 | 0 |

**Key files created:** `supabase-health-check.tsx`

---

### 35. `2c1e9fc` &mdash; 2026-02-25

**Proxy all auth operations through server API to bypass Jio DNS poisoning**

Major architectural change: all Supabase auth operations now route through the app's own Vercel API routes instead of calling `supabase.co` directly from the browser.

**Root cause:** Jio ISP DNS-poisons `*.supabase.co`, resolving it to a sinkhole IP. Since the Supabase JS SDK runs in the browser, all auth calls fail for Jio users.

**Solution:** 6 new server-side auth API routes. The browser only talks to the app's own domain (Vercel), which contacts Supabase server-to-server.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 13 | +315 | -93 |

**Key files created:** `/api/auth/login/route.ts`, `/api/auth/register/route.ts`, `/api/auth/reset-password/route.ts`, `/api/auth/google/route.ts`, `/api/auth/update-password/route.ts`, `/api/auth/signout/route.ts`

---

### 36. `b5004cf` &mdash; 2026-02-25

**Add admin password reset endpoint to bypass broken email flow**

Jio DNS poisoning also breaks Supabase's password reset email links. Admin-only API endpoint uses Supabase Admin API (`service_role` key) to set passwords directly, plus "Reset Password" button in admin panel.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 3 | +193 | 0 |

**Key files created:** `supabase/admin.ts`, `/api/admin/users/[userId]/reset-password/route.ts`

---

### 37. `bdfaf8a` &mdash; 2026-02-25

**Remove browser Supabase client from auth flow to fix login on Jio ISP**

AuthContext rewritten to fetch all auth state from `/api/auth/profile` (server-side). Added `refreshAuth()` function, `visibilitychange` listener, and rejection reason support. No browser Supabase client used anywhere in auth flow.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 5 | +103 | -97 |

---

### 38. `32368fc` &mdash; 2026-02-25

**Fix JSON parse error on Kite credentials save when unauthenticated**

Middleware now returns `401 JSON` for unauthenticated API calls (was returning HTML redirect). Kite dialog has defensive JSON parsing with "Session expired" messages.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 2 | +30 | -6 |

---

### 39. `1d8c9af` &mdash; 2026-02-25

**Improve Kite credentials error messages to show actual cause**

Separated encryption errors from database errors. UI now shows actionable messages (missing encryption key vs. RLS policy failure) instead of generic errors.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 1 | +14 | -2 |

---

### 40. `d0a8b95` &mdash; 2026-02-25

**Update documentation with 16 new commits (Feb 24-25 features)**

Comprehensive documentation refresh across all 3 doc files. CHANGELOG: 16 new commit entries, updated stats. ARCHITECTURE: server-side auth proxy flow, user_profiles + kite_credentials tables, 14 new API endpoints, updated env vars and security sections. USER-GUIDE: admin approval flow, per-user Kite setup, Admin Panel section, new FAQ entries.

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 3 | +474 | -47 |

---

### 41. `718e752` &mdash; 2026-02-25

**Fix security vulnerabilities: open redirects, info leakage, weak validation**

Security hardening across 12 files after a comprehensive audit:
- **Open redirect fix**: Auth routes no longer trust user-controlled `Origin` header or `x-forwarded-host`; use `request.nextUrl.origin` exclusively
- **Information leakage**: Error messages no longer expose env var names (`SUPABASE_SERVICE_ROLE_KEY`, `KITE_CREDENTIALS_ENCRYPTION_KEY`) or raw database errors to clients
- **Password validation**: Admin reset-password API now enforces uppercase + number requirements server-side (not just client-side)
- **CSP hardening**: Removed `'unsafe-eval'` from `script-src` directive
- **Session encryption**: Kite session cookie payload encrypted with AES-256-GCM (backward-compatible with legacy sessions)
- **State transition guards**: Admin approve/reject endpoints validate current status before allowing changes
- **CSRF timing safety**: Kite OAuth callback uses `crypto.timingSafeEqual` for state comparison
- **Query safety**: Admin users list capped at 500 rows

| Files | Insertions | Deletions |
|-------|-----------|-----------|
| 12 | +91 | -26 |

---

### 42. `b0a74d4` &mdash; 2026-02-26

**Add missing SQL migrations for paper_trades & watchlist + admin RLS diagnostic endpoint**

Investigated a transient data disappearance (paper trades and watchlist returned empty with no errors). Root cause: the `paper_trades` and `watchlist` tables had no migration files, so RLS policies had no source of truth if lost. Created proper migration files matching the pattern used by `user_profiles` and `kite_credentials`, plus an admin-only diagnostic endpoint.

- **`paper_trades.sql`**: Full `CREATE TABLE IF NOT EXISTS` with 22 columns, 3 indexes, 4 RLS policies (SELECT/INSERT/UPDATE/DELETE scoped to `auth.uid() = user_id`), and auto-update `updated_at` trigger. All statements idempotent.
- **`watchlist.sql`**: Same pattern with 16 columns, `UNIQUE(user_id, symbol)` constraint, 1 index, 4 RLS policies, and auto-update trigger.
- **`GET /api/debug/tables`**: Admin-only endpoint that compares anon client (RLS-filtered) vs admin client (service-role, RLS-bypassed) query counts. Instantly reveals if RLS is blocking data access.

| Files | Insertions |
|-------|-----------:|
| 3 | +200 |

**Key files created:** `supabase/migrations/paper_trades.sql`, `supabase/migrations/watchlist.sql`, `src/app/api/debug/tables/route.ts`

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

Feb 24  [Feature]  Per-user Kite API credentials (AES-256-GCM encryption)
        [Feature]  Admin-approval registration + role-based access control
        [Fix]      RLS infinite recursion on user_profiles
        [Fix]      Admin panel visibility, CSP font-src, profile fetch
        [Fix]      Forgot password PKCE flow
        [UX]       Column sorting on all data tables
        [Fix]      Market indicator, duplicate stock removal

Feb 25  [UX]       Light theme + more pronounced indicator colors
        [Fix]      Live data reverting to demo on refresh
        [Security] Server-side auth proxy (Jio ISP DNS bypass)
        [Feature]  Admin password reset (bypasses broken email flow)
        [Infra]    Remove browser Supabase client from auth flow
        [Fix]      JSON parse error on unauthenticated API calls
        [Fix]      Kite credentials error message improvements
        [Docs]     Full documentation refresh (16 commits, 3 files)
        [Security] Open redirect fixes, info leakage, CSP hardening,
                   session encryption, timing-safe CSRF, state guards

Feb 26  [Infra]    SQL migrations for paper_trades & watchlist tables
        [Infra]    Admin RLS diagnostic endpoint (GET /api/debug/tables)
```

---

*This file is maintained with every code push. Update it by appending new commit entries at the bottom.*
