# User Guide

> A complete walkthrough of Nifty Velocity Alpha for first-time users. Covers every page, common workflows, and tips for smarter momentum trading.

---

## Table of Contents

1. [What Is This App?](#what-is-this-app)
2. [Getting Started](#getting-started)
3. [Connecting to Live Market Data](#connecting-to-live-market-data)
4. [Dashboard](#dashboard)
5. [Screener](#screener)
6. [Signals](#signals)
7. [Paper Trade](#paper-trade)
8. [Watchlist](#watchlist)
9. [Position Size Calculator](#position-size-calculator)
10. [Admin Panel](#admin-panel)
11. [Glossary](#glossary)
12. [Typical Daily Workflow](#typical-daily-workflow)
13. [Tips for Better Trading](#tips-for-better-trading)
14. [Frequently Asked Questions](#frequently-asked-questions)

---

## What Is This App?

Nifty Velocity Alpha is an automated **momentum stock screener** built for the Indian equity market. It scans all ~500 stocks in the Nifty 500 index, runs them through a 6-phase technical analysis pipeline, and ranks them by momentum quality.

### What It Does

- Scores every stock from 0 to 100 based on trend, momentum, volume, and volatility
- Assigns a signal: **STRONG_BUY**, **BUY**, **WATCH**, **NEUTRAL**, or **AVOID**
- Calculates entry price, stop-loss, and target for actionable signals
- Tracks your paper trades and watchlist with live price updates
- Monitors open positions for exit signals (trend breaks, stop-loss breaches, signal downgrades)

### What It Does NOT Do

- It does **not** place real orders. All trading is simulated (paper trading).
- It does **not** guarantee profits. Signals are probabilistic, not certainties.
- It is **not** intraday. The screener is designed for swing trading (holding 3-20 days).

---

## Getting Started

### 1. Create an Account

Visit the app and sign up with your email address or Google account.

> **Admin Approval Required:** After registration, your account will be in **"pending approval"** status. An administrator must approve your account before you can access the app. You'll see a "Pending Approval" page until this happens. If your account is rejected, you'll see the rejection reason on this page.

### 2. Explore in Demo Mode

Once approved, the app works immediately in **Demo Mode** using sample market data. This lets you explore every feature without connecting to a broker. You'll see a "DEMO" badge in the header when using sample data.

### 3. Set Up Your Kite API Credentials

To use live market data, you'll need to save your own Zerodha Kite Connect API credentials. See the [Connecting to Live Data](#connecting-to-live-market-data) section below.

### 4. Choose Your Theme

The app supports both **light** and **dark** themes. Use the theme toggle (sun/moon icon) in the navigation bar to switch between them. Your preference is saved automatically.

---

## Connecting to Live Market Data

The screener fetches real-time and historical price data from Zerodha's Kite Connect API. Each user stores their own API credentials.

### Prerequisites

- An active Zerodha trading account
- A Kite Connect developer app at [developers.kite.trade](https://developers.kite.trade)

### Step 1: Save Your Kite API Credentials

1. Create a Kite Connect app at [developers.kite.trade](https://developers.kite.trade)
2. Set the **Redirect URL** in your Kite app to: `https://your-app-domain.com/api/kite/callback`
3. Click the **key icon** (Kite Connect Setup) in the navigation bar
4. Enter your **API Key** and **API Secret** from the Kite developer portal
5. Click **Save Credentials**

Your API secret is encrypted (AES-256-GCM) before being stored. You only need to do this once — credentials persist across sessions.

### Step 2: Connect to Kite

1. Go to the **Screener** page
2. Click the **Connect Kite** button in the Kite Connect panel
3. You'll be redirected to Zerodha's login page
4. Enter your Zerodha credentials and complete 2FA
5. Authorize the app to access your market data
6. You'll be redirected back with a **LIVE** badge showing in the header

### Managing Credentials

To view, update, or remove your credentials, click the **key icon** in the navigation bar. You'll see your masked API key and can update or delete your credentials.

### Important Notes

- Kite sessions expire daily at **6:00 AM IST**. You'll need to reconnect each morning.
- The app only reads market data. It **never** places orders or accesses your funds.
- If Kite is disconnected, the app falls back to Demo mode automatically.
- A green "MARKET OPEN" badge appears in the navbar during NSE trading hours (9:15 AM - 3:30 PM IST, Mon-Fri).

---

## Dashboard

The Dashboard is your home screen. It shows a high-level summary of the latest screener results.

### What You'll See

**Market Regime Banner** (top)
A colored banner showing the current market condition:
- **BULL** (green): Nifty is trending up. The screener uses more lenient filters.
- **BEAR** (red): Nifty is trending down. Filters are tightened to reduce false signals.
- **SIDEWAYS** (amber): No clear trend. Moderate filter settings.

The banner also displays Nifty 50 price, VIX level, and key EMA values.

**Signal Summary Cards**
Four cards showing how many stocks received each signal type:
- STRONG_BUY count
- BUY count
- WATCH count
- Total stocks scanned

**Top Momentum Pick**
A highlighted card for the highest-scoring stock, showing its entry price, stop-loss, target, and a visual momentum score bar.

**Screening Pipeline**
Six cards explaining each phase of the screener. Click **Learn More** on any card to see what indicators it uses and what a stock needs to pass.

**Top 10 Results Table**
A quick-reference table of the best stocks. Each row shows the symbol, price, daily change, signal badge, momentum score, key indicators (RSI, ADX), and which phases it passed. You can add stocks to your watchlist or initiate a paper trade directly from here.

### Actions You Can Take

| Action | How |
|--------|-----|
| Refresh data | Click the **Refresh Data** button |
| Add to watchlist | Click the star icon on any stock row |
| Paper-buy a stock | Click the shopping cart icon on any stock row |
| See full results | Click **View Full Results** to go to the Screener page |

---

## Screener

The Screener is the core of the app. It shows every scanned stock with full technical analysis details.

### Layout

**Header Bar**: Shows LIVE/DEMO status, last scan time, and buttons for Refresh and Config.

**Search & Filter**: A search bar lets you find stocks by symbol, company name, or sector. Filter buttons let you show only stocks with a specific signal (STRONG_BUY, BUY, WATCH, NEUTRAL, AVOID, or All).

**Stock Cards**: Each stock is displayed as an expandable card showing:
- Circular score indicator (color-coded by signal)
- Stock symbol, company name, sector
- Current price and daily change percentage
- Signal badge with optional upgrade/downgrade/NEW markers
- Six phase-pass dots (filled = passed, empty = failed)
- Action buttons (Buy, Watchlist)

### Expanding a Stock Card

Click the chevron arrow to expand a stock card. Three tabs appear:

**Analysis Tab**
- Phase-by-phase results: which phases passed or failed, with reasons
- Sector rotation context: whether the stock's sector is in a top, middle, or bottom momentum tier
- Rationale: a plain-English explanation of why the stock received its score

**Indicators Tab**
- 25+ technical indicator cards showing current values
- Each card is color-coded: green (bullish), red (bearish), grey (neutral)
- Hover over the info icon on any card to see an educational tooltip explaining what the indicator measures

**Trade Setup Tab**
- Entry Price (current market price)
- Stop Loss (calculated as Entry minus 1.5x ATR)
- Target Price (calculated using the risk:reward ratio)
- Risk:Reward ratio

### Strategy Presets

Above the configuration panel, four strategy presets let you quickly adjust all parameters:

| Preset | Style | Key Characteristics |
|--------|-------|-------------------|
| **Balanced** | Default | Middle-ground settings for most markets |
| **Indian Favourite** | SuperTrend-based | Requires SuperTrend UP + Bollinger expansion. Popular in Indian TA circles |
| **Multi-Signal** | High confirmation | Higher ADX minimum (28), requires MACD, tighter volume/MFI filters |
| **Conservative** | Risk-averse | Strictest criteria. ADX 30+, tight RSI (50-65), 2.5:1 minimum R:R |

Selecting a preset loads its parameter values. You can further customize individual parameters after selecting a preset.

### Configuration Panel

Click the gear icon to expand the full configuration panel. You can adjust:

- **Phase 1**: Minimum daily turnover
- **Phase 2**: Minimum ADX, SuperTrend/MACD requirements
- **Phase 3**: RSI range, minimum momentum conditions
- **Phase 4**: Volume multiplier, MFI range
- **Phase 5**: Maximum ATR percentage, Bollinger requirements
- **Phase 6**: Minimum risk:reward ratio, maximum capital risk

Click **Reset Defaults** to return all parameters to the Balanced preset.

### Signal Change Badges

If the screener has been run at least twice, stocks may show change indicators next to their signal badge:
- **Up Upgraded** (green): Signal improved since last scan (e.g., WATCH to BUY)
- **Down Downgraded** (red): Signal weakened since last scan (e.g., BUY to WATCH)
- **NEW** (blue): Stock wasn't in the previous scan's results

---

## Signals

The Signals page provides deeper analysis of signal distribution, sector performance, and historical accuracy.

### Tabs

**Overview Tab**
- **Signal Distribution**: Donut chart showing how many stocks fall into each signal category
- **Sector Analysis**: Horizontal bar chart showing signal counts per sector
- **Sector Rotation Rankings**: Table ranking all sectors by momentum composite score (weighted blend of 3-month relative strength, breadth, and weekly change). Sectors marked "Top" give their stocks a +5 scoring bonus; "Bottom" sectors apply a -5 penalty.

**Top Picks Tab**
- **Price Chart**: 90-day price history for the highest-scoring stock
- **Momentum Radar**: A 10-axis radar chart showing the top pick's strength across RSI, Trend, EMA Alignment, MACD, OBV, Stochastic, Bollinger, Risk:Reward, Weekly Trend, and Divergence
- **Actionable Signals Table**: All BUY and STRONG_BUY stocks with entry, stop-loss, target, and risk:reward

**Pipeline Tab**
- **Phase Pass Rates**: Bar chart showing what percentage of stocks pass each of the 6 phases
- **Daily Workflow**: A timeline showing the recommended daily analysis sequence

**Performance Tab** (requires multiple screener runs with price data)
- **Period Selector**: View performance over 7, 30, or 90 days
- **Metric Cards**: Total signals generated, win rate, target hit rate, stopped-out rate, screener runs
- **Strategy Summary**: Natural-language verdict (Promising, Mixed, Underperforming, Needs More Data) with confidence level based on sample size
- **Win Rate by Signal**: How often STRONG_BUY vs BUY signals hit their targets
- **Hit Rate Breakdown**: Donut chart of Target Hit / Stopped Out / Expired outcomes
- **Average Return by Period**: Grouped bar chart showing 1-day, 3-day, 5-day, and 10-day average returns by signal type
- **Score-Tier Performance**: Do higher scores actually perform better? This chart and table break down returns by score range (75+, 55-74, 35-54, below 35)
- **Accuracy Trend**: Weekly win rate over time
- **Sector Performance**: Which sectors produce the best-performing signals
- **Best & Worst Signals**: The individual signals with the highest and lowest returns

---

## Paper Trade

Paper Trading lets you simulate buying and selling stocks without risking real money. Prices update automatically every 3 minutes during market hours.

### Portfolio Summary

Four cards at the top show:
- **Invested**: Total capital deployed across open positions
- **Current Value**: Live market value of open positions
- **Unrealized P&L**: Profit/loss on positions you still hold
- **Realized P&L**: Profit/loss from trades you've closed

### Tabs

**Open Positions Tab**

Each open position shows:
- Stock symbol, name, and sector
- Quantity, entry price, and current price
- Profit/loss in rupees and percentage (green for profit, red for loss)
- Stop-loss level
- **Rebalancing flags** (if screener data is available):
  - Red badges (Critical): Stop Loss Breached, Trend Broken, Signal downgraded to AVOID
  - Amber badges (Warning): Signal Downgraded, Extended Hold (>20 days with negative P&L), Bearish Divergence

A **Rebalancing Summary** alert appears at the top when any positions are flagged, showing total flagged count and severity breakdown.

**How to close a trade**: Click the X button on any position. Enter the exit price and reason in the dialog that appears.

**Closed Trades Tab**

A table of all completed trades showing symbol, quantity, entry price, exit price, P&L, and exit reason.

**Analytics Tab**

Requires at least some trading history:

*Portfolio Risk Section* (from open positions):
- 6 risk metric cards: Portfolio Heat, Worst-Case Loss, Avg Risk:Reward, Positions at Risk, Max Sector Exposure, Open Positions count
- Sector allocation donut chart
- Risk checklist with green/red status indicators

*Performance Metrics* (from closed trades):
- 10 metric cards: Sharpe Ratio, Sortino Ratio, Max Drawdown, Profit Factor, Win Rate, Avg Win, Avg Loss, Consecutive Wins/Losses, Avg Hold Duration
- Equity curve chart showing portfolio value over time
- Drawdown chart showing peak-to-trough declines
- Monthly returns heatmap
- Win rate breakdown by signal type and sector

### How to Place a Paper Trade

1. Find a stock on the **Dashboard**, **Screener**, or **Watchlist** page
2. Click the shopping cart (Buy) icon
3. A dialog opens pre-filled with the stock's current price and screener-recommended stop-loss/target
4. Adjust quantity, stop-loss, and target if desired
5. Click **Confirm** to open the position

---

## Watchlist

The Watchlist lets you monitor stocks you're interested in without committing to a trade.

### Adding Stocks

Click the star icon next to any stock on the Dashboard or Screener page. The stock is saved with its current price as the "Added Price."

### Watchlist Features

Each watchlist entry shows:
- Stock symbol and name
- Signal badge (from the latest screener run)
- Price when added vs. current price
- Change since added (amount and percentage)
- Buy Target and Sell Target fields

### Setting Price Targets

1. Click the **Edit** (pencil) icon on any watchlist item
2. Enter your desired Buy Target and/or Sell Target prices
3. Click **Save**

These targets are for your reference. The app does not auto-execute trades when targets are hit.

### Actions

| Action | How |
|--------|-----|
| Edit targets | Click the pencil icon, enter prices, click Save |
| Buy the stock | Click the shopping cart icon (opens Paper Buy dialog) |
| Remove from watchlist | Click the trash icon |

---

## Position Size Calculator

The Calculator helps you determine how many shares to buy based on your risk tolerance. It implements the standard risk-per-trade model used by professional traders.

### Input Fields

| Field | Description | Recommended |
|-------|-------------|-------------|
| **Account Equity** | Your total trading capital in rupees | Your actual account size |
| **Risk Per Trade** | Maximum percentage of capital to risk on one trade | 1.0% - 2.0% |
| **Entry Price** | Price at which you plan to buy | Current market price |
| **Stop Loss** | Price at which you'll exit if the trade goes wrong | 1.5x ATR below entry |
| **Max Capital Per Trade** | Maximum percentage of capital in a single position | 10% - 20% |

### Output

**Calculated Position**:
- Number of shares to buy
- Total position value
- Target price (at 2:1 risk:reward)
- Risk per share
- Capital usage percentage (with progress bar)

**P&L Projection**:
- Maximum profit if target is hit
- Maximum loss if stop-loss is triggered

**Risk Controls** (4 checks):
- Trade Risk: Is the loss within 1.5% of equity?
- Capital Exposure: Is the position capped at max allocation?
- Risk:Reward: Is the ratio at least 2:1?
- Trailing Stop: Recommends moving stop to breakeven at +5%, then tracking 20 EMA

### Quick Example

If you have Rs 5,00,000 in capital and risk 1% per trade:
- Max loss per trade = Rs 5,000
- If Entry = Rs 1,000 and Stop Loss = Rs 960, Risk Per Share = Rs 40
- Position Size = 5,000 / 40 = **125 shares**
- Position Value = Rs 1,25,000 (25% of capital)
- If Max Capital is 20%, position is capped at Rs 1,00,000 = **100 shares**

---

## Admin Panel

The Admin Panel is accessible only to users with the **admin** role. It provides tools for managing user accounts.

### Accessing the Panel

Click **Admin** in the navigation bar (visible only to admin users). The panel is located at `/admin`.

### Features

**User Management Table**

A table listing all registered users with:
- Email address and display name
- Role (`user` or `admin`)
- Approval status (`pending`, `approved`, `rejected`)
- Registration date

**Actions (per user)**

| Action | Description |
|--------|-------------|
| **Approve** | Grant access to a pending user. Changes status to `approved`. |
| **Reject** | Deny access to a pending user. Optionally provide a rejection reason visible to the user. |
| **Reset Password** | Set a new password for any non-admin user. Uses Supabase Admin API to bypass broken email flows. Requires a password with 8+ characters, one uppercase letter, and one number. |

**Filtering**

Use the status filter buttons (All, Pending, Approved, Rejected) to quickly find users by their approval status.

---

## Glossary

Click the **?** (help) icon in the navigation bar to open the searchable glossary. It contains 33 terms covering:

- **General concepts**: Overbought, Oversold, Divergence, Breakout, Support, Resistance
- **Indicators**: EMA, RSI, MACD, ADX, ATR, Bollinger Bands, SuperTrend, OBV, MFI, and more
- **Risk management**: Stop Loss, Risk:Reward Ratio, Position Sizing
- **Strategy**: Market Regime, Sector Rotation

Use the search bar to find specific terms or browse by category.

---

## Typical Daily Workflow

### Morning Routine (9:00 - 9:15 AM)

1. **Connect Kite**: Open the Screener page and click Connect Kite. Complete the Zerodha login.
2. **Check Market Regime**: Look at the regime banner on the Dashboard. A BULL market means the screener will surface more opportunities; BEAR markets will show fewer, higher-quality signals.

### After Market Open (9:30 - 10:00 AM)

3. **Run the Screener**: Click Refresh Data. Wait for the scan to complete (takes 1-2 minutes for 500 stocks with live data).
4. **Review STRONG_BUY Signals**: Filter by STRONG_BUY on the Screener page. Expand each stock to review the Analysis and Trade Setup tabs.
5. **Check for Upgrades**: Look for green "Upgraded" badges. A stock that moved from WATCH to BUY or BUY to STRONG_BUY may be gaining momentum.

### Trade Management (10:00 AM onwards)

6. **Check Open Positions**: Go to Paper Trade. Look for red/amber rebalancing badges.
7. **Act on Critical Flags**: If a position shows "Stop Loss Breached" or "Trend Broken," consider closing it.
8. **Review Watchlist**: Check if any watchlisted stocks have reached your buy targets.
9. **Size New Positions**: Use the Calculator before entering any trade. Never risk more than 1-2% per trade.

### End of Day (3:30 PM)

10. **Run Final Scan**: Refresh the screener after market close for clean closing prices.
11. **Update Watchlist**: Add promising WATCH stocks. Remove stocks that have fallen to AVOID.
12. **Review Analytics**: Check the Paper Trade Analytics tab weekly to track your performance.

---

## Tips for Better Trading

### Signal Quality

1. **STRONG_BUY is not a guarantee.** It means the stock passed all technical filters with a high score. Markets can still move against you.
2. **Prefer stocks with aligned weekly trends.** The "ALIGNED" weekly trend badge means daily and weekly timeframes agree. These signals are more reliable.
3. **Watch for bearish divergences.** Even a STRONG_BUY stock with a bearish RSI or MACD divergence deserves caution. Divergences often precede reversals.
4. **Higher scores correlate with better outcomes, but sample size matters.** Check the Score-Tier Performance chart in the Signals Performance tab to see if this holds for recent data.

### Risk Management

5. **Never skip the stop-loss.** The screener calculates stops using 1.5x ATR (Average True Range). This gives the trade room to breathe while capping losses.
6. **Risk 1% per trade, maximum 2%.** This means if you have Rs 5,00,000 in capital, your maximum loss on any single trade should be Rs 5,000 to Rs 10,000.
7. **Don't put more than 20% of capital in one stock.** Even the best signal can fail. Diversification protects your portfolio.
8. **Monitor portfolio heat.** The Portfolio Risk section in Analytics shows your total risk across all positions. Keep it below 20%.

### Market Regime Awareness

9. **Trade fewer stocks in BEAR markets.** The screener automatically tightens filters, but you should also be more selective. Focus only on STRONG_BUY signals.
10. **SIDEWAYS markets produce more false signals.** ADX below 20 means no clear trend. Consider reducing position sizes.
11. **BULL markets favor trend-following.** In bull markets, even BUY signals have higher hit rates. Consider widening your watchlist.

### Sector Rotation

12. **Favour stocks in top-ranked sectors.** The Sector Rotation Rankings on the Signals page show which sectors have the strongest momentum. Stocks in top sectors get a +5 scoring bonus for good reason.
13. **Avoid bottom-ranked sectors.** Even if an individual stock scores well, sector headwinds can drag it down.

### Continuous Improvement

14. **Run the screener consistently.** The Performance tab needs multiple data points to show meaningful trends. Daily scans build a richer performance history.
15. **Review weekly performance.** Check the Accuracy Trend chart every weekend to see if win rates are improving or declining.
16. **Experiment with presets.** Try the Conservative preset during volatile markets. Switch to Multi-Signal when you want fewer but higher-conviction trades.

---

## Frequently Asked Questions

### General

**Q: Is this a real trading platform?**
A: No. Nifty Velocity Alpha is a screening and analysis tool. Paper trades are simulated. You cannot place real orders through this app.

**Q: Do I need a Zerodha account?**
A: No. The app works in Demo mode with sample data. A Zerodha Kite account is only needed for live NSE market data.

**Q: How often should I run the screener?**
A: Once daily, ideally after market close (3:30 PM) for the cleanest closing prices. You can also run it during market hours for intraday snapshots.

**Q: Can I use this for intraday trading?**
A: The screener is designed for swing trading (3-20 day holding period). Intraday signals would require different indicators and timeframes.

### Accounts & Access

**Q: My account is pending approval. What do I do?**
A: After registration, an administrator must approve your account before you can access the app. Contact your admin if approval is taking a long time. You'll see a "Pending Approval" page until your account is approved.

**Q: My account was rejected. Can I re-register?**
A: If your account was rejected, you'll see the reason on the pending page. Contact your administrator to discuss re-approval.

**Q: How do I set up my own Kite API credentials?**
A: Click the key icon in the navigation bar to open the **Kite Connect Setup** dialog. Create a Kite Connect app at [developers.kite.trade](https://developers.kite.trade), set the redirect URL, then enter your API Key and API Secret. Your secret is encrypted before storage.

### Data & Connectivity

**Q: Why does it say "DEMO" instead of "LIVE"?**
A: Your Kite session is not connected or has expired. Go to the Screener page and click Connect Kite to authenticate. Kite sessions expire daily at 6:00 AM IST.

**Q: I'm getting a "Failed to fetch" error on login.**
A: This can happen if your ISP (e.g., Jio) blocks Supabase domains. The app uses server-side proxying to work around this automatically. Try clearing your browser cache and reloading. If the issue persists, check the Supabase health-check banner on the login page.

**Q: The screener is taking a long time. Is it stuck?**
A: Scanning 500 stocks with full historical data can take 1-2 minutes. The app processes stocks in batches to stay within API rate limits. If it takes more than 3 minutes, try refreshing the page and reconnecting Kite.

**Q: Why do some stocks show "N/A" for indicators?**
A: Some indicators require sufficient historical data (e.g., 200-day EMA needs 200+ trading days). Recently listed stocks may not have enough history.

**Q: My Kite connection keeps disconnecting. Why?**
A: Zerodha Kite sessions are valid for one calendar day and expire at 6:00 AM IST. This is a Kite API design. You need to reconnect each trading day.

### Signals & Scoring

**Q: What does the momentum score (0-100) actually measure?**
A: The score is a composite of 5 dimensions: trend establishment (EMA alignment, ADX), momentum quality (RSI, MACD, ROC), volume confirmation (OBV, MFI), volatility (ATR, Bollinger), and bonus factors (sector rotation, relative strength). Higher scores mean more indicators agree that the stock has strong, well-supported upward momentum.

**Q: Why did a STRONG_BUY stock drop in price?**
A: Signals are probabilistic. A STRONG_BUY means the stock passed all technical filters at the time of scanning. Markets are influenced by news, global events, and factors beyond technical analysis. Always use stop-losses.

**Q: What's the difference between BUY and STRONG_BUY?**
A: STRONG_BUY stocks passed all 6 phases including volume confirmation AND scored above the threshold (75 in bull markets, 85 in bear markets). BUY stocks passed phases 1-3 (trend + momentum) but may lack volume confirmation or scored slightly lower.

**Q: Should I only trade STRONG_BUY signals?**
A: In bear or sideways markets, restricting to STRONG_BUY is prudent. In bull markets, BUY signals also have reasonable hit rates. Check the Score-Tier Performance chart for historical data.

**Q: What does "Upgraded" or "Downgraded" mean on a stock?**
A: The screener compares current signals to the previous scan. "Upgraded" means the signal improved (e.g., WATCH to BUY). "Downgraded" means it weakened. These transitions often signal momentum shifts worth attention.

### Paper Trading

**Q: Is the paper trade P&L accurate?**
A: P&L is calculated using real-time prices when Kite is connected. In Demo mode, prices are static samples and P&L won't update.

**Q: What do the red and amber badges on my positions mean?**
A: These are **rebalancing alerts** from the exit signal system:
- **Red (Critical)**: Immediate attention needed. Stop-loss breached, trend broken, or signal downgraded to AVOID.
- **Amber (Warning)**: Review recommended. Signal downgraded, extended hold with negative P&L, or bearish divergence detected.

**Q: How long should I hold a position?**
A: The screener is designed for swing trades lasting 3-20 trading days. If a position has been open for more than 20 days with a negative P&L, the "Extended Hold" warning flag will appear.

**Q: Can I delete a paper trade?**
A: Yes. Click the trash icon on any open position. This permanently removes the trade without recording it as a closed trade in your analytics.

### Risk Management

**Q: What is "Portfolio Heat"?**
A: Portfolio Heat measures your total capital at risk across all open positions. It sums up (Quantity x Risk Per Share) for every position and expresses it as a percentage of your starting capital. Keep it below 20%.

**Q: Why does the calculator sometimes cap my position size?**
A: If the calculated position would exceed your Max Capital Per Trade setting (default 20%), the calculator reduces the number of shares to stay within that limit. This prevents over-concentration in a single stock.

**Q: What stop-loss method does the screener use?**
A: Stop-loss is calculated as Entry Price minus (1.5 x ATR). ATR (Average True Range) measures daily price volatility, so the stop automatically adapts to each stock's typical movement range.

---

*This guide is current as of commit `718e752` (2026-02-25). For technical details, see ARCHITECTURE.md. For screening methodology, see SCREENING-LOGIC.md.*
