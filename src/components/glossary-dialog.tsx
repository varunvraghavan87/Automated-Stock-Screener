"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

// ── Glossary Data ──────────────────────────────────────────────────────────────

type GlossaryCategory = "General" | "Indicator" | "Risk" | "Strategy";

interface GlossaryEntry {
  term: string;
  definition: string;
  category: GlossaryCategory;
}

const GLOSSARY_ENTRIES: GlossaryEntry[] = [
  // General
  {
    term: "Overbought",
    definition:
      "A condition where an indicator (RSI, Stochastic, MFI) signals that buying pressure may be exhausted. RSI > 70, Stochastic > 80, or MFI > 80 are common thresholds. Does not mean the price will immediately reverse.",
    category: "General",
  },
  {
    term: "Oversold",
    definition:
      "A condition where selling pressure may be exhausted. RSI < 30, Stochastic < 20, or MFI < 20. Often signals a potential bounce, but the trend may continue downward in strong bear markets.",
    category: "General",
  },
  {
    term: "Divergence",
    definition:
      "When price and an indicator move in opposite directions. Bullish divergence: price makes lower lows but the indicator makes higher lows (potential reversal up). Bearish divergence: price makes higher highs but indicator makes lower highs (weakening momentum).",
    category: "General",
  },
  {
    term: "Golden Cross",
    definition:
      "When a shorter-period moving average (e.g., 50-day EMA) crosses above a longer-period one (e.g., 200-day EMA). Considered a bullish long-term signal. The opposite is a Death Cross.",
    category: "General",
  },
  {
    term: "Death Cross",
    definition:
      "When a shorter-period moving average crosses below a longer-period one. Considered a bearish long-term signal. The opposite of a Golden Cross.",
    category: "General",
  },
  {
    term: "Breakout",
    definition:
      "When price moves above a resistance level or below a support level with increased volume. Breakouts with volume confirmation are more reliable. False breakouts occur when price quickly reverses back.",
    category: "General",
  },
  {
    term: "Support",
    definition:
      "A price level where buying interest is strong enough to prevent further decline. EMAs, Ichimoku Cloud, and SuperTrend can act as dynamic support. Broken support often becomes resistance.",
    category: "General",
  },
  {
    term: "Resistance",
    definition:
      "A price level where selling pressure is strong enough to prevent further rise. Once broken with volume, resistance often becomes support.",
    category: "General",
  },
  {
    term: "Trend",
    definition:
      "The general direction of price movement. Uptrend: higher highs and higher lows with price above key EMAs. Downtrend: lower highs and lower lows. Sideways: no clear direction, with ADX < 25.",
    category: "General",
  },
  {
    term: "OHLCV",
    definition:
      "Open, High, Low, Close, Volume — the five fundamental data points for each trading period (daily candle). All technical indicators are derived from combinations of these values.",
    category: "General",
  },
  // Indicators
  {
    term: "EMA (Exponential Moving Average)",
    definition:
      "A moving average that gives more weight to recent prices, making it more responsive than a Simple Moving Average. The screener uses EMA 20 (short-term), EMA 50 (medium-term), and EMA 200 (long-term). Trend alignment requires price > EMA20 > EMA50 > EMA200.",
    category: "Indicator",
  },
  {
    term: "RSI (Relative Strength Index)",
    definition:
      "Momentum oscillator (0-100) measuring speed and magnitude of price changes. The screener uses tiered zones: 45-55 = optimal entry, 55-65 = good, 65-70 = caution, >70 = overbought, <30 = oversold. RSI between 50-70 indicates healthy bullish momentum.",
    category: "Indicator",
  },
  {
    term: "MACD",
    definition:
      "Moving Average Convergence Divergence consists of the MACD Line (12-EMA minus 26-EMA), Signal Line (9-EMA of MACD Line), and Histogram (difference between the two). Bullish when MACD Line > Signal Line and both above zero.",
    category: "Indicator",
  },
  {
    term: "ADX (Average Directional Index)",
    definition:
      "Measures trend strength on a scale of 0-100 (does not indicate direction). ADX > 25 = trending market, > 40 = very strong trend, < 20 = no trend (sideways). Used with +DI (bullish direction) and -DI (bearish direction).",
    category: "Indicator",
  },
  {
    term: "+DI / -DI (Directional Indicators)",
    definition:
      "Part of the ADX system. +DI measures bullish pressure, -DI measures bearish pressure. When +DI > -DI, buyers are stronger than sellers. The gap between them indicates the strength of directional conviction.",
    category: "Indicator",
  },
  {
    term: "ATR (Average True Range)",
    definition:
      "Measures daily price volatility in absolute terms. Used for stop-loss placement (typically 1.5x ATR below entry) and position sizing. ATR < 5% of stock price = manageable volatility for swing trading.",
    category: "Indicator",
  },
  {
    term: "Bollinger Bands",
    definition:
      "Three bands: Middle (20-day SMA), Upper (Middle + 2 std devs), Lower (Middle - 2 std devs). %B measures position within bands (>0.5 = upper half). Expanding bandwidth indicates increasing volatility and potential breakout.",
    category: "Indicator",
  },
  {
    term: "SuperTrend",
    definition:
      "An ATR-based trend-following indicator popular in Indian markets. When UP, the line acts as dynamic support below price. When DOWN, it acts as dynamic resistance above price. Uses ATR period 10 and multiplier 3.",
    category: "Indicator",
  },
  {
    term: "Parabolic SAR",
    definition:
      "Stop and Reverse indicator that places dots above (downtrend) or below (uptrend) price. The dots act as trailing stop levels that accelerate as the trend strengthens. A flip from above to below signals a potential trend reversal.",
    category: "Indicator",
  },
  {
    term: "Ichimoku Cloud",
    definition:
      "A comprehensive indicator with five lines forming a 'cloud' (Kumo). Price ABOVE the cloud = bullish. BELOW = bearish. INSIDE = indecisive/avoid. The cloud provides dynamic support and resistance levels.",
    category: "Indicator",
  },
  {
    term: "OBV (On-Balance Volume)",
    definition:
      "Cumulative indicator that adds volume on up-days and subtracts on down-days. Rising OBV = accumulation (buying pressure). Falling OBV = distribution. OBV diverging from price warns of potential reversal.",
    category: "Indicator",
  },
  {
    term: "MFI (Money Flow Index)",
    definition:
      "Volume-weighted RSI on a scale of 0-100. Combines price and volume to measure buying/selling pressure. 40-80 = healthy zone. >80 = overbought. <20 = oversold. More reliable than RSI because it includes volume.",
    category: "Indicator",
  },
  {
    term: "Stochastic Oscillator",
    definition:
      "Shows where the current close is relative to the high-low range over 14 periods. %K > 50 = bullish momentum. %K > 80 = overbought. %K < 20 = oversold. %K crossing above %D is a buy signal.",
    category: "Indicator",
  },
  {
    term: "CCI (Commodity Channel Index)",
    definition:
      "Measures price deviation from its statistical mean. CCI > +100 = strong uptrend, > 0 = moderate bullish, < -100 = strong downtrend. Despite its name, it works on all instruments including stocks.",
    category: "Indicator",
  },
  {
    term: "Williams %R",
    definition:
      "Momentum indicator on a -100 to 0 scale (inverted). -20 to -50 = healthy bullish zone. Above -20 = overbought. Below -80 = oversold. Similar to Stochastic but on an inverted scale.",
    category: "Indicator",
  },
  {
    term: "ROC (Rate of Change)",
    definition:
      "Percentage change in price over a specified period (14 days in the screener). Positive ROC = upward momentum. Rising ROC = accelerating trend. ROC crossing zero can signal trend changes.",
    category: "Indicator",
  },
  {
    term: "A/D Line (Accumulation/Distribution)",
    definition:
      "Tracks money flow using the position of the close relative to the high-low range, weighted by volume. Rising A/D = accumulation (smart money buying). Falling A/D = distribution (selling). Divergence from price is a warning sign.",
    category: "Indicator",
  },
  // Risk
  {
    term: "Risk:Reward Ratio",
    definition:
      "The ratio between potential loss (entry to stop-loss) and potential gain (entry to target). A 1:2 ratio means you risk ₹1 to make ₹2. The screener requires minimum 2:1 (risking 1 unit to gain 2). Higher ratios allow lower win rates to be profitable.",
    category: "Risk",
  },
  {
    term: "Stop Loss",
    definition:
      "A predefined exit price to limit losses. The screener places stops at 1.5x ATR below the entry price. This ATR-based approach adapts to each stock's volatility — volatile stocks get wider stops, stable stocks get tighter stops.",
    category: "Risk",
  },
  {
    term: "Position Sizing",
    definition:
      "Determining how many shares to buy based on your risk tolerance. Formula: Shares = (Capital × Risk%) / (Entry - StopLoss). With ₹10L capital and 2% risk, you risk ₹20,000 per trade. If stop-loss distance is ₹10, buy 2,000 shares.",
    category: "Risk",
  },
  {
    term: "Portfolio Heat",
    definition:
      "Total capital at risk across all open positions. Calculated as the sum of (quantity × stop-loss distance) for each position. Should ideally stay below 10-20% of total capital to survive simultaneous stop-outs.",
    category: "Risk",
  },
  // Strategy
  {
    term: "Market Regime",
    definition:
      "The overall market condition — BULL (Nifty above EMA20 and EMA50, ADX > 25), BEAR (below EMAs), or SIDEWAYS (mixed signals, low ADX). The screener adapts thresholds: bull markets use standard settings, bear markets tighten criteria.",
    category: "Strategy",
  },
  {
    term: "Sector Rotation",
    definition:
      "The tendency for different market sectors to outperform at different times. The screener ranks sectors by relative strength, breadth (% of stocks above EMA50), and momentum. Top 3 sectors get +5 score bonus, bottom 3 get -5 penalty.",
    category: "Strategy",
  },
  {
    term: "Multi-Timeframe Confirmation",
    definition:
      "Checking signals across daily and weekly timeframes. When both timeframes agree (ALIGNED), the signal is strongest. When daily trend opposes weekly trend (COUNTER), trades are riskier. The screener checks weekly EMA20, RSI, and MACD.",
    category: "Strategy",
  },
];

const CATEGORIES: GlossaryCategory[] = ["General", "Indicator", "Risk", "Strategy"];

const CATEGORY_COLORS: Record<GlossaryCategory, string> = {
  General: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  Indicator: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  Risk: "bg-red-500/10 text-red-500 border-red-500/20",
  Strategy: "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

// ── Component ──────────────────────────────────────────────────────────────────

interface GlossaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlossaryDialog({ open, onOpenChange }: GlossaryDialogProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<GlossaryCategory | "All">("All");

  const filtered = useMemo(() => {
    let entries = GLOSSARY_ENTRIES;

    if (activeCategory !== "All") {
      entries = entries.filter((e) => e.category === activeCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.term.toLowerCase().includes(q) ||
          e.definition.toLowerCase().includes(q)
      );
    }

    return entries;
  }, [search, activeCategory]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Glossary & Quick Reference</DialogTitle>
          <DialogDescription>
            Search {GLOSSARY_ENTRIES.length} terms used in momentum trading and the screener pipeline.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search terms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveCategory("All")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              activeCategory === "All"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            All ({GLOSSARY_ENTRIES.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = GLOSSARY_ENTRIES.filter((e) => e.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Terms List */}
        <div className="overflow-y-auto flex-1 space-y-3 pr-1 min-h-0">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No terms match &quot;{search}&quot;
            </div>
          ) : (
            filtered.map((entry) => (
              <div
                key={entry.term}
                className="p-3 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h4 className="font-semibold text-sm">{entry.term}</h4>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${CATEGORY_COLORS[entry.category]}`}
                  >
                    {entry.category}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {entry.definition}
                </p>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
