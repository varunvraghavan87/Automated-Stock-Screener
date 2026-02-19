// Live Data Service — bridges Kite Connect API to the screener engine
// Fetches real-time + historical data and computes all technical indicators

import { KiteAPI } from "./kite-api";
import type { StockData, TechnicalIndicators } from "./types";
import {
  calculateEMA,
  calculateRSI,
  calculateADX,
  calculateATR,
  calculateMACD,
  calculateStochastic,
  calculateWilliamsR,
  calculateROC,
  calculateCCI,
  calculateBollingerBands,
  calculateOBV,
  calculateMFI,
  calculateSuperTrend,
  calculateParabolicSAR,
  calculateIchimokuCloud,
  calculateRelativeStrength,
  detectCandlestickPattern,
} from "./indicators";

// Sector mapping for common NSE stocks (extend as needed)
const SECTOR_MAP: Record<string, string> = {
  RELIANCE: "Energy", INFY: "IT Services", TCS: "IT Services", HDFCBANK: "Banking",
  ICICIBANK: "Banking", SBIN: "Banking", KOTAKBANK: "Banking", AXISBANK: "Banking",
  BAJFINANCE: "NBFC", BAJAJFINSV: "NBFC", TATASTEEL: "Metals & Mining",
  HINDALCO: "Metals & Mining", JSWSTEEL: "Metals & Mining", LT: "Infrastructure",
  BHARTIARTL: "Telecom", WIPRO: "IT Services", HCLTECH: "IT Services",
  TECHM: "IT Services", SUNPHARMA: "Pharma", DRREDDY: "Pharma", CIPLA: "Pharma",
  MARUTI: "Automobile", TATAMOTORS: "Automobile", M_M: "Automobile",
  HINDUNILVR: "FMCG", ITC: "FMCG", NESTLEIND: "FMCG", TITAN: "Consumer",
  ASIANPAINT: "Consumer", ULTRACEMCO: "Cement", ADANIENT: "Conglomerate",
  POWERGRID: "Utilities", NTPC: "Utilities", ONGC: "Energy",
};

// Nifty 50 instrument token for relative strength calculation
const NIFTY50_INSTRUMENT_TOKEN = 256265;

interface HistoricalCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class LiveDataService {
  private kite: KiteAPI;

  constructor(kite: KiteAPI) {
    this.kite = kite;
  }

  async fetchAndComputeIndicators(
    symbols: string[],
    exchange: string = "NSE"
  ): Promise<Array<{ stock: StockData; indicators: TechnicalIndicators }>> {
    // 1. Fetch instruments to get instrument tokens
    const instruments = await this.kite.fetchInstruments(exchange);
    const instrumentMap = new Map(
      instruments.map((inst) => [inst.tradingsymbol, inst])
    );

    // 2. Fetch current quotes
    const quoteSymbols = symbols.map((s) => `${exchange}:${s}`);
    const quotes = await this.kite.fetchQuotes(quoteSymbols);

    // 3. Calculate date range (200+ trading days back)
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 365); // ~250 trading days

    // 4. Fetch Nifty 50 historical for relative strength
    let niftyHistory: HistoricalCandle[] = [];
    try {
      niftyHistory = await this.kite.fetchHistorical(
        NIFTY50_INSTRUMENT_TOKEN,
        "day",
        from,
        to
      );
    } catch {
      // If Nifty fails, relative strength will be 0
    }
    const niftyCloses = niftyHistory.map((c) => c.close);

    // 5. For each symbol, fetch historical + compute indicators
    const results: Array<{ stock: StockData; indicators: TechnicalIndicators }> = [];

    for (const symbol of symbols) {
      try {
        const instrument = instrumentMap.get(symbol);
        if (!instrument) continue;

        const quote = quotes.get(`${exchange}:${symbol}`);
        if (!quote) continue;

        // Fetch historical data
        const history = await this.kite.fetchHistorical(
          instrument.instrument_token,
          "day",
          from,
          to
        );

        if (history.length < 52) continue; // Need minimum data

        const indicators = this.computeAllIndicators(history, niftyCloses);
        const stock = this.buildStockData(quote, instrument, history, exchange, symbol);

        results.push({ stock, indicators });
      } catch (err) {
        console.error(`Failed to process ${symbol}:`, err);
        continue;
      }
    }

    return results;
  }

  private computeAllIndicators(
    history: HistoricalCandle[],
    niftyCloses: number[]
  ): TechnicalIndicators {
    const close = history.map((c) => c.close);
    const high = history.map((c) => c.high);
    const low = history.map((c) => c.low);
    const volume = history.map((c) => c.volume);

    // Moving Averages
    const ema20 = calculateEMA(close, 20);
    const ema50 = calculateEMA(close, 50);
    const ema200 = calculateEMA(close, 200);

    // RSI
    const rsi = calculateRSI(close, 14);

    // ADX (also gives us DI values via internal calculation)
    const adx = calculateADX(high, low, close, 14);

    // Compute +DI and -DI manually for the latest value
    const { plusDI, minusDI } = this.computeDI(high, low, close, 14);

    // ATR
    const atr = calculateATR(high, low, close, 14);

    // MACD
    const macd = calculateMACD(close, 12, 26, 9);

    // Stochastic
    const stoch = calculateStochastic(high, low, close, 14, 3, 3);

    // Williams %R
    const willR = calculateWilliamsR(high, low, close, 14);

    // ROC
    const roc = calculateROC(close, 14);

    // CCI
    const cci = calculateCCI(high, low, close, 20);

    // Bollinger Bands
    const bb = calculateBollingerBands(close, 20, 2);

    // OBV
    const obv = calculateOBV(close, volume);
    const obvCurrent = obv[obv.length - 1];
    const obv10Ago = obv.length > 10 ? obv[obv.length - 11] : obv[0];
    const obvTrend: "up" | "down" | "flat" =
      obvCurrent > obv10Ago * 1.01 ? "up" :
      obvCurrent < obv10Ago * 0.99 ? "down" : "flat";

    // MFI
    const mfi = calculateMFI(high, low, close, volume, 14);

    // SuperTrend
    const st = calculateSuperTrend(high, low, close, 10, 3);

    // Parabolic SAR
    const sar = calculateParabolicSAR(high, low, close);
    const sarValue = sar.length > 0 ? sar[sar.length - 1] : 0;
    const lastClose = close[close.length - 1];
    const sarTrend: "up" | "down" = sarValue < lastClose ? "up" : "down";

    // Ichimoku
    const ichi = calculateIchimokuCloud(high, low, close);
    const ichiIdx = close.length - 1;
    const senkouA = ichi.senkouA[ichiIdx] || 0;
    const senkouB = ichi.senkouB[ichiIdx] || 0;
    const cloudTop = Math.max(senkouA, senkouB);
    const cloudBottom = Math.min(senkouA, senkouB);
    const ichimokuCloudSignal: "above" | "below" | "inside" =
      lastClose > cloudTop ? "above" :
      lastClose < cloudBottom ? "below" : "inside";

    // Relative Strength vs Nifty 50
    const relativeStrength3M = calculateRelativeStrength(close, niftyCloses, 63);

    // Volume SMA 20
    const volSlice = volume.slice(-20);
    const volumeSMA20 = volSlice.reduce((a, b) => a + b, 0) / volSlice.length;

    // Week change
    const weekClose = close.length >= 5 ? close[close.length - 6] : close[0];
    const weekChange = ((lastClose - weekClose) / weekClose) * 100;

    return {
      ema20: last(ema20),
      ema50: last(ema50),
      ema200: ema200.length > 0 ? last(ema200) : lastClose * 0.9,
      rsi14: last(rsi),
      adx14: last(adx),
      plusDI,
      minusDI,
      atr14: last(atr),
      relativeStrength3M,
      volumeSMA20,
      weekChange,
      macdLine: macd.macdLine.length > 0 ? last(macd.macdLine) : 0,
      macdSignal: macd.signalLine.length > 0 ? last(macd.signalLine) : 0,
      macdHistogram: macd.histogram.length > 0 ? last(macd.histogram) : 0,
      stochasticK: stoch.k.length > 0 ? last(stoch.k) : 50,
      stochasticD: stoch.d.length > 0 ? last(stoch.d) : 50,
      williamsR: willR.length > 0 ? last(willR) : -50,
      roc14: roc.length > 0 ? last(roc) : 0,
      cci20: cci.length > 0 ? last(cci) : 0,
      bollingerUpper: bb.upper.length > 0 ? last(bb.upper) : lastClose * 1.05,
      bollingerMiddle: bb.middle.length > 0 ? last(bb.middle) : lastClose,
      bollingerLower: bb.lower.length > 0 ? last(bb.lower) : lastClose * 0.95,
      bollingerPercentB: bb.percentB.length > 0 ? last(bb.percentB) : 0.5,
      bollingerBandwidth: bb.bandwidth.length > 0 ? last(bb.bandwidth) : 0.04,
      obv: obvCurrent,
      obvTrend,
      mfi14: mfi.length > 0 ? last(mfi) : 50,
      superTrend: st.supertrend.length > 0 ? last(st.supertrend) : lastClose,
      superTrendDirection: st.direction.length > 0 ? st.direction[st.direction.length - 1] : "up",
      parabolicSAR: sarValue,
      sarTrend,
      ichimokuTenkan: !isNaN(ichi.tenkan[ichiIdx]) ? ichi.tenkan[ichiIdx] : 0,
      ichimokuKijun: !isNaN(ichi.kijun[ichiIdx]) ? ichi.kijun[ichiIdx] : 0,
      ichimokuSenkouA: !isNaN(senkouA) ? senkouA : 0,
      ichimokuSenkouB: !isNaN(senkouB) ? senkouB : 0,
      ichimokuCloudSignal,
    };
  }

  private computeDI(
    high: number[],
    low: number[],
    close: number[],
    period: number
  ): { plusDI: number; minusDI: number } {
    const trueRanges: number[] = [];
    const plusDM: number[] = [];
    const minusDM: number[] = [];

    for (let i = 1; i < high.length; i++) {
      const tr = Math.max(
        high[i] - low[i],
        Math.abs(high[i] - close[i - 1]),
        Math.abs(low[i] - close[i - 1])
      );
      trueRanges.push(tr);

      const upMove = high[i] - high[i - 1];
      const downMove = low[i - 1] - low[i];
      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }

    // Use Wilder's smoothing
    const smoothTR = wilderSmooth(trueRanges, period);
    const smoothPlusDM = wilderSmooth(plusDM, period);
    const smoothMinusDM = wilderSmooth(minusDM, period);

    const lastIdx = smoothTR.length - 1;
    if (lastIdx < 0 || smoothTR[lastIdx] === 0) {
      return { plusDI: 0, minusDI: 0 };
    }

    return {
      plusDI: (smoothPlusDM[lastIdx] / smoothTR[lastIdx]) * 100,
      minusDI: (smoothMinusDM[lastIdx] / smoothTR[lastIdx]) * 100,
    };
  }

  private buildStockData(
    quote: { last_price: number; ohlc: { open: number; high: number; low: number; close: number }; volume: number; change: number },
    instrument: { tradingsymbol: string; name: string; exchange: string },
    history: HistoricalCandle[],
    exchange: string,
    symbol: string
  ): StockData {
    // Calculate avg daily turnover from last 20 days
    const last20 = history.slice(-20);
    const avgTurnover = last20.reduce((sum, c) => sum + (c.close * c.volume) / 10000000, 0) / last20.length;

    return {
      symbol: instrument.tradingsymbol,
      name: instrument.name || symbol,
      exchange,
      sector: SECTOR_MAP[symbol] || "Unknown",
      marketCap: 0, // Not available from Kite, would need external data
      lastPrice: quote.last_price,
      change: quote.change,
      changePercent: quote.ohlc.close > 0
        ? ((quote.last_price - quote.ohlc.close) / quote.ohlc.close) * 100
        : 0,
      volume: quote.volume,
      avgDailyTurnover: avgTurnover,
      open: quote.ohlc.open,
      high: quote.ohlc.high,
      low: quote.ohlc.low,
      close: quote.last_price,
      previousClose: quote.ohlc.close,
    };
  }
}

function last(arr: number[]): number {
  return arr.length > 0 ? arr[arr.length - 1] : 0;
}

function wilderSmooth(data: number[], period: number): number[] {
  const result: number[] = [];
  let sum = 0;
  for (let i = 0; i < period && i < data.length; i++) sum += data[i];
  result.push(sum / period);
  for (let i = period; i < data.length; i++) {
    result.push((result[result.length - 1] * (period - 1) + data[i]) / period);
  }
  return result;
}

// Default Nifty 200 symbols for full screening
export const NIFTY_200_TOP_SYMBOLS = [
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR",
  "BHARTIARTL", "SBIN", "BAJFINANCE", "LT", "ITC", "KOTAKBANK",
  "TATAMOTORS", "AXISBANK", "SUNPHARMA", "MARUTI", "TITAN",
  "HCLTECH", "WIPRO", "TATASTEEL", "NTPC", "POWERGRID", "ONGC",
  "ASIANPAINT", "ULTRACEMCO", "TECHM", "DRREDDY", "CIPLA",
  "BAJAJFINSV", "ADANIENT", "JSWSTEEL", "HINDALCO", "NESTLEIND",
  "TATASTEEL", "M_M",
];
