"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useSortable } from "@/hooks/useSortable";
import { SortableHeader } from "@/components/ui/sortable-header";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  Target,
  Clock,
  RefreshCw,
  Wifi,
  WifiOff,
  History,
  Trophy,
  AlertTriangle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { useScreenerData } from "@/hooks/useScreenerData";
import { computeSignalPerformance, computeBacktestAnalytics } from "@/lib/signal-performance";
import { useChartColors } from "@/hooks/useChartColors";
import type { SignalSnapshot, ScreenerSnapshot, ConfidenceLevel } from "@/lib/types";

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const config = {
    high: { label: "High Confidence", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
    moderate: { label: "Moderate Confidence", cls: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
    low: { label: "Low Confidence", cls: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
    insufficient: { label: "Insufficient Data", cls: "bg-red-500/20 text-red-400 border-red-500/40" },
  };
  const c = config[level];
  return <Badge className={`text-[10px] ${c.cls}`}>{c.label}</Badge>;
}

export default function SignalsPage() {
  const { results, mode, loading, lastRefresh, marketRegime, sectorRankings, refresh } = useScreenerData();
  const chartColors = useChartColors();

  const COLORS = [chartColors.accent, chartColors.primary, chartColors.warning, chartColors.muted, chartColors.destructive];
  const HIT_RATE_COLORS = [chartColors.accent, chartColors.destructive, chartColors.warning];
  const CHART_TOOLTIP_STYLE = {
    contentStyle: {
      backgroundColor: chartColors.tooltipBg,
      border: `1px solid ${chartColors.tooltipBorder}`,
      borderRadius: "8px",
    },
  };
  const RETURN_PERIOD_COLORS = [chartColors.muted, chartColors.primary, chartColors.purple, chartColors.accent];

  // ---- Signal Performance State ----
  const [perfDays, setPerfDays] = useState(30);
  const [perfSignals, setPerfSignals] = useState<SignalSnapshot[]>([]);
  const [perfSnapshots, setPerfSnapshots] = useState<ScreenerSnapshot[]>([]);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfError, setPerfError] = useState<string | null>(null);

  const fetchPerformanceData = useCallback(async (days: number) => {
    setPerfLoading(true);
    setPerfError(null);
    try {
      const response = await fetch(`/api/signal-performance?days=${days}`);
      if (!response.ok) throw new Error("Failed to fetch performance data");
      const data = await response.json();
      setPerfSignals(data.signals || []);
      setPerfSnapshots(data.snapshots || []);
    } catch (err) {
      setPerfError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setPerfLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPerformanceData(perfDays);
  }, [perfDays, fetchPerformanceData]);

  const perfAnalytics = useMemo(
    () => computeSignalPerformance(perfSignals, perfSnapshots),
    [perfSignals, perfSnapshots]
  );

  // Prepare hit rate donut data
  const hitRateDonutData = useMemo(() => {
    const { hitRate } = perfAnalytics;
    return [
      { name: "Target Hit", value: hitRate.targetHit },
      { name: "Stopped Out", value: hitRate.stoppedOut },
      { name: "Expired", value: hitRate.expired },
    ].filter((d) => d.value > 0);
  }, [perfAnalytics]);

  // Prepare avg return chart data (null = omit bar, not 0%)
  const avgReturnChartData = useMemo(() => {
    return perfAnalytics.avgReturnByPeriod.map((r) => ({
      signal: r.signal.replace("_", " "),
      "1D": r.avgReturn1d ?? null,
      "3D": r.avgReturn3d ?? null,
      "5D": r.avgReturn5d ?? null,
      "10D": r.avgReturn10d ?? null,
    }));
  }, [perfAnalytics]);

  const backtestAnalytics = useMemo(
    () => computeBacktestAnalytics(perfSignals, perfDays),
    [perfSignals, perfDays]
  );

  const signalDistribution = useMemo(() => {
    const dist: Record<string, number> = {
      STRONG_BUY: 0,
      BUY: 0,
      WATCH: 0,
      NEUTRAL: 0,
      AVOID: 0,
    };
    results.forEach((r) => dist[r.signal]++);
    return Object.entries(dist).map(([name, value]) => ({ name: name.replace("_", " "), value }));
  }, [results]);

  const sectorBreakdown = useMemo(() => {
    const sectors: Record<string, { count: number; avgScore: number }> = {};
    results.forEach((r) => {
      if (!sectors[r.stock.sector]) {
        sectors[r.stock.sector] = { count: 0, avgScore: 0 };
      }
      sectors[r.stock.sector].count++;
      sectors[r.stock.sector].avgScore += r.overallScore;
    });
    return Object.entries(sectors).map(([sector, data]) => ({
      sector,
      count: data.count,
      avgScore: Math.round(data.avgScore / data.count),
    }));
  }, [results]);

  const topPicks = results.filter(
    (r) => r.signal === "STRONG_BUY" || r.signal === "BUY"
  );

  const { sortedData: sortedRankings, requestSort: requestSortRank, getSortIndicator: getSortIndicatorRank } =
    useSortable(sectorRankings.rankings, { key: "rank", direction: "asc" });

  const { sortedData: sortedPicks, requestSort: requestSortPicks, getSortIndicator: getSortIndicatorPicks } =
    useSortable(topPicks, { key: "overallScore", direction: "desc" });

  const radarData = useMemo(() => {
    if (topPicks.length === 0) return [];
    const pick = topPicks[0];
    return [
      {
        metric: "RSI Quality",
        value:
          pick.phase3Details.rsiTierScore >= 4 ? 90 :
          pick.phase3Details.rsiTierScore >= 2 ? 65 :
          pick.phase3Details.rsiTierScore >= 0 ? 40 : 15,
      },
      {
        metric: "Trend (ADX)",
        value: Math.min((pick.indicators.adx14 / 50) * 100, 100),
      },
      {
        metric: "EMA Align",
        value:
          pick.stock.lastPrice > pick.indicators.ema20 &&
          pick.indicators.ema20 > pick.indicators.ema50
            ? 95
            : 20,
      },
      {
        metric: "MACD",
        value:
          pick.indicators.macdLine > pick.indicators.macdSignal &&
          pick.indicators.macdLine > 0
            ? 90
            : 25,
      },
      {
        metric: "OBV",
        value: pick.indicators.obvTrend === "up" ? 90 : 20,
      },
      {
        metric: "Stochastic",
        value: Math.min(pick.indicators.stochasticK, 100),
      },
      {
        metric: "Bollinger %B",
        value: Math.min(pick.indicators.bollingerPercentB * 100, 100),
      },
      {
        metric: "R:R Ratio",
        value: Math.min(pick.phase6.riskRewardRatio * 40, 100),
      },
      {
        metric: "Weekly Trend",
        value:
          pick.phase2WeeklyTrend.status === "aligned" ? 95 :
          pick.phase2WeeklyTrend.status === "mixed" ? 50 : 10,
      },
      {
        metric: "Divergence",
        value:
          pick.indicators.divergences.hasBullish ? 95 :
          pick.indicators.divergences.hasBearish ? 10 : 50,
      },
    ];
  }, [topPicks]);

  // ---- Real Historical Price Data ----
  const [priceData, setPriceData] = useState<Array<{ date: string; close: number; volume: number }>>([]);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceMode, setPriceMode] = useState<"live" | "demo">("demo");

  useEffect(() => {
    if (topPicks.length === 0) {
      setPriceData([]);
      return;
    }
    const symbol = topPicks[0].stock.symbol;
    const exchange = topPicks[0].stock.exchange || "NSE";
    let cancelled = false;

    setPriceLoading(true);
    fetch(`/api/historical-prices?symbol=${encodeURIComponent(symbol)}&exchange=${encodeURIComponent(exchange)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setPriceData(data.prices || []);
        setPriceMode(data.mode || "demo");
      })
      .catch(() => {
        if (cancelled) return;
        setPriceData([]);
        setPriceMode("demo");
      })
      .finally(() => {
        if (!cancelled) setPriceLoading(false);
      });

    return () => { cancelled = true; };
  }, [topPicks]);

  const phasePassRates = useMemo(() => {
    if (results.length === 0) return [];
    const total = results.length;
    return [
      {
        phase: "P1: Liquidity",
        rate: Math.round(
          (results.filter((r) => r.phase1Pass).length / total) * 100
        ),
      },
      {
        phase: "P2: Trend",
        rate: Math.round(
          (results.filter((r) => r.phase2Pass).length / total) * 100
        ),
      },
      {
        phase: "P3: Momentum",
        rate: Math.round(
          (results.filter((r) => r.phase3Pass).length / total) * 100
        ),
      },
      {
        phase: "P4: Volume",
        rate: Math.round(
          (results.filter((r) => r.phase4VolumePass).length / total) * 100
        ),
      },
      {
        phase: "P5: Volatility",
        rate: Math.round(
          (results.filter((r) => r.phase5VolatilityPass).length / total) * 100
        ),
      },
      {
        phase: "P6: Risk",
        rate: Math.round(
          (results.filter(
            (r) => r.phase5VolatilityPass && r.phase6.riskRewardRatio >= 2
          ).length /
            total) *
            100
        ),
      },
    ];
  }, [results]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Signal Dashboard</h1>
            <p className="text-muted-foreground">
              Visual analytics for momentum signals and market conditions
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
            <Badge
              variant={
                marketRegime.regime === "BULL"
                  ? "success"
                  : marketRegime.regime === "BEAR"
                    ? "destructive"
                    : "outline"
              }
              className="gap-1 text-[10px]"
            >
              <Activity className="w-3 h-3" />
              {marketRegime.regime}
            </Badge>
            <div className="text-xs text-muted-foreground font-mono">
              {lastRefresh.toLocaleTimeString("en-IN")}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refresh()}
              disabled={loading}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {signalDistribution.map((item, i) => (
            <Card key={item.name} className="bg-card/50 backdrop-blur border-border">
              <CardContent className="p-4 text-center">
                <div
                  className="w-3 h-3 rounded-full mx-auto mb-2"
                  style={{ backgroundColor: COLORS[i] }}
                />
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.name}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analysis">Top Pick Analysis</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="performance"><History className="w-4 h-4 mr-1" /> Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Signal Distribution */}
              <Card className="bg-card/50 backdrop-blur border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Signal Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={signalDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {signalDistribution.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          {...CHART_TOOLTIP_STYLE}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 mt-4">
                    {signalDistribution.map((item, i) => (
                      <div key={item.name} className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: COLORS[i] }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {item.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Sector Breakdown */}
              <Card className="bg-card/50 backdrop-blur border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Sector Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sectorBreakdown} layout="vertical">
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={chartColors.gridStroke}
                        />
                        <XAxis type="number" stroke={chartColors.axisStroke} fontSize={12} />
                        <YAxis
                          type="category"
                          dataKey="sector"
                          stroke={chartColors.axisStroke}
                          fontSize={11}
                          width={100}
                        />
                        <Tooltip
                          {...CHART_TOOLTIP_STYLE}
                        />
                        <Bar
                          dataKey="avgScore"
                          fill={chartColors.primary}
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sector Rotation Rankings Table */}
            {sectorRankings.rankings.length > 0 && (
              <Card className="bg-card/50 backdrop-blur border-border mt-6">
                <CardHeader>
                  <CardTitle className="text-lg">Sector Rotation Rankings</CardTitle>
                  <CardDescription>
                    Sectors ranked by composite momentum (RS, breadth, short-term change)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-2"><SortableHeader label="Rank" sortKey="rank" sortIndicator={getSortIndicatorRank("rank")} onSort={requestSortRank} className="text-xs" /></th>
                          <th className="text-left py-2 px-2"><SortableHeader label="Sector" sortKey="sector" sortIndicator={getSortIndicatorRank("sector")} onSort={requestSortRank} className="text-xs" /></th>
                          <th className="text-right py-2 px-2"><SortableHeader label="Stocks" sortKey="stockCount" sortIndicator={getSortIndicatorRank("stockCount")} onSort={requestSortRank} className="text-xs justify-end" /></th>
                          <th className="text-right py-2 px-2"><SortableHeader label="Avg 3M RS" sortKey="avgRelativeStrength3M" sortIndicator={getSortIndicatorRank("avgRelativeStrength3M")} onSort={requestSortRank} className="text-xs justify-end" /></th>
                          <th className="text-right py-2 px-2"><SortableHeader label="Breadth" sortKey="breadth" sortIndicator={getSortIndicatorRank("breadth")} onSort={requestSortRank} className="text-xs justify-end" /></th>
                          <th className="text-right py-2 px-2"><SortableHeader label="Composite" sortKey="compositeScore" sortIndicator={getSortIndicatorRank("compositeScore")} onSort={requestSortRank} className="text-xs justify-end" /></th>
                          <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground">Impact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedRankings.map((s) => (
                          <tr key={s.sector} className="border-b border-border/50 hover:bg-secondary/30">
                            <td className="py-2 px-2 font-mono font-bold text-sm">#{s.rank}</td>
                            <td className="py-2 px-2 text-sm">{s.sector}</td>
                            <td className="text-right py-2 px-2 font-mono text-sm">{s.stockCount}</td>
                            <td className="text-right py-2 px-2 font-mono text-sm">
                              <span className={s.avgRelativeStrength3M >= 0 ? "text-green-500" : "text-red-500"}>
                                {s.avgRelativeStrength3M > 0 ? "+" : ""}{s.avgRelativeStrength3M.toFixed(1)}%
                              </span>
                            </td>
                            <td className="text-right py-2 px-2 font-mono text-sm">{s.breadth.toFixed(0)}%</td>
                            <td className="text-right py-2 px-2 font-mono text-sm">{s.compositeScore.toFixed(1)}</td>
                            <td className="text-center py-2 px-2">
                              <Badge
                                variant={
                                  sectorRankings.topSectors.includes(s.sector)
                                    ? "success"
                                    : sectorRankings.bottomSectors.includes(s.sector)
                                      ? "destructive"
                                      : "outline"
                                }
                                className="text-[10px]"
                              >
                                {sectorRankings.topSectors.includes(s.sector) ? "+5" :
                                 sectorRankings.bottomSectors.includes(s.sector) ? "-5" : "0"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="analysis">
            {topPicks.length > 0 && (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Price Chart — Real historical data from Kite */}
                <Card className="bg-card/50 backdrop-blur border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {topPicks[0].stock.symbol} - 90 Day Price
                    </CardTitle>
                    {priceMode === "live" && priceData.length > 0 && (
                      <CardDescription>Historical daily closing prices from Kite Connect</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {priceLoading ? (
                      <div className="h-72 flex items-center justify-center">
                        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading price history...</span>
                      </div>
                    ) : priceData.length > 0 ? (
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={priceData}>
                            <defs>
                              <linearGradient
                                id="colorPrice"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor={chartColors.primary}
                                  stopOpacity={0.3}
                                />
                                <stop
                                  offset="95%"
                                  stopColor={chartColors.primary}
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={chartColors.gridStroke}
                            />
                            <XAxis
                              dataKey="date"
                              stroke={chartColors.axisStroke}
                              fontSize={10}
                              tickFormatter={(v) =>
                                new Date(v).toLocaleDateString("en-IN", {
                                  month: "short",
                                  day: "numeric",
                                })
                              }
                            />
                            <YAxis stroke={chartColors.axisStroke} fontSize={12} />
                            <Tooltip
                              {...CHART_TOOLTIP_STYLE}
                              labelFormatter={(v) =>
                                new Date(v).toLocaleDateString("en-IN")
                              }
                            />
                            <Area
                              type="monotone"
                              dataKey="close"
                              stroke={chartColors.primary}
                              fill="url(#colorPrice)"
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-72 flex flex-col items-center justify-center text-center">
                        <WifiOff className="w-8 h-8 mb-3 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">
                          Connect to Kite to view historical prices
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Real price data requires an active Kite Connect session
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Radar Analysis */}
                <Card className="bg-card/50 backdrop-blur border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {topPicks[0].stock.symbol} - Momentum Radar
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData}>
                          <PolarGrid stroke={chartColors.gridStroke} />
                          <PolarAngleAxis
                            dataKey="metric"
                            stroke={chartColors.axisStroke}
                            fontSize={11}
                          />
                          <PolarRadiusAxis
                            stroke={chartColors.gridStroke}
                            fontSize={10}
                            domain={[0, 100]}
                          />
                          <Radar
                            name="Score"
                            dataKey="value"
                            stroke={chartColors.primary}
                            fill={chartColors.primary}
                            fillOpacity={0.2}
                            strokeWidth={2}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Picks Table */}
                <Card className="md:col-span-2 bg-card/50 backdrop-blur border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Actionable Signals
                    </CardTitle>
                    <CardDescription>
                      Stocks with BUY or STRONG BUY signals
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-3">
                              <SortableHeader label="Stock" sortKey="stock.symbol" sortIndicator={getSortIndicatorPicks("stock.symbol")} onSort={requestSortPicks} />
                            </th>
                            <th className="text-right py-3 px-3">
                              <SortableHeader label="Price" sortKey="stock.lastPrice" sortIndicator={getSortIndicatorPicks("stock.lastPrice")} onSort={requestSortPicks} className="justify-end" />
                            </th>
                            <th className="text-center py-3 px-3">
                              <SortableHeader label="Signal" sortKey="signal" sortIndicator={getSortIndicatorPicks("signal")} onSort={requestSortPicks} className="justify-center" />
                            </th>
                            <th className="text-center py-3 px-3">
                              <SortableHeader label="Score" sortKey="overallScore" sortIndicator={getSortIndicatorPicks("overallScore")} onSort={requestSortPicks} className="justify-center" />
                            </th>
                            <th className="text-right py-3 px-3">
                              <SortableHeader label="Entry" sortKey="phase6.entryPrice" sortIndicator={getSortIndicatorPicks("phase6.entryPrice")} onSort={requestSortPicks} className="justify-end" />
                            </th>
                            <th className="text-right py-3 px-3">
                              <SortableHeader label="Stop Loss" sortKey="phase6.stopLoss" sortIndicator={getSortIndicatorPicks("phase6.stopLoss")} onSort={requestSortPicks} className="justify-end" />
                            </th>
                            <th className="text-right py-3 px-3">
                              <SortableHeader label="Target" sortKey="phase6.target" sortIndicator={getSortIndicatorPicks("phase6.target")} onSort={requestSortPicks} className="justify-end" />
                            </th>
                            <th className="text-center py-3 px-3">
                              <SortableHeader label="R:R" sortKey="phase6.riskRewardRatio" sortIndicator={getSortIndicatorPicks("phase6.riskRewardRatio")} onSort={requestSortPicks} className="justify-center" />
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedPicks.map((r) => (
                            <tr
                              key={r.stock.symbol}
                              className="border-b border-border/50 hover:bg-secondary/30"
                            >
                              <td className="py-3 px-3">
                                <div className="font-semibold">
                                  {r.stock.symbol}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {r.stock.sector}
                                </div>
                              </td>
                              <td className="text-right py-3 px-3 font-mono">
                                {formatCurrency(r.stock.lastPrice)}
                              </td>
                              <td className="text-center py-3 px-3">
                                <Badge
                                  variant={
                                    r.signal === "STRONG_BUY"
                                      ? "success"
                                      : "default"
                                  }
                                  className="text-[10px]"
                                >
                                  {r.signal.replace("_", " ")}
                                </Badge>
                              </td>
                              <td className="text-center py-3 px-3 font-mono">
                                {r.overallScore}
                              </td>
                              <td className="text-right py-3 px-3 font-mono text-primary">
                                {formatCurrency(r.phase6.entryPrice)}
                              </td>
                              <td className="text-right py-3 px-3 font-mono text-destructive">
                                {formatCurrency(r.phase6.stopLoss)}
                              </td>
                              <td className="text-right py-3 px-3 font-mono text-accent">
                                {formatCurrency(r.phase6.target)}
                              </td>
                              <td className="text-center py-3 px-3 font-mono">
                                1:{r.phase6.riskRewardRatio}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="pipeline">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Phase Pass Rates */}
              <Card className="bg-card/50 backdrop-blur border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Phase Pass Rates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={phasePassRates}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={chartColors.gridStroke}
                        />
                        <XAxis
                          dataKey="phase"
                          stroke={chartColors.axisStroke}
                          fontSize={12}
                        />
                        <YAxis stroke={chartColors.axisStroke} fontSize={12} />
                        <Tooltip
                          {...CHART_TOOLTIP_STYLE}
                        />
                        <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                          {phasePassRates.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                [chartColors.primary, chartColors.accent, chartColors.warning, chartColors.purple, chartColors.pink, chartColors.destructive][
                                  index
                                ]
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Screener Runs — real data from screener_snapshots */}
              <Card className="bg-card/50 backdrop-blur border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Recent Screener Runs</CardTitle>
                  <CardDescription>
                    Last {Math.min(perfSnapshots.length, 5)} screener execution{perfSnapshots.length !== 1 ? "s" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {perfSnapshots.length > 0 ? (
                    <div className="space-y-3">
                      {perfSnapshots.slice(0, 5).map((snap) => {
                        const totalSignals = snap.resultsSummary?.signalCounts
                          ? Object.values(snap.resultsSummary.signalCounts).reduce((s, v) => s + v, 0)
                          : 0;
                        const runDate = new Date(snap.runDate);
                        return (
                          <div
                            key={snap.id}
                            className="flex items-center gap-4 p-3 rounded-lg bg-background/50 border border-border"
                          >
                            <Badge
                              variant="outline"
                              className="font-mono text-xs"
                            >
                              {runDate.toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </Badge>
                            <div className="p-2 rounded-lg bg-primary/10">
                              <Activity className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {runDate.toLocaleDateString("en-IN", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {snap.totalScanned} stocks scanned · {totalSignals} signals
                              </p>
                            </div>
                            <Badge
                              variant={snap.mode === "live" ? "success" : "outline"}
                              className="text-[10px]"
                            >
                              {snap.mode === "live" ? "LIVE" : "DEMO"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <Clock className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">
                        No screener runs yet
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Run the screener to see execution history here
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ---- Performance Tab ---- */}
          <TabsContent value="performance">
            {/* Period Selector */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold">Signal Performance</h2>
                <p className="text-sm text-muted-foreground">
                  Track how screener signals performed over time
                </p>
              </div>
              <div className="flex items-center gap-2">
                {[7, 30, 90].map((d) => (
                  <Button
                    key={d}
                    variant={perfDays === d ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPerfDays(d)}
                    disabled={perfLoading}
                  >
                    {d}d
                  </Button>
                ))}
              </div>
            </div>

            {perfLoading ? (
              <Card className="bg-card/50 backdrop-blur border-border">
                <CardContent className="py-16 text-center">
                  <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-muted-foreground" />
                  <p className="text-muted-foreground">Loading performance data...</p>
                </CardContent>
              </Card>
            ) : perfError ? (
              <Card className="bg-card/50 backdrop-blur border-border">
                <CardContent className="py-16 text-center">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-amber-500" />
                  <p className="text-muted-foreground">{perfError}</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchPerformanceData(perfDays)}>
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : perfSignals.length === 0 ? (
              <Card className="bg-card/50 backdrop-blur border-border">
                <CardContent className="py-16 text-center">
                  <History className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-lg font-medium mb-1">No signal history yet</p>
                  <p className="text-muted-foreground text-sm">
                    Run the screener to start tracking signal performance. Results are saved automatically.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Section A — 5 Metric Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card className="bg-card/50 backdrop-blur border-border">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Total Signals</p>
                      <p className="text-2xl font-bold font-mono">{perfAnalytics.totalSignals}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-card/50 backdrop-blur border-border">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Win Rate (BUY+)</p>
                      <p className={`text-2xl font-bold font-mono ${
                        perfAnalytics.winRateBySignal.length > 0 &&
                        perfAnalytics.winRateBySignal.reduce((s, w) => s + w.wins, 0) > 0
                          ? (perfAnalytics.winRateBySignal.reduce((s, w) => s + w.wins, 0) /
                            Math.max(perfAnalytics.winRateBySignal.reduce((s, w) => s + w.wins + w.losses, 0), 1)) * 100 >= 50
                            ? "text-green-500"
                            : "text-red-500"
                          : "text-muted-foreground"
                      }`}>
                        {perfAnalytics.winRateBySignal.length > 0
                          ? `${(
                              (perfAnalytics.winRateBySignal.reduce((s, w) => s + w.wins, 0) /
                                Math.max(
                                  perfAnalytics.winRateBySignal.reduce((s, w) => s + w.wins + w.losses, 0),
                                  1
                                )) *
                              100
                            ).toFixed(1)}%`
                          : "—"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-card/50 backdrop-blur border-border">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Target Hit Rate</p>
                      <p className={`text-2xl font-bold font-mono ${perfAnalytics.hitRate.targetHitPct !== null ? "text-green-500" : "text-muted-foreground"}`}>
                        {perfAnalytics.hitRate.targetHitPct !== null
                          ? `${perfAnalytics.hitRate.targetHitPct.toFixed(1)}%`
                          : "—"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-card/50 backdrop-blur border-border">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Stopped Out Rate</p>
                      <p className={`text-2xl font-bold font-mono ${perfAnalytics.hitRate.stoppedOutPct !== null ? "text-red-500" : "text-muted-foreground"}`}>
                        {perfAnalytics.hitRate.stoppedOutPct !== null
                          ? `${perfAnalytics.hitRate.stoppedOutPct.toFixed(1)}%`
                          : "—"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-card/50 backdrop-blur border-border">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Screener Runs</p>
                      <p className="text-2xl font-bold font-mono">{perfAnalytics.totalSnapshots}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Section F — Strategy Summary (#8) */}
                {backtestAnalytics.strategySummary.summaryLines.length > 0 && (
                  <Card className="bg-card/50 backdrop-blur border-border">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            Strategy Summary
                          </CardTitle>
                          <CardDescription>
                            Backtesting preview based on historical signal outcomes
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <ConfidenceBadge level={backtestAnalytics.strategySummary.confidenceLevel} />
                          <Badge
                            className={`text-[10px] ${
                              backtestAnalytics.strategySummary.overallVerdict === "Promising"
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                : backtestAnalytics.strategySummary.overallVerdict === "Mixed"
                                  ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                                  : backtestAnalytics.strategySummary.overallVerdict === "Underperforming"
                                    ? "bg-red-500/20 text-red-400 border-red-500/40"
                                    : "bg-blue-500/20 text-blue-400 border-blue-500/40"
                            }`}
                          >
                            {backtestAnalytics.strategySummary.overallVerdict}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {backtestAnalytics.strategySummary.summaryLines.map((line, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-primary mt-0.5">&#8226;</span>
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Section B — Win Rate by Signal + Hit Rate Donut */}
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="bg-card/50 backdrop-blur border-border">
                    <CardHeader>
                      <CardTitle className="text-lg">Win Rate by Signal</CardTitle>
                      <CardDescription>
                        Target hit vs stopped out for BUY and STRONG_BUY signals
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {perfAnalytics.winRateBySignal.length > 0 ? (
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={perfAnalytics.winRateBySignal.map((w) => ({
                                signal: w.signal.replace("_", " "),
                                winRate: Number(w.winRate.toFixed(1)),
                                total: w.total,
                              }))}
                              layout="vertical"
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
                              <XAxis type="number" stroke={chartColors.axisStroke} fontSize={12} domain={[0, 100]} />
                              <YAxis type="category" dataKey="signal" stroke={chartColors.axisStroke} fontSize={11} width={100} />
                              <Tooltip {...CHART_TOOLTIP_STYLE} />
                              <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                                {perfAnalytics.winRateBySignal.map((w, i) => (
                                  <Cell key={`wr-${i}`} fill={w.winRate >= 50 ? chartColors.accent : chartColors.destructive} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No resolved signals yet. Outcomes are determined after 10 trading days.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-card/50 backdrop-blur border-border">
                    <CardHeader>
                      <CardTitle className="text-lg">Hit Rate Breakdown</CardTitle>
                      <CardDescription>
                        Outcome distribution for actionable signals
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {hitRateDonutData.length > 0 ? (
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={hitRateDonutData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {hitRateDonutData.map((_, index) => (
                                  <Cell key={`hr-${index}`} fill={HIT_RATE_COLORS[index % HIT_RATE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip {...CHART_TOOLTIP_STYLE} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="flex justify-center gap-4 mt-2">
                            {hitRateDonutData.map((item, i) => (
                              <div key={item.name} className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: HIT_RATE_COLORS[i] }} />
                                <span className="text-xs text-muted-foreground">{item.name} ({item.value})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Pending: {perfAnalytics.hitRate.pending} signals awaiting outcome
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Section C — Avg Return by Period */}
                {avgReturnChartData.length > 0 && (
                  <Card className="bg-card/50 backdrop-blur border-border">
                    <CardHeader>
                      <CardTitle className="text-lg">Average Return by Period</CardTitle>
                      <CardDescription>
                        Mean % return after 1, 3, 5, and 10 trading days by signal type
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={avgReturnChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
                            <XAxis dataKey="signal" stroke={chartColors.axisStroke} fontSize={11} />
                            <YAxis stroke={chartColors.axisStroke} fontSize={12} tickFormatter={(v) => `${v}%`} />
                            <Tooltip
                              {...CHART_TOOLTIP_STYLE}
                              formatter={(value) => [`${Number(value ?? 0).toFixed(2)}%`]}
                            />
                            <Bar dataKey="1D" fill={RETURN_PERIOD_COLORS[0]} radius={[2, 2, 0, 0]} />
                            <Bar dataKey="3D" fill={RETURN_PERIOD_COLORS[1]} radius={[2, 2, 0, 0]} />
                            <Bar dataKey="5D" fill={RETURN_PERIOD_COLORS[2]} radius={[2, 2, 0, 0]} />
                            <Bar dataKey="10D" fill={RETURN_PERIOD_COLORS[3]} radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center gap-4 mt-3">
                        {["1D", "3D", "5D", "10D"].map((label, i) => (
                          <div key={label} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: RETURN_PERIOD_COLORS[i] }} />
                            <span className="text-xs text-muted-foreground">{label}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Section G — Score-Tier Performance (#8) */}
                {backtestAnalytics.scoreTierPerformance.filter((t) => t.signalCount > 0).length > 0 && (
                  <Card className="bg-card/50 backdrop-blur border-border">
                    <CardHeader>
                      <CardTitle className="text-lg">Score-Tier Performance</CardTitle>
                      <CardDescription>
                        Average returns by score bucket &mdash; does a higher score mean better returns?
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 mb-6">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={backtestAnalytics.scoreTierPerformance
                              .filter((t) => t.signalCount > 0)
                              .map((t) => ({
                                tier: t.tierLabel,
                                "1D": t.avgReturn1d ?? 0,
                                "3D": t.avgReturn3d ?? 0,
                                "5D": t.avgReturn5d ?? 0,
                                "10D": t.avgReturn10d ?? 0,
                              }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
                            <XAxis dataKey="tier" stroke={chartColors.axisStroke} fontSize={11} />
                            <YAxis stroke={chartColors.axisStroke} fontSize={12} tickFormatter={(v) => `${v}%`} />
                            <Tooltip
                              {...CHART_TOOLTIP_STYLE}
                              formatter={(value) => [`${Number(value ?? 0).toFixed(2)}%`]}
                            />
                            <Bar dataKey="1D" fill={RETURN_PERIOD_COLORS[0]} radius={[2, 2, 0, 0]} />
                            <Bar dataKey="3D" fill={RETURN_PERIOD_COLORS[1]} radius={[2, 2, 0, 0]} />
                            <Bar dataKey="5D" fill={RETURN_PERIOD_COLORS[2]} radius={[2, 2, 0, 0]} />
                            <Bar dataKey="10D" fill={RETURN_PERIOD_COLORS[3]} radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Tier</th>
                              <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Signals (N)</th>
                              <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Win Rate</th>
                              <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Avg 10D</th>
                              <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground">Confidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {backtestAnalytics.scoreTierPerformance
                              .filter((t) => t.signalCount > 0)
                              .map((t) => {
                                const resolved = t.wins + t.losses;
                                const conf: ConfidenceLevel =
                                  resolved >= 30 ? "high" : resolved >= 15 ? "moderate" : resolved >= 5 ? "low" : "insufficient";
                                return (
                                  <tr key={t.tierLabel} className="border-b border-border/50 hover:bg-secondary/30">
                                    <td className="py-2 px-2 text-sm font-semibold">{t.tier}</td>
                                    <td className="text-right py-2 px-2 font-mono text-sm">{t.signalCount}</td>
                                    <td className="text-right py-2 px-2 font-mono text-sm">
                                      <span className={t.winRate >= 50 ? "text-green-500" : resolved === 0 ? "text-muted-foreground" : "text-red-500"}>
                                        {resolved > 0 ? `${t.winRate.toFixed(1)}%` : "\u2014"}
                                      </span>
                                    </td>
                                    <td className="text-right py-2 px-2 font-mono text-sm">
                                      <span className={(t.avgReturn10d ?? 0) >= 0 ? "text-green-500" : "text-red-500"}>
                                        {t.avgReturn10d !== null ? `${t.avgReturn10d.toFixed(2)}%` : "\u2014"}
                                      </span>
                                    </td>
                                    <td className="text-center py-2 px-2">
                                      <ConfidenceBadge level={conf} />
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex justify-center gap-4 mt-3">
                        {["1D", "3D", "5D", "10D"].map((label, i) => (
                          <div key={label} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: RETURN_PERIOD_COLORS[i] }} />
                            <span className="text-xs text-muted-foreground">{label}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Section D — Signal Accuracy Trend */}
                {perfAnalytics.accuracyTrend.length > 1 && (
                  <Card className="bg-card/50 backdrop-blur border-border">
                    <CardHeader>
                      <CardTitle className="text-lg">Signal Accuracy Trend</CardTitle>
                      <CardDescription>
                        Weekly win rate for BUY/STRONG_BUY signals — is the strategy improving?
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={perfAnalytics.accuracyTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
                            <XAxis
                              dataKey="weekStart"
                              stroke={chartColors.axisStroke}
                              fontSize={10}
                              tickFormatter={(v) =>
                                new Date(v).toLocaleDateString("en-IN", {
                                  month: "short",
                                  day: "numeric",
                                })
                              }
                            />
                            <YAxis stroke={chartColors.axisStroke} fontSize={12} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                            <Tooltip
                              {...CHART_TOOLTIP_STYLE}
                              formatter={(value) => [`${Number(value ?? 0).toFixed(1)}%`, "Win Rate"]}
                              labelFormatter={(v) =>
                                `Week of ${new Date(v).toLocaleDateString("en-IN")}`
                              }
                            />
                            <Line
                              type="monotone"
                              dataKey="winRate"
                              stroke={chartColors.primary}
                              strokeWidth={2}
                              dot={{ r: 4, fill: chartColors.primary }}
                              activeDot={{ r: 6 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Section H — Sector Performance Breakdown (#8) */}
                {backtestAnalytics.sectorPerformance.filter((s) => s.signalCount >= 2).length > 0 && (
                  <Card className="bg-card/50 backdrop-blur border-border">
                    <CardHeader>
                      <CardTitle className="text-lg">Sector Performance by Signal</CardTitle>
                      <CardDescription>
                        Which sectors performed best for each signal type (min. 2 signals)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Sector</th>
                              <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground">Signal</th>
                              <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">N</th>
                              <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Avg 10D Return</th>
                              <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Win Rate</th>
                              <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground">Confidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {backtestAnalytics.sectorPerformance
                              .filter((s) => s.signalCount >= 2)
                              .slice(0, 15)
                              .map((s) => {
                                const resolved = s.wins + s.losses;
                                const conf: ConfidenceLevel =
                                  resolved >= 30 ? "high" : resolved >= 15 ? "moderate" : resolved >= 5 ? "low" : "insufficient";
                                return (
                                  <tr key={`${s.sector}-${s.signal}`} className="border-b border-border/50 hover:bg-secondary/30">
                                    <td className="py-2 px-2 text-sm">{s.sector}</td>
                                    <td className="text-center py-2 px-2">
                                      <Badge
                                        className={`text-[10px] ${
                                          s.signal === "STRONG_BUY"
                                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                            : s.signal === "BUY"
                                              ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                                              : ""
                                        }`}
                                      >
                                        {s.signal.replace("_", " ")}
                                      </Badge>
                                    </td>
                                    <td className="text-right py-2 px-2 font-mono text-sm">{s.signalCount}</td>
                                    <td className="text-right py-2 px-2 font-mono text-sm">
                                      <span className={(s.avgReturn10d ?? 0) >= 0 ? "text-green-500" : "text-red-500"}>
                                        {s.avgReturn10d !== null ? `${s.avgReturn10d.toFixed(2)}%` : "\u2014"}
                                      </span>
                                    </td>
                                    <td className="text-right py-2 px-2 font-mono text-sm">
                                      <span className={s.winRate >= 50 ? "text-green-500" : resolved === 0 ? "text-muted-foreground" : "text-red-500"}>
                                        {resolved > 0 ? `${s.winRate.toFixed(1)}%` : "\u2014"}
                                      </span>
                                    </td>
                                    <td className="text-center py-2 px-2">
                                      <ConfidenceBadge level={conf} />
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Section E — Best & Worst Signals */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Best Signals */}
                  <Card className="bg-card/50 backdrop-blur border-border">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-green-500" />
                        Best Signals
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {perfAnalytics.bestSignals.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Stock</th>
                                <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground">Signal</th>
                                <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Score</th>
                                <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Return</th>
                                <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground">Period</th>
                              </tr>
                            </thead>
                            <tbody>
                              {perfAnalytics.bestSignals.map((ranked) => (
                                <tr key={ranked.signal.id} className="border-b border-border/50 hover:bg-secondary/30">
                                  <td className="py-2 px-2">
                                    <div className="font-semibold text-sm">{ranked.signal.symbol}</div>
                                    <div className="text-[10px] text-muted-foreground">{ranked.signal.sector}</div>
                                  </td>
                                  <td className="text-center py-2 px-2">
                                    <Badge variant={ranked.signal.signal === "STRONG_BUY" ? "success" : "default"} className="text-[10px]">
                                      {ranked.signal.signal.replace("_", " ")}
                                    </Badge>
                                  </td>
                                  <td className="text-right py-2 px-2 font-mono text-sm">{ranked.signal.score}</td>
                                  <td className="text-right py-2 px-2 font-mono text-sm text-green-500">
                                    +{ranked.returnPct.toFixed(1)}%
                                  </td>
                                  <td className="text-center py-2 px-2">
                                    <Badge variant="outline" className="text-[10px] font-mono">{ranked.period}</Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Worst Signals */}
                  <Card className="bg-card/50 backdrop-blur border-border">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        Worst Signals
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {perfAnalytics.worstSignals.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Stock</th>
                                <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground">Signal</th>
                                <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Score</th>
                                <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Return</th>
                                <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground">Period</th>
                              </tr>
                            </thead>
                            <tbody>
                              {perfAnalytics.worstSignals.map((ranked) => (
                                <tr key={ranked.signal.id} className="border-b border-border/50 hover:bg-secondary/30">
                                  <td className="py-2 px-2">
                                    <div className="font-semibold text-sm">{ranked.signal.symbol}</div>
                                    <div className="text-[10px] text-muted-foreground">{ranked.signal.sector}</div>
                                  </td>
                                  <td className="text-center py-2 px-2">
                                    <Badge variant={ranked.signal.signal === "STRONG_BUY" ? "success" : "default"} className="text-[10px]">
                                      {ranked.signal.signal.replace("_", " ")}
                                    </Badge>
                                  </td>
                                  <td className="text-right py-2 px-2 font-mono text-sm">{ranked.signal.score}</td>
                                  <td className="text-right py-2 px-2 font-mono text-sm text-red-500">
                                    {ranked.returnPct.toFixed(1)}%
                                  </td>
                                  <td className="text-center py-2 px-2">
                                    <Badge variant="outline" className="text-[10px] font-mono">{ranked.period}</Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
