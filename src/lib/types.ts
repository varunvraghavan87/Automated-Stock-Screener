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

  // Accumulation/Distribution Line
  adLineTrend: "up" | "down" | "flat";

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

  // Divergence Detection
  divergences: DivergenceResult;
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

// ---- Divergence Detection Types ----

export type DivergenceType =
  | 'bullish_rsi' | 'bearish_rsi'
  | 'bullish_macd' | 'bearish_macd'
  | 'obv_divergence' | 'mfi_divergence';

export interface SwingPoint {
  index: number;       // Bar index in the array
  value: number;       // Price or indicator value at this point
  type: 'high' | 'low';
}

export interface Divergence {
  type: DivergenceType;
  direction: 'bullish' | 'bearish';
  priceSwing1: SwingPoint;      // Earlier swing in price
  priceSwing2: SwingPoint;      // Later swing in price
  indicatorSwing1: SwingPoint;  // Earlier swing in indicator
  indicatorSwing2: SwingPoint;  // Later swing in indicator
  strength: number;             // 0-1 normalized magnitude
  barsAgo: number;              // How many bars ago the divergence completed
  scoreImpact: number;          // Points to add/subtract (+8 or -10 or -5)
  description: string;          // Human-readable for rationale
}

export interface DivergenceResult {
  divergences: Divergence[];
  hasBullish: boolean;
  hasBearish: boolean;
  netScoreImpact: number;  // Clamped to [-15, +8]
  summary: string;
}

export const EMPTY_DIVERGENCE_RESULT: DivergenceResult = {
  divergences: [],
  hasBullish: false,
  hasBearish: false,
  netScoreImpact: 0,
  summary: 'No divergences detected',
};

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

// ---- Sector Rotation Types ----

export interface SectorMetrics {
  sector: string;
  stockCount: number;
  avgRelativeStrength3M: number;
  avgWeekChange: number;
  breadth: number;            // % of stocks with lastPrice > ema50 (0-100)
  compositeScore: number;     // 50% normalized RS3M + 30% breadth + 20% normalized weekChange
  rank: number;               // 1 = strongest, N = weakest
}

export interface SectorRankings {
  rankings: SectorMetrics[];  // Sorted by rank ascending
  totalSectors: number;
  topSectors: string[];       // Top 3 sector names
  bottomSectors: string[];    // Bottom 3 sector names
}

export interface SectorContext {
  sectorName: string;
  sectorRank: number;
  totalSectors: number;
  isTopSector: boolean;
  isBottomSector: boolean;
  sectorScoreImpact: number;  // +5, 0, or -5
  sectorBreadth: number;
  sectorAvgRS3M: number;
}

export const EMPTY_SECTOR_RANKINGS: SectorRankings = {
  rankings: [], totalSectors: 0, topSectors: [], bottomSectors: [],
};

export const DEFAULT_SECTOR_CONTEXT: SectorContext = {
  sectorName: 'Unknown', sectorRank: 0, totalSectors: 0,
  isTopSector: false, isBottomSector: false, sectorScoreImpact: 0,
  sectorBreadth: 0, sectorAvgRS3M: 0,
};

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
  sectorContext: SectorContext;
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
  sectorRankings: SectorRankings;
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
  cciBullish: boolean;       // CCI(20) > 0
  cciStrong: boolean;        // CCI(20) > 100 (strong uptrend)
  williamsRBullish: boolean;  // Williams %R in healthy zone (-50 to -20)
  divergenceResult: DivergenceResult;
  divergenceScoreImpact: number; // Net score impact from divergences (-15 to +8)
}

export interface Phase4VolumeDetails {
  obvTrendingUp: boolean;
  volumeAboveAvg: boolean;
  mfiHealthy: boolean;
  adLineTrendingUp: boolean;   // A/D Line trending up (accumulation)
  adLineDivergence: boolean;   // Price up but A/D down (distribution warning)
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

// ---- Portfolio Analytics Types ----

export interface EquityCurvePoint {
  date: string;
  equity: number;
  drawdown: number;       // Negative % from peak (e.g., -5.2)
  drawdownAbs: number;    // Absolute currency drawdown
}

export interface MonthlyReturn {
  year: number;
  month: number;          // 0-11
  pnl: number;
  returnPercent: number;
  tradeCount: number;
}

export interface WinRateByGroup {
  group: string;          // Signal name or sector name
  wins: number;
  losses: number;
  total: number;
  winRate: number;        // 0-100
  totalPnl: number;
}

export interface PortfolioAnalytics {
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  maxDrawdown: number | null;        // Percentage (negative, e.g., -12.5)
  maxDrawdownAbs: number | null;     // Absolute currency value
  profitFactor: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  avgHoldingPeriodDays: number | null;
  totalTrades: number;
  winRate: number;                   // 0-100
  winRateBySignal: WinRateByGroup[];
  winRateBySector: WinRateByGroup[];
  equityCurve: EquityCurvePoint[];
  monthlyReturns: MonthlyReturn[];
}

// ---- Screener Snapshot Types ----

export interface ScreenerSnapshot {
  id: string;
  userId: string;
  runDate: string;
  mode: "live" | "demo";
  marketRegime: MarketRegime;
  totalScanned: number;
  resultsSummary: ScreenerResultsSummary;
  createdAt: string;
}

export interface ScreenerResultsSummary {
  signalCounts: Record<string, number>;
  topStocks: SnapshotTopStock[];
}

export interface SnapshotTopStock {
  symbol: string;
  signal: string;
  score: number;
  entryPrice: number;
}

export interface SignalSnapshot {
  id: string;
  snapshotId: string;
  userId: string;
  symbol: string;
  exchange: string;
  name: string;
  sector: string;
  signal: "STRONG_BUY" | "BUY" | "WATCH" | "NEUTRAL" | "AVOID";
  score: number;
  entryPrice: number;
  stopLoss: number;
  targetPrice: number;
  riskReward: number;
  priceAfter1d: number | null;
  priceAfter3d: number | null;
  priceAfter5d: number | null;
  priceAfter10d: number | null;
  outcome: "target_hit" | "stopped_out" | "expired" | "pending" | null;
  createdAt: string;
}

// ---- Signal Performance Analytics Types ----

export interface SignalPerformanceAnalytics {
  totalSignals: number;
  totalSnapshots: number;
  dateRange: { from: string; to: string } | null;
  winRateBySignal: SignalWinRate[];
  avgReturnByPeriod: AvgReturnByPeriod[];
  bestSignals: SignalSnapshot[];
  worstSignals: SignalSnapshot[];
  hitRate: HitRateStats;
  accuracyTrend: AccuracyTrendPoint[];
}

export interface SignalWinRate {
  signal: string;
  total: number;
  wins: number;
  losses: number;
  pending: number;
  expired: number;
  winRate: number;
}

export interface AvgReturnByPeriod {
  signal: string;
  avgReturn1d: number | null;
  avgReturn3d: number | null;
  avgReturn5d: number | null;
  avgReturn10d: number | null;
}

export interface HitRateStats {
  targetHit: number;
  stoppedOut: number;
  expired: number;
  pending: number;
  targetHitPct: number;
  stoppedOutPct: number;
  expiredPct: number;
}

export interface AccuracyTrendPoint {
  weekStart: string;
  winRate: number;
  signalCount: number;
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

// ---- Strategy Presets ----

export type ScreenerStrategy =
  | "balanced"
  | "indian_favourite"
  | "multi_signal"
  | "conservative";

export const STRATEGY_LABELS: Record<
  ScreenerStrategy,
  { name: string; description: string }
> = {
  balanced: {
    name: "Balanced",
    description: "Default settings — all phases weighted equally",
  },
  indian_favourite: {
    name: "Indian Favourite",
    description:
      "SuperTrend + Bollinger focus, popular with Indian retail traders",
  },
  multi_signal: {
    name: "Multi-Signal",
    description:
      "Higher ADX + volume bar — demands strong trend with institutional volume",
  },
  conservative: {
    name: "Conservative",
    description:
      "Tight RSI + high R:R — fewer signals but higher quality setups",
  },
};

export const STRATEGY_PRESETS: Record<
  ScreenerStrategy,
  Partial<ScreenerConfig>
> = {
  balanced: {},
  indian_favourite: {
    requireSuperTrendUp: true,
    requireBollingerExpanding: true,
    rsiLow: 45,
    rsiHigh: 70,
  },
  multi_signal: {
    minADX: 28,
    requireMACDBullish: true,
    mfiLow: 45,
    mfiHigh: 75,
    volumeMultiplier: 1.5,
  },
  conservative: {
    minADX: 30,
    rsiLow: 50,
    rsiHigh: 65,
    volumeMultiplier: 1.5,
    minRiskReward: 2.5,
    maxATRPercent: 4,
    maxCapitalRisk: 5,
  },
};

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

// ---- Signal Change Alert Types (#6) ----

export type SignalChangeType = "UPGRADED" | "DOWNGRADED" | "NEW" | "UNCHANGED";

export const SIGNAL_HIERARCHY: Record<string, number> = {
  AVOID: 0,
  NEUTRAL: 1,
  WATCH: 2,
  BUY: 3,
  STRONG_BUY: 4,
};

export interface PreviousSignalMap {
  [symbol: string]: { signal: string; score: number };
}

export function computeSignalChange(
  currentSignal: string,
  previousSignal: string | undefined
): SignalChangeType {
  if (previousSignal === undefined) return "NEW";
  const currentRank = SIGNAL_HIERARCHY[currentSignal] ?? -1;
  const previousRank = SIGNAL_HIERARCHY[previousSignal] ?? -1;
  if (currentRank > previousRank) return "UPGRADED";
  if (currentRank < previousRank) return "DOWNGRADED";
  return "UNCHANGED";
}

// ---- Backtest / Strategy-Level Analytics Types (#8) ----

export interface ScoreTierPerformance {
  tier: string;
  tierLabel: string;
  scoreMin: number;
  scoreMax: number;
  signalCount: number;
  avgReturn1d: number | null;
  avgReturn3d: number | null;
  avgReturn5d: number | null;
  avgReturn10d: number | null;
  winRate: number;
  wins: number;
  losses: number;
}

export interface SectorSignalPerformance {
  sector: string;
  signal: string;
  signalCount: number;
  avgReturn10d: number | null;
  winRate: number;
  wins: number;
  losses: number;
}

export type ConfidenceLevel = "high" | "moderate" | "low" | "insufficient";

export interface StrategySummaryText {
  summaryLines: string[];
  overallVerdict: string;
  confidenceLevel: ConfidenceLevel;
  totalResolvedSignals: number;
}

export interface BacktestAnalytics {
  scoreTierPerformance: ScoreTierPerformance[];
  sectorPerformance: SectorSignalPerformance[];
  strategySummary: StrategySummaryText;
}

// ---- Rebalancing & Exit Signal Types (#7) ----

export type RebalanceFlagType =
  | "SIGNAL_DOWNGRADED"
  | "BEARISH_DIVERGENCE"
  | "TREND_BROKEN"
  | "EXTENDED_HOLD"
  | "STOP_LOSS_BREACHED";

export type RebalanceSeverity = "critical" | "warning";

export interface RebalanceFlag {
  type: RebalanceFlagType;
  severity: RebalanceSeverity;
  label: string;
  description: string;
}

export interface TradeRebalanceInfo {
  tradeId: string;
  symbol: string;
  flags: RebalanceFlag[];
  hasCritical: boolean;
  hasWarning: boolean;
}

export interface RebalanceSummary {
  totalFlagged: number;
  criticalCount: number;
  warningCount: number;
  flagsByType: Record<RebalanceFlagType, number>;
  lastScreenerRun: Date;
  isStale: boolean;
}

export interface RebalanceResult {
  trades: Map<string, TradeRebalanceInfo>;
  summary: RebalanceSummary;
}

// ---- Portfolio Risk (Open Position) Types (#9) ----

export interface SectorAllocation {
  sector: string;
  value: number;
  percent: number;
}

export interface PortfolioRiskMetrics {
  totalRiskAmount: number;
  portfolioHeatPercent: number;
  heatLevel: "low" | "moderate" | "high";
  sectorAllocations: SectorAllocation[];
  maxSectorPercent: number;
  maxSectorName: string;
  hasConcentrationWarning: boolean;
  worstCaseLoss: number;
  worstCaseLossPercent: number;
  positionsWithoutSL: number;
  totalPositions: number;
  avgRiskReward: number | null;
  positionsWithRR: number;
  overallRiskLevel: "low" | "moderate" | "high";
}
