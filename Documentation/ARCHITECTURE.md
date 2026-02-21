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
|   |   +-- api/                 # 13 REST API endpoints
|   |   |   +-- kite/            # Zerodha Kite OAuth (auth, callback, logout, status)
|   |   |   +-- paper-trades/    # Paper trade CRUD + close
|   |   |   +-- watchlist/       # Watchlist CRUD
|   |   |   +-- prices/          # Live price updates + lock status
|   |   |   +-- screener/        # Screener execution + previous signals
|   |   |   +-- signal-performance/  # Analytics data
|   |   +-- auth/                # Authentication pages (login, register, reset, callback)
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
|   |   +-- providers/           # Context provider wrapper
|   |   +-- trade-actions/       # PaperBuyDialog, CloseTradeDialog, WatchlistButton
|   |   +-- glossary-dialog.tsx  # Searchable glossary modal (33 terms)
|   |   +-- ui/                  # shadcn/ui primitives (badge, button, card, dialog, etc.)
|   |
|   +-- contexts/                # React Context state management
|   |   +-- AuthContext.tsx       # Supabase auth state
|   |   +-- ScreenerContext.tsx   # Screener results + refresh + market regime
|   |   +-- PaperTradeContext.tsx # Open/closed trades + CRUD
|   |   +-- WatchlistContext.tsx  # Watchlist items + CRUD
|   |   +-- PriceUpdateContext.tsx# Live price map + market hours flag
|   |
|   +-- hooks/                   # Custom React hooks
|   |   +-- useScreenerData.ts   # Screener context accessor
|   |   +-- usePriceUpdater.ts   # 3-minute price polling loop
|   |   +-- useSupabase.ts       # Browser Supabase client singleton
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
|   |   +-- kite-lock.ts        # In-process async mutex
|   |   +-- rate-limit.ts       # Sliding-window rate limiter
|   |   +-- market-hours.ts     # IST market hours + trading day counter
|   |   +-- mock-data.ts        # Demo mode stock data (11 stocks)
|   |   +-- types.ts            # All TypeScript interfaces (~800 LOC)
|   |   +-- validation.ts       # Zod schemas + record limits
|   |   +-- utils.ts            # Currency/number formatting helpers
|   |   +-- supabase/           # Supabase client, server, middleware, helpers
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

### Authentication Flow

```
[Supabase Auth]                          [Kite Connect OAuth]

User -> /auth/login                      User -> "Connect Kite" button
  |                                        |
Supabase validates credentials           GET /api/kite/auth
  |                                        |
JWT token in sb-* cookies               Generate CSRF state -> HttpOnly cookie
  |                                        |
Middleware: getUser() on every request    Redirect -> kite.zerodha.com/connect/login
  |                                        |
AuthContext reads session                User logs into Zerodha
  |                                        |
Protected routes accessible              GET /api/kite/callback?request_token=...
                                           |
                                         Validate CSRF state
                                           |
                                         Exchange token -> SHA-256 checksum
                                           |
                                         Store access_token in kite_session cookie
                                           |
                                         Redirect -> /screener?kite_connected=true
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

**All tables use Row-Level Security (RLS)**: every query filters by `user_id = auth.uid()`.

---

## API Endpoint Catalog

### Authentication

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/kite/auth` | No | Initiate Kite OAuth + CSRF state |
| GET | `/api/kite/callback` | No | Kite OAuth callback + token exchange |
| POST | `/api/kite/logout` | Yes | Clear Kite session cookie |
| GET | `/api/kite/status` | Yes | Check if Kite connected |

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
| `KITE_API_KEY` | Server only | Yes | Zerodha Kite API key (public identifier) |
| `KITE_API_SECRET` | Server only | Yes | Zerodha Kite API secret (private) |
| `NODE_ENV` | Server | Auto | `development` or `production` |

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
