# Momentum Screening Logic

> Complete explanation of the 6-phase pipeline, all technical indicators, scoring system, and signal assignment.

---

## Overview

The Nifty Velocity Alpha screener processes ~500 NSE-listed stocks through a sequential 6-phase pipeline. Each phase acts as a gate: only stocks passing earlier phases proceed to later stages. The pipeline produces:

- **Momentum Score**: 0-100 points
- **Signal**: STRONG_BUY, BUY, WATCH, NEUTRAL, or AVOID
- **Risk Parameters**: Entry price, stop-loss, target price, risk:reward ratio
- **Rationale**: Human-readable explanation of why the stock scored as it did

### Pipeline Flow

```
NIFTY 500 Stocks (~500)
        |
   Phase 1: Liquidity           ~350 pass (70%)
        |
   Phase 2: Trend                ~120 pass (34% of P1)
        |
   Phase 3: Momentum             ~70 pass (58% of P2)
        |
   Phase 4: Volume               ~35 pass (50% of P3)
        |
   Phase 5: Volatility           ~28 pass (80% of P4)
        |
   Phase 6: Risk Management      All P5 passers get risk calcs
        |
   Score (0-100) + Signal Assignment
        |
   Typical Output: 2-5 STRONG_BUY, 5-12 BUY, 10-20 WATCH
```

---

## Market Regime Detection

Before running the pipeline, the screener detects the macro market condition from Nifty 50 data. This drives adaptive thresholds across all phases.

### Detection Logic

| Regime | Conditions |
|--------|-----------|
| **BULL** | Nifty > EMA50 AND EMA20 > EMA50 AND ADX > 20 |
| **BEAR** | Nifty < EMA50 AND EMA20 < EMA50 AND ADX > 20 |
| **SIDEWAYS** | ADX < 20 (regardless of price position) |

### Adaptive Thresholds

| Parameter | BULL | SIDEWAYS | BEAR |
|-----------|------|----------|------|
| Min ADX | 25 | 30 | 35 |
| RSI Low / High | 40 / 75 | 45 / 65 | 50 / 60 |
| Volume Multiplier | 1.2x | 1.5x | 2.0x |
| Min Risk:Reward | 2:1 | 2.5:1 | 3:1 |
| STRONG_BUY threshold | 75 pts | 80 pts | 85 pts |
| BUY threshold | 55 pts | 60 pts | 65 pts |
| WATCH threshold | 35 pts | 40 pts | 45 pts |

**Rationale**: Bear markets have more false breakouts, so filters are tightened. Bull markets favor trend-following with more lenient criteria.

---

## Phase 1: Universe & Liquidity Filter

**Purpose**: Eliminate illiquid stocks where slippage would destroy trading edge.

**Check**: Average daily turnover >= configured minimum (default: 20 crores)

**Score**: +15 points (if pass)

**Typical Pass Rate**: ~70% of Nifty 500

Stocks failing Phase 1 receive the **AVOID** signal regardless of other indicators.

---

## Phase 2: Trend Establishment

**Purpose**: Confirm the stock is in an established uptrend with directional momentum.

### Checks

| Check | Condition | Default |
|-------|-----------|---------|
| EMA Alignment | Price > EMA20 > EMA50 > EMA200 | Required |
| ADX Strength | ADX(14) > minADX | 25 (regime-adjusted) |
| Relative Strength | RS3M vs Nifty 50 > 0% | Required |
| MACD Bullish | MACD Line > Signal AND > 0 | Required |
| SuperTrend | Direction = "up" | Optional |

### Scoring

| Component | Points |
|-----------|--------|
| Base (pass all checks) | +10 |
| MACD bullish | +3 |
| SuperTrend up | +3 |
| Parabolic SAR up | +2 |
| Ichimoku above cloud | +2 |
| Weekly trend aligned | +5 |
| Weekly trend counter | -10 |

### Weekly Multi-Timeframe Confirmation

Daily candles are aggregated into weekly candles to compute:
- Weekly EMA20
- Weekly RSI(14)
- Weekly MACD histogram

**Status Classification**:
- **Aligned** (+5 pts): Close > weekly EMA20 AND RSI > 40 AND MACD hist > 0
- **Counter-trend** (-10 pts): All three bearish
- **Mixed** (0 pts): Partial

---

## Phase 3: Momentum Signal Detection

**Purpose**: Identify high-probability entry zones with healthy momentum.

**Gate**: Requires >= 3 of the following conditions to pass.

### RSI Tiered Scoring

The RSI(14) is classified into quality tiers instead of a simple pass/fail:

| RSI Range | Tier | Score | Interpretation |
|-----------|------|-------|----------------|
| 45-55 | Optimal | +5 | Perfect pullback zone |
| 55-65 | Good | +4 | Healthy continuation |
| 40-45 or 65-70 | Caution | +2 | Edge of optimal |
| 70-75 | Exhaustion | 0 | Overbought, neutral |
| >75 or <40 | Penalty | -3 | High rejection risk |

### Other Momentum Checks

| Check | Condition | Score |
|-------|-----------|-------|
| EMA Pullback | Price within 3% of EMA20 or EMA50 | +5 |
| ROC Positive | ROC(14) > 0 | +4 |
| +DI > -DI | Directional indicator favors bulls | +4 |
| Stochastic | %K > 50 | +3 |
| MACD Histogram | Histogram > 0 | +2 |
| CCI Strong | CCI(20) > 100 | +2 |
| CCI Bullish | CCI(20) > 0 (but <= 100) | +1 |
| Williams %R | Between -50 and -20 | +2 |
| Divergences | See divergence section below | -15 to +8 |

---

## Divergence Detection

The screener scans the last 50 bars for price-indicator divergences using fractal-based swing point detection (5-bar fractals, minimum 5-bar separation).

### Divergence Types

| Divergence | Condition | Score | Meaning |
|------------|-----------|-------|---------|
| Bullish RSI | Price lower low, RSI higher low | +8 | Hidden momentum strength |
| Bearish RSI | Price higher high, RSI lower high | -10 | Momentum weakening |
| Bullish MACD | Price lower low, histogram higher low | +8 | Bottom confirmation |
| Bearish MACD | Price higher high, histogram lower high | -10 | Trend exhaustion |
| OBV Warning | Price higher high, OBV not confirming | -5 | Distribution signal |
| MFI Warning | Price higher high, MFI declining | -5 | Money exiting |

**Net divergence score is clamped to [-15, +8]** to prevent over-weighting.

---

## Phase 4: Volume Confirmation

**Purpose**: Validate that institutional money backs the momentum signal.

**Gate**: Requires >= 2 conditions to pass.

### Checks

| Check | Condition | Score |
|-------|-----------|-------|
| Volume Above Average | Current > SMA20 x multiplier | +3 |
| OBV Trending Up | OBV(now) > OBV(10 bars ago) | +5 |
| MFI Healthy Zone | MFI between 40-80 | +5 |
| A/D Line Up | A/D trending up | +3 |
| A/D Divergence | Price up but A/D down | -3 |
| Volume Accelerating | 3-bar rising pattern | +5 |
| Volume Steady | Current > avg of prior 2 | +2 |
| Volume Declining | 3-bar falling pattern | -3 |

---

## Phase 5: Volatility Check

**Purpose**: Ensure risk is manageable for position sizing.

### Checks

| Check | Condition | Score |
|-------|-----------|-------|
| ATR Reasonable (required) | ATR/Price < 5% | +4 |
| Bollinger Expanding | Bandwidth > 2% | +3 |
| Price in Upper Band | %B > 0.5 | +3 |

---

## Phase 6: Risk Management

**Purpose**: Calculate precise entry, stop-loss, and target prices.

### Formulas

- **Entry Price** = Current market price
- **Stop Loss** = Entry - (ATR x 1.5)
- **Risk Per Share** = Entry - Stop Loss
- **Target Price** = Entry + (Risk Per Share x R:R ratio)
- **Risk:Reward Ratio** = Regime-adjusted (Bull: 2:1, Sideways: 2.5:1, Bear: 3:1)

### Example

| Parameter | Value |
|-----------|-------|
| Entry | 1,685.00 |
| ATR(14) | 40.00 |
| Stop Loss | 1,685 - (40 x 1.5) = 1,625.00 |
| Risk Per Share | 60.00 |
| Target (2:1) | 1,685 + (60 x 2) = 1,805.00 |
| R:R Ratio | 2.0 |

---

## Bonus Scoring

After the 6 phases, additional context-based bonuses are applied:

| Bonus | Condition | Points |
|-------|-----------|--------|
| ADX Strong | ADX > 35 | +3 |
| Relative Strength | RS3M > 5% | +2 |
| Top Sector | Stock in top 3 sectors | +5 |
| Bottom Sector | Stock in bottom 3 sectors | -5 |

**Final score is clamped to 0-100**.

---

## Sector Rotation Ranking

Sectors are ranked by a composite momentum score:

**Composite** = 0.50 x Normalized RS3M + 0.30 x Breadth + 0.20 x Normalized Week Change

Where:
- **RS3M**: Average 3-month relative strength of stocks in the sector
- **Breadth**: Percentage of stocks above their EMA50
- **Week Change**: Average weekly price change in the sector

Top ~33% of sectors are classified as "Top Sectors" (+5 pts to member stocks).
Bottom ~33% are "Bottom Sectors" (-5 pts).

---

## Signal Assignment

Signals are assigned based on which phases passed and the overall score:

| Signal | Phase Requirements | Score Threshold |
|--------|-------------------|----------------|
| **STRONG_BUY** | P1 + P2 + P3 + P4 (volume) | >= strongBuyThreshold |
| **BUY** | P1 + P2 + P3 | >= buyThreshold |
| **WATCH** | P1 + P2 | >= watchThreshold |
| **NEUTRAL** | P1 only | 15-34 |
| **AVOID** | Failed P1 | 0-14 |

Thresholds are regime-adjusted (see Adaptive Thresholds table above).

---

## Technical Indicators Reference

### Trend Indicators

| Indicator | Period | Formula Summary | Use in Pipeline |
|-----------|--------|----------------|-----------------|
| EMA 20/50/200 | 20, 50, 200 | Exponential weighted average | Phase 2: Alignment check |
| ADX | 14 | Smoothed DX from +DI/-DI | Phase 2: Trend strength |
| +DI / -DI | 14 | Directional movement indicators | Phase 3: Direction |
| SuperTrend | 10, ATR x3 | ATR-based trend bands | Phase 2: Optional trend filter |
| MACD | 12, 26, 9 | EMA12 - EMA26, signal=EMA9 | Phase 2+3: Momentum crossover |
| Parabolic SAR | AF 0.02, max 0.20 | Trailing stop indicator | Phase 2: Trend confirmation |
| Ichimoku Cloud | 9, 26, 52 | 5-component system | Phase 2: Trend confirmation |

### Momentum Indicators

| Indicator | Period | Range | Use in Pipeline |
|-----------|--------|-------|-----------------|
| RSI | 14 | 0-100 | Phase 3: Tiered scoring |
| ROC | 14 | Unbounded | Phase 3: Positive momentum |
| Stochastic %K | 14, 3, 3 | 0-100 | Phase 3: Momentum oscillator |
| Williams %R | 14 | -100 to 0 | Phase 3: Momentum zone |
| CCI | 20 | Unbounded | Phase 3: Cyclical momentum |

### Volume Indicators

| Indicator | Period | Use in Pipeline |
|-----------|--------|-----------------|
| OBV | Cumulative | Phase 4: Accumulation trend |
| MFI | 14 | Phase 4: Volume-weighted RSI |
| A/D Line | Cumulative | Phase 4: Accumulation/distribution |
| VROC | 20 | Phase 4: Volume acceleration |
| Volume SMA | 20 | Phase 4: Baseline comparison |

### Volatility Indicators

| Indicator | Period | Use in Pipeline |
|-----------|--------|-----------------|
| ATR | 14 | Phase 5: Volatility check, Phase 6: Stop-loss |
| Bollinger Bands | 20, 2 std dev | Phase 5: Band expansion, %B position |

### Advanced

| Indicator | Use in Pipeline |
|-----------|-----------------|
| Relative Strength (3M vs Nifty) | Phase 2: Outperformance filter, Bonus scoring |
| Weekly EMA/RSI/MACD | Phase 2: Multi-timeframe confirmation |
| Divergence Detection (4 types) | Phase 3: RSI, MACD, OBV, MFI divergences |

---

## Strategy Presets

Four pre-configured parameter sets for different trading styles:

### Balanced (Default)
All parameters at default values. Middle-ground approach suitable for most market conditions.

### Indian Favourite
Tailored for popular Indian technical analysis style:
- SuperTrend required (popular indicator in India)
- Bollinger expansion required
- RSI range: 45-70 (tighter upper bound)

### Multi-Signal
Requires more confirmations before generating signals:
- Higher ADX minimum (28)
- MACD required
- MFI range: 45-75 (tighter)
- Volume multiplier: 1.5x (higher)

### Conservative
Strictest criteria for risk-averse traders:
- ADX minimum: 30
- RSI range: 50-65 (very tight)
- Volume multiplier: 1.5x
- Risk:Reward: 2.5:1
- Max ATR: 4%
- Max capital risk: 5%

---

## Rebalancing & Exit Signals

Open positions are monitored against current screener data. Five exit conditions are checked:

| Flag | Severity | Trigger |
|------|----------|---------|
| Signal Downgraded | Warning/Critical | Entry was BUY/STRONG_BUY, now WATCH or lower |
| Bearish Divergence | Warning | Bearish divergence detected on current scan |
| Trend Broken | Critical | Phase 2 no longer passes for this stock |
| Extended Hold | Warning | Held > 20 trading days AND P&L negative |
| Stop Loss Breached | Critical | Current price < stop loss |

---

## Portfolio Risk Metrics

Computed from open positions in real-time:

| Metric | Formula | Thresholds |
|--------|---------|-----------|
| Portfolio Heat | Sum(qty x (entry - SL)) / Capital x 100 | Green <10%, Amber 10-20%, Red >20% |
| Worst-Case Loss | Heat + 20% assumed loss for positions without SL | Always displayed |
| Avg Risk:Reward | Position-value weighted average R:R | Green >=2:1, Amber >=1:1, Red <1:1 |
| Sector Concentration | Max single-sector % of portfolio value | Red >40% |
| Overall Risk Level | Additive score from 4 binary checks | Low (0-1), Moderate (2), High (3+) |
