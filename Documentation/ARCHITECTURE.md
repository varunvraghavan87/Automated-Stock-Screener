# Code Architecture

> Detailed technical reference for the Nifty Velocity Alpha codebase.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| Language | TypeScript | 5.x |
| UI Library | React | 19.2.3 |
| Styling | Tailwind CSS | 4.x |
| Components | Radix UI (via shadcn/ui) | Various |
| Charts | Recharts | 3.7.0 |
| Icons | Lucide React | 0.574.0 |
| Auth & DB | Supabase (PostgreSQL) | 2.97.0 |
| Validation | Zod | 4.3.6 |
| Theming | next-themes | 0.4.6 |
| Toast | Sonner | 2.0.7 |
| Deployment | Vercel | Serverless |

---

## Directory Structure

```
auto_screener/
+-- Documentation/               # Project documentation
+-- public/                      # Static assets
+-- src/
|   +-- app/                     # Next.js App Router pages + API routes
|   |   +-- admin/               # Admin panel (user management)
|   |   +-- api/                 # 25+ REST API endpoints
|   |   |   +-- admin/           # User management (approve, reject, reset-password)
|   |   |   +-- auth/            # Server-side auth proxy (login, register, profile, etc.)
|   |   |   +-- kite/            # Zerodha Kite OAuth + credentials CRUD
|   |   |   +-- paper-trades/    # Paper trade CRUD + close
|   |   |   +-- watchlist/       # Watchlist CRUD
|   |   |   +-- prices/          # Live price updates + lock status
|   |   |   +-- screener/        # Screener execution + previous signals
|   |   |   +-- signal-performance/  # Analytics data
|   |   +-- auth/                # Auth pages (login, register, reset, callback, pending)
|   |   +-- screener/            # Screener UI page
|   |   +-- signals/             # Signal analysis page
|   |   +-- paper-trade/         # Paper trading dashboard
|   |   +-- watchlist/           # Watchlist page
|   |   +-- calculator/          # Position sizing calculator
|   |   +-- page.tsx             # Dashboard (home)
|   |   +-- layout.tsx           # Root layout
|   |   +-- globals.css          # Tailwind + custom styles
|   |
|   +-- components/              # Reusable React components
|   |   +-- layout/navbar.tsx    # Main navigation bar
|   |   +-- kite/                # KiteCredentialsDialog
|   |   +-- providers/           # Context provider wrapper
|   |   +-- trade-actions/       # PaperBuyDialog, CloseTradeDialog, WatchlistButton
|   |   +-- glossary-dialog.tsx  # Searchable glossary modal (33 terms)
|   |   +-- supabase-health-check.tsx  # Backend connectivity banner
|   |   +-- ui/                  # shadcn/ui primitives + sortable-header
|   |
|   +-- contexts/                # React Context state management
|   |   +-- AuthContext.tsx       # Server-API auth state (no browser Supabase client)
|   |   +-- ScreenerContext.tsx   # Screener results + refresh + market regime
|   |   +-- PaperTradeContext.tsx # Open/closed trades + CRUD
|   |   +-- WatchlistContext.tsx  # Watchlist items + CRUD
|   |   +-- PriceUpdateContext.tsx# Live price map + market hours flag
|   |
|   +-- hooks/                   # Custom React hooks
|   |   +-- useScreenerData.ts   # Screener context accessor
|   |   +-- usePriceUpdater.ts   # 3-minute price polling loop
|   |   +-- useSupabase.ts       # Browser Supabase client singleton
|   |   +-- useChartColors.ts    # Theme-aware chart color palette
|   |   +-- useSortable.ts       # Column sort state + comparator
|   |
|   +-- lib/                     # Core business logic (no React dependencies)
|   |   +-- screener-engine.ts   # 6-phase pipeline + scoring + signals (~500 LOC)
|   |   +-- indicators.ts        # 22+ technical indicator functions (~1200 LOC)
|   |   +-- live-data-service.ts # Kite API data aggregation (~400 LOC)
|   |   +-- portfolio-analytics.ts # Sharpe, Sortino, equity curve (~350 LOC)
|   |   +-- signal-performance.ts  # Win rates, score tiers, trends (~450 LOC)
|   |   +-- rebalancing.ts      # Exit signal detection (5 checks, ~240 LOC)
|   |   +-- kite-api.ts         # Zerodha Kite Connect wrapper (~300 LOC)
|   |   +-- kite-session.ts     # OAuth token exchange + cookie management
|   |   +-- kite-credentials.ts # AES-256-GCM encryption for per-user Kite secrets
|   |   +-- kite-lock.ts        # In-process async mutex
|   |   +-- rate-limit.ts       # Sliding-window rate limiter
|   |   +-- market-hours.ts     # IST market hours + trading day counter
|   |   +-- mock-data.ts        # Demo mode stock data (11 stocks)
|   |   +-- types.ts            # All TypeScript interfaces (~800 LOC)
|   |   +-- validation.ts       # Zod schemas + record limits
|   |   +-- utils.ts            # Currency/number formatting helpers
|   |   +-- supabase/           # Supabase client, server, middleware, admin helpers
|   |
|   +-- middleware.ts            # Rate limiting + Supabase session + Cache-Control
|
+-- next.config.ts               # Security headers + CSP
+-- package.json                 # Dependencies + scripts
+-- tsconfig.json                # TypeScript configuration
+-- .env.example                 # Environment variable template
```

---

## Architecture Patterns

### Pure Computation Modules

All business logic lives in standalone `.ts` files under `src/lib/` with zero React dependencies. Page components call these functions via `useMemo`:

```
[page.tsx] --useMemo--> [lib/module.ts] --> pure computation --> return data
```

| Module | Entry Function | Called From |
|--------|---------------|------------|
| `screener-engine.ts` | `runScreener()` | `/api/screener` (server) |
| `portfolio-analytics.ts` | `computePortfolioAnalytics()`, `computePortfolioRisk()` | `paper-trade/page.tsx` (client) |
| `signal-performance.ts` | `computeBacktestAnalytics()` | `signals/page.tsx` (client) |
| `rebalancing.ts` | `computeRebalanceAlerts()` | `paper-trade/page.tsx` (client) |

### Context Provider Architecture

Five context providers are nested in `ClientProviders`:

```
<AuthProvider>              -- Supabase user + session
  <ScreenerProvider>        -- Screener results + market regime
    <PriceUpdateProvider>   -- Live price map + market hours
      <PaperTradeProvider>  -- Open/closed trades
        <WatchlistProvider> -- Watchlist items
          {children}
        </WatchlistProvider>
      </PaperTradeProvider>
    </PriceUpdateProvider>
  </ScreenerProvider>
</AuthProvider>
```

### Server vs. Client Split

| Concern | Where | Why |
|---------|-------|-----|
| Kite API calls | Server (API routes) | API secret must not reach browser |
| Supabase auth | Server (middleware) | `getUser()` validates with server |
| Screener engine | Server (`/api/screener`) | Kite data fetched server-side |
| Portfolio analytics | Client (`useMemo`) | Operates on already-fetched trades |
| Risk dashboard | Client (`useMemo`) | Operates on already-fetched trades |
| Signal performance | Client (`useMemo`) | Operates on fetched snapshot data |
| Rebalancing | Client (`useMemo`) | Combines trades + screener results |

---

## Data Flow

### Screener Execution Flow

```
User clicks "Run Screener"
       |
ScreenerContext.refresh()
       |
POST /api/screener
       |
[Server] Acquire kiteLock (mutex)
       |
[Server] Kite API: Fetch instruments, quotes (batched x250), Nifty 50 history
       |
[Server] LiveDataService: Compute 22+ indicators per stock, aggregate weekly
       |
[Server] Screener Engine: Run 6-phase pipeline
       |    Phase 1: Liquidity filter (turnover >= 20 Cr)
       |    Phase 2: Trend establishment (EMA, ADX, MACD, SuperTrend)
       |    Phase 3: Momentum signal (RSI tiers, ROC, divergences)
       |    Phase 4: Volume confirmation (OBV, MFI, A/D Line)
       |    Phase 5: Volatility check (ATR, Bollinger)
       |    Phase 6: Risk management (SL, target, R:R)
       |
[Server] Calculate score (0-100) + assign signal
       |
[Server] Fire-and-forget: Save snapshots to Supabase
       |
[Server] Release kiteLock
       |
[Client] ScreenerContext stores results + regime + sectors
       |
[Client] SessionStorage cache (survives page reload, 30 min TTL)
       |
[Client] All pages reactively update
```

### Price Update Flow (Every 3 Minutes)

```
usePriceUpdater hook (client)
       |
isIndianMarketOpen() check (9:15 AM - 3:30 PM IST, Mon-Fri)
       |
POST /api/prices/update
       |
[Server] Acquire kiteLock (returns 503 if held)
       |
[Server] Collect symbols from: open trades + watchlist + pending signals
       |
[Server] Kite API: Fetch quotes (up to 500 symbols)
       |
[Server] Update paper_trades.current_price + watchlist.current_price
       |
[Server] Fill forward signal_snapshots prices (1d/3d/5d/10d)
       |
[Server] Release kiteLock
       |
[Client] PriceUpdateContext broadcasts new prices
       |
[Client] All components re-render with fresh prices
```

### Authentication Flow (Server-Side Auth Proxy)

All Supabase auth operations are proxied through the app's own API routes. The browser **never** contacts `supabase.co` directly. This architecture was adopted to bypass Jio ISP DNS poisoning of `*.supabase.co`.

```
[Supabase Auth — Server-Side Proxy]        [Kite Connect OAuth]

User -> /auth/login page                    User -> "Connect Kite" button
  |                                           |
Browser POST /api/auth/login               GET /api/kite/auth
  |                                           |
[Vercel] Supabase server-to-server         Generate CSRF state -> HttpOnly cookie
  |                                           |
JWT token set in sb-* cookies              Redirect -> kite.zerodha.com/connect/login
  |                                           |
Middleware: getUser() on every request     User logs into Zerodha
  |                                           |
AuthContext fetches /api/auth/profile      GET /api/kite/callback?request_token=...
  |                                           |
Protected routes accessible                Validate CSRF state
                                              |
                                           Exchange token -> SHA-256 checksum
                                              |
                                           Store access_token in kite_session cookie
                                              |
                                           Redirect -> /screener?kite_connected=true
```

**Admin-Approval Registration Flow:**

```
User -> /auth/register page
  |
Browser POST /api/auth/register
  |
[Vercel] Create Supabase auth user + user_profiles row (approval_status = 'pending')
  |
Redirect -> /auth/pending ("Your account is pending approval")
  |
Admin -> /admin panel -> Approve / Reject user
  |
User's approval_status updated -> 'approved' or 'rejected'
  |
On next login, middleware checks approval_status:
  - 'approved' -> full access
  - 'pending'  -> redirect to /auth/pending
  - 'rejected' -> redirect to /auth/pending (shows rejection reason)
```

---

## Database Schema (Supabase PostgreSQL)

### `paper_trades`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| user_id | UUID (FK) | References `auth.users.id` |
| symbol | VARCHAR(20) | e.g., "RELIANCE" |
| exchange | VARCHAR(10) | Default "NSE" |
| name | VARCHAR(255) | Company name |
| sector | VARCHAR(100) | e.g., "Banking" |
| quantity | INT | Shares bought |
| entry_price | NUMERIC | Price at entry |
| entry_date | TIMESTAMP | When trade opened |
| stop_loss | NUMERIC | Nullable |
| target_price | NUMERIC | Nullable |
| signal | VARCHAR(20) | Signal at entry time |
| overall_score | INT | 0-100 score at entry |
| current_price | NUMERIC | Last known price (auto-updated) |
| last_price_update | TIMESTAMP | When current_price was last set |
| status | ENUM | `'open'` or `'closed'` |
| exit_price | NUMERIC | Nullable (set on close) |
| exit_date | TIMESTAMP | Nullable (set on close) |
| exit_reason | VARCHAR | `'manual'`, `'stop_loss_hit'`, `'target_hit'` |
| realized_pnl | NUMERIC | `(exit - entry) * quantity` |
| notes | TEXT | User notes (max 2000 chars) |
| created_at | TIMESTAMP | Auto-set |
| updated_at | TIMESTAMP | Auto-set |

### `watchlist`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| user_id | UUID (FK) | References `auth.users.id` |
| symbol | VARCHAR(20) | Stock symbol |
| exchange | VARCHAR(10) | Default "NSE" |
| name | VARCHAR(255) | Company name |
| sector | VARCHAR(100) | Sector |
| added_price | NUMERIC | Price when added |
| current_price | NUMERIC | Last known price |
| last_price_update | TIMESTAMP | |
| target_buy | NUMERIC | User's buy target |
| target_sell | NUMERIC | User's sell target |
| signal | VARCHAR(20) | Signal when added |
| overall_score | INT | Score when added |
| notes | TEXT | User notes |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### `screener_snapshots`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| run_date | VARCHAR | ISO timestamp |
| mode | ENUM | `'live'` or `'demo'` |
| market_regime | VARCHAR | `'BULL'`, `'BEAR'`, `'SIDEWAYS'` |
| total_scanned | INT | Number of stocks processed |
| results_summary | JSONB | Signal counts + top stocks |
| created_at | TIMESTAMP | |

### `signal_snapshots`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| snapshot_id | UUID (FK) | References `screener_snapshots.id` |
| user_id | UUID (FK) | |
| symbol | VARCHAR(20) | |
| exchange | VARCHAR(10) | |
| name | VARCHAR(255) | |
| sector | VARCHAR(100) | |
| signal | VARCHAR | STRONG_BUY, BUY, WATCH, NEUTRAL, AVOID |
| score | INT | 0-100 |
| entry_price | NUMERIC | Price at signal time |
| stop_loss | NUMERIC | Computed stop loss |
| target_price | NUMERIC | Computed target |
| risk_reward | NUMERIC | R:R ratio |
| price_after_1d | NUMERIC | Filled after 1 trading day |
| price_after_3d | NUMERIC | Filled after 3 trading days |
| price_after_5d | NUMERIC | Filled after 5 trading days |
| price_after_10d | NUMERIC | Filled after 10 trading days |
| outcome | VARCHAR | `'target_hit'`, `'stopped_out'`, `'expired'`, `'pending'` |
| created_at | TIMESTAMP | |

### `user_profiles`

| Column | Type | Notes |
|--------|------|-------|
| user_id | UUID (PK, FK) | References `auth.users.id` |
| email | VARCHAR | User's email address |
| display_name | VARCHAR | User's display name |
| role | VARCHAR | `'user'` or `'admin'` (default `'user'`) |
| approval_status | VARCHAR | `'pending'`, `'approved'`, or `'rejected'` |
| rejection_reason | TEXT | Nullable (set when admin rejects) |
| created_at | TIMESTAMP | Auto-set |
| updated_at | TIMESTAMP | Auto-set |

**RLS Note:** Uses a `SECURITY DEFINER` function (`get_user_role()`) to avoid infinite recursion when RLS policies query the same table.

### `kite_credentials`

| Column | Type | Notes |
|--------|------|-------|
| user_id | UUID (PK, FK) | References `auth.users.id` |
| kite_api_key | VARCHAR | User's Kite Connect API key (plaintext) |
| kite_api_secret_encrypted | TEXT | AES-256-GCM encrypted API secret |
| created_at | TIMESTAMP | Auto-set |
| updated_at | TIMESTAMP | Auto-set |

**All tables use Row-Level Security (RLS)**: every query filters by `user_id = auth.uid()`.

---

## API Endpoint Catalog

### Auth Proxy (Server-Side)

All Supabase auth operations proxied through Vercel to bypass ISP DNS issues.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/login` | No | Email/password login via Supabase |
| POST | `/api/auth/register` | No | Create account + pending user_profile |
| POST | `/api/auth/reset-password` | No | Send password reset email |
| POST | `/api/auth/google` | No | Initiate Google OAuth via Supabase |
| POST | `/api/auth/update-password` | Yes | Set new password (reset flow) |
| POST | `/api/auth/signout` | Yes | Clear Supabase session cookies |
| GET | `/api/auth/profile` | Yes | Get user info, role, approval status |

### Admin

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/admin/users` | Admin | List all users with profiles |
| POST | `/api/admin/users/[userId]/approve` | Admin | Approve a pending user |
| POST | `/api/admin/users/[userId]/reject` | Admin | Reject a user (with reason) |
| POST | `/api/admin/users/[userId]/reset-password` | Admin | Reset user password (Supabase Admin API) |

### Kite Connect

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/kite/auth` | No | Initiate Kite OAuth + CSRF state |
| GET | `/api/kite/callback` | No | Kite OAuth callback + token exchange |
| POST | `/api/kite/logout` | Yes | Clear Kite session cookie |
| GET | `/api/kite/status` | Yes | Check if Kite connected |

### Kite Credentials (Per-User)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/kite/credentials` | Yes | Check if user has stored credentials |
| POST | `/api/kite/credentials` | Yes | Store/update API key + encrypted secret |
| DELETE | `/api/kite/credentials` | Yes | Remove stored credentials |

### Screener

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/screener` | Yes | Fetch cached results |
| POST | `/api/screener` | Yes | Run full 6-phase screener |
| GET | `/api/screener/previous-signals` | Yes | Get last run's signal map |

### Paper Trades

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/paper-trades?status=open\|closed` | Yes | List trades |
| POST | `/api/paper-trades` | Yes | Create trade |
| PATCH | `/api/paper-trades/[id]` | Yes | Update notes/SL/target |
| DELETE | `/api/paper-trades/[id]` | Yes | Delete trade |
| POST | `/api/paper-trades/[id]/close` | Yes | Close with exit price |

### Watchlist

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/watchlist` | Yes | List all items |
| POST | `/api/watchlist` | Yes | Add item |
| PATCH | `/api/watchlist/[id]` | Yes | Update targets/notes |
| DELETE | `/api/watchlist/[id]` | Yes | Remove item |

### Prices & Analytics

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/prices/update` | Yes | Fetch + update live quotes |
| GET | `/api/prices/status` | Yes | Check price update lock status |
| GET | `/api/signal-performance?days=30` | Yes | Get signal analytics |

### Rate Limits (per IP)

| Tier | Endpoints | Limit |
|------|----------|-------|
| Auth | `/auth/*`, `/api/kite/auth` | 10 req / 5 min |
| Screener | `POST /api/screener` | 2 req / 1 min |
| General | `/api/*` | 60 req / 1 min |

---

## Security Architecture

### Server-Side Auth Proxy

All Supabase auth calls are proxied through 7 API routes on the app's own Vercel domain. The browser never contacts `*.supabase.co` directly. This mitigates ISP DNS poisoning (e.g., Jio resolving Supabase domains to a sinkhole IP).

- **Middleware**: Unauthenticated requests to `/api/*` routes return `401 JSON` (not HTML redirects), preventing JSON parse errors in client code.
- **AuthContext**: Fetches user state from `/api/auth/profile` — no browser Supabase client in the auth flow.

### Credential Encryption (AES-256-GCM)

Per-user Kite API secrets are encrypted at rest using Web Crypto `AES-GCM`:
- **Key**: 256-bit key from `KITE_CREDENTIALS_ENCRYPTION_KEY` env var (64-char hex)
- **IV**: 96-bit random nonce per encryption
- **Storage**: Base64-encoded `iv + ciphertext + auth_tag` in Supabase `kite_credentials.kite_api_secret_encrypted`
- Decryption happens only server-side when a Kite API call is needed

### Admin Role-Based Access Control

- `user_profiles.role` column: `'user'` (default) or `'admin'`
- Admin API routes verify role via `user_profiles` query before processing
- `SECURITY DEFINER` function `get_user_role()` avoids RLS infinite recursion
- New users start with `approval_status = 'pending'`; admin must approve before access is granted
- Middleware redirects unapproved users to `/auth/pending`

### Headers (`next.config.ts`)

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ...`

### Input Validation (`validation.ts`)

All API inputs validated with Zod schemas using `.strict()` mode:
- String lengths bounded (symbol: 1-20, name: 1-255, notes: max 2000)
- Numeric ranges enforced (price: max 9,999,999, quantity: max 1,000,000)
- UUID format validated via regex
- Unknown properties rejected (prototype pollution prevention)

### Record Limits

| Resource | Max Count |
|----------|-----------|
| Open paper trades | 100 |
| Watchlist items | 200 |
| Price update symbols | 500 |
| Snapshots per user | 270 |
| Signals per snapshot | 50 |
| Snapshot retention | 90 days |

### Cookie Security

| Cookie | HttpOnly | Secure | SameSite | MaxAge |
|--------|----------|--------|----------|--------|
| `kite_session` | Yes | Prod only | Lax | 24h |
| `kite_oauth_state` | Yes | Prod only | Lax | 5 min |
| `kite_flash_error` | No* | Prod only | Lax | 30 sec |
| `sb-*` (Supabase) | Yes | Prod only | Lax | Session |

*Flash error cookie is non-HttpOnly so client JS can read and display it. Values are hardcoded strings (never user-controlled).

---

## Environment Variables

| Variable | Scope | Required | Purpose |
|----------|-------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Yes | Supabase public API key (RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Yes | Supabase service-role key (admin operations, password reset) |
| `KITE_CREDENTIALS_ENCRYPTION_KEY` | Server only | Yes | 64-char hex string for AES-256-GCM encryption of Kite API secrets |
| `NODE_ENV` | Server | Auto | `development` or `production` |

**Note:** Global `KITE_API_KEY` and `KITE_API_SECRET` env vars are no longer used. Each user stores their own Kite credentials via the Kite Connect Setup dialog (encrypted at rest in Supabase).

---

## Key Type Definitions (`src/lib/types.ts`)

### Core Data Types

- **`StockData`** &mdash; Stock with OHLCV, sector, turnover, price changes
- **`TechnicalIndicators`** &mdash; All 22+ computed indicator values per stock
- **`ScreenerResult`** &mdash; Full pipeline output (stock + indicators + phases + score + signal + rationale)
- **`ScreenerConfig`** &mdash; User-adjustable pipeline parameters
- **`MarketRegimeInfo`** &mdash; Bull/Bear/Sideways detection with thresholds
- **`AdaptiveThresholds`** &mdash; Regime-adjusted thresholds for all phases
- **`SectorRanking`** &mdash; Sector momentum composite score + breadth + rank

### Trading Types

- **`PaperTrade`** &mdash; Open/closed trade with entry, exit, P&L, SL, target
- **`WatchlistItem`** &mdash; Monitored stock with buy/sell targets
- **`PortfolioAnalytics`** &mdash; Sharpe, Sortino, max drawdown, win rate, profit factor
- **`PortfolioRiskMetrics`** &mdash; Portfolio heat, sector allocation, worst-case loss
- **`RebalanceResult`** &mdash; Exit signal flags per trade + summary

### Signal Types

- **`SignalChangeType`** &mdash; UPGRADED, DOWNGRADED, NEW, UNCHANGED
- **`DivergenceResult`** &mdash; Bullish/bearish RSI, MACD, OBV, MFI divergences
- **`BacktestAnalytics`** &mdash; Score-tier performance, sector performance, strategy summary
- **`ScoreTierPerformance`** &mdash; Win rate and avg returns per score bracket

---

## Deployment Notes

### Vercel Configuration

- **Runtime**: Node.js serverless functions
- **Max Duration**: 300 seconds (Vercel Pro) for screener route
- **Build Output**: ~12-15 MB optimized bundle

### Serverless Limitations

1. **`kite-lock.ts`**: In-memory mutex only works within a single process. On Vercel, concurrent requests may be routed to different instances. For high-traffic production: replace with Vercel KV (Redis).

2. **`rate-limit.ts`**: Same limitation. In-memory `Map` state doesn't persist across instances. Adequate for single-user or low-concurrency usage.

### Production Migration Path

```typescript
// Replace in-memory lock with Redis:
await kv.set("kite_lock", caller, { nx: true, ex: 300 });  // acquire
await kv.del("kite_lock");                                   // release

// Replace in-memory rate limiter with Redis:
await kv.incr(`rate:${key}`, { ex: windowSec });             // check count
```
