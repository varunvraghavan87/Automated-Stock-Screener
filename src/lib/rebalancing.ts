/**
 * Rebalancing & Exit Signals — Pure computation functions for open position alerts.
 *
 * All functions are pure (no React, no side effects).
 * Single entry point: computeRebalanceAlerts(openTrades, screenerResults, ...)
 */

import { countTradingDays } from "./market-hours";
import { SIGNAL_HIERARCHY } from "./types";
import type {
  PaperTrade,
  ScreenerResult,
  DivergenceResult,
  RebalanceFlag,
  RebalanceFlagType,
  TradeRebalanceInfo,
  RebalanceSummary,
  RebalanceResult,
} from "./types";

// ---- Constants ----

const EXTENDED_HOLD_TRADING_DAYS = 20;
const STALE_SCREENER_HOURS = 24;

/** Entry signals that indicate a bullish position */
const BULLISH_ENTRY_SIGNALS = new Set(["STRONG_BUY", "BUY"]);

/** Signals at or below this rank trigger "consider exit" */
const EXIT_SIGNAL_THRESHOLD = SIGNAL_HIERARCHY["WATCH"]; // WATCH=2

// ---- Flag Computation Functions ----

/**
 * Check if the current screener signal is significantly lower than the entry signal.
 * Only flags trades that were entered on BUY/STRONG_BUY signals.
 */
function checkSignalDowngraded(
  trade: PaperTrade,
  screenerResult: ScreenerResult
): RebalanceFlag | null {
  if (!trade.signal || !BULLISH_ENTRY_SIGNALS.has(trade.signal)) return null;

  const currentRank = SIGNAL_HIERARCHY[screenerResult.signal] ?? -1;

  if (currentRank <= EXIT_SIGNAL_THRESHOLD) {
    return {
      type: "SIGNAL_DOWNGRADED",
      severity: screenerResult.signal === "AVOID" ? "critical" : "warning",
      label: "Consider Exit",
      description: `Signal downgraded from ${trade.signal.replace("_", " ")} to ${screenerResult.signal.replace("_", " ")}`,
    };
  }
  return null;
}

/**
 * Check for bearish divergence between price and indicators.
 */
function checkBearishDivergence(
  divergences: DivergenceResult
): RebalanceFlag | null {
  if (!divergences.hasBearish) return null;
  return {
    type: "BEARISH_DIVERGENCE",
    severity: "warning",
    label: "Bearish Divergence",
    description: divergences.summary || "Price/indicator disagreement detected",
  };
}

/**
 * Check if the stock's uptrend has broken (Phase 2 failed).
 * Phase 2 checks EMA alignment, ADX threshold, and trend indicators.
 */
function checkTrendBroken(
  screenerResult: ScreenerResult
): RebalanceFlag | null {
  if (screenerResult.phase2Pass) return null;
  return {
    type: "TREND_BROKEN",
    severity: "critical",
    label: "Trend Broken",
    description:
      "Phase 2 (Trend Establishment) failed \u2014 EMA alignment or ADX threshold not met",
  };
}

/**
 * Check if a trade has been held too long with negative P&L.
 * Uses trading days (excludes weekends) for accuracy.
 */
function checkExtendedHold(
  trade: PaperTrade,
  now: Date
): RebalanceFlag | null {
  if (!trade.entryDate) return null;

  const entryDate = new Date(trade.entryDate);
  const tradingDays = countTradingDays(entryDate, now);

  if (tradingDays <= EXTENDED_HOLD_TRADING_DAYS) return null;

  // Only flag if P&L is negative
  const currentPrice = trade.currentPrice ?? trade.entryPrice;
  const pnl = (currentPrice - trade.entryPrice) * trade.quantity;
  if (pnl >= 0) return null;

  return {
    type: "EXTENDED_HOLD",
    severity: "warning",
    label: "Extended Hold",
    description: `Held ${tradingDays} trading days with negative P&L \u2014 review position`,
  };
}

/**
 * Check if the current price has breached the stop loss level.
 */
function checkStopLossBreached(trade: PaperTrade): RebalanceFlag | null {
  if (trade.stopLoss === null) return null;

  const currentPrice = trade.currentPrice ?? trade.entryPrice;
  if (currentPrice >= trade.stopLoss) return null;

  return {
    type: "STOP_LOSS_BREACHED",
    severity: "critical",
    label: "Stop Loss Hit",
    description: `Current price \u20B9${currentPrice.toFixed(2)} is below stop loss \u20B9${trade.stopLoss.toFixed(2)}`,
  };
}

// ---- Main Entry Point ----

/**
 * Compute rebalancing alerts for all open trades.
 *
 * Cross-references each open trade with current screener results to detect
 * exit signals, divergences, trend breaks, extended holds, and stop loss breaches.
 *
 * @param openTrades - All open paper trades
 * @param screenerResults - Current screener run results
 * @param bearishDivergenceMap - Pre-computed map of symbol → DivergenceResult
 * @param lastScreenerRun - When the screener was last refreshed
 * @param now - Current date (injectable for testing)
 */
export function computeRebalanceAlerts(
  openTrades: PaperTrade[],
  screenerResults: ScreenerResult[],
  bearishDivergenceMap: Map<string, DivergenceResult>,
  lastScreenerRun: Date,
  now: Date = new Date()
): RebalanceResult {
  // Build symbol → ScreenerResult lookup
  const screenerMap = new Map<string, ScreenerResult>();
  for (const r of screenerResults) {
    screenerMap.set(r.stock.symbol, r);
  }

  const trades = new Map<string, TradeRebalanceInfo>();

  const flagsByType: Record<RebalanceFlagType, number> = {
    SIGNAL_DOWNGRADED: 0,
    BEARISH_DIVERGENCE: 0,
    TREND_BROKEN: 0,
    EXTENDED_HOLD: 0,
    STOP_LOSS_BREACHED: 0,
  };

  let totalFlagged = 0;
  let criticalCount = 0;
  let warningOnlyCount = 0;

  for (const trade of openTrades) {
    const flags: RebalanceFlag[] = [];
    const screenerResult = screenerMap.get(trade.symbol);

    // ---- Screener-dependent checks (skip if symbol not in current results) ----
    if (screenerResult) {
      const signalFlag = checkSignalDowngraded(trade, screenerResult);
      if (signalFlag) flags.push(signalFlag);

      const trendFlag = checkTrendBroken(screenerResult);
      if (trendFlag) flags.push(trendFlag);
    }

    // Bearish divergence (uses pre-computed map from screener results)
    const divergences = bearishDivergenceMap.get(trade.symbol);
    if (divergences) {
      const divFlag = checkBearishDivergence(divergences);
      if (divFlag) flags.push(divFlag);
    }

    // ---- Non-screener checks (always run) ----
    const holdFlag = checkExtendedHold(trade, now);
    if (holdFlag) flags.push(holdFlag);

    const slFlag = checkStopLossBreached(trade);
    if (slFlag) flags.push(slFlag);

    // ---- Aggregate ----
    if (flags.length > 0) {
      totalFlagged++;
      const hasCritical = flags.some((f) => f.severity === "critical");
      const hasWarning = flags.some((f) => f.severity === "warning");
      if (hasCritical) criticalCount++;
      else if (hasWarning) warningOnlyCount++;

      for (const f of flags) {
        flagsByType[f.type]++;
      }

      trades.set(trade.id, {
        tradeId: trade.id,
        symbol: trade.symbol,
        flags,
        hasCritical,
        hasWarning,
      });
    }
  }

  // Stale screener check
  const hoursSinceRefresh =
    (now.getTime() - lastScreenerRun.getTime()) / (1000 * 60 * 60);

  const summary: RebalanceSummary = {
    totalFlagged,
    criticalCount,
    warningCount: warningOnlyCount,
    flagsByType,
    lastScreenerRun,
    isStale: hoursSinceRefresh > STALE_SCREENER_HOURS,
  };

  return { trades, summary };
}
