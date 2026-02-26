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
  RankedSignal,
  SignalWinRate,
  AvgReturnByPeriod,
  HitRateStats,
  AccuracyTrendPoint,
  ScoreTierPerformance,
  SectorSignalPerformance,
  StrategySummaryText,
  BacktestAnalytics,
  ConfidenceLevel,
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
 * Get the best available forward price for a signal with its period label.
 * Prefers the longest period available (10d > 5d > 3d > 1d).
 */
function getBestForwardPriceWithPeriod(
  sig: SignalSnapshot
): { price: number; period: "1D" | "3D" | "5D" | "10D" } | null {
  if (sig.priceAfter10d !== null) return { price: sig.priceAfter10d, period: "10D" };
  if (sig.priceAfter5d !== null) return { price: sig.priceAfter5d, period: "5D" };
  if (sig.priceAfter3d !== null) return { price: sig.priceAfter3d, period: "3D" };
  if (sig.priceAfter1d !== null) return { price: sig.priceAfter1d, period: "1D" };
  return null;
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

  // Return null percentages when no resolved signals (instead of misleading 0%)
  if (resolved.length === 0) {
    return {
      targetHit,
      stoppedOut,
      expired,
      pending,
      targetHitPct: null,
      stoppedOutPct: null,
      expiredPct: null,
    };
  }

  const total = resolved.length;
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
  const withReturns: RankedSignal[] = signals
    .map((s) => {
      const result = getBestForwardPriceWithPeriod(s);
      if (!result) return null;
      return {
        signal: s,
        returnPct: computeReturn(s.entryPrice, result.price),
        period: result.period,
      };
    })
    .filter((item): item is RankedSignal => item !== null);

  const bestSignals = [...withReturns]
    .sort((a, b) => b.returnPct - a.returnPct)
    .slice(0, 5);

  const worstSignals = [...withReturns]
    .sort((a, b) => a.returnPct - b.returnPct)
    .slice(0, 5);

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

// ---- Backtest / Strategy-Level Analytics (#8) ----

const SCORE_TIERS = [
  { tierLabel: "STRONG_BUY", tier: "STRONG_BUY (\u226575)", scoreMin: 75, scoreMax: 100 },
  { tierLabel: "BUY", tier: "BUY (55\u201374)", scoreMin: 55, scoreMax: 74 },
  { tierLabel: "WATCH", tier: "WATCH (35\u201354)", scoreMin: 35, scoreMax: 54 },
  { tierLabel: "LOW", tier: "Below WATCH (<35)", scoreMin: 0, scoreMax: 34 },
];

/**
 * Group signals by score tier and compute avg returns + win rate per tier.
 * Uses fixed score boundaries (75/55/35) for consistent historical bucketing.
 */
export function computeScoreTierPerformance(
  signals: SignalSnapshot[]
): ScoreTierPerformance[] {
  return SCORE_TIERS.map(({ tier, tierLabel, scoreMin, scoreMax }) => {
    const bucket = signals.filter(
      (s) => s.score >= scoreMin && s.score <= scoreMax
    );
    const r1d: number[] = [];
    const r3d: number[] = [];
    const r5d: number[] = [];
    const r10d: number[] = [];
    let wins = 0;
    let losses = 0;

    for (const s of bucket) {
      if (s.priceAfter1d !== null)
        r1d.push(computeReturn(s.entryPrice, s.priceAfter1d));
      if (s.priceAfter3d !== null)
        r3d.push(computeReturn(s.entryPrice, s.priceAfter3d));
      if (s.priceAfter5d !== null)
        r5d.push(computeReturn(s.entryPrice, s.priceAfter5d));
      if (s.priceAfter10d !== null)
        r10d.push(computeReturn(s.entryPrice, s.priceAfter10d));
      if (s.outcome === "target_hit") wins++;
      if (s.outcome === "stopped_out") losses++;
    }

    return {
      tier,
      tierLabel,
      scoreMin,
      scoreMax,
      signalCount: bucket.length,
      avgReturn1d: r1d.length > 0 ? mean(r1d) : null,
      avgReturn3d: r3d.length > 0 ? mean(r3d) : null,
      avgReturn5d: r5d.length > 0 ? mean(r5d) : null,
      avgReturn10d: r10d.length > 0 ? mean(r10d) : null,
      winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
      wins,
      losses,
    };
  });
}

/**
 * Group signals by sector × signal type and compute avg 10d return + win rate.
 * Sorted by avgReturn10d descending (best-performing combos first).
 */
export function computeSectorPerformance(
  signals: SignalSnapshot[]
): SectorSignalPerformance[] {
  const groups = new Map<
    string,
    {
      sector: string;
      signal: string;
      r10d: number[];
      wins: number;
      losses: number;
      total: number;
    }
  >();

  for (const s of signals) {
    const sector = s.sector || "Unknown";
    const key = `${sector}|${s.signal}`;
    const g = groups.get(key) ?? {
      sector,
      signal: s.signal,
      r10d: [],
      wins: 0,
      losses: 0,
      total: 0,
    };
    g.total++;
    if (s.priceAfter10d !== null)
      g.r10d.push(computeReturn(s.entryPrice, s.priceAfter10d));
    if (s.outcome === "target_hit") g.wins++;
    if (s.outcome === "stopped_out") g.losses++;
    groups.set(key, g);
  }

  return Array.from(groups.values())
    .map((g) => ({
      sector: g.sector,
      signal: g.signal,
      signalCount: g.total,
      avgReturn10d: g.r10d.length > 0 ? mean(g.r10d) : null,
      winRate:
        g.wins + g.losses > 0 ? (g.wins / (g.wins + g.losses)) * 100 : 0,
      wins: g.wins,
      losses: g.losses,
    }))
    .sort((a, b) => (b.avgReturn10d ?? -999) - (a.avgReturn10d ?? -999));
}

/**
 * Build natural-language strategy summary with verdict and confidence level.
 */
export function computeStrategySummary(
  tierPerf: ScoreTierPerformance[],
  sectorPerf: SectorSignalPerformance[],
  totalSignals: number,
  days: number
): StrategySummaryText {
  const totalResolved = tierPerf.reduce(
    (s, t) => s + t.wins + t.losses,
    0
  );

  const confidenceLevel: ConfidenceLevel =
    totalResolved >= 30
      ? "high"
      : totalResolved >= 15
        ? "moderate"
        : totalResolved >= 5
          ? "low"
          : "insufficient";

  const lines: string[] = [];
  const activeTiers = tierPerf.filter((t) => t.signalCount > 0).length;
  lines.push(
    `Over the last ${days} days, ${totalSignals} signals were generated across ${activeTiers} active score tiers.`
  );

  const sbTier = tierPerf.find((t) => t.tierLabel === "STRONG_BUY");
  if (sbTier && sbTier.signalCount > 0 && sbTier.avgReturn10d !== null) {
    lines.push(
      `STRONG_BUY signals (score \u226575) averaged ${sbTier.avgReturn10d.toFixed(2)}% at 10 days with ${sbTier.winRate.toFixed(0)}% win rate (N=${sbTier.signalCount}).`
    );
  }

  const buyTier = tierPerf.find((t) => t.tierLabel === "BUY");
  if (buyTier && buyTier.signalCount > 0 && buyTier.avgReturn10d !== null) {
    lines.push(
      `BUY signals (score 55-74) averaged ${buyTier.avgReturn10d.toFixed(2)}% at 10 days with ${buyTier.winRate.toFixed(0)}% win rate (N=${buyTier.signalCount}).`
    );
  }

  const bestSector = sectorPerf.find(
    (s) => s.avgReturn10d !== null && s.signalCount >= 2
  );
  if (bestSector && bestSector.avgReturn10d !== null) {
    lines.push(
      `Best-performing sector: ${bestSector.sector} for ${bestSector.signal.replace("_", " ")} signals (${bestSector.avgReturn10d.toFixed(2)}% avg 10d return, N=${bestSector.signalCount}).`
    );
  }

  lines.push(
    `Confidence: ${confidenceLevel} (${totalResolved} resolved signals).`
  );

  const actionableTiers = tierPerf.filter(
    (t) => t.tierLabel === "STRONG_BUY" || t.tierLabel === "BUY"
  );
  // Weighted average win rate across actionable tiers (by resolved count)
  const totalActionableWins = actionableTiers.reduce((s, t) => s + t.wins, 0);
  const totalActionableResolved = actionableTiers.reduce(
    (s, t) => s + t.wins + t.losses,
    0
  );
  const weightedWinRate =
    totalActionableResolved > 0
      ? (totalActionableWins / totalActionableResolved) * 100
      : 0;

  let overallVerdict: string;
  if (totalResolved < 5) overallVerdict = "Needs more data";
  else if (weightedWinRate > 60) overallVerdict = "Promising";
  else if (weightedWinRate >= 40) overallVerdict = "Mixed";
  else overallVerdict = "Underperforming";

  return {
    summaryLines: lines,
    overallVerdict,
    confidenceLevel,
    totalResolvedSignals: totalResolved,
  };
}

/**
 * Orchestrator: compute all backtest analytics from signal snapshots.
 * Called from the Signals page via useMemo alongside computeSignalPerformance.
 */
export function computeBacktestAnalytics(
  signals: SignalSnapshot[],
  days: number
): BacktestAnalytics {
  const scoreTierPerformance = computeScoreTierPerformance(signals);
  const sectorPerformance = computeSectorPerformance(signals);
  const strategySummary = computeStrategySummary(
    scoreTierPerformance,
    sectorPerformance,
    signals.length,
    days
  );
  return { scoreTierPerformance, sectorPerformance, strategySummary };
}
