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

  // Volume trend data (for 3-bar acceleration check)
  volumeRecent3: [number, number, number]; // [vol[-2], vol[-1], vol[0]] — last 3 bars
  vroc20: number; // Volume Rate of Change: (vol[0] / vol[-20]) * 100

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

  // Weekly Timeframe Indicators (aggregated from daily data)
  weeklyTrend: WeeklyTrendHealth;
}

// Weekly Trend Health — computed from aggregated daily→weekly candles
export interface WeeklyTrendHealth {
  closeAboveEMA20: boolean;     // Weekly close > Weekly EMA20 (higher TF uptrend)
  rsiAbove40: boolean;          // Weekly RSI > 40 (not in weekly downtrend)
  macdHistPositive: boolean;    // Weekly MACD histogram > 0 or turning positive
  weeklyEMA20: number;          // Actual value for display
  weeklyRSI: number;            // Actual value for display
  weeklyMACDHist: number;       // Actual value for display
  weeklyClose: number;          // Latest weekly close for display
  aligned: boolean;             // true if daily trend direction matches weekly
  score: number;                // +5 (aligned) or -10 (counter-trend) or 0 (mixed)
  status: 'aligned' | 'counter-trend' | 'mixed'; // Human-readable status
}

// ---- Market Regime Types ----

export type MarketRegime = "BULL" | "BEAR" | "SIDEWAYS";

export interface MarketRegimeInfo {
  regime: MarketRegime;
  niftyClose: number;
  niftyEMA20: number;
  niftyEMA50: number;
  niftyADX: number;
  indiaVIX: number | null; // null if not available
  description: string;
}

// Adaptive thresholds that change per regime
export interface AdaptiveThresholds {
  minADX: number;
  rsiLow: number;
  rsiHigh: number;
  volumeMultiplier: number;
  minRiskReward: number;
  strongBuyThreshold: number;
  buyThreshold: number;
  watchThreshold: number;
}

export interface ScreenerResult {
  stock: StockData;
  indicators: TechnicalIndicators;
  phase1Pass: boolean;
  phase2Pass: boolean;
  phase2WeeklyTrend: WeeklyTrendHealth; // Multi-timeframe confirmation data
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

export interface ScreenerResponse {
  timestamp: string;
  mode: "live" | "demo";
  totalScanned: number;
  marketRegime: MarketRegimeInfo;
  adaptiveThresholds: AdaptiveThresholds;
  pipeline: {
    phase1: number;
    phase2: number;
    phase3: number;
    phase4Volume: number;
    phase5Volatility: number;
  };
  results: ScreenerResult[];
  config?: ScreenerConfig;
}

export interface Phase3Details {
  pullbackToEMA: boolean;
  rsiInZone: boolean;
  rsiValue: number;
  rsiTier: 'optimal' | 'good' | 'caution' | 'exhaustion' | 'penalty';
  rsiTierScore: number; // Actual score awarded: -3 to 5
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
  volumeTrend: 'accelerating' | 'steady' | 'declining';
  volumeTrendScore: number; // Score contribution: -3, +2, or +5
  vroc20: number; // Volume Rate of Change value
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

// ---- Paper Trade Types ----

export interface PaperTrade {
  id: string;
  userId: string;
  symbol: string;
  exchange: string;
  name: string;
  sector: string;
  quantity: number;
  entryPrice: number;
  entryDate: string;
  stopLoss: number | null;
  targetPrice: number | null;
  signal: string | null;
  overallScore: number | null;
  currentPrice: number | null;
  lastPriceUpdate: string | null;
  status: "open" | "closed";
  exitPrice: number | null;
  exitDate: string | null;
  exitReason: string | null;
  realizedPnl: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaperTradeInput {
  symbol: string;
  exchange: string;
  name: string;
  sector: string;
  quantity: number;
  entryPrice: number;
  stopLoss?: number;
  targetPrice?: number;
  signal?: string;
  overallScore?: number;
  notes?: string;
}

export interface PaperTradeCloseInput {
  exitPrice: number;
  exitReason?: "manual" | "stop_loss_hit" | "target_hit";
}

// ---- Watchlist Types ----

export interface WatchlistItem {
  id: string;
  userId: string;
  symbol: string;
  exchange: string;
  name: string;
  sector: string;
  addedPrice: number;
  currentPrice: number | null;
  lastPriceUpdate: string | null;
  targetBuy: number | null;
  targetSell: number | null;
  signal: string | null;
  overallScore: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistInput {
  symbol: string;
  exchange: string;
  name: string;
  sector: string;
  addedPrice: number;
  targetBuy?: number;
  targetSell?: number;
  signal?: string;
  overallScore?: number;
  notes?: string;
}

// ---- Price Update Types ----

export interface PriceUpdateResult {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  updatedAt: string;
}

// ---- Screener Config ----

export const DEFAULT_SCREENER_CONFIG: ScreenerConfig = {
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
