export interface StockData {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  marketCap: number; // in crores
  lastPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  avgDailyTurnover: number; // in crores (20-day)
  open: number;
  high: number;
  low: number;
  close: number;
  previousClose: number;
}

export interface TechnicalIndicators {
  // Moving Averages
  ema20: number;
  ema50: number;
  ema200: number;

  // Existing core indicators
  rsi14: number;
  adx14: number;
  plusDI: number;
  minusDI: number;
  atr14: number;
  relativeStrength3M: number; // vs Nifty 50
  volumeSMA20: number;
  weekChange: number;

  // MACD
  macdLine: number;
  macdSignal: number;
  macdHistogram: number;

  // Stochastic Oscillator
  stochasticK: number;
  stochasticD: number;

  // Williams %R
  williamsR: number;

  // Rate of Change
  roc14: number;

  // CCI
  cci20: number;

  // Bollinger Bands
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  bollingerPercentB: number;
  bollingerBandwidth: number;

  // OBV
  obv: number;
  obvTrend: "up" | "down" | "flat";

  // MFI
  mfi14: number;

  // SuperTrend
  superTrend: number;
  superTrendDirection: "up" | "down";

  // Parabolic SAR
  parabolicSAR: number;
  sarTrend: "up" | "down";

  // Ichimoku Cloud
  ichimokuTenkan: number;
  ichimokuKijun: number;
  ichimokuSenkouA: number;
  ichimokuSenkouB: number;
  ichimokuCloudSignal: "above" | "below" | "inside";
}

export interface ScreenerResult {
  stock: StockData;
  indicators: TechnicalIndicators;
  phase1Pass: boolean;
  phase2Pass: boolean;
  phase3Pass: boolean;
  phase3Details: Phase3Details;
  phase4VolumePass: boolean;
  phase4VolumeDetails: Phase4VolumeDetails;
  phase5VolatilityPass: boolean;
  phase5VolatilityDetails: Phase5VolatilityDetails;
  phase6: Phase4RiskParams; // Risk management (was phase4)
  overallScore: number; // 0-100
  signal: "STRONG_BUY" | "BUY" | "WATCH" | "NEUTRAL" | "AVOID";
  rationale: string;
}

export interface Phase3Details {
  pullbackToEMA: boolean;
  rsiInZone: boolean;
  rsiValue: number;
  volumeDecline: boolean;
  candlestickPattern: string | null;
  emaProximity: number; // % distance from nearest support EMA
  rocPositive: boolean;
  plusDIAboveMinusDI: boolean;
  stochasticBullish: boolean;
  macdBullish: boolean;
}

export interface Phase4VolumeDetails {
  obvTrendingUp: boolean;
  volumeAboveAvg: boolean;
  mfiHealthy: boolean;
}

export interface Phase5VolatilityDetails {
  atrReasonable: boolean;   // ATR/Close < 5%
  bollingerExpanding: boolean;
  priceInUpperBand: boolean;
}

export interface Phase4RiskParams {
  entryPrice: number;
  stopLoss: number;
  target: number;
  riskRewardRatio: number;
  riskPerShare: number;
  atrMultiple: number;
}

export interface PositionSizing {
  shares: number;
  positionValue: number;
  riskAmount: number;
  riskPerShare: number;
  targetPrice: number;
  potentialProfit: number;
  potentialLoss: number;
}

export interface ScreenerConfig {
  // Phase 1: Liquidity
  minMarketCap: number; // crores
  minAvgDailyTurnover: number; // crores
  excludeASMGSM: boolean;
  // Phase 2: Trend
  requireEMAAlignment: boolean;
  minADX: number;
  requireRelativeStrength: boolean;
  requireMACDBullish: boolean;
  requireSuperTrendUp: boolean;
  // Phase 3: Momentum
  rsiLow: number;
  rsiHigh: number;
  maxEMAProximity: number; // % distance
  requireROCPositive: boolean;
  requireDIPlusCross: boolean;
  // Phase 4: Volume Confirmation
  volumeMultiplier: number; // current vol > X * avg vol
  requireOBVUp: boolean;
  mfiLow: number;
  mfiHigh: number;
  // Phase 5: Volatility Check
  maxATRPercent: number; // ATR/Close threshold
  requireBollingerExpanding: boolean;
  // Phase 6: Risk Management
  atrMultiple: number;
  minRiskReward: number;
  maxCapitalRisk: number; // %
}

export const DEFAULT_SCREENER_CONFIG: ScreenerConfig = {
  minMarketCap: 5000,
  minAvgDailyTurnover: 20,
  excludeASMGSM: true,
  requireEMAAlignment: true,
  minADX: 25,
  requireRelativeStrength: true,
  requireMACDBullish: true,
  requireSuperTrendUp: false,
  rsiLow: 40,
  rsiHigh: 75,
  maxEMAProximity: 3,
  requireROCPositive: true,
  requireDIPlusCross: true,
  volumeMultiplier: 1.2,
  requireOBVUp: true,
  mfiLow: 40,
  mfiHigh: 80,
  maxATRPercent: 5,
  requireBollingerExpanding: false,
  atrMultiple: 1.5,
  minRiskReward: 2,
  maxCapitalRisk: 8,
};
