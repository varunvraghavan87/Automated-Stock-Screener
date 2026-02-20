/**
 * Portfolio Analytics — Pure computation functions for paper trade analysis.
 *
 * All functions are pure (no React, no side effects).
 * Single entry point: computePortfolioAnalytics(closedTrades)
 */

import type {
  PaperTrade,
  PortfolioAnalytics,
  EquityCurvePoint,
  MonthlyReturn,
  WinRateByGroup,
} from "./types";

// ---- Constants ----

const INITIAL_CAPITAL = 100_000; // ₹1L starting equity for curve
const TRADING_DAYS_PER_YEAR = 252;
const MIN_TRADES_FOR_RATIOS = 3;

// ---- Internal Helpers ----

/** Difference in calendar days between two ISO date strings */
function daysBetween(startISO: string, endISO: string): number {
  const msPerDay = 86_400_000;
  const start = new Date(startISO);
  const end = new Date(endISO);
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

/** Mean of a number array. Returns 0 for empty arrays. */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Population standard deviation */
function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Downside deviation — standard Sortino calculation.
 * Uses the full sample mean as the MAR (Minimum Acceptable Return).
 * Squares only negative deviations, divides by total N.
 */
function downsideDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const downsideVariance =
    values.reduce((s, v) => s + Math.min(v - m, 0) ** 2, 0) / values.length;
  return Math.sqrt(downsideVariance);
}

// ---- Core Computation Functions ----

/**
 * Build the equity curve from sorted closed trades.
 * Accumulates realized P&L starting from INITIAL_CAPITAL.
 * Tracks running peak for drawdown calculation.
 */
function buildEquityCurve(sortedTrades: PaperTrade[]): EquityCurvePoint[] {
  const curve: EquityCurvePoint[] = [];
  let equity = INITIAL_CAPITAL;
  let peak = INITIAL_CAPITAL;

  for (const trade of sortedTrades) {
    equity += trade.realizedPnl ?? 0;
    if (equity > peak) peak = equity;

    const drawdownAbs = equity - peak; // negative or zero
    const drawdown = peak > 0 ? (drawdownAbs / peak) * 100 : 0;

    curve.push({
      date: trade.exitDate!,
      equity,
      drawdown, // e.g., -5.2
      drawdownAbs, // e.g., -5200
    });
  }

  return curve;
}

/**
 * Compute sequential returns between equity curve points.
 * Returns array of decimal returns (e.g., 0.02 for 2%).
 */
function computeDailyReturns(curve: EquityCurvePoint[]): number[] {
  if (curve.length < 2) return [];

  const returns: number[] = [];
  // First point: return from initial capital
  returns.push((curve[0].equity - INITIAL_CAPITAL) / INITIAL_CAPITAL);
  // Subsequent points: return from previous point
  for (let i = 1; i < curve.length; i++) {
    const prevEquity = curve[i - 1].equity;
    if (prevEquity !== 0) {
      returns.push((curve[i].equity - prevEquity) / prevEquity);
    }
  }
  return returns;
}

/**
 * Group closed trades by year-month of exit date.
 * Computes % returns using the equity at the start of each month.
 */
function computeMonthlyReturns(
  sortedTrades: PaperTrade[],
  equityCurve: EquityCurvePoint[]
): MonthlyReturn[] {
  const monthMap = new Map<string, { pnl: number; count: number }>();

  for (const trade of sortedTrades) {
    const d = new Date(trade.exitDate!);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const existing = monthMap.get(key) ?? { pnl: 0, count: 0 };
    existing.pnl += trade.realizedPnl ?? 0;
    existing.count += 1;
    monthMap.set(key, existing);
  }

  // Build equity-at-start-of-month from curve.
  // For each month, use the equity at the last point of the PREVIOUS month.
  const equityByMonth = new Map<string, number>();
  let lastEquity = INITIAL_CAPITAL;
  let lastKey = "";
  for (const point of equityCurve) {
    const d = new Date(point.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (key !== lastKey) {
      equityByMonth.set(key, lastEquity); // equity BEFORE this month's trades
      lastKey = key;
    }
    lastEquity = point.equity;
  }

  const results: MonthlyReturn[] = [];
  for (const [key, data] of monthMap.entries()) {
    const [yearStr, monthStr] = key.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const startEquity = equityByMonth.get(key) ?? INITIAL_CAPITAL;
    results.push({
      year,
      month,
      pnl: data.pnl,
      returnPercent: startEquity > 0 ? (data.pnl / startEquity) * 100 : 0,
      tradeCount: data.count,
    });
  }

  results.sort((a, b) => a.year - b.year || a.month - b.month);
  return results;
}

/**
 * Group trades by a string field (signal or sector) and compute win rate.
 * Returns sorted by win rate descending.
 */
function computeWinRateByField(
  trades: PaperTrade[],
  field: "signal" | "sector"
): WinRateByGroup[] {
  const groups = new Map<
    string,
    { wins: number; losses: number; total: number; totalPnl: number }
  >();

  for (const trade of trades) {
    const groupKey = (trade[field] ?? "Unknown") as string;
    const existing = groups.get(groupKey) ?? {
      wins: 0,
      losses: 0,
      total: 0,
      totalPnl: 0,
    };
    existing.total += 1;
    const pnl = trade.realizedPnl ?? 0;
    existing.totalPnl += pnl;
    if (pnl > 0) existing.wins += 1;
    else existing.losses += 1;
    groups.set(groupKey, existing);
  }

  return Array.from(groups.entries())
    .map(([group, data]) => ({
      group,
      wins: data.wins,
      losses: data.losses,
      total: data.total,
      winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
      totalPnl: data.totalPnl,
    }))
    .sort((a, b) => b.winRate - a.winRate);
}

/**
 * Count max consecutive wins and losses.
 * Trades MUST be pre-sorted by exit date.
 */
function computeConsecutiveStreaks(
  sortedTrades: PaperTrade[]
): { maxWins: number; maxLosses: number } {
  let maxWins = 0;
  let maxLosses = 0;
  let currentWins = 0;
  let currentLosses = 0;

  for (const trade of sortedTrades) {
    if ((trade.realizedPnl ?? 0) > 0) {
      currentWins += 1;
      currentLosses = 0;
      maxWins = Math.max(maxWins, currentWins);
    } else {
      currentLosses += 1;
      currentWins = 0;
      maxLosses = Math.max(maxLosses, currentLosses);
    }
  }

  return { maxWins, maxLosses };
}

// ---- Main Entry Point ----

/**
 * Compute all portfolio analytics from closed trades.
 * This is the single entry point called from the page via useMemo.
 */
export function computePortfolioAnalytics(
  closedTrades: PaperTrade[]
): PortfolioAnalytics {
  // Filter to only trades with exitDate and sort by exit date ascending
  const sorted = closedTrades
    .filter((t) => t.exitDate != null)
    .sort(
      (a, b) =>
        new Date(a.exitDate!).getTime() - new Date(b.exitDate!).getTime()
    );

  const totalTrades = sorted.length;

  // --- Win/Loss basics ---
  const wins = sorted.filter((t) => (t.realizedPnl ?? 0) > 0);
  const losses = sorted.filter((t) => (t.realizedPnl ?? 0) <= 0);
  const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;

  // --- Average Win / Loss ---
  const avgWin =
    wins.length > 0 ? mean(wins.map((t) => t.realizedPnl!)) : null;
  const avgLoss =
    losses.length > 0 ? mean(losses.map((t) => t.realizedPnl!)) : null;

  // --- Profit Factor ---
  const totalWinPnl = wins.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
  const totalLossPnl = Math.abs(
    losses.reduce((s, t) => s + (t.realizedPnl ?? 0), 0)
  );
  const profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : null;

  // --- Consecutive Streaks ---
  const { maxWins, maxLosses } = computeConsecutiveStreaks(sorted);

  // --- Average Holding Period ---
  const holdingDays = sorted
    .filter((t) => t.entryDate && t.exitDate)
    .map((t) => daysBetween(t.entryDate, t.exitDate!));
  const avgHoldingPeriodDays =
    holdingDays.length > 0 ? mean(holdingDays) : null;

  // --- Equity Curve ---
  const equityCurve = buildEquityCurve(sorted);

  // --- Max Drawdown ---
  let maxDrawdown: number | null = null;
  let maxDrawdownAbs: number | null = null;
  if (equityCurve.length > 0) {
    maxDrawdown = Math.min(...equityCurve.map((p) => p.drawdown));
    maxDrawdownAbs = Math.min(...equityCurve.map((p) => p.drawdownAbs));
  }

  // --- Sharpe Ratio ---
  const dailyReturns = computeDailyReturns(equityCurve);
  let sharpeRatio: number | null = null;
  if (dailyReturns.length >= MIN_TRADES_FOR_RATIOS) {
    const sd = stddev(dailyReturns);
    if (sd > 0) {
      sharpeRatio =
        (mean(dailyReturns) / sd) * Math.sqrt(TRADING_DAYS_PER_YEAR);
    }
  }

  // --- Sortino Ratio ---
  let sortinoRatio: number | null = null;
  if (dailyReturns.length >= MIN_TRADES_FOR_RATIOS) {
    const dd = downsideDeviation(dailyReturns);
    if (dd > 0) {
      sortinoRatio =
        (mean(dailyReturns) / dd) * Math.sqrt(TRADING_DAYS_PER_YEAR);
    }
  }

  // --- Monthly Returns ---
  const monthlyReturns = computeMonthlyReturns(sorted, equityCurve);

  // --- Win Rate by Signal / Sector ---
  const winRateBySignal = computeWinRateByField(sorted, "signal");
  const winRateBySector = computeWinRateByField(sorted, "sector");

  return {
    sharpeRatio,
    sortinoRatio,
    maxDrawdown,
    maxDrawdownAbs,
    profitFactor,
    avgWin,
    avgLoss,
    maxConsecutiveWins: maxWins,
    maxConsecutiveLosses: maxLosses,
    avgHoldingPeriodDays,
    totalTrades,
    winRate,
    winRateBySignal,
    winRateBySector,
    equityCurve,
    monthlyReturns,
  };
}
