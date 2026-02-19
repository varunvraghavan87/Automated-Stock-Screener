// Technical indicator calculations for the Nifty Velocity Alpha framework

export function calculateEMA(
  prices: number[],
  period: number
): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  // First EMA value is the SMA of the first `period` values
  let sum = 0;
  for (let i = 0; i < period && i < prices.length; i++) {
    sum += prices[i];
  }
  const sma = sum / Math.min(period, prices.length);
  result.push(sma);

  // Calculate subsequent EMA values
  for (let i = period; i < prices.length; i++) {
    const ema = (prices[i] - result[result.length - 1]) * multiplier + result[result.length - 1];
    result.push(ema);
  }

  return result;
}

export function calculateRSI(prices: number[], period: number = 14): number[] {
  const result: number[] = [];
  const changes: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  let avgGain = 0;
  let avgLoss = 0;

  // Initial average
  for (let i = 0; i < period && i < changes.length; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) {
    result.push(100);
  } else {
    const rs = avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }

  // Smoothed RSI
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }

  return result;
}

export function calculateADX(
  high: number[],
  low: number[],
  close: number[],
  period: number = 14
): number[] {
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

  // Smooth the TR, +DM, -DM
  const smoothTR = smoothWilder(trueRanges, period);
  const smoothPlusDM = smoothWilder(plusDM, period);
  const smoothMinusDM = smoothWilder(minusDM, period);

  const dx: number[] = [];
  for (let i = 0; i < smoothTR.length; i++) {
    if (smoothTR[i] === 0) {
      dx.push(0);
      continue;
    }
    const plusDI = (smoothPlusDM[i] / smoothTR[i]) * 100;
    const minusDI = (smoothMinusDM[i] / smoothTR[i]) * 100;
    const diSum = plusDI + minusDI;
    dx.push(diSum === 0 ? 0 : (Math.abs(plusDI - minusDI) / diSum) * 100);
  }

  // Smooth DX to get ADX
  return smoothWilder(dx, period);
}

function smoothWilder(data: number[], period: number): number[] {
  const result: number[] = [];
  let sum = 0;

  for (let i = 0; i < period && i < data.length; i++) {
    sum += data[i];
  }
  result.push(sum / period);

  for (let i = period; i < data.length; i++) {
    const smoothed = (result[result.length - 1] * (period - 1) + data[i]) / period;
    result.push(smoothed);
  }

  return result;
}

export function calculateATR(
  high: number[],
  low: number[],
  close: number[],
  period: number = 14
): number[] {
  const trueRanges: number[] = [];

  for (let i = 1; i < high.length; i++) {
    const tr = Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i] - close[i - 1])
    );
    trueRanges.push(tr);
  }

  return smoothWilder(trueRanges, period);
}

export function calculateRelativeStrength(
  stockPrices: number[],
  benchmarkPrices: number[],
  period: number = 63 // ~3 months trading days
): number {
  if (stockPrices.length < period || benchmarkPrices.length < period) return 0;

  const stockReturn =
    (stockPrices[stockPrices.length - 1] / stockPrices[stockPrices.length - period] - 1) * 100;
  const benchmarkReturn =
    (benchmarkPrices[benchmarkPrices.length - 1] / benchmarkPrices[benchmarkPrices.length - period] - 1) * 100;

  return stockReturn - benchmarkReturn;
}

export function detectCandlestickPattern(
  open: number[],
  high: number[],
  low: number[],
  close: number[]
): string | null {
  const len = open.length;
  if (len < 2) return null;

  const lastOpen = open[len - 1];
  const lastHigh = high[len - 1];
  const lastLow = low[len - 1];
  const lastClose = close[len - 1];

  const body = Math.abs(lastClose - lastOpen);
  const range = lastHigh - lastLow;
  const upperShadow = lastHigh - Math.max(lastOpen, lastClose);
  const lowerShadow = Math.min(lastOpen, lastClose) - lastLow;

  // Hammer: small body at top, long lower shadow
  if (
    lowerShadow >= body * 2 &&
    upperShadow < body * 0.5 &&
    range > 0
  ) {
    return "Hammer";
  }

  // Bullish Engulfing: current candle engulfs previous
  if (len >= 2) {
    const prevOpen = open[len - 2];
    const prevClose = close[len - 2];
    if (
      prevClose < prevOpen && // previous was bearish
      lastClose > lastOpen && // current is bullish
      lastOpen < prevClose && // current opens below prev close
      lastClose > prevOpen // current closes above prev open
    ) {
      return "Bullish Engulfing";
    }
  }

  // Doji: very small body
  if (body < range * 0.1 && range > 0) {
    return "Doji";
  }

  // Morning Star (3-candle pattern)
  if (len >= 3) {
    const prevPrevClose = close[len - 3];
    const prevPrevOpen = open[len - 3];
    const prevBody = Math.abs(close[len - 2] - open[len - 2]);
    const prevRange = high[len - 2] - low[len - 2];

    if (
      prevPrevClose < prevPrevOpen && // first is bearish
      prevBody < prevRange * 0.3 && // second is small
      lastClose > lastOpen && // third is bullish
      lastClose > (prevPrevOpen + prevPrevClose) / 2 // closes above midpoint of first
    ) {
      return "Morning Star";
    }
  }

  return null;
}

// ============================================================
// MACD (Moving Average Convergence Divergence)
// ============================================================
export interface MACDResult {
  macdLine: number[];
  signalLine: number[];
  histogram: number[];
}

export function calculateMACD(
  close: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  const fastEMA = calculateEMA(close, fastPeriod);
  const slowEMA = calculateEMA(close, slowPeriod);

  // Align lengths: slowEMA starts later than fastEMA
  const offset = slowPeriod - fastPeriod;
  const macdLine: number[] = [];
  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push(fastEMA[i + offset] - slowEMA[i]);
  }

  const signalLine = calculateEMA(macdLine, signalPeriod);
  const signalOffset = macdLine.length - signalLine.length;
  const histogram: number[] = [];
  for (let i = 0; i < signalLine.length; i++) {
    histogram.push(macdLine[i + signalOffset] - signalLine[i]);
  }

  return { macdLine, signalLine, histogram };
}

// ============================================================
// Parabolic SAR (Stop and Reverse)
// ============================================================
export function calculateParabolicSAR(
  high: number[],
  low: number[],
  close: number[],
  afStart: number = 0.02,
  afIncrement: number = 0.02,
  afMax: number = 0.20
): number[] {
  const len = high.length;
  if (len < 2) return [];

  const sar: number[] = new Array(len);
  let isUpTrend = close[1] > close[0];
  let af = afStart;
  let ep = isUpTrend ? high[0] : low[0];

  sar[0] = isUpTrend ? low[0] : high[0];

  for (let i = 1; i < len; i++) {
    const prevSAR = sar[i - 1];
    let currentSAR = prevSAR + af * (ep - prevSAR);

    if (isUpTrend) {
      // In uptrend, SAR cannot be above prior two lows
      if (i >= 2) currentSAR = Math.min(currentSAR, low[i - 1], low[i - 2]);
      else currentSAR = Math.min(currentSAR, low[i - 1]);

      if (low[i] < currentSAR) {
        // Trend reversal to downtrend
        isUpTrend = false;
        currentSAR = ep;
        ep = low[i];
        af = afStart;
      } else {
        if (high[i] > ep) {
          ep = high[i];
          af = Math.min(af + afIncrement, afMax);
        }
      }
    } else {
      // In downtrend, SAR cannot be below prior two highs
      if (i >= 2) currentSAR = Math.max(currentSAR, high[i - 1], high[i - 2]);
      else currentSAR = Math.max(currentSAR, high[i - 1]);

      if (high[i] > currentSAR) {
        // Trend reversal to uptrend
        isUpTrend = true;
        currentSAR = ep;
        ep = high[i];
        af = afStart;
      } else {
        if (low[i] < ep) {
          ep = low[i];
          af = Math.min(af + afIncrement, afMax);
        }
      }
    }

    sar[i] = currentSAR;
  }

  return sar;
}

// ============================================================
// SuperTrend
// ============================================================
export interface SuperTrendResult {
  supertrend: number[];
  direction: ("up" | "down")[];
}

export function calculateSuperTrend(
  high: number[],
  low: number[],
  close: number[],
  period: number = 10,
  multiplier: number = 3
): SuperTrendResult {
  const atr = calculateATR(high, low, close, period);
  const len = atr.length;
  // ATR starts from index 1 of the original data, so offset = original.length - atr.length
  const offset = high.length - len;

  const supertrend: number[] = new Array(len);
  const direction: ("up" | "down")[] = new Array(len);
  const upperBand: number[] = new Array(len);
  const lowerBand: number[] = new Array(len);

  for (let i = 0; i < len; i++) {
    const hl2 = (high[i + offset] + low[i + offset]) / 2;
    upperBand[i] = hl2 + multiplier * atr[i];
    lowerBand[i] = hl2 - multiplier * atr[i];
  }

  // First value
  direction[0] = close[offset] > upperBand[0] ? "up" : "down";
  supertrend[0] = direction[0] === "up" ? lowerBand[0] : upperBand[0];

  for (let i = 1; i < len; i++) {
    const ci = i + offset;

    // Adjust bands based on previous values
    if (lowerBand[i] > lowerBand[i - 1] || close[ci - 1] < lowerBand[i - 1]) {
      // keep lowerBand[i]
    } else {
      lowerBand[i] = lowerBand[i - 1];
    }

    if (upperBand[i] < upperBand[i - 1] || close[ci - 1] > upperBand[i - 1]) {
      // keep upperBand[i]
    } else {
      upperBand[i] = upperBand[i - 1];
    }

    if (direction[i - 1] === "up") {
      direction[i] = close[ci] < lowerBand[i] ? "down" : "up";
    } else {
      direction[i] = close[ci] > upperBand[i] ? "up" : "down";
    }

    supertrend[i] = direction[i] === "up" ? lowerBand[i] : upperBand[i];
  }

  return { supertrend, direction };
}

// ============================================================
// Ichimoku Cloud
// ============================================================
export interface IchimokuResult {
  tenkan: number[];   // Conversion Line (9-period)
  kijun: number[];    // Base Line (26-period)
  senkouA: number[];  // Leading Span A
  senkouB: number[];  // Leading Span B
  chikou: number[];   // Lagging Span
}

function highLowMid(high: number[], low: number[], start: number, end: number): number {
  let hi = -Infinity;
  let lo = Infinity;
  for (let i = start; i <= end; i++) {
    if (high[i] > hi) hi = high[i];
    if (low[i] < lo) lo = low[i];
  }
  return (hi + lo) / 2;
}

export function calculateIchimokuCloud(
  high: number[],
  low: number[],
  close: number[],
  tenkanPeriod: number = 9,
  kijunPeriod: number = 26,
  senkouBPeriod: number = 52
): IchimokuResult {
  const len = high.length;
  const tenkan: number[] = [];
  const kijun: number[] = [];
  const senkouA: number[] = [];
  const senkouB: number[] = [];
  const chikou: number[] = [];

  for (let i = 0; i < len; i++) {
    // Tenkan-sen
    if (i >= tenkanPeriod - 1) {
      tenkan.push(highLowMid(high, low, i - tenkanPeriod + 1, i));
    } else {
      tenkan.push(NaN);
    }

    // Kijun-sen
    if (i >= kijunPeriod - 1) {
      kijun.push(highLowMid(high, low, i - kijunPeriod + 1, i));
    } else {
      kijun.push(NaN);
    }

    // Senkou Span A = (Tenkan + Kijun) / 2, plotted 26 ahead
    if (!isNaN(tenkan[i]) && !isNaN(kijun[i])) {
      senkouA.push((tenkan[i] + kijun[i]) / 2);
    } else {
      senkouA.push(NaN);
    }

    // Senkou Span B = 52-period high-low mid, plotted 26 ahead
    if (i >= senkouBPeriod - 1) {
      senkouB.push(highLowMid(high, low, i - senkouBPeriod + 1, i));
    } else {
      senkouB.push(NaN);
    }

    // Chikou Span = current close, plotted 26 periods back
    chikou.push(close[i]);
  }

  return { tenkan, kijun, senkouA, senkouB, chikou };
}

// ============================================================
// Stochastic Oscillator
// ============================================================
export interface StochasticResult {
  k: number[];
  d: number[];
}

export function calculateStochastic(
  high: number[],
  low: number[],
  close: number[],
  kPeriod: number = 14,
  dPeriod: number = 3,
  smooth: number = 3 // slow stochastic smoothing
): StochasticResult {
  const len = close.length;
  const rawK: number[] = [];

  for (let i = kPeriod - 1; i < len; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (high[j] > highest) highest = high[j];
      if (low[j] < lowest) lowest = low[j];
    }
    const range = highest - lowest;
    rawK.push(range === 0 ? 50 : ((close[i] - lowest) / range) * 100);
  }

  // Slow %K = SMA of raw %K
  const k: number[] = [];
  for (let i = smooth - 1; i < rawK.length; i++) {
    let sum = 0;
    for (let j = i - smooth + 1; j <= i; j++) sum += rawK[j];
    k.push(sum / smooth);
  }

  // %D = SMA of slow %K
  const d: number[] = [];
  for (let i = dPeriod - 1; i < k.length; i++) {
    let sum = 0;
    for (let j = i - dPeriod + 1; j <= i; j++) sum += k[j];
    d.push(sum / dPeriod);
  }

  return { k, d };
}

// ============================================================
// Williams %R
// ============================================================
export function calculateWilliamsR(
  high: number[],
  low: number[],
  close: number[],
  period: number = 14
): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < close.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (high[j] > highest) highest = high[j];
      if (low[j] < lowest) lowest = low[j];
    }
    const range = highest - lowest;
    result.push(range === 0 ? -50 : ((highest - close[i]) / range) * -100);
  }
  return result;
}

// ============================================================
// Rate of Change (ROC)
// ============================================================
export function calculateROC(
  close: number[],
  period: number = 14
): number[] {
  const result: number[] = [];
  for (let i = period; i < close.length; i++) {
    const prev = close[i - period];
    result.push(prev === 0 ? 0 : ((close[i] - prev) / prev) * 100);
  }
  return result;
}

// ============================================================
// Commodity Channel Index (CCI)
// ============================================================
export function calculateCCI(
  high: number[],
  low: number[],
  close: number[],
  period: number = 20
): number[] {
  const tp: number[] = [];
  for (let i = 0; i < close.length; i++) {
    tp.push((high[i] + low[i] + close[i]) / 3);
  }

  const result: number[] = [];
  for (let i = period - 1; i < tp.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += tp[j];
    const sma = sum / period;

    let meanDev = 0;
    for (let j = i - period + 1; j <= i; j++) meanDev += Math.abs(tp[j] - sma);
    meanDev /= period;

    result.push(meanDev === 0 ? 0 : (tp[i] - sma) / (0.015 * meanDev));
  }
  return result;
}

// ============================================================
// Bollinger Bands
// ============================================================
export interface BollingerResult {
  upper: number[];
  middle: number[];
  lower: number[];
  percentB: number[];
  bandwidth: number[];
}

export function calculateBollingerBands(
  close: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): BollingerResult {
  const upper: number[] = [];
  const middle: number[] = [];
  const lower: number[] = [];
  const percentB: number[] = [];
  const bandwidth: number[] = [];

  for (let i = period - 1; i < close.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += close[j];
    const sma = sum / period;

    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (close[j] - sma) ** 2;
    const sd = Math.sqrt(variance / period);

    const ub = sma + stdDevMultiplier * sd;
    const lb = sma - stdDevMultiplier * sd;
    const bw = ub - lb;

    upper.push(ub);
    middle.push(sma);
    lower.push(lb);
    percentB.push(bw === 0 ? 0.5 : (close[i] - lb) / bw);
    bandwidth.push(sma === 0 ? 0 : bw / sma);
  }

  return { upper, middle, lower, percentB, bandwidth };
}

// ============================================================
// On-Balance Volume (OBV)
// ============================================================
export function calculateOBV(
  close: number[],
  volume: number[]
): number[] {
  const result: number[] = [0];
  for (let i = 1; i < close.length; i++) {
    if (close[i] > close[i - 1]) {
      result.push(result[result.length - 1] + volume[i]);
    } else if (close[i] < close[i - 1]) {
      result.push(result[result.length - 1] - volume[i]);
    } else {
      result.push(result[result.length - 1]);
    }
  }
  return result;
}

// ============================================================
// Money Flow Index (MFI)
// ============================================================
export function calculateMFI(
  high: number[],
  low: number[],
  close: number[],
  volume: number[],
  period: number = 14
): number[] {
  const tp: number[] = [];
  for (let i = 0; i < close.length; i++) {
    tp.push((high[i] + low[i] + close[i]) / 3);
  }

  const rawMF: number[] = [];
  for (let i = 0; i < tp.length; i++) {
    rawMF.push(tp[i] * volume[i]);
  }

  const result: number[] = [];
  for (let i = period; i < tp.length; i++) {
    let posMF = 0;
    let negMF = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (tp[j] > tp[j - 1]) posMF += rawMF[j];
      else if (tp[j] < tp[j - 1]) negMF += rawMF[j];
    }
    if (negMF === 0) {
      result.push(100);
    } else {
      const mfRatio = posMF / negMF;
      result.push(100 - 100 / (1 + mfRatio));
    }
  }
  return result;
}

// ============================================================
// VWAP (Volume Weighted Average Price) - intraday
// ============================================================
export function calculateVWAP(
  high: number[],
  low: number[],
  close: number[],
  volume: number[]
): number[] {
  const result: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVol = 0;

  for (let i = 0; i < close.length; i++) {
    const tp = (high[i] + low[i] + close[i]) / 3;
    cumulativeTPV += tp * volume[i];
    cumulativeVol += volume[i];
    result.push(cumulativeVol === 0 ? tp : cumulativeTPV / cumulativeVol);
  }
  return result;
}

// ============================================================
// Accumulation/Distribution Line
// ============================================================
export function calculateADLine(
  high: number[],
  low: number[],
  close: number[],
  volume: number[]
): number[] {
  const result: number[] = [];
  let adl = 0;

  for (let i = 0; i < close.length; i++) {
    const range = high[i] - low[i];
    const mfm = range === 0 ? 0 : ((close[i] - low[i]) - (high[i] - close[i])) / range;
    adl += mfm * volume[i];
    result.push(adl);
  }
  return result;
}
