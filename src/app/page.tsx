"use client";

import { useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  TrendingUp,
  Filter,
  Zap,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Clock,
  Target,
  Shield,
  Volume2,
  Waves,
  Wifi,
  WifiOff,
  RefreshCw,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { useScreenerData } from "@/hooks/useScreenerData";
import { PaperBuyDialog } from "@/components/trade-actions/PaperBuyDialog";
import { WatchlistButton } from "@/components/trade-actions/WatchlistButton";
import { useSortable } from "@/hooks/useSortable";
import { SortableHeader } from "@/components/ui/sortable-header";
import type { ScreenerResult, MarketRegimeInfo } from "@/lib/types";

export default function DashboardPage() {
  const { results, mode, loading, lastRefresh, kiteStatus, marketRegime, adaptiveThresholds, refresh } =
    useScreenerData();
  const [buyingStock, setBuyingStock] = useState<ScreenerResult | null>(null);
  const top10 = results.slice(0, 10);
  const { sortedData: sortedResults, requestSort, getSortIndicator } =
    useSortable(top10, { key: "overallScore", direction: "desc" });

  const strongBuys = results.filter((r) => r.signal === "STRONG_BUY");
  const buys = results.filter((r) => r.signal === "BUY");
  const watches = results.filter((r) => r.signal === "WATCH");
  const topPick = results[0];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Momentum Dashboard</h1>
            <p className="text-muted-foreground">
              Nifty Velocity Alpha Framework - Automated Momentum Screener
            </p>
          </div>
          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <Badge
              variant={mode === "live" ? "success" : "outline"}
              className="gap-1"
            >
              {mode === "live" ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              {mode === "live" ? "LIVE" : "DEMO"}
            </Badge>
            <div className="text-sm text-muted-foreground">
              Last scan:{" "}
              <span className="font-mono text-foreground">
                {lastRefresh.toLocaleTimeString("en-IN")}
              </span>
            </div>
            <Button onClick={() => refresh()} disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Data
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Market Regime Badge */}
        <MarketRegimeBanner regime={marketRegime} />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card/50 backdrop-blur border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-accent/10">
                  <TrendingUp className="w-4 h-4 text-accent" />
                </div>
                <span className="text-sm text-muted-foreground">Strong Buy</span>
              </div>
              <div className="text-3xl font-bold text-accent">
                {strongBuys.length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">Buy</span>
              </div>
              <div className="text-3xl font-bold text-primary">{buys.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-[#f59e0b]/10">
                  <Clock className="w-4 h-4 text-[#f59e0b]" />
                </div>
                <span className="text-sm text-muted-foreground">Watch</span>
              </div>
              <div className="text-3xl font-bold text-[#f59e0b]">
                {watches.length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <BarChart3 className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">Scanned</span>
              </div>
              <div className="text-3xl font-bold">{results.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Top Pick & Pipeline */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {topPick && (
            <Card className="md:col-span-2 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Top Momentum Pick</CardTitle>
                  <SignalBadge signal={topPick.signal} />
                </div>
                <CardDescription>
                  Highest scoring stock from the current scan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-2xl font-bold">{topPick.stock.symbol}</h3>
                    <p className="text-sm text-muted-foreground">
                      {topPick.stock.name}
                    </p>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-2xl font-bold">
                      {formatCurrency(topPick.stock.lastPrice)}
                    </div>
                    <div
                      className={`text-sm font-mono ${
                        topPick.stock.changePercent >= 0
                          ? "text-accent"
                          : "text-destructive"
                      }`}
                    >
                      {formatPercent(topPick.stock.changePercent)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-3 rounded-lg bg-background/50 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Entry</p>
                    <p className="font-bold text-primary">
                      {formatCurrency(topPick.phase6.entryPrice)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-background/50 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Stop Loss</p>
                    <p className="font-bold text-destructive">
                      {formatCurrency(topPick.phase6.stopLoss)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-background/50 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Target</p>
                    <p className="font-bold text-accent">
                      {formatCurrency(topPick.phase6.target)}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">
                      Momentum Score
                    </span>
                    <span className="font-mono font-bold">
                      {topPick.overallScore}/100
                    </span>
                  </div>
                  <Progress value={topPick.overallScore} className="h-2" />
                </div>

                <p className="text-sm text-muted-foreground">
                  {topPick.rationale}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Screening Pipeline */}
          <Card className="bg-card/50 backdrop-blur border-border">
            <CardHeader>
              <CardTitle className="text-lg">Screening Pipeline</CardTitle>
              <CardDescription>6-phase momentum filter status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PipelineStep
                phase={1}
                title="Universe & Liquidity"
                passed={results.filter((r) => r.phase1Pass).length}
                total={results.length}
                color="#3b82f6"
              />
              <PipelineStep
                phase={2}
                title="Trend Establishment"
                passed={results.filter((r) => r.phase2Pass).length}
                total={results.filter((r) => r.phase1Pass).length}
                color="#10b981"
              />
              <PipelineStep
                phase={3}
                title="Momentum Signal"
                passed={results.filter((r) => r.phase3Pass).length}
                total={results.filter((r) => r.phase2Pass).length}
                color="#f59e0b"
              />
              <PipelineStep
                phase={4}
                title="Volume Confirmation"
                passed={results.filter((r) => r.phase4VolumePass).length}
                total={results.filter((r) => r.phase3Pass).length}
                color="#8b5cf6"
              />
              <PipelineStep
                phase={5}
                title="Volatility Check"
                passed={results.filter((r) => r.phase5VolatilityPass).length}
                total={results.filter((r) => r.phase4VolumePass).length}
                color="#ec4899"
              />
              <PipelineStep
                phase={6}
                title="Risk Management"
                passed={
                  results.filter(
                    (r) => r.phase5VolatilityPass && r.phase6.riskRewardRatio >= 2
                  ).length
                }
                total={results.filter((r) => r.phase5VolatilityPass).length}
                color="#ef4444"
              />

              <Link href="/screener">
                <Button variant="outline" className="w-full mt-4">
                  View Full Results
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Results Table */}
        <Card className="bg-card/50 backdrop-blur border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Screener Results</CardTitle>
                <CardDescription>Stocks ranked by momentum score</CardDescription>
              </div>
              <Link href="/screener">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2">
                      <SortableHeader label="Symbol" sortKey="stock.symbol" sortIndicator={getSortIndicator("stock.symbol")} onSort={requestSort} />
                    </th>
                    <th className="text-right py-3 px-2">
                      <SortableHeader label="Price" sortKey="stock.lastPrice" sortIndicator={getSortIndicator("stock.lastPrice")} onSort={requestSort} className="justify-end" />
                    </th>
                    <th className="text-right py-3 px-2">
                      <SortableHeader label="Change" sortKey="stock.changePercent" sortIndicator={getSortIndicator("stock.changePercent")} onSort={requestSort} className="justify-end" />
                    </th>
                    <th className="text-center py-3 px-2">
                      <SortableHeader label="Signal" sortKey="signal" sortIndicator={getSortIndicator("signal")} onSort={requestSort} className="justify-center" />
                    </th>
                    <th className="text-center py-3 px-2">
                      <SortableHeader label="Score" sortKey="overallScore" sortIndicator={getSortIndicator("overallScore")} onSort={requestSort} className="justify-center" />
                    </th>
                    <th className="text-right py-3 px-2 hidden md:table-cell">
                      <SortableHeader label="RSI" sortKey="indicators.rsi14" sortIndicator={getSortIndicator("indicators.rsi14")} onSort={requestSort} className="justify-end" />
                    </th>
                    <th className="text-right py-3 px-2 hidden md:table-cell">
                      <SortableHeader label="ADX" sortKey="indicators.adx14" sortIndicator={getSortIndicator("indicators.adx14")} onSort={requestSort} className="justify-end" />
                    </th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground hidden lg:table-cell">
                      Phases
                    </th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((result) => (
                    <tr
                      key={result.stock.symbol}
                      className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                    >
                      <td className="py-3 px-2">
                        <div>
                          <span className="font-semibold">
                            {result.stock.symbol}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {result.stock.sector}
                          </p>
                        </div>
                      </td>
                      <td className="text-right py-3 px-2 font-mono">
                        {formatCurrency(result.stock.lastPrice)}
                      </td>
                      <td className="text-right py-3 px-2">
                        <span
                          className={`font-mono text-sm ${
                            result.stock.changePercent >= 0
                              ? "text-accent"
                              : "text-destructive"
                          }`}
                        >
                          {formatPercent(result.stock.changePercent)}
                        </span>
                      </td>
                      <td className="text-center py-3 px-2">
                        <SignalBadge signal={result.signal} />
                      </td>
                      <td className="text-center py-3 px-2">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16">
                            <Progress
                              value={result.overallScore}
                              className="h-1.5"
                            />
                          </div>
                          <span className="text-xs font-mono">
                            {result.overallScore}
                          </span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-2 font-mono text-sm hidden md:table-cell">
                        {result.indicators.rsi14.toFixed(1)}
                      </td>
                      <td className="text-right py-3 px-2 font-mono text-sm hidden md:table-cell">
                        {result.indicators.adx14.toFixed(1)}
                      </td>
                      <td className="text-center py-3 px-2 hidden lg:table-cell">
                        <div className="flex items-center justify-center gap-1">
                          <PhaseIndicator passed={result.phase1Pass} />
                          <PhaseIndicator passed={result.phase2Pass} />
                          <PhaseIndicator passed={result.phase3Pass} />
                          <PhaseIndicator passed={result.phase4VolumePass} />
                          <PhaseIndicator passed={result.phase5VolatilityPass} />
                          <PhaseIndicator
                            passed={result.phase6.riskRewardRatio >= 2}
                          />
                        </div>
                      </td>
                      <td className="text-right py-3 px-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setBuyingStock(result)}
                          >
                            <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                            Buy
                          </Button>
                          <WatchlistButton
                            stock={{
                              symbol: result.stock.symbol,
                              name: result.stock.name,
                              exchange: result.stock.exchange,
                              sector: result.stock.sector,
                              lastPrice: result.stock.lastPrice,
                              signal: result.signal,
                              overallScore: result.overallScore,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Framework Overview Cards */}
        <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4 mt-8">
          <FrameworkCard
            icon={Target}
            phase={1}
            title="Universe & Liquidity"
            items={[
              "Nifty 500 constituents",
              "Market Cap > ₹5,000 Cr",
              "Avg Turnover > ₹20 Cr",
            ]}
            color="#3b82f6"
            learnMore={{
              description: "Ensures only liquid, actively-traded stocks enter the pipeline. Illiquid stocks cause slippage and unreliable indicators.",
              indicators: ["Average Daily Turnover", "Market Capitalization"],
              passCriteria: "Stock must have avg daily turnover ≥₹20 Cr to pass.",
            }}
          />
          <FrameworkCard
            icon={TrendingUp}
            phase={2}
            title="Trend Establishment"
            items={[
              "EMA Alignment (20>50>200)",
              "ADX(14) > 25",
              "MACD bullish above zero",
            ]}
            color="#10b981"
            learnMore={{
              description: "Confirms the stock is in a well-defined uptrend across multiple timeframes before looking for entries.",
              indicators: ["EMA 20/50/200", "ADX(14)", "MACD", "SuperTrend", "Relative Strength 3M", "Weekly Trend"],
              passCriteria: "EMA alignment + ADX ≥25 + positive 3-month relative strength vs Nifty.",
            }}
          />
          <FrameworkCard
            icon={Zap}
            phase={3}
            title="Momentum Signal"
            items={[
              "Pullback to 20/50 EMA",
              "RSI(14) in 40-75 zone",
              "ROC positive, +DI > -DI",
            ]}
            color="#f59e0b"
            learnMore={{
              description: "Identifies high-probability entry points within the established trend. Looks for pullbacks and momentum confirmation.",
              indicators: ["RSI(14) tiered zones", "ROC(14)", "+DI/-DI", "Stochastic %K", "CCI(20)", "Williams %R", "Divergences"],
              passCriteria: "At least 3 of 5 core conditions met: EMA pullback, RSI in zone, ROC positive, +DI > -DI, Stochastic bullish.",
            }}
          />
          <FrameworkCard
            icon={Volume2}
            phase={4}
            title="Volume Confirmation"
            items={[
              "OBV trending up",
              "Volume > 1.2x average",
              "MFI in 40-80 zone",
            ]}
            color="#8b5cf6"
            learnMore={{
              description: "Validates that real institutional money backs the momentum signal. Price moves without volume often fail.",
              indicators: ["OBV trend", "Volume vs 20-day avg", "MFI(14)", "A/D Line", "3-bar volume acceleration"],
              passCriteria: "At least 2 of 3: volume above average, MFI in healthy range, OBV trending up.",
            }}
          />
          <FrameworkCard
            icon={Waves}
            phase={5}
            title="Volatility Check"
            items={[
              "ATR/Close < 5%",
              "Bollinger expanding",
              "Price in upper band",
            ]}
            color="#ec4899"
            learnMore={{
              description: "Ensures risk is manageable and the stock is not too volatile for position sizing. Expanding Bollinger bands confirm breakout momentum.",
              indicators: ["ATR(14) as % of price", "Bollinger Band width", "Bollinger %B"],
              passCriteria: "ATR must be <5% of price. Bollinger bands expanding (bandwidth > 2%).",
            }}
          />
          <FrameworkCard
            icon={Shield}
            phase={6}
            title="Risk Management"
            items={[
              "Stop Loss: 1.5x ATR",
              "Target: Min 1:2 R:R",
              "Max 8% capital risk",
            ]}
            color="#ef4444"
            learnMore={{
              description: "Sets precise entry, stop-loss, and target levels for execution. No trade should risk more than 2% of capital.",
              indicators: ["ATR-based stop-loss (1.5x ATR)", "Risk:Reward ratio", "Position size calculator"],
              passCriteria: "Minimum 2:1 reward-to-risk ratio. Maximum 8% of capital per position.",
            }}
          />
        </div>
      </main>

      {/* Paper Buy Dialog */}
      {buyingStock && (
        <PaperBuyDialog
          open={!!buyingStock}
          onOpenChange={(open) => !open && setBuyingStock(null)}
          stock={{
            symbol: buyingStock.stock.symbol,
            name: buyingStock.stock.name,
            exchange: buyingStock.stock.exchange,
            sector: buyingStock.stock.sector,
            lastPrice: buyingStock.stock.lastPrice,
            signal: buyingStock.signal,
            overallScore: buyingStock.overallScore,
            stopLoss: buyingStock.phase6.stopLoss,
            target: buyingStock.phase6.target,
          }}
        />
      )}
    </div>
  );
}

function PipelineStep({
  phase,
  title,
  passed,
  total,
  color,
}: {
  phase: number;
  title: string;
  passed: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (passed / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {phase}
          </div>
          <span className="text-sm font-medium">{title}</span>
        </div>
        <span className="text-sm font-mono text-muted-foreground">
          {passed}/{total}
        </span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function SignalBadge({ signal }: { signal: string }) {
  const config: Record<
    string,
    { variant: "success" | "default" | "outline" | "destructive"; label: string }
  > = {
    STRONG_BUY: { variant: "success", label: "STRONG BUY" },
    BUY: { variant: "default", label: "BUY" },
    WATCH: { variant: "outline", label: "WATCH" },
    NEUTRAL: { variant: "outline", label: "NEUTRAL" },
    AVOID: { variant: "destructive", label: "AVOID" },
  };
  const { variant, label } = config[signal] || {
    variant: "outline" as const,
    label: signal,
  };
  return (
    <Badge variant={variant} className="text-[10px]">
      {label}
    </Badge>
  );
}

function PhaseIndicator({ passed }: { passed: boolean }) {
  return (
    <div
      className={`w-3 h-3 rounded-full ${passed ? "bg-accent" : "bg-secondary"}`}
    />
  );
}

function MarketRegimeBanner({ regime }: { regime: MarketRegimeInfo }) {
  const regimeConfig: Record<
    string,
    { color: string; bg: string; border: string; icon: string; label: string }
  > = {
    BULL: {
      color: "text-accent",
      bg: "bg-accent/10",
      border: "border-accent/30",
      icon: "text-accent",
      label: "BULL MARKET",
    },
    BEAR: {
      color: "text-destructive",
      bg: "bg-destructive/10",
      border: "border-destructive/30",
      icon: "text-destructive",
      label: "BEAR MARKET",
    },
    SIDEWAYS: {
      color: "text-[#f59e0b]",
      bg: "bg-[#f59e0b]/10",
      border: "border-[#f59e0b]/30",
      icon: "text-[#f59e0b]",
      label: "SIDEWAYS",
    },
  };

  const cfg = regimeConfig[regime.regime] || regimeConfig.SIDEWAYS;

  return (
    <Card className={`mb-6 ${cfg.bg} backdrop-blur ${cfg.border}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${cfg.bg}`}>
              <Activity className={`w-5 h-5 ${cfg.icon}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${cfg.color}`}>
                  Market Regime: {cfg.label}
                </span>
                {regime.indiaVIX !== null && (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    VIX: {regime.indiaVIX.toFixed(1)}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                {regime.description}
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground font-mono">
            <div>
              <span className="text-muted-foreground">Nifty: </span>
              <span className="text-foreground font-semibold">
                {regime.niftyClose.toFixed(0)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">EMA20: </span>
              <span className="text-foreground">{regime.niftyEMA20.toFixed(0)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">EMA50: </span>
              <span className="text-foreground">{regime.niftyEMA50.toFixed(0)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">ADX: </span>
              <span className="text-foreground">{regime.niftyADX.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FrameworkCard({
  icon: Icon,
  phase,
  title,
  items,
  color,
  learnMore,
}: {
  icon: React.ComponentType<{ className?: string }>;
  phase: number;
  title: string;
  items: string[];
  color: string;
  learnMore?: {
    description: string;
    indicators: string[];
    passCriteria: string;
  };
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="bg-card/50 backdrop-blur border-border hover:border-primary/30 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${color}20`, color }}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-mono">
              Phase {phase}
            </p>
            <h3 className="font-semibold text-sm">{title}</h3>
          </div>
        </div>
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li
              key={i}
              className="text-xs text-muted-foreground flex items-start gap-2"
            >
              <CheckCircle2
                className="w-3 h-3 mt-0.5 flex-shrink-0"
                style={{ color }}
              />
              {item}
            </li>
          ))}
        </ul>

        {learnMore && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 mt-3 text-xs font-medium transition-colors hover:text-foreground"
              style={{ color }}
            >
              {expanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              {expanded ? "Less" : "Learn More"}
            </button>

            {expanded && (
              <div className="mt-3 pt-3 border-t border-border space-y-2.5">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {learnMore.description}
                </p>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1">
                    Indicators Used
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {learnMore.indicators.map((ind) => (
                      <Badge key={ind} variant="outline" className="text-[10px] px-1.5 py-0">
                        {ind}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1">
                    Pass Criteria
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {learnMore.passCriteria}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
