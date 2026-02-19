// Kite Connect API integration layer
// This module provides the interface between the screener and Zerodha's Kite Connect API

import type { StockData, TechnicalIndicators } from "./types";

const KITE_API_BASE = "https://api.kite.trade";

interface KiteConfig {
  apiKey: string;
  accessToken: string;
}

interface KiteInstrument {
  instrument_token: number;
  exchange_token: number;
  tradingsymbol: string;
  name: string;
  exchange: string;
  segment: string;
  instrument_type: string;
}

interface KiteQuote {
  instrument_token: number;
  last_price: number;
  ohlc: { open: number; high: number; low: number; close: number };
  volume: number;
  change: number;
  average_price: number;
}

interface KiteHistorical {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Rate limiter to respect Kite Connect limits
class RateLimiter {
  private timestamps: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(
      (t) => now - t < this.windowMs
    );
    if (this.timestamps.length >= this.maxRequests) {
      const oldest = this.timestamps[0];
      const waitTime = this.windowMs - (now - oldest) + 10;
      await new Promise((r) => setTimeout(r, waitTime));
    }
    this.timestamps.push(Date.now());
  }
}

// Rate limiters per Kite Connect docs: quotes 1/sec, historical 3/sec, orders 10/sec
const quoteLimiter = new RateLimiter(1, 1000);
const historicalLimiter = new RateLimiter(3, 1000);
const orderLimiter = new RateLimiter(10, 1000);

export class KiteAPI {
  private config: KiteConfig;
  private instruments: Map<string, KiteInstrument> = new Map();

  constructor(config: KiteConfig) {
    this.config = config;
  }

  private getHeaders(): HeadersInit {
    return {
      "X-Kite-Version": "3",
      Authorization: `token ${this.config.apiKey}:${this.config.accessToken}`,
    };
  }

  // Fetch instruments list
  async fetchInstruments(exchange: string = "NSE"): Promise<KiteInstrument[]> {
    await quoteLimiter.wait();
    const response = await fetch(
      `${KITE_API_BASE}/instruments/${exchange}`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) throw new Error(`Failed to fetch instruments: ${response.status}`);

    const text = await response.text();
    // Parse CSV response
    const lines = text.split("\n");
    const headers = lines[0].split(",");
    const instruments: KiteInstrument[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      if (values.length < headers.length) continue;

      instruments.push({
        instrument_token: parseInt(values[0]),
        exchange_token: parseInt(values[1]),
        tradingsymbol: values[2],
        name: values[3],
        exchange: values[11] || exchange,
        segment: values[10] || "",
        instrument_type: values[9] || "",
      });
    }

    instruments.forEach((inst) => {
      this.instruments.set(
        `${inst.exchange}:${inst.tradingsymbol}`,
        inst
      );
    });

    return instruments;
  }

  // Fetch quotes for up to 500 instruments
  async fetchQuotes(symbols: string[]): Promise<Map<string, KiteQuote>> {
    await quoteLimiter.wait();
    const params = symbols.map((s) => `i=${s}`).join("&");
    const response = await fetch(
      `${KITE_API_BASE}/quote?${params}`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) throw new Error(`Failed to fetch quotes: ${response.status}`);

    const data = await response.json();
    const quotes = new Map<string, KiteQuote>();

    for (const [key, value] of Object.entries(data.data || {})) {
      quotes.set(key, value as KiteQuote);
    }

    return quotes;
  }

  // Fetch historical candle data
  async fetchHistorical(
    instrumentToken: number,
    interval: string,
    from: Date,
    to: Date
  ): Promise<KiteHistorical[]> {
    await historicalLimiter.wait();
    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];

    const response = await fetch(
      `${KITE_API_BASE}/instruments/historical/${instrumentToken}/${interval}?from=${fromStr}&to=${toStr}`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) throw new Error(`Failed to fetch historical data: ${response.status}`);

    const data = await response.json();
    return (data.data?.candles || []).map((c: number[]) => ({
      date: c[0],
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: c[5],
    }));
  }

  // Place order via Kite
  async placeOrder(params: {
    tradingsymbol: string;
    exchange: string;
    transaction_type: "BUY" | "SELL";
    order_type: "MARKET" | "LIMIT" | "SL" | "SL-M";
    quantity: number;
    price?: number;
    trigger_price?: number;
    product: "CNC" | "MIS" | "NRML";
    validity?: "DAY" | "IOC";
    tag?: string;
  }): Promise<{ order_id: string }> {
    await orderLimiter.wait();

    const response = await fetch(`${KITE_API_BASE}/orders/regular`, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(
        Object.entries(params).reduce(
          (acc, [k, v]) => {
            if (v !== undefined) acc[k] = String(v);
            return acc;
          },
          {} as Record<string, string>
        )
      ),
    });

    if (!response.ok) throw new Error(`Order failed: ${response.status}`);

    const data = await response.json();
    return { order_id: data.data?.order_id };
  }

  // Check margins
  async getMargins(): Promise<{
    equity: { available: { cash: number } };
  }> {
    await quoteLimiter.wait();
    const response = await fetch(`${KITE_API_BASE}/user/margins`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error(`Failed to fetch margins: ${response.status}`);
    const data = await response.json();
    return data.data;
  }

  // Convert Kite data to our StockData format
  static toStockData(
    quote: KiteQuote,
    instrument: KiteInstrument,
    additionalData: Partial<StockData> = {}
  ): StockData {
    return {
      symbol: instrument.tradingsymbol,
      name: instrument.name,
      exchange: instrument.exchange,
      sector: additionalData.sector || "Unknown",
      marketCap: additionalData.marketCap || 0,
      lastPrice: quote.last_price,
      change: quote.change,
      changePercent:
        quote.ohlc.close > 0
          ? ((quote.last_price - quote.ohlc.close) / quote.ohlc.close) * 100
          : 0,
      volume: quote.volume,
      avgDailyTurnover: additionalData.avgDailyTurnover || 0,
      open: quote.ohlc.open,
      high: quote.ohlc.high,
      low: quote.ohlc.low,
      close: quote.last_price,
      previousClose: quote.ohlc.close,
    };
  }
}

// Position sizing calculator
export function calculatePositionSize(
  accountEquity: number,
  riskPercent: number,
  entryPrice: number,
  stopLoss: number,
  maxCapitalPercent: number = 8
): {
  shares: number;
  positionValue: number;
  riskAmount: number;
  riskPerShare: number;
  capitalUsedPercent: number;
} {
  const riskAmount = (accountEquity * riskPercent) / 100;
  const riskPerShare = entryPrice - stopLoss;

  if (riskPerShare <= 0) {
    return {
      shares: 0,
      positionValue: 0,
      riskAmount: 0,
      riskPerShare: 0,
      capitalUsedPercent: 0,
    };
  }

  let shares = Math.floor(riskAmount / riskPerShare);
  let positionValue = shares * entryPrice;

  // Cap at max capital % of equity
  const maxPositionValue = (accountEquity * maxCapitalPercent) / 100;
  if (positionValue > maxPositionValue) {
    shares = Math.floor(maxPositionValue / entryPrice);
    positionValue = shares * entryPrice;
  }

  return {
    shares,
    positionValue,
    riskAmount: shares * riskPerShare,
    riskPerShare,
    capitalUsedPercent: (positionValue / accountEquity) * 100,
  };
}
