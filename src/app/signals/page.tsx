"use client";

import { useMemo } from "react";
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
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Zap,
  Target,
  Clock,
  RefreshCw,
  Wifi,
  WifiOff,
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
} from "recharts";
import { generateHistoricalPrices } from "@/lib/mock-data";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { useScreenerData } from "@/hooks/useScreenerData";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#94a3b8", "#ef4444"];

export default function SignalsPage() {
  const { results, mode, loading, lastRefresh, marketRegime, refresh } = useScreenerData();

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
    ];
  }, [topPicks]);

  const priceData = useMemo(() => {
    if (topPicks.length === 0) return [];
    return generateHistoricalPrices(topPicks[0].stock.lastPrice, 90);
  }, [topPicks]);

  const phasePassRates = useMemo(() => {
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
                          contentStyle={{
                            backgroundColor: "#141826",
                            border: "1px solid #1e293b",
                            borderRadius: "8px",
                          }}
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
                          stroke="#1e293b"
                        />
                        <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                        <YAxis
                          type="category"
                          dataKey="sector"
                          stroke="#94a3b8"
                          fontSize={11}
                          width={100}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#141826",
                            border: "1px solid #1e293b",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar
                          dataKey="avgScore"
                          fill="#3b82f6"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analysis">
            {topPicks.length > 0 && (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Price Chart */}
                <Card className="bg-card/50 backdrop-blur border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {topPicks[0].stock.symbol} - 90 Day Price
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
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
                                stopColor="#3b82f6"
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="95%"
                                stopColor="#3b82f6"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#1e293b"
                          />
                          <XAxis
                            dataKey="date"
                            stroke="#94a3b8"
                            fontSize={10}
                            tickFormatter={(v) =>
                              new Date(v).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                              })
                            }
                          />
                          <YAxis stroke="#94a3b8" fontSize={12} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#141826",
                              border: "1px solid #1e293b",
                              borderRadius: "8px",
                            }}
                            labelFormatter={(v) =>
                              new Date(v).toLocaleDateString("en-IN")
                            }
                          />
                          <Area
                            type="monotone"
                            dataKey="close"
                            stroke="#3b82f6"
                            fill="url(#colorPrice)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
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
                          <PolarGrid stroke="#1e293b" />
                          <PolarAngleAxis
                            dataKey="metric"
                            stroke="#94a3b8"
                            fontSize={11}
                          />
                          <PolarRadiusAxis
                            stroke="#1e293b"
                            fontSize={10}
                            domain={[0, 100]}
                          />
                          <Radar
                            name="Score"
                            dataKey="value"
                            stroke="#3b82f6"
                            fill="#3b82f6"
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
                            <th className="text-left py-3 px-3 text-sm font-medium text-muted-foreground">
                              Stock
                            </th>
                            <th className="text-right py-3 px-3 text-sm font-medium text-muted-foreground">
                              Price
                            </th>
                            <th className="text-center py-3 px-3 text-sm font-medium text-muted-foreground">
                              Signal
                            </th>
                            <th className="text-center py-3 px-3 text-sm font-medium text-muted-foreground">
                              Score
                            </th>
                            <th className="text-right py-3 px-3 text-sm font-medium text-muted-foreground">
                              Entry
                            </th>
                            <th className="text-right py-3 px-3 text-sm font-medium text-muted-foreground">
                              Stop Loss
                            </th>
                            <th className="text-right py-3 px-3 text-sm font-medium text-muted-foreground">
                              Target
                            </th>
                            <th className="text-center py-3 px-3 text-sm font-medium text-muted-foreground">
                              R:R
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {topPicks.map((r) => (
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
                          stroke="#1e293b"
                        />
                        <XAxis
                          dataKey="phase"
                          stroke="#94a3b8"
                          fontSize={12}
                        />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#141826",
                            border: "1px solid #1e293b",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                          {phasePassRates.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#ef4444"][
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

              {/* Workflow Timeline */}
              <Card className="bg-card/50 backdrop-blur border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Daily Workflow</CardTitle>
                  <CardDescription>
                    Automated execution timeline
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      {
                        time: "15:15",
                        label: "Data Collection",
                        agent: "DataAgent",
                        icon: Activity,
                      },
                      {
                        time: "15:20",
                        label: "Indicator Calculation",
                        agent: "IndicatorAgent",
                        icon: BarChart3,
                      },
                      {
                        time: "15:27",
                        label: "Screening",
                        agent: "ScreenerAgent",
                        icon: Target,
                      },
                      {
                        time: "15:29",
                        label: "LLM Analysis",
                        agent: "AnalystAgent",
                        icon: Zap,
                      },
                      {
                        time: "09:15",
                        label: "Order Execution",
                        agent: "ExecutionAgent",
                        icon: TrendingUp,
                      },
                    ].map((step, i) => {
                      const Icon = step.icon;
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-4 p-3 rounded-lg bg-background/50 border border-border"
                        >
                          <Badge
                            variant="outline"
                            className="font-mono text-xs"
                          >
                            {step.time}
                          </Badge>
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{step.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {step.agent}
                            </p>
                          </div>
                          <Clock className="w-4 h-4 text-muted-foreground" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
