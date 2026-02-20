/**
 * Signal Performance Analytics — Pure computation functions for signal tracking.
 *
 * All functions are pure (no React, no side effects).
 * Single entry point: computeSignalPerformance(signals, snapshots)
 */

import type {
  SignalSnapshot,
  ScreenerSnapshot,
  SignalPerformanceAnalytics,
  SignalWinRate,
  AvgReturnByPeriod,
  HitRateStats,
  AccuracyTrendPoint,
} from "./types";

// ---- Internal Helpers ----

/** Mean of a number array. Returns 0 for empty arrays. */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Compute percentage return from entry to current price */
function computeReturn(entry: number, current: number): number {
  return entry > 0 ? ((current - entry) / entry) * 100 : 0;
}

/**
 * Get the best available forward price for a signal.
 * Prefers the longest period available (10d > 5d > 3d > 1d).
 */
function getBestForwardPrice(sig: SignalSnapshot): number | null {
  return sig.priceAfter10d ?? sig.priceAfter5d ?? sig.priceAfter3d ?? sig.priceAfter1d;
}

// ---- Core Computation Functions ----

/**
 * Compute win rate breakdown by signal type.
 * A "win" = outcome is target_hit. A "loss" = stopped_out.
 * Win rate = wins / (wins + losses) * 100 (ignores pending/expired).
 */
function computeWinRateBySignalType(signals: SignalSnapshot[]): SignalWinRate[] {
  const groups = new Map<
    string,
    { wins: number; losses: number; pending: number; expired: number; total: number }
  >();

  for (const sig of signals) {
    const existing = groups.get(sig.signal) ?? {
      wins: 0,
      losses: 0,
      pending: 0,
      expired: 0,
      total: 0,
    };
    existing.total++;
    switch (sig.outcome) {
      case "target_hit":
        existing.wins++;
        break;
      case "stopped_out":
        existing.losses++;
        break;
      case "expired":
        existing.expired++;
        break;
      default:
        existing.pending++;
        break;
    }
    groups.set(sig.signal, existing);
  }

  return Array.from(groups.entries())
    .map(([signal, data]) => ({
      signal,
      total: data.total,
      wins: data.wins,
      losses: data.losses,
      pending: data.pending,
      expired: data.expired,
      winRate:
        data.wins + data.losses > 0
          ? (data.wins / (data.wins + data.losses)) * 100
          : 0,
    }))
    .sort((a, b) => b.winRate - a.winRate);
}

/**
 * Compute average percentage return at each time horizon, grouped by signal type.
 */
function computeAvgReturnByPeriod(signals: SignalSnapshot[]): AvgReturnByPeriod[] {
  const groups = new Map<
    string,
    { r1d: number[]; r3d: number[]; r5d: number[]; r10d: number[] }
  >();

  for (const sig of signals) {
    const existing = groups.get(sig.signal) ?? {
      r1d: [],
      r3d: [],
      r5d: [],
      r10d: [],
    };
    if (sig.priceAfter1d !== null)
      existing.r1d.push(computeReturn(sig.entryPrice, sig.priceAfter1d));
    if (sig.priceAfter3d !== null)
      existing.r3d.push(computeReturn(sig.entryPrice, sig.priceAfter3d));
    if (sig.priceAfter5d !== null)
      existing.r5d.push(computeReturn(sig.entryPrice, sig.priceAfter5d));
    if (sig.priceAfter10d !== null)
      existing.r10d.push(computeReturn(sig.entryPrice, sig.priceAfter10d));
    groups.set(sig.signal, existing);
  }

  return Array.from(groups.entries()).map(([signal, data]) => ({
    signal,
    avgReturn1d: data.r1d.length > 0 ? mean(data.r1d) : null,
    avgReturn3d: data.r3d.length > 0 ? mean(data.r3d) : null,
    avgReturn5d: data.r5d.length > 0 ? mean(data.r5d) : null,
    avgReturn10d: data.r10d.length > 0 ? mean(data.r10d) : null,
  }));
}

/**
 * Compute overall hit rate statistics from actionable signals (BUY/STRONG_BUY).
 */
function computeHitRate(signals: SignalSnapshot[]): HitRateStats {
  const resolved = signals.filter(
    (s) => s.outcome && s.outcome !== "pending"
  );
  const targetHit = resolved.filter((s) => s.outcome === "target_hit").length;
  const stoppedOut = resolved.filter((s) => s.outcome === "stopped_out").length;
  const expired = resolved.filter((s) => s.outcome === "expired").length;
  const pending = signals.filter(
    (s) => !s.outcome || s.outcome === "pending"
  ).length;
  const total = resolved.length || 1; // avoid division by zero

  return {
    targetHit,
    stoppedOut,
    expired,
    pending,
    targetHitPct: (targetHit / total) * 100,
    stoppedOutPct: (stoppedOut / total) * 100,
    expiredPct: (expired / total) * 100,
  };
}

/**
 * Compute weekly win rate trend for actionable signals.
 * Groups by ISO week start (Monday) and computes win rate per week.
 */
function computeAccuracyTrend(signals: SignalSnapshot[]): AccuracyTrendPoint[] {
  const weekMap = new Map<string, { wins: number; total: number }>();

  for (const sig of signals) {
    if (!sig.outcome || sig.outcome === "pending") continue;

    const date = new Date(sig.createdAt);
    const dayOfWeek = date.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() + mondayOffset);
    const weekKey = weekStart.toISOString().split("T")[0];

    const existing = weekMap.get(weekKey) ?? { wins: 0, total: 0 };
    existing.total++;
    if (sig.outcome === "target_hit") existing.wins++;
    weekMap.set(weekKey, existing);
  }

  return Array.from(weekMap.entries())
    .map(([weekStart, data]) => ({
      weekStart,
      winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
      signalCount: data.total,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

// ---- Main Entry Point ----

/**
 * Compute all signal performance analytics from signals and snapshots.
 * This is the single entry point called from the page via useMemo.
 */
export function computeSignalPerformance(
  signals: SignalSnapshot[],
  snapshots: ScreenerSnapshot[]
): SignalPerformanceAnalytics {
  // Focus on actionable signals (STRONG_BUY + BUY) for win rate and hit rate
  const actionable = signals.filter(
    (s) => s.signal === "STRONG_BUY" || s.signal === "BUY"
  );

  // Best/worst signals by return (using longest available forward period)
  const withReturns = signals
    .filter((s) => getBestForwardPrice(s) !== null)
    .map((s) => {
      const bestPrice = getBestForwardPrice(s)!;
      return { signal: s, returnPct: computeReturn(s.entryPrice, bestPrice) };
    });

  const bestSignals = [...withReturns]
    .sort((a, b) => b.returnPct - a.returnPct)
    .slice(0, 5)
    .map((item) => item.signal);

  const worstSignals = [...withReturns]
    .sort((a, b) => a.returnPct - b.returnPct)
    .slice(0, 5)
    .map((item) => item.signal);

  // Date range
  const dates = signals.map((s) => s.createdAt).sort();

  return {
    totalSignals: signals.length,
    totalSnapshots: snapshots.length,
    dateRange:
      dates.length > 0
        ? { from: dates[0], to: dates[dates.length - 1] }
        : null,
    winRateBySignal: computeWinRateBySignalType(actionable),
    avgReturnByPeriod: computeAvgReturnByPeriod(signals),
    bestSignals,
    worstSignals,
    hitRate: computeHitRate(actionable),
    accuracyTrend: computeAccuracyTrend(actionable),
  };
}
