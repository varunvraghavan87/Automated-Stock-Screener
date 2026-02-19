import {
  type StockData,
  type TechnicalIndicators,
  type ScreenerResult,
  type ScreenerConfig,
  type Phase3Details,
  type Phase4VolumeDetails,
  type Phase5VolatilityDetails,
  type Phase4RiskParams,
  DEFAULT_SCREENER_CONFIG,
} from "./types";

// Phase 1: Universe & Liquidity Filter
export function phase1Filter(
  stock: StockData,
  config: ScreenerConfig = DEFAULT_SCREENER_CONFIG
): boolean {
  if (stock.marketCap < config.minMarketCap) return false;
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

  // RSI in momentum zone (40-75)
  const rsiInZone =
    indicators.rsi14 >= config.rsiLow && indicators.rsi14 <= config.rsiHigh;

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
    volumeDecline,
    candlestickPattern: null,
    emaProximity,
    rocPositive,
    plusDIAboveMinusDI,
    stochasticBullish,
    macdBullish,
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

// Phase 4: Volume Confirmation
export function phase4VolumeAnalyze(
  stock: StockData,
  indicators: TechnicalIndicators,
  config: ScreenerConfig = DEFAULT_SCREENER_CONFIG
): Phase4VolumeDetails {
  const obvTrendingUp = indicators.obvTrend === "up";
  const volumeAboveAvg = stock.volume > indicators.volumeSMA20 * config.volumeMultiplier;
  const mfiHealthy = indicators.mfi14 >= config.mfiLow && indicators.mfi14 <= config.mfiHigh;

  return { obvTrendingUp, volumeAboveAvg, mfiHealthy };
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
  indicators: TechnicalIndicators
): number {
  let score = 0;

  // Phase 1: Liquidity (15 pts)
  if (phase1) score += 15;

  // Phase 2: Trend (20 pts)
  if (phase2) score += 10;
  if (indicators.macdLine > indicators.macdSignal && indicators.macdLine > 0) score += 3;
  if (indicators.superTrendDirection === "up") score += 3;
  if (indicators.sarTrend === "up") score += 2;
  if (indicators.ichimokuCloudSignal === "above") score += 2;

  // Phase 3: Momentum (25 pts)
  if (phase3.pullbackToEMA) score += 5;
  if (phase3.rsiInZone) score += 5;
  if (phase3.rocPositive) score += 4;
  if (phase3.plusDIAboveMinusDI) score += 4;
  if (phase3.stochasticBullish) score += 3;
  if (phase3.macdBullish) score += 2;
  if (phase3.candlestickPattern) score += 2;

  // Phase 4: Volume (15 pts)
  if (phase4Vol.obvTrendingUp) score += 5;
  if (phase4Vol.volumeAboveAvg) score += 5;
  if (phase4Vol.mfiHealthy) score += 5;

  // Phase 5: Volatility (10 pts)
  if (phase5Vola.atrReasonable) score += 4;
  if (phase5Vola.bollingerExpanding) score += 3;
  if (phase5Vola.priceInUpperBand) score += 3;

  // Bonus: Strong trend (5 pts)
  if (indicators.adx14 > 35) score += 3;
  if (indicators.relativeStrength3M > 5) score += 2;

  return Math.min(score, 100);
}

function determineSignal(
  score: number,
  phase1: boolean,
  phase2: boolean,
  phase3Pass: boolean,
  phase4VolPass: boolean
): ScreenerResult["signal"] {
  if (phase1 && phase2 && phase3Pass && phase4VolPass && score >= 75) return "STRONG_BUY";
  if (phase1 && phase2 && phase3Pass && score >= 55) return "BUY";
  if (phase1 && phase2 && score >= 35) return "WATCH";
  if (phase1) return "NEUTRAL";
  return "AVOID";
}

function generateRationale(
  stock: StockData,
  indicators: TechnicalIndicators,
  phase3: Phase3Details,
  phase4Vol: Phase4VolumeDetails,
  phase5Vola: Phase5VolatilityDetails,
  riskParams: Phase4RiskParams
): string {
  const parts: string[] = [];

  // Trend signals
  if (indicators.macdLine > indicators.macdSignal && indicators.macdLine > 0) {
    parts.push("MACD bullish above zero");
  }
  if (indicators.superTrendDirection === "up") {
    parts.push("SuperTrend green");
  }

  // Momentum signals
  if (phase3.pullbackToEMA) {
    parts.push(
      `pulling back to EMA support (${phase3.emaProximity.toFixed(1)}% away)`
    );
  }
  if (phase3.rsiInZone) {
    parts.push(`RSI at ${indicators.rsi14.toFixed(1)}`);
  }
  if (phase3.rocPositive) {
    parts.push(`ROC positive (${indicators.roc14.toFixed(1)}%)`);
  }

  // Volume signals
  if (phase4Vol.obvTrendingUp) {
    parts.push("OBV trending up");
  }
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

  parts.push(
    `Entry ₹${riskParams.entryPrice.toFixed(2)}, SL ₹${riskParams.stopLoss.toFixed(2)}, Target ₹${riskParams.target.toFixed(2)} (${riskParams.riskRewardRatio}:1 R:R)`
  );

  return parts.join(". ") + ".";
}

// Main screener function — 6-stage pipeline
export function runScreener(
  stocks: Array<{ stock: StockData; indicators: TechnicalIndicators }>,
  config: ScreenerConfig = DEFAULT_SCREENER_CONFIG
): ScreenerResult[] {
  const results: ScreenerResult[] = [];

  for (const { stock, indicators } of stocks) {
    const p1 = phase1Filter(stock, config);
    const p2 = p1 ? phase2Filter(indicators, stock.lastPrice, config) : false;
    const p3Details = phase3Analyze(stock, indicators, config);
    const p3 = p2 ? phase3Pass(p3Details) : false;
    const p4VolDetails = phase4VolumeAnalyze(stock, indicators, config);
    const p4Vol = p3 ? phase4VolumePass(p4VolDetails, config) : false;
    const p5VolaDetails = phase5VolatilityAnalyze(stock, indicators, config);
    const p5Vola = p4Vol ? phase5VolatilityPass(p5VolaDetails, config) : false;
    const p6 = phase6Calculate(stock.lastPrice, indicators.atr14, config);

    const score = calculateScore(p1, p2, p3Details, p4VolDetails, p5VolaDetails, indicators);
    const signal = determineSignal(score, p1, p2, p3, p4Vol);
    const rationale = generateRationale(stock, indicators, p3Details, p4VolDetails, p5VolaDetails, p6);

    results.push({
      stock,
      indicators,
      phase1Pass: p1,
      phase2Pass: p2,
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
    });
  }

  results.sort((a, b) => b.overallScore - a.overallScore);
  return results;
}
