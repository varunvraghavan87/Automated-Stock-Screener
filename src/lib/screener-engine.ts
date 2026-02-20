import {
  type StockData,
  type TechnicalIndicators,
  type ScreenerResult,
  type ScreenerConfig,
  type Phase3Details,
  type Phase4VolumeDetails,
  type Phase5VolatilityDetails,
  type Phase4RiskParams,
  type MarketRegime,
  type MarketRegimeInfo,
  type AdaptiveThresholds,
  type WeeklyTrendHealth,
  type SectorMetrics,
  type SectorRankings,
  type SectorContext,
  DEFAULT_SCREENER_CONFIG,
  DEFAULT_SECTOR_CONTEXT,
  EMPTY_SECTOR_RANKINGS,
} from "./types";

// ---- Market Regime Detection ----

/**
 * Detect current market regime from Nifty 50 indicators.
 *
 * Bull:     Nifty > EMA50 AND ADX > 20 AND EMA20 > EMA50
 * Bear:     Nifty < EMA50 AND ADX > 20 AND EMA20 < EMA50
 * Sideways: ADX < 20 (no trend regardless of price)
 */
export function detectMarketRegime(
  niftyClose: number,
  niftyEMA20: number,
  niftyEMA50: number,
  niftyADX: number,
  indiaVIX: number | null = null
): MarketRegimeInfo {
  let regime: MarketRegime;
  let description: string;

  if (niftyADX < 20) {
    regime = "SIDEWAYS";
    description = `Nifty in sideways range — ADX at ${niftyADX.toFixed(1)} (below 20). Trend-following setups unreliable; tighter filters applied.`;
  } else if (niftyClose > niftyEMA50 && niftyEMA20 > niftyEMA50) {
    regime = "BULL";
    description = `Nifty in uptrend — trading above EMA50 (${niftyEMA50.toFixed(0)}), EMA20 > EMA50, ADX ${niftyADX.toFixed(1)}. Standard thresholds active.`;
  } else if (niftyClose < niftyEMA50 && niftyEMA20 < niftyEMA50) {
    regime = "BEAR";
    description = `Nifty in downtrend — trading below EMA50 (${niftyEMA50.toFixed(0)}), EMA20 < EMA50, ADX ${niftyADX.toFixed(1)}. Stricter filters applied to avoid catching falling knives.`;
  } else {
    // Transitional — treat as sideways for safety
    regime = "SIDEWAYS";
    description = `Nifty in transitional phase — mixed signals between EMAs. ADX ${niftyADX.toFixed(1)}. Cautious thresholds applied.`;
  }

  // Elevated VIX amplifies caution
  if (indiaVIX !== null && indiaVIX > 25) {
    description += ` India VIX elevated at ${indiaVIX.toFixed(1)} — expect wider stops and higher volatility.`;
  }

  return {
    regime,
    niftyClose,
    niftyEMA20,
    niftyEMA50,
    niftyADX,
    indiaVIX,
    description,
  };
}

/**
 * Get adaptive thresholds based on the current market regime.
 *
 * In bear/sideways markets, we demand stronger signals to avoid false positives.
 * In bull markets, standard thresholds let us catch more setups (higher base rate).
 */
export function getAdaptiveThresholds(
  regime: MarketRegime,
  baseConfig: ScreenerConfig = DEFAULT_SCREENER_CONFIG
): AdaptiveThresholds {
  switch (regime) {
    case "BULL":
      return {
        minADX: baseConfig.minADX,           // 25 (standard)
        rsiLow: baseConfig.rsiLow,           // 40
        rsiHigh: baseConfig.rsiHigh,         // 75
        volumeMultiplier: baseConfig.volumeMultiplier, // 1.2x
        minRiskReward: baseConfig.minRiskReward,       // 2:1
        strongBuyThreshold: 75,
        buyThreshold: 55,
        watchThreshold: 35,
      };
    case "SIDEWAYS":
      return {
        minADX: Math.round(baseConfig.minADX * 1.2),  // 30 (+20%)
        rsiLow: 45,                                     // tighter range
        rsiHigh: 65,
        volumeMultiplier: baseConfig.volumeMultiplier * 1.25, // 1.5x
        minRiskReward: 2.5,                              // demand more reward
        strongBuyThreshold: 80,                          // harder to qualify
        buyThreshold: 60,
        watchThreshold: 40,
      };
    case "BEAR":
      return {
        minADX: Math.round(baseConfig.minADX * 1.4),  // 35 (+40%)
        rsiLow: 50,                                     // very tight
        rsiHigh: 60,
        volumeMultiplier: baseConfig.volumeMultiplier * 1.67, // ~2.0x
        minRiskReward: 3,                                // high reward demanded
        strongBuyThreshold: 85,                          // very hard to qualify
        buyThreshold: 65,
        watchThreshold: 45,
      };
  }
}

/**
 * Apply adaptive thresholds to a ScreenerConfig, returning a new config
 * with regime-adjusted values merged in.
 */
export function applyAdaptiveConfig(
  baseConfig: ScreenerConfig,
  thresholds: AdaptiveThresholds
): ScreenerConfig {
  return {
    ...baseConfig,
    minADX: thresholds.minADX,
    rsiLow: thresholds.rsiLow,
    rsiHigh: thresholds.rsiHigh,
    volumeMultiplier: thresholds.volumeMultiplier,
    minRiskReward: thresholds.minRiskReward,
  };
}

// Phase 1: Universe & Liquidity Filter
export function phase1Filter(
  stock: StockData,
  config: ScreenerConfig = DEFAULT_SCREENER_CONFIG
): boolean {
  if (stock.avgDailyTurnover < config.minAvgDailyTurnover) return false;
  return true;
}

// Phase 2: Trend Establishment Filter
export function phase2Filter(
  indicators: TechnicalIndicators,
  lastPrice: number,
  config: ScreenerConfig = DEFAULT_SCREENER_CONFIG
): boolean {
  // EMA Alignment: Price > 20 EMA > 50 EMA > 200 EMA
  if (config.requireEMAAlignment) {
    if (
      !(
        lastPrice > indicators.ema20 &&
        indicators.ema20 > indicators.ema50 &&
        indicators.ema50 > indicators.ema200
      )
    ) {
      return false;
    }
  }

  // ADX > 25 (trending) with +DI > -DI (uptrend)
  if (indicators.adx14 < config.minADX) return false;

  // Relative Strength: 3M performance > Nifty 50
  if (config.requireRelativeStrength && indicators.relativeStrength3M <= 0) {
    return false;
  }

  // MACD Line > Signal Line AND MACD > 0
  if (config.requireMACDBullish) {
    if (!(indicators.macdLine > indicators.macdSignal && indicators.macdLine > 0)) {
      return false;
    }
  }

  // SuperTrend direction = up
  if (config.requireSuperTrendUp) {
    if (indicators.superTrendDirection !== "up") return false;
  }

  return true;
}

// RSI Tier Classification — maps RSI value to a quality tier and score
function classifyRSITier(rsi: number): { tier: Phase3Details['rsiTier']; score: number } {
  if (rsi >= 45 && rsi <= 55) return { tier: 'optimal', score: 5 };
  if (rsi > 55 && rsi <= 65) return { tier: 'good', score: 4 };
  if ((rsi >= 40 && rsi < 45) || (rsi > 65 && rsi <= 70)) return { tier: 'caution', score: 2 };
  if (rsi > 70 && rsi <= 75) return { tier: 'exhaustion', score: 0 };
  return { tier: 'penalty', score: -3 }; // RSI > 75 or < 40
}

// Phase 3: Momentum Signal Detection
export function phase3Analyze(
  stock: StockData,
  indicators: TechnicalIndicators,
  config: ScreenerConfig = DEFAULT_SCREENER_CONFIG
): Phase3Details {
  const lastPrice = stock.lastPrice;

  // Pullback to 20/50 EMA
  const distTo20 = ((lastPrice - indicators.ema20) / indicators.ema20) * 100;
  const distTo50 = ((lastPrice - indicators.ema50) / indicators.ema50) * 100;
  const emaProximity = Math.min(Math.abs(distTo20), Math.abs(distTo50));
  const pullbackToEMA = emaProximity <= config.maxEMAProximity;

  // RSI tiered scoring (replaces flat zone check)
  const { tier: rsiTier, score: rsiTierScore } = classifyRSITier(indicators.rsi14);
  // rsiInZone remains true if score >= 0 (backward compat for phase3Pass)
  const rsiInZone = rsiTierScore >= 0;

  // Volume declining on pullback
  const volumeDecline = stock.volume < indicators.volumeSMA20;

  // ROC positive
  const rocPositive = indicators.roc14 > 0;

  // +DI > -DI
  const plusDIAboveMinusDI = indicators.plusDI > indicators.minusDI;

  // Stochastic %K > 50 and rising
  const stochasticBullish = indicators.stochasticK > 50;

  // MACD histogram positive
  const macdBullish = indicators.macdHistogram > 0;

  return {
    pullbackToEMA,
    rsiInZone,
    rsiValue: indicators.rsi14,
    rsiTier,
    rsiTierScore,
    volumeDecline,
    candlestickPattern: null,
    emaProximity,
    rocPositive,
    plusDIAboveMinusDI,
    stochasticBullish,
    macdBullish,
    divergenceResult: indicators.divergences,
    divergenceScoreImpact: indicators.divergences.netScoreImpact,
  };
}

export function phase3Pass(details: Phase3Details): boolean {
  const conditions = [
    details.pullbackToEMA,
    details.rsiInZone,
    details.rocPositive,
    details.plusDIAboveMinusDI,
    details.stochasticBullish,
  ];
  const passCount = conditions.filter(Boolean).length;
  return passCount >= 3; // At least 3 of 5 conditions
}

// Volume Trend Classification — detects 3-bar acceleration/deceleration
function classifyVolumeTrend(
  volumeRecent3: [number, number, number]
): { trend: Phase4VolumeDetails['volumeTrend']; score: number } {
  const [vol2ago, vol1ago, volNow] = volumeRecent3;

  // All zero or invalid → steady
  if (volNow === 0 && vol1ago === 0 && vol2ago === 0) {
    return { trend: 'steady', score: 2 };
  }

  // Accelerating: each bar higher than the previous
  if (volNow > vol1ago && vol1ago > vol2ago) {
    return { trend: 'accelerating', score: 5 };
  }

  // Declining: each bar lower than the previous
  if (volNow < vol1ago && vol1ago < vol2ago) {
    return { trend: 'declining', score: -3 };
  }

  // Steady: current above avg of prior two, but not strictly accelerating
  const avgPrior = (vol2ago + vol1ago) / 2;
  if (volNow > avgPrior) {
    return { trend: 'steady', score: 2 };
  }

  // Default: declining tendency
  return { trend: 'declining', score: -3 };
}

// Phase 4: Volume Confirmation
export function phase4VolumeAnalyze(
  stock: StockData,
  indicators: TechnicalIndicators,
  config: ScreenerConfig = DEFAULT_SCREENER_CONFIG
): Phase4VolumeDetails {
  const obvTrendingUp = indicators.obvTrend === "up";
  const volumeAboveAvg = stock.volume > indicators.volumeSMA20 * config.volumeMultiplier;
  const mfiHealthy = indicators.mfi14 >= config.mfiLow && indicators.mfi14 <= config.mfiHigh;

  // Volume trend analysis (3-bar acceleration)
  const { trend: volumeTrend, score: volumeTrendScore } = classifyVolumeTrend(
    indicators.volumeRecent3
  );

  return {
    obvTrendingUp,
    volumeAboveAvg,
    mfiHealthy,
    volumeTrend,
    volumeTrendScore,
    vroc20: indicators.vroc20,
  };
}

export function phase4VolumePass(
  details: Phase4VolumeDetails,
  config: ScreenerConfig = DEFAULT_SCREENER_CONFIG
): boolean {
  const conditions = [
    details.volumeAboveAvg,
    details.mfiHealthy,
  ];
  if (config.requireOBVUp) conditions.push(details.obvTrendingUp);

  const passCount = conditions.filter(Boolean).length;
  return passCount >= 2;
}

// Phase 5: Volatility Check
export function phase5VolatilityAnalyze(
  stock: StockData,
  indicators: TechnicalIndicators,
  config: ScreenerConfig = DEFAULT_SCREENER_CONFIG
): Phase5VolatilityDetails {
  const atrPercent = (indicators.atr14 / stock.lastPrice) * 100;
  const atrReasonable = atrPercent < config.maxATRPercent;

  // Bollinger Band expanding: bandwidth above some threshold (use relative)
  const bollingerExpanding = indicators.bollingerBandwidth > 0.02;

  // Price in upper half of Bollinger Bands
  const priceInUpperBand = indicators.bollingerPercentB > 0.5;

  return { atrReasonable, bollingerExpanding, priceInUpperBand };
}

export function phase5VolatilityPass(
  details: Phase5VolatilityDetails,
  config: ScreenerConfig = DEFAULT_SCREENER_CONFIG
): boolean {
  if (!details.atrReasonable) return false;
  if (config.requireBollingerExpanding && !details.bollingerExpanding) return false;
  return true;
}

// Phase 6: Risk Management Calculations
export function phase6Calculate(
  entryPrice: number,
  atr: number,
  config: ScreenerConfig = DEFAULT_SCREENER_CONFIG
): Phase4RiskParams {
  const stopLoss = entryPrice - config.atrMultiple * atr;
  const riskPerShare = entryPrice - stopLoss;
  const target = entryPrice + riskPerShare * config.minRiskReward;
  const riskRewardRatio = config.minRiskReward;

  return {
    entryPrice,
    stopLoss: Math.round(stopLoss * 100) / 100,
    target: Math.round(target * 100) / 100,
    riskRewardRatio,
    riskPerShare: Math.round(riskPerShare * 100) / 100,
    atrMultiple: config.atrMultiple,
  };
}

// Calculate overall momentum score with new indicators
function calculateScore(
  phase1: boolean,
  phase2: boolean,
  phase3: Phase3Details,
  phase4Vol: Phase4VolumeDetails,
  phase5Vola: Phase5VolatilityDetails,
  indicators: TechnicalIndicators,
  sectorCtx?: SectorContext
): number {
  let score = 0;

  // Phase 1: Liquidity (15 pts)
  if (phase1) score += 15;

  // Phase 2: Trend (20 pts base + weekly trend bonus/penalty)
  if (phase2) score += 10;
  if (indicators.macdLine > indicators.macdSignal && indicators.macdLine > 0) score += 3;
  if (indicators.superTrendDirection === "up") score += 3;
  if (indicators.sarTrend === "up") score += 2;
  if (indicators.ichimokuCloudSignal === "above") score += 2;

  // Multi-Timeframe Confirmation: weekly trend score (+5 aligned, -10 counter-trend, 0 mixed)
  score += indicators.weeklyTrend.score;

  // Phase 3: Momentum (25 pts max)
  if (phase3.pullbackToEMA) score += 5;
  // Tiered RSI scoring: -3 to +5 based on quality zone
  score += phase3.rsiTierScore;
  if (phase3.rocPositive) score += 4;
  if (phase3.plusDIAboveMinusDI) score += 4;
  if (phase3.stochasticBullish) score += 3;
  if (phase3.macdBullish) score += 2;
  if (phase3.candlestickPattern) score += 2;

  // Divergence scoring (Phase 3 extension): clamped -15 to +8 pts
  score += phase3.divergenceScoreImpact;

  // Phase 4: Volume (20 pts max — expanded with trend analysis)
  if (phase4Vol.obvTrendingUp) score += 5;
  if (phase4Vol.mfiHealthy) score += 5;
  // Volume trend: -3 (declining) to +5 (accelerating), replaces flat volumeAboveAvg check
  score += phase4Vol.volumeTrendScore;
  // Bonus if volume is above average (additional confirmation)
  if (phase4Vol.volumeAboveAvg) score += 3;

  // Phase 5: Volatility (10 pts)
  if (phase5Vola.atrReasonable) score += 4;
  if (phase5Vola.bollingerExpanding) score += 3;
  if (phase5Vola.priceInUpperBand) score += 3;

  // Bonus: Strong trend (5 pts)
  if (indicators.adx14 > 35) score += 3;
  if (indicators.relativeStrength3M > 5) score += 2;

  // Sector Rotation: +5 top sector, -5 bottom sector
  if (sectorCtx) score += sectorCtx.sectorScoreImpact;

  return Math.max(0, Math.min(score, 100));
}

function determineSignal(
  score: number,
  phase1: boolean,
  phase2: boolean,
  phase3Pass: boolean,
  phase4VolPass: boolean,
  thresholds?: AdaptiveThresholds
): ScreenerResult["signal"] {
  const strongBuy = thresholds?.strongBuyThreshold ?? 75;
  const buy = thresholds?.buyThreshold ?? 55;
  const watch = thresholds?.watchThreshold ?? 35;

  if (phase1 && phase2 && phase3Pass && phase4VolPass && score >= strongBuy) return "STRONG_BUY";
  if (phase1 && phase2 && phase3Pass && score >= buy) return "BUY";
  if (phase1 && phase2 && score >= watch) return "WATCH";
  if (phase1) return "NEUTRAL";
  return "AVOID";
}

function generateRationale(
  stock: StockData,
  indicators: TechnicalIndicators,
  phase3: Phase3Details,
  phase4Vol: Phase4VolumeDetails,
  phase5Vola: Phase5VolatilityDetails,
  riskParams: Phase4RiskParams,
  sectorCtx?: SectorContext
): string {
  const parts: string[] = [];

  // Sector rotation context (high prominence — first in rationale)
  if (sectorCtx && sectorCtx.sectorScoreImpact !== 0) {
    if (sectorCtx.isTopSector) {
      parts.push(`🏆 Sector Leader: ${sectorCtx.sectorName} ranked #${sectorCtx.sectorRank}/${sectorCtx.totalSectors} (breadth ${sectorCtx.sectorBreadth.toFixed(0)}%, avg RS ${sectorCtx.sectorAvgRS3M.toFixed(1)}%) — +5 pts`);
    } else if (sectorCtx.isBottomSector) {
      parts.push(`⚠️ Sector Laggard: ${sectorCtx.sectorName} ranked #${sectorCtx.sectorRank}/${sectorCtx.totalSectors} (breadth ${sectorCtx.sectorBreadth.toFixed(0)}%, avg RS ${sectorCtx.sectorAvgRS3M.toFixed(1)}%) — -5 pts`);
    }
  }

  // Trend signals
  if (indicators.macdLine > indicators.macdSignal && indicators.macdLine > 0) {
    parts.push("MACD bullish above zero");
  }
  if (indicators.superTrendDirection === "up") {
    parts.push("SuperTrend green");
  }

  // Weekly trend confirmation
  const wt = indicators.weeklyTrend;
  const wtLabels: Record<string, string> = {
    aligned: `Weekly trend aligned (RSI ${wt.weeklyRSI.toFixed(1)}, close > EMA20) — +5 pts`,
    'counter-trend': `CAUTION: Weekly trend counter-trend (RSI ${wt.weeklyRSI.toFixed(1)}, close ${wt.closeAboveEMA20 ? '>' : '<'} EMA20) — -10 pts`,
    mixed: `Weekly trend mixed (RSI ${wt.weeklyRSI.toFixed(1)})`,
  };
  parts.push(wtLabels[wt.status]);

  // Momentum signals
  if (phase3.pullbackToEMA) {
    parts.push(
      `pulling back to EMA support (${phase3.emaProximity.toFixed(1)}% away)`
    );
  }
  // RSI with tier context
  const rsiTierLabels: Record<string, string> = {
    optimal: 'optimal pullback zone',
    good: 'healthy continuation',
    caution: 'caution zone',
    exhaustion: 'exhaustion zone',
    penalty: 'overbought/broken',
  };
  parts.push(
    `RSI ${indicators.rsi14.toFixed(1)} — ${rsiTierLabels[phase3.rsiTier]} (${phase3.rsiTierScore > 0 ? '+' : ''}${phase3.rsiTierScore} pts)`
  );
  if (phase3.rocPositive) {
    parts.push(`ROC positive (${indicators.roc14.toFixed(1)}%)`);
  }

  // Volume signals
  if (phase4Vol.obvTrendingUp) {
    parts.push("OBV trending up");
  }
  // Volume trend context
  const volTrendLabels: Record<string, string> = {
    accelerating: 'volume accelerating (3-bar rising)',
    steady: 'volume steady',
    declining: 'volume declining — caution',
  };
  parts.push(volTrendLabels[phase4Vol.volumeTrend]);
  if (phase4Vol.mfiHealthy) {
    parts.push(`MFI at ${indicators.mfi14.toFixed(0)}`);
  }

  // Volatility signals
  if (phase5Vola.priceInUpperBand) {
    parts.push(`Bollinger %B at ${indicators.bollingerPercentB.toFixed(2)}`);
  }

  if (phase3.candlestickPattern) {
    parts.push(`${phase3.candlestickPattern} pattern detected`);
  }

  // Divergence signals
  if (phase3.divergenceResult.divergences.length > 0) {
    for (const div of phase3.divergenceResult.divergences) {
      parts.push(div.description);
    }
  }

  parts.push(
    `Entry ₹${riskParams.entryPrice.toFixed(2)}, SL ₹${riskParams.stopLoss.toFixed(2)}, Target ₹${riskParams.target.toFixed(2)} (${riskParams.riskRewardRatio}:1 R:R)`
  );

  return parts.join(". ") + ".";
}

// ---- Sector Rotation Ranking ----

/**
 * Compute sector-level momentum rankings across all stocks.
 * Uses relativeStrength3M, weekChange, and price vs EMA50 breadth.
 * Composite = 50% normalized RS3M + 30% breadth + 20% normalized weekChange.
 */
export function computeSectorRankings(
  stocks: Array<{ stock: StockData; indicators: TechnicalIndicators }>
): SectorRankings {
  // Pass 1: Accumulate per-sector metrics
  const sectorMap = new Map<string, {
    rsSum: number; weekChangeSum: number;
    aboveEMA50: number; total: number;
  }>();

  for (const { stock, indicators } of stocks) {
    if (stock.sector === "Unknown") continue;
    const entry = sectorMap.get(stock.sector) ?? {
      rsSum: 0, weekChangeSum: 0, aboveEMA50: 0, total: 0,
    };
    entry.rsSum += indicators.relativeStrength3M;
    entry.weekChangeSum += indicators.weekChange;
    if (stock.lastPrice > indicators.ema50) entry.aboveEMA50++;
    entry.total++;
    sectorMap.set(stock.sector, entry);
  }

  if (sectorMap.size === 0) return EMPTY_SECTOR_RANKINGS;

  // Pass 2: Compute averages
  const rawMetrics: Array<Omit<SectorMetrics, 'rank'>> = [];
  for (const [sector, data] of sectorMap) {
    rawMetrics.push({
      sector,
      stockCount: data.total,
      avgRelativeStrength3M: data.rsSum / data.total,
      avgWeekChange: data.weekChangeSum / data.total,
      breadth: (data.aboveEMA50 / data.total) * 100,
      compositeScore: 0, // computed below after normalization
    });
  }

  // Pass 3: Normalize RS3M and weekChange to 0-100 (min-max)
  const rsValues = rawMetrics.map(m => m.avgRelativeStrength3M);
  const wcValues = rawMetrics.map(m => m.avgWeekChange);
  const rsMin = Math.min(...rsValues);
  const rsMax = Math.max(...rsValues);
  const wcMin = Math.min(...wcValues);
  const wcMax = Math.max(...wcValues);
  const rsRange = rsMax - rsMin || 1; // avoid division by zero
  const wcRange = wcMax - wcMin || 1;

  for (const m of rawMetrics) {
    const normalizedRS = ((m.avgRelativeStrength3M - rsMin) / rsRange) * 100;
    const normalizedWC = ((m.avgWeekChange - wcMin) / wcRange) * 100;
    m.compositeScore = 0.50 * normalizedRS + 0.30 * m.breadth + 0.20 * normalizedWC;
  }

  // Pass 4: Sort descending by composite score, assign ranks
  rawMetrics.sort((a, b) => b.compositeScore - a.compositeScore);
  const rankings: SectorMetrics[] = rawMetrics.map((m, i) => ({
    ...m,
    rank: i + 1,
  }));

  const N = rankings.length;
  const topCount = N <= 6 ? Math.ceil(N / 3) : 3;
  const bottomCount = N <= 6 ? Math.ceil(N / 3) : 3;

  return {
    rankings,
    totalSectors: N,
    topSectors: rankings.slice(0, topCount).map(r => r.sector),
    bottomSectors: rankings.slice(N - bottomCount).map(r => r.sector),
  };
}

/**
 * Get sector context for a specific stock based on computed rankings.
 */
export function getSectorContext(
  stock: StockData,
  rankings: SectorRankings
): SectorContext {
  const found = rankings.rankings.find(r => r.sector === stock.sector);
  if (!found) {
    // Unknown sector or not ranked — neutral treatment
    return {
      ...DEFAULT_SECTOR_CONTEXT,
      sectorName: stock.sector,
      totalSectors: rankings.totalSectors,
      sectorRank: Math.ceil(rankings.totalSectors / 2) || 0,
    };
  }

  const isTop = rankings.topSectors.includes(found.sector);
  const isBottom = rankings.bottomSectors.includes(found.sector);

  return {
    sectorName: found.sector,
    sectorRank: found.rank,
    totalSectors: rankings.totalSectors,
    isTopSector: isTop,
    isBottomSector: isBottom,
    sectorScoreImpact: isTop ? 5 : isBottom ? -5 : 0,
    sectorBreadth: found.breadth,
    sectorAvgRS3M: found.avgRelativeStrength3M,
  };
}

// Main screener function — 6-stage pipeline
// Accepts optional adaptive thresholds for regime-aware signal determination
export function runScreener(
  stocks: Array<{ stock: StockData; indicators: TechnicalIndicators }>,
  config: ScreenerConfig = DEFAULT_SCREENER_CONFIG,
  adaptiveThresholds?: AdaptiveThresholds,
  sectorRankings?: SectorRankings
): ScreenerResult[] {
  const results: ScreenerResult[] = [];

  // If adaptive thresholds provided, merge regime-specific values into config
  const effectiveConfig = adaptiveThresholds
    ? applyAdaptiveConfig(config, adaptiveThresholds)
    : config;

  for (const { stock, indicators } of stocks) {
    const p1 = phase1Filter(stock, effectiveConfig);
    const p2 = p1 ? phase2Filter(indicators, stock.lastPrice, effectiveConfig) : false;
    const p3Details = phase3Analyze(stock, indicators, effectiveConfig);
    const p3 = p2 ? phase3Pass(p3Details) : false;
    const p4VolDetails = phase4VolumeAnalyze(stock, indicators, effectiveConfig);
    const p4Vol = p3 ? phase4VolumePass(p4VolDetails, effectiveConfig) : false;
    const p5VolaDetails = phase5VolatilityAnalyze(stock, indicators, effectiveConfig);
    const p5Vola = p4Vol ? phase5VolatilityPass(p5VolaDetails, effectiveConfig) : false;
    const p6 = phase6Calculate(stock.lastPrice, indicators.atr14, effectiveConfig);

    // Sector context: look up this stock's sector rank
    const sectorCtx = sectorRankings
      ? getSectorContext(stock, sectorRankings)
      : DEFAULT_SECTOR_CONTEXT;

    const score = calculateScore(p1, p2, p3Details, p4VolDetails, p5VolaDetails, indicators, sectorCtx);
    const signal = determineSignal(score, p1, p2, p3, p4Vol, adaptiveThresholds);
    const rationale = generateRationale(stock, indicators, p3Details, p4VolDetails, p5VolaDetails, p6, sectorCtx);

    results.push({
      stock,
      indicators,
      phase1Pass: p1,
      phase2Pass: p2,
      phase2WeeklyTrend: indicators.weeklyTrend,
      phase3Pass: p3,
      phase3Details: p3Details,
      phase4VolumePass: p4Vol,
      phase4VolumeDetails: p4VolDetails,
      phase5VolatilityPass: p5Vola,
      phase5VolatilityDetails: p5VolaDetails,
      phase6: p6,
      overallScore: score,
      signal,
      rationale,
      sectorContext: sectorCtx,
    });
  }

  results.sort((a, b) => b.overallScore - a.overallScore);
  return results;
}
