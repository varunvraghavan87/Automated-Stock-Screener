"use client";

import { useState, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Settings2,
  RefreshCw,
  Wifi,
  WifiOff,
  Link2,
  Link2Off,
  ShoppingCart,
  AlertTriangle,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type ScreenerConfig,
  type ScreenerResult,
  type MarketRegimeInfo,
  type AdaptiveThresholds,
  type ScreenerStrategy,
  DEFAULT_SCREENER_CONFIG,
  STRATEGY_LABELS,
  STRATEGY_PRESETS,
  computeSignalChange,
} from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { useScreenerData } from "@/hooks/useScreenerData";
import { PaperBuyDialog } from "@/components/trade-actions/PaperBuyDialog";
import { WatchlistButton } from "@/components/trade-actions/WatchlistButton";

export default function ScreenerPage() {
  const [config, setConfig] = useState<ScreenerConfig>(DEFAULT_SCREENER_CONFIG);
  const [activeStrategy, setActiveStrategy] =
    useState<ScreenerStrategy>("balanced");
  const [search, setSearch] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [signalFilter, setSignalFilter] = useState<string>("all");
  const [showConfig, setShowConfig] = useState(false);
  const [buyingStock, setBuyingStock] = useState<ScreenerResult | null>(null);

  const {
    results,
    mode,
    loading,
    lastRefresh,
    kiteStatus,
    marketRegime,
    adaptiveThresholds,
    previousSignals,
    refresh,
    connectKite,
    disconnectKite,
  } = useScreenerData();

  const filtered = useMemo(() => {
    let list = [...results];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.stock.symbol.toLowerCase().includes(q) ||
          r.stock.name.toLowerCase().includes(q) ||
          r.stock.sector.toLowerCase().includes(q)
      );
    }
    if (signalFilter !== "all") {
      list = list.filter((r) => r.signal === signalFilter);
    }
    return list;
  }, [results, search, signalFilter]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Momentum Screener</h1>
            <p className="text-muted-foreground">
              6-Phase screening with configurable parameters
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
            <div className="text-xs text-muted-foreground font-mono">
              {lastRefresh.toLocaleTimeString("en-IN")}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refresh(config)}
              disabled={loading}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Refresh Data
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
            >
              <Settings2 className="w-4 h-4 mr-2" />
              Config
            </Button>
          </div>
        </div>

        {/* Kite Connect Panel */}
        <Card className="mb-6 bg-card/50 backdrop-blur border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {kiteStatus.connected ? (
                  <Link2 className="w-5 h-5 text-accent" />
                ) : (
                  <Link2Off className="w-5 h-5 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {kiteStatus.connected
                      ? "Connected to Kite"
                      : "Kite Connect"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {kiteStatus.connected
                      ? "Session active — expires at 6:00 AM IST"
                      : kiteStatus.configured
                        ? "Click Connect to authenticate with Zerodha"
                        : "Set KITE_API_KEY and KITE_API_SECRET env vars to enable"}
                  </p>
                </div>
              </div>
              {kiteStatus.configured && (
                <Button
                  variant={kiteStatus.connected ? "outline" : "default"}
                  size="sm"
                  onClick={
                    kiteStatus.connected ? disconnectKite : connectKite
                  }
                >
                  {kiteStatus.connected ? "Disconnect" : "Connect to Kite"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Market Regime Banner */}
        <MarketRegimeBanner regime={marketRegime} thresholds={adaptiveThresholds} />

        {/* Configuration Panel */}
        {showConfig && (
          <Card className="mb-8 bg-card/50 backdrop-blur border-border">
            <CardHeader>
              <CardTitle className="text-lg">Screener Configuration</CardTitle>
              <CardDescription>
                Adjust the 6-phase filter parameters
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Strategy Presets */}
              <div className="mb-6">
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Strategy Preset
                </Label>
                <div className="flex flex-wrap gap-2">
                  {(
                    Object.keys(STRATEGY_LABELS) as ScreenerStrategy[]
                  ).map((key) => {
                    const { name, description } = STRATEGY_LABELS[key];
                    const isActive = activeStrategy === key;
                    return (
                      <Tooltip key={key}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => {
                              setActiveStrategy(key);
                              setConfig({
                                ...DEFAULT_SCREENER_CONFIG,
                                ...STRATEGY_PRESETS[key],
                              });
                            }}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                              isActive
                                ? "bg-primary/15 text-primary border border-primary/30"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
                            }`}
                          >
                            {name}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[240px]">
                          <p className="text-xs">{description}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>

              <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-primary">
                    Phase 1: Universe
                  </h4>
                  <div className="space-y-2">
                    <Label>Min Avg Turnover (Cr)</Label>
                    <Input
                      type="number"
                      value={config.minAvgDailyTurnover}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          minAvgDailyTurnover: Number(e.target.value),
                        })
                      }
                      className="bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-accent">
                    Phase 2: Trend
                  </h4>
                  <div className="space-y-2">
                    <Label>Min ADX</Label>
                    <Input
                      type="number"
                      value={config.minADX}
                      onChange={(e) =>
                        setConfig({ ...config, minADX: Number(e.target.value) })
                      }
                      className="bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-[#f59e0b]">
                    Phase 3: Momentum
                  </h4>
                  <div className="space-y-2">
                    <Label>RSI Low</Label>
                    <Input
                      type="number"
                      value={config.rsiLow}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          rsiLow: Number(e.target.value),
                        })
                      }
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>RSI High</Label>
                    <Input
                      type="number"
                      value={config.rsiHigh}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          rsiHigh: Number(e.target.value),
                        })
                      }
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max EMA Proximity (%)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={config.maxEMAProximity}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          maxEMAProximity: Number(e.target.value),
                        })
                      }
                      className="bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-[#8b5cf6]">
                    Phase 4: Volume
                  </h4>
                  <div className="space-y-2">
                    <Label>Volume Multiplier</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={config.volumeMultiplier}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          volumeMultiplier: Number(e.target.value),
                        })
                      }
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>MFI Low</Label>
                    <Input
                      type="number"
                      value={config.mfiLow}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          mfiLow: Number(e.target.value),
                        })
                      }
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>MFI High</Label>
                    <Input
                      type="number"
                      value={config.mfiHigh}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          mfiHigh: Number(e.target.value),
                        })
                      }
                      className="bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-[#ec4899]">
                    Phase 5: Volatility
                  </h4>
                  <div className="space-y-2">
                    <Label>Max ATR % of Price</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={config.maxATRPercent}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          maxATRPercent: Number(e.target.value),
                        })
                      }
                      className="bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-destructive">
                    Phase 6: Risk
                  </h4>
                  <div className="space-y-2">
                    <Label>ATR Multiple</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={config.atrMultiple}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          atrMultiple: Number(e.target.value),
                        })
                      }
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Min Risk:Reward</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={config.minRiskReward}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          minRiskReward: Number(e.target.value),
                        })
                      }
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Capital Risk (%)</Label>
                    <Input
                      type="number"
                      value={config.maxCapitalRisk}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          maxCapitalRisk: Number(e.target.value),
                        })
                      }
                      className="bg-background"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfig(DEFAULT_SCREENER_CONFIG);
                    setActiveStrategy("balanced");
                  }}
                >
                  Reset Defaults
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by symbol, name, or sector..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card"
            />
          </div>
          <div className="flex gap-2">
            {["all", "STRONG_BUY", "BUY", "WATCH", "NEUTRAL", "AVOID"].map(
              (filter) => (
                <Button
                  key={filter}
                  variant={signalFilter === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSignalFilter(filter)}
                >
                  {filter === "all"
                    ? "All"
                    : filter.replace("_", " ")}
                </Button>
              )
            )}
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-bold text-foreground">{filtered.length}</span>{" "}
            of {results.length} stocks
          </p>
        </div>

        {/* Results */}
        <div className="space-y-3">
          {filtered.map((result) => (
            <StockRow
              key={result.stock.symbol}
              result={result}
              previousSignal={previousSignals[result.stock.symbol]?.signal}
              expanded={expandedRow === result.stock.symbol}
              onToggle={() =>
                setExpandedRow(
                  expandedRow === result.stock.symbol
                    ? null
                    : result.stock.symbol
                )
              }
              onBuy={() => setBuyingStock(result)}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <Card className="bg-card/50 border-border p-12 text-center">
            <p className="text-muted-foreground">
              No stocks match the current filters.
            </p>
          </Card>
        )}
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

function StockRow({
  result,
  previousSignal,
  expanded,
  onToggle,
  onBuy,
}: {
  result: ScreenerResult;
  previousSignal?: string;
  expanded: boolean;
  onToggle: () => void;
  onBuy: () => void;
}) {
  const signalChange = computeSignalChange(result.signal, previousSignal);
  const signalColors: Record<string, string> = {
    STRONG_BUY: "text-accent",
    BUY: "text-primary",
    WATCH: "text-[#f59e0b]",
    NEUTRAL: "text-muted-foreground",
    AVOID: "text-destructive",
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border hover:border-primary/30 transition-colors">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer"
        onClick={onToggle}
      >
        {/* Score Circle */}
        <div className="relative w-12 h-12 flex-shrink-0">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-secondary"
            />
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className={signalColors[result.signal]}
              strokeDasharray={`${(result.overallScore / 100) * 125.6} 125.6`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
            {result.overallScore}
          </span>
        </div>

        {/* Stock Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold">{result.stock.symbol}</span>
            <Badge variant="outline" className="text-[10px]">
              {result.stock.sector}
            </Badge>
            {result.sectorContext.sectorScoreImpact !== 0 && (
              <Badge
                variant={result.sectorContext.isTopSector ? "success" : "destructive"}
                className="text-[10px]"
              >
                {result.sectorContext.isTopSector ? "▲" : "▼"} Sector #{result.sectorContext.sectorRank}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {result.stock.name}
          </p>
        </div>

        {/* Price */}
        <div className="text-right hidden sm:block">
          <div className="font-mono font-semibold">
            {formatCurrency(result.stock.lastPrice)}
          </div>
          <div
            className={`text-sm font-mono ${
              result.stock.changePercent >= 0
                ? "text-accent"
                : "text-destructive"
            }`}
          >
            {formatPercent(result.stock.changePercent)}
          </div>
        </div>

        {/* Signal */}
        <div className="hidden md:flex items-center gap-1.5">
          <Badge
            variant={
              result.signal === "STRONG_BUY"
                ? "success"
                : result.signal === "BUY"
                  ? "default"
                  : result.signal === "AVOID"
                    ? "destructive"
                    : "outline"
            }
            className="text-xs"
          >
            {result.signal.replace("_", " ")}
          </Badge>
          {signalChange === "UPGRADED" && (
            <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
              ↑ Up
            </Badge>
          )}
          {signalChange === "DOWNGRADED" && (
            <Badge className="text-[10px] bg-red-500/15 text-red-400 border-red-500/30">
              ↓ Down
            </Badge>
          )}
          {signalChange === "NEW" && (
            <Badge className="text-[10px] bg-blue-500/15 text-blue-400 border-blue-500/30">
              NEW
            </Badge>
          )}
          {result.phase3Details.divergenceResult.hasBullish && (
            <Badge variant="success" className="text-[10px] gap-0.5">
              Bull Div
            </Badge>
          )}
          {result.phase3Details.divergenceResult.hasBearish && (
            <Badge variant="destructive" className="text-[10px] gap-0.5">
              Bear Div
            </Badge>
          )}
        </div>

        {/* Phase Indicators */}
        <div className="hidden lg:flex items-center gap-1">
          <PhaseChip phase={1} passed={result.phase1Pass} />
          <PhaseChip phase={2} passed={result.phase2Pass} />
          <PhaseChip phase={3} passed={result.phase3Pass} />
          <PhaseChip phase={4} passed={result.phase4VolumePass} />
          <PhaseChip phase={5} passed={result.phase5VolatilityPass} />
          <PhaseChip phase={6} passed={result.phase6.riskRewardRatio >= 2} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onBuy}
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

        {/* Expand */}
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-4">
          <Tabs defaultValue="analysis">
            <TabsList className="mb-4">
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
              <TabsTrigger value="indicators">Indicators</TabsTrigger>
              <TabsTrigger value="trade">Trade Setup</TabsTrigger>
            </TabsList>

            <TabsContent value="analysis">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Phase Results</h4>
                  <div className="space-y-3">
                    <PhaseResult
                      phase={1}
                      title="Universe & Liquidity"
                      passed={result.phase1Pass}
                      details={[
                        `Avg Daily Turnover: ₹${result.stock.avgDailyTurnover.toFixed(1)} Cr (Min: ₹20 Cr)`,
                      ]}
                    />
                    <PhaseResult
                      phase={2}
                      title="Trend Establishment"
                      passed={result.phase2Pass}
                      details={[
                        `EMA Alignment: ${result.stock.lastPrice > result.indicators.ema20 && result.indicators.ema20 > result.indicators.ema50 ? "Yes" : "No"}`,
                        `ADX(14): ${result.indicators.adx14.toFixed(1)} (Min: 25)`,
                        `3M Relative Strength: ${result.indicators.relativeStrength3M > 0 ? "+" : ""}${result.indicators.relativeStrength3M.toFixed(1)}%`,
                        `Weekly Trend: ${result.phase2WeeklyTrend.status} (${result.phase2WeeklyTrend.score > 0 ? "+" : ""}${result.phase2WeeklyTrend.score} pts) — Close ${result.phase2WeeklyTrend.closeAboveEMA20 ? ">" : "<"} EMA20, RSI ${result.phase2WeeklyTrend.weeklyRSI.toFixed(1)}, MACD Hist ${result.phase2WeeklyTrend.macdHistPositive ? "+" : "-"}`,
                      ]}
                    />
                    {/* Sector Rotation Context */}
                    <div className={`p-3 rounded-lg border ${
                      result.sectorContext.isTopSector
                        ? "border-accent/20 bg-accent/5"
                        : result.sectorContext.isBottomSector
                          ? "border-destructive/20 bg-destructive/5"
                          : "border-border bg-background/50"
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold">
                          Sector Rotation: {result.sectorContext.sectorName}
                        </span>
                        <Badge
                          variant={
                            result.sectorContext.isTopSector ? "success" :
                            result.sectorContext.isBottomSector ? "destructive" : "outline"
                          }
                          className="text-[10px]"
                        >
                          #{result.sectorContext.sectorRank} of {result.sectorContext.totalSectors}
                        </Badge>
                      </div>
                      <div className="space-y-0.5 text-xs text-muted-foreground pl-2">
                        <p>Breadth: {result.sectorContext.sectorBreadth.toFixed(0)}% above EMA50</p>
                        <p>Avg 3M RS: {result.sectorContext.sectorAvgRS3M > 0 ? "+" : ""}{result.sectorContext.sectorAvgRS3M.toFixed(1)}%</p>
                        <p>Score Impact: {result.sectorContext.sectorScoreImpact > 0 ? "+" : ""}{result.sectorContext.sectorScoreImpact} pts</p>
                      </div>
                    </div>

                    <PhaseResult
                      phase={3}
                      title="Momentum Signal"
                      passed={result.phase3Pass}
                      details={[
                        `Pullback to EMA: ${result.phase3Details.pullbackToEMA ? "Yes" : "No"} (${result.phase3Details.emaProximity.toFixed(1)}% from EMA)`,
                        `RSI: ${result.phase3Details.rsiValue.toFixed(1)} — ${result.phase3Details.rsiTier} zone (${result.phase3Details.rsiTierScore > 0 ? "+" : ""}${result.phase3Details.rsiTierScore} pts)`,
                        `ROC Positive: ${result.phase3Details.rocPositive ? "Yes" : "No"}`,
                        `+DI > -DI: ${result.phase3Details.plusDIAboveMinusDI ? "Yes" : "No"}`,
                        `Stochastic Bullish: ${result.phase3Details.stochasticBullish ? "Yes" : "No"}`,
                        `Divergences: ${result.phase3Details.divergenceResult.summary} (${result.phase3Details.divergenceScoreImpact > 0 ? "+" : ""}${result.phase3Details.divergenceScoreImpact} pts)`,
                      ]}
                    />
                    <PhaseResult
                      phase={4}
                      title="Volume Confirmation"
                      passed={result.phase4VolumePass}
                      details={[
                        `OBV Trending Up: ${result.phase4VolumeDetails.obvTrendingUp ? "Yes" : "No"}`,
                        `Volume Above Avg: ${result.phase4VolumeDetails.volumeAboveAvg ? "Yes" : "No"}`,
                        `Volume Trend: ${result.phase4VolumeDetails.volumeTrend} (${result.phase4VolumeDetails.volumeTrendScore > 0 ? "+" : ""}${result.phase4VolumeDetails.volumeTrendScore} pts)`,
                        `MFI Healthy: ${result.phase4VolumeDetails.mfiHealthy ? "Yes" : "No"}`,
                      ]}
                    />
                    <PhaseResult
                      phase={5}
                      title="Volatility Check"
                      passed={result.phase5VolatilityPass}
                      details={[
                        `ATR Reasonable: ${result.phase5VolatilityDetails.atrReasonable ? "Yes" : "No"}`,
                        `Bollinger Expanding: ${result.phase5VolatilityDetails.bollingerExpanding ? "Yes" : "No"}`,
                        `Price in Upper Band: ${result.phase5VolatilityDetails.priceInUpperBand ? "Yes" : "No"}`,
                      ]}
                    />
                    <PhaseResult
                      phase={6}
                      title="Risk Management"
                      passed={result.phase6.riskRewardRatio >= 2}
                      details={[
                        `Risk:Reward: 1:${result.phase6.riskRewardRatio}`,
                        `ATR Multiple: ${result.phase6.atrMultiple}x`,
                      ]}
                    />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Rationale</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {result.rationale}
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="indicators">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {/* Trend Indicators */}
                <IndicatorCard
                  label="EMA 20"
                  value={formatCurrency(result.indicators.ema20)}
                  tooltip="20-day Exponential Moving Average. Price above EMA20 = short-term uptrend. The screener requires price > EMA20 > EMA50 > EMA200 for trend alignment."
                  status={
                    result.stock.lastPrice > result.indicators.ema20
                      ? "good"
                      : "bad"
                  }
                />
                <IndicatorCard
                  label="EMA 50"
                  value={formatCurrency(result.indicators.ema50)}
                  tooltip="50-day EMA tracks medium-term trend. Price above EMA50 = intermediate uptrend confirmed. Golden Cross: 50-EMA crosses above 200-EMA."
                  status={
                    result.indicators.ema20 > result.indicators.ema50
                      ? "good"
                      : "bad"
                  }
                />
                <IndicatorCard
                  label="EMA 200"
                  value={formatCurrency(result.indicators.ema200)}
                  tooltip="200-day EMA is the long-term trend benchmark. Price above 200-EMA = long-term bull market for this stock."
                  status={
                    result.indicators.ema50 > result.indicators.ema200
                      ? "good"
                      : "bad"
                  }
                />
                <IndicatorCard
                  label="ADX(14)"
                  value={result.indicators.adx14.toFixed(1)}
                  tooltip="Average Directional Index measures trend strength (not direction). >25 = confirmed trend, >40 = very strong. Screener requires >=25 (adapted higher in bear markets)."
                  status={result.indicators.adx14 > 25 ? "good" : "neutral"}
                />
                <IndicatorCard
                  label="MACD"
                  value={result.indicators.macdLine.toFixed(2)}
                  tooltip="Moving Average Convergence Divergence: 12-EMA minus 26-EMA. Line above Signal AND above zero = confirmed bullish momentum."
                  status={
                    result.indicators.macdLine > result.indicators.macdSignal &&
                    result.indicators.macdLine > 0
                      ? "good"
                      : "bad"
                  }
                />
                <IndicatorCard
                  label="SuperTrend"
                  value={result.indicators.superTrendDirection.toUpperCase()}
                  tooltip="ATR-based trend indicator popular in Indian markets. UP = bullish (line acts as support). DOWN = bearish. Uses ATR period 10, multiplier 3."
                  status={result.indicators.superTrendDirection === "up" ? "good" : "bad"}
                />
                {/* Momentum Indicators */}
                <IndicatorCard
                  label="RSI(14)"
                  value={`${result.indicators.rsi14.toFixed(1)} (${result.phase3Details.rsiTier})`}
                  tooltip="Relative Strength Index (0-100). 50-70 = healthy bullish momentum. >70 = overbought caution. <30 = oversold. Screener uses tiered zones: 45-55 optimal, 55-65 good."
                  status={
                    result.indicators.rsi14 >= 45 && result.indicators.rsi14 <= 65
                      ? "good"
                      : result.indicators.rsi14 > 65 && result.indicators.rsi14 <= 75
                        ? "neutral"
                        : "bad"
                  }
                />
                <IndicatorCard
                  label="Stochastic %K"
                  value={result.indicators.stochasticK.toFixed(1)}
                  tooltip="Shows where price closed relative to its 14-day range. >50 = bullish momentum. >80 = overbought. <20 = oversold."
                  status={result.indicators.stochasticK > 50 ? "good" : "neutral"}
                />
                <IndicatorCard
                  label="ROC(14)"
                  value={`${result.indicators.roc14 > 0 ? "+" : ""}${result.indicators.roc14.toFixed(1)}%`}
                  tooltip="Rate of Change: % price change over 14 days. Positive = upward momentum. Rising ROC = accelerating trend."
                  status={result.indicators.roc14 > 0 ? "good" : "bad"}
                />
                <IndicatorCard
                  label="+DI / -DI"
                  value={`${result.indicators.plusDI.toFixed(0)} / ${result.indicators.minusDI.toFixed(0)}`}
                  tooltip="Directional Indicators from ADX system. +DI > -DI = buyers stronger than sellers (bullish direction)."
                  status={result.indicators.plusDI > result.indicators.minusDI ? "good" : "bad"}
                />
                <IndicatorCard
                  label="CCI(20)"
                  value={result.indicators.cci20.toFixed(0)}
                  tooltip="Commodity Channel Index measures price deviation from average. >100 = strong uptrend, >0 = moderate bullish, <-100 = strong downtrend."
                  status={
                    result.indicators.cci20 > 100
                      ? "good"
                      : result.indicators.cci20 > 0
                        ? "neutral"
                        : "bad"
                  }
                />
                <IndicatorCard
                  label="Williams %R"
                  value={result.indicators.williamsR.toFixed(1)}
                  tooltip="Williams %R shows momentum on a -100 to 0 scale. -20 to -50 = healthy bullish zone. Above -20 = overbought. Below -80 = oversold."
                  status={
                    result.indicators.williamsR > -50 && result.indicators.williamsR < -20
                      ? "good"
                      : "neutral"
                  }
                />
                {/* Volume Indicators */}
                <IndicatorCard
                  label="OBV Trend"
                  value={result.indicators.obvTrend.toUpperCase()}
                  tooltip="On-Balance Volume: cumulative volume on up vs down days. Rising OBV = accumulation (buying pressure). Divergence from price warns of reversal."
                  status={result.indicators.obvTrend === "up" ? "good" : "bad"}
                />
                <IndicatorCard
                  label="MFI(14)"
                  value={result.indicators.mfi14.toFixed(0)}
                  tooltip="Money Flow Index: volume-weighted RSI (0-100). 40-80 = healthy flow. >80 = overbought. <20 = oversold. Confirms buying pressure."
                  status={
                    result.indicators.mfi14 >= 40 && result.indicators.mfi14 <= 80
                      ? "good"
                      : "bad"
                  }
                />
                <IndicatorCard
                  label="A/D Line"
                  value={result.indicators.adLineTrend.toUpperCase()}
                  tooltip="Accumulation/Distribution Line tracks money flow using price position within the range. UP = accumulation (smart money buying). DOWN = distribution (selling)."
                  status={result.indicators.adLineTrend === "up" ? "good" : result.indicators.adLineTrend === "down" ? "bad" : "neutral"}
                />
                <IndicatorCard
                  label={`Volume (${result.phase4VolumeDetails.volumeTrend})`}
                  value={`${(result.stock.volume / 1000000).toFixed(1)}M`}
                  tooltip="Current volume vs 20-day average. 1.2x+ = above average (institutional participation). 3-bar acceleration = volume increasing consistently."
                  status={
                    result.phase4VolumeDetails.volumeTrend === "accelerating"
                      ? "good"
                      : result.phase4VolumeDetails.volumeTrend === "declining"
                        ? "bad"
                        : "neutral"
                  }
                />
                {/* Volatility Indicators */}
                <IndicatorCard
                  label="ATR(14)"
                  value={result.indicators.atr14.toFixed(2)}
                  tooltip="Average True Range measures daily volatility. Used for stop-loss (1.5x ATR below entry) and position sizing. <5% of price = manageable risk."
                  status={
                    (result.indicators.atr14 / result.stock.lastPrice) * 100 < 5
                      ? "good"
                      : "bad"
                  }
                />
                <IndicatorCard
                  label="Bollinger %B"
                  value={result.indicators.bollingerPercentB.toFixed(2)}
                  tooltip="Position within Bollinger Bands. >0.5 = upper half (bullish). >1.0 = above upper band (breakout). <0 = below lower band."
                  status={result.indicators.bollingerPercentB > 0.5 ? "good" : "neutral"}
                />
                {/* Extra */}
                <IndicatorCard
                  label="3M RS"
                  value={`${result.indicators.relativeStrength3M > 0 ? "+" : ""}${result.indicators.relativeStrength3M.toFixed(1)}%`}
                  tooltip="3-month Relative Strength vs Nifty 50. Positive = outperforming the index. >5% = strongly outperforming."
                  status={result.indicators.relativeStrength3M > 0 ? "good" : "bad"}
                />
                <IndicatorCard
                  label="Ichimoku Cloud"
                  value={result.indicators.ichimokuCloudSignal.toUpperCase()}
                  tooltip="ABOVE = price above cloud (bullish). BELOW = bearish. INSIDE = transition/avoid. Cloud provides dynamic support/resistance."
                  status={result.indicators.ichimokuCloudSignal === "above" ? "good" : "bad"}
                />
                <IndicatorCard
                  label="Parabolic SAR"
                  value={result.indicators.sarTrend.toUpperCase()}
                  tooltip="Stop and Reverse: UP = dots below price (uptrend). DOWN = dots above (downtrend). Dots act as trailing stop levels."
                  status={result.indicators.sarTrend === "up" ? "good" : "bad"}
                />
                {/* Weekly Timeframe */}
                <IndicatorCard
                  label="Weekly Trend"
                  value={result.phase2WeeklyTrend.status.toUpperCase()}
                  tooltip="Multi-timeframe confirmation. ALIGNED = daily and weekly trends agree (strongest signal). COUNTER = daily opposes weekly (risky)."
                  status={
                    result.phase2WeeklyTrend.status === "aligned"
                      ? "good"
                      : result.phase2WeeklyTrend.status === "counter-trend"
                        ? "bad"
                        : "neutral"
                  }
                />
                <IndicatorCard
                  label="Weekly RSI"
                  value={result.phase2WeeklyTrend.weeklyRSI.toFixed(1)}
                  tooltip="RSI on weekly timeframe. Above 40 = weekly uptrend intact. Confirms daily signals are not just noise."
                  status={result.phase2WeeklyTrend.rsiAbove40 ? "good" : "bad"}
                />
                {/* Divergence */}
                <IndicatorCard
                  label="Divergence"
                  value={
                    result.indicators.divergences.hasBullish
                      ? "BULLISH"
                      : result.indicators.divergences.hasBearish
                        ? "BEARISH"
                        : "NONE"
                  }
                  tooltip="When price and indicators disagree. BULLISH = price falling but indicators rising (potential reversal up). BEARISH = price rising but indicators weakening."
                  status={
                    result.indicators.divergences.hasBullish
                      ? "good"
                      : result.indicators.divergences.hasBearish
                        ? "bad"
                        : "neutral"
                  }
                />
                {/* Sector Rank */}
                <IndicatorCard
                  label={`Sector #${result.sectorContext.sectorRank}`}
                  value={result.sectorContext.sectorName}
                  tooltip="Sector rotation ranking based on relative strength, breadth, and momentum. Top 3 sectors get +5 score bonus, bottom 3 get -5 penalty."
                  status={
                    result.sectorContext.isTopSector
                      ? "good"
                      : result.sectorContext.isBottomSector
                        ? "bad"
                        : "neutral"
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="trade">
              <div className="grid md:grid-cols-3 gap-6">
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">
                    Entry Price
                  </p>
                  <p className="text-xl font-bold text-primary">
                    {formatCurrency(result.phase6.entryPrice)}
                  </p>
                </Card>
                <Card className="p-4 bg-destructive/5 border-destructive/20">
                  <p className="text-xs text-muted-foreground mb-1">
                    Stop Loss
                  </p>
                  <p className="text-xl font-bold text-destructive">
                    {formatCurrency(result.phase6.stopLoss)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {result.phase6.atrMultiple}x ATR = ₹
                    {result.phase6.riskPerShare.toFixed(2)} risk/share
                  </p>
                </Card>
                <Card className="p-4 bg-accent/5 border-accent/20">
                  <p className="text-xs text-muted-foreground mb-1">
                    Target (1:{result.phase6.riskRewardRatio})
                  </p>
                  <p className="text-xl font-bold text-accent">
                    {formatCurrency(result.phase6.target)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Potential: +
                    {formatPercent(
                      ((result.phase6.target - result.phase6.entryPrice) /
                        result.phase6.entryPrice) *
                        100
                    )}
                  </p>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </Card>
  );
}

function PhaseChip({ phase, passed }: { phase: number; passed: boolean }) {
  return (
    <div
      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
        passed
          ? "bg-accent/20 text-accent"
          : "bg-secondary text-muted-foreground"
      }`}
    >
      {phase}
    </div>
  );
}

function PhaseResult({
  phase,
  title,
  passed,
  details,
}: {
  phase: number;
  title: string;
  passed: boolean;
  details: string[];
}) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        passed ? "border-accent/20 bg-accent/5" : "border-border bg-background/50"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {passed ? (
          <CheckCircle2 className="w-4 h-4 text-accent" />
        ) : (
          <XCircle className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="text-sm font-semibold">
          Phase {phase}: {title}
        </span>
      </div>
      <ul className="space-y-1">
        {details.map((detail, i) => (
          <li key={i} className="text-xs text-muted-foreground pl-6">
            {detail}
          </li>
        ))}
      </ul>
    </div>
  );
}

function IndicatorCard({
  label,
  value,
  status,
  tooltip,
}: {
  label: string;
  value: string;
  status: "good" | "bad" | "neutral";
  tooltip?: string;
}) {
  const borderColor =
    status === "good"
      ? "border-accent/30"
      : status === "bad"
        ? "border-destructive/30"
        : "border-border";

  const card = (
    <div className={`p-3 rounded-lg bg-background/50 border ${borderColor}`}>
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        {tooltip && (
          <Info className="h-3 w-3 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
        )}
      </div>
      <p className="font-mono font-semibold">{value}</p>
    </div>
  );

  if (!tooltip) return card;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px] text-xs">
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function MarketRegimeBanner({
  regime,
  thresholds,
}: {
  regime: MarketRegimeInfo;
  thresholds: AdaptiveThresholds;
}) {
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
  const isNotBull = regime.regime !== "BULL";

  return (
    <Card className={`mb-6 ${cfg.bg} backdrop-blur ${cfg.border}`}>
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
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
              <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
                {regime.description}
              </p>
            </div>
          </div>

          {/* Adaptive Thresholds Summary */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-4 font-mono text-muted-foreground">
              <div>
                <span className="text-muted-foreground">Nifty: </span>
                <span className="text-foreground font-semibold">
                  {regime.niftyClose.toFixed(0)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">ADX: </span>
                <span className="text-foreground">{regime.niftyADX.toFixed(1)}</span>
              </div>
            </div>
            {isNotBull && (
              <div className="flex items-center gap-1.5">
                <AlertTriangle className={`w-3.5 h-3.5 ${cfg.icon}`} />
                <span className={`font-medium ${cfg.color}`}>
                  Adapted: ADX&ge;{thresholds.minADX}, RSI {thresholds.rsiLow}-{thresholds.rsiHigh}, R:R {thresholds.minRiskReward}:1, SB&ge;{thresholds.strongBuyThreshold}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
