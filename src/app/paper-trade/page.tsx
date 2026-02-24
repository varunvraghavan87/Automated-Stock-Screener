"use client";

import { useState, useMemo } from "react";
import { useSortable } from "@/hooks/useSortable";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Navbar } from "@/components/layout/navbar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
  PieChart,
  Pie,
} from "recharts";
import {
  LineChart,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Briefcase,
  Trash2,
  XCircle,
  RefreshCw,
  Clock,
  BarChart3,
  AlertTriangle,
  Shield,
} from "lucide-react";
import { usePaperTrade } from "@/contexts/PaperTradeContext";
import { usePriceUpdate } from "@/contexts/PriceUpdateContext";
import { useScreenerData } from "@/hooks/useScreenerData";
import { CloseTradeDialog } from "@/components/trade-actions/CloseTradeDialog";
import {
  computePortfolioAnalytics,
  computePortfolioRisk,
} from "@/lib/portfolio-analytics";
import { computeRebalanceAlerts } from "@/lib/rebalancing";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import type { PaperTrade, DivergenceResult, MonthlyReturn } from "@/lib/types";

// ---- Chart Constants (matching signals page dark theme) ----

const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "#141826",
    border: "1px solid #1e293b",
    borderRadius: "8px",
  },
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const SECTOR_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
];

// ---- Monthly Returns Heatmap Component ----

function MonthlyReturnsHeatmap({ data }: { data: MonthlyReturn[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No monthly data yet
      </p>
    );
  }

  const years = [...new Set(data.map((d) => d.year))].sort();
  const lookup = new Map(data.map((d) => [`${d.year}-${d.month}`, d]));

  function cellColor(returnPercent: number): string {
    if (returnPercent > 5) return "bg-green-600/80 text-white";
    if (returnPercent > 2) return "bg-green-500/60 text-white";
    if (returnPercent > 0) return "bg-green-400/30 text-green-300";
    if (returnPercent === 0) return "bg-muted/30 text-muted-foreground";
    if (returnPercent > -2) return "bg-red-400/30 text-red-300";
    if (returnPercent > -5) return "bg-red-500/60 text-white";
    return "bg-red-600/80 text-white";
  }

  return (
    <div className="overflow-x-auto">
      {/* Column headers */}
      <div className="grid grid-cols-[60px_repeat(12,1fr)] gap-1 mb-1">
        <div />
        {MONTH_NAMES.map((m) => (
          <div
            key={m}
            className="text-center text-[10px] text-muted-foreground font-medium"
          >
            {m}
          </div>
        ))}
      </div>

      {/* Rows: one per year */}
      {years.map((year) => (
        <div
          key={year}
          className="grid grid-cols-[60px_repeat(12,1fr)] gap-1 mb-1"
        >
          <div className="text-xs text-muted-foreground font-mono flex items-center">
            {year}
          </div>
          {Array.from({ length: 12 }, (_, month) => {
            const entry = lookup.get(`${year}-${month}`);
            if (!entry) {
              return (
                <div key={month} className="h-8 rounded bg-muted/10" />
              );
            }
            return (
              <div
                key={month}
                className={`h-8 rounded flex items-center justify-center text-[10px] font-mono ${cellColor(entry.returnPercent)}`}
                title={`${MONTH_NAMES[month]} ${year}: ${entry.returnPercent >= 0 ? "+" : ""}${entry.returnPercent.toFixed(1)}% (${entry.tradeCount} trades)`}
              >
                {entry.returnPercent >= 0 ? "+" : ""}
                {entry.returnPercent.toFixed(1)}%
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---- Main Page Component ----

export default function PaperTradePage() {
  const {
    openTrades,
    closedTrades,
    loading,
    totalInvested,
    totalCurrentValue,
    totalUnrealizedPnl,
    totalUnrealizedPnlPercent,
    totalRealizedPnl,
    deleteTrade,
  } = usePaperTrade();

  const { lastUpdate, updating, marketOpen, triggerUpdate } = usePriceUpdate();
  const { results: screenerResults, lastRefresh } = useScreenerData();

  // Build a map of symbols with bearish divergences (for warning badges on open trades)
  const bearishDivergenceMap = useMemo(() => {
    const map = new Map<string, DivergenceResult>();
    for (const r of screenerResults) {
      if (r.indicators.divergences.hasBearish) {
        map.set(r.stock.symbol, r.indicators.divergences);
      }
    }
    return map;
  }, [screenerResults]);

  // Compute rebalancing alerts for open positions
  const rebalanceResult = useMemo(
    () =>
      computeRebalanceAlerts(
        openTrades,
        screenerResults,
        bearishDivergenceMap,
        lastRefresh
      ),
    [openTrades, screenerResults, bearishDivergenceMap, lastRefresh]
  );

  const [closingTrade, setClosingTrade] = useState<PaperTrade | null>(null);

  const winCount = closedTrades.filter((t) => (t.realizedPnl ?? 0) > 0).length;
  const winRate =
    closedTrades.length > 0 ? (winCount / closedTrades.length) * 100 : 0;

  // Portfolio analytics — computed from closed trades only
  const analytics = useMemo(
    () => computePortfolioAnalytics(closedTrades),
    [closedTrades]
  );

  // Portfolio risk — computed from open trades only
  const riskMetrics = useMemo(
    () => computePortfolioRisk(openTrades),
    [openTrades]
  );

  // Add derived P&L fields for sorting
  const openTradesWithPnl = useMemo(
    () =>
      openTrades.map((t) => ({
        ...t,
        _pnl: ((t.currentPrice ?? t.entryPrice) - t.entryPrice) * t.quantity,
      })),
    [openTrades]
  );
  const { sortedData: sortedOpen, requestSort: requestSortOpen, getSortIndicator: getSortIndicatorOpen } =
    useSortable(openTradesWithPnl);

  const closedTradesWithPnl = useMemo(
    () =>
      closedTrades.map((t) => ({
        ...t,
        _pnl: t.realizedPnl ?? 0,
      })),
    [closedTrades]
  );
  const { sortedData: sortedClosed, requestSort: requestSortClosed, getSortIndicator: getSortIndicatorClosed } =
    useSortable(closedTradesWithPnl);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LineChart className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Paper Trade</h1>
              <p className="text-sm text-muted-foreground">
                Track mock positions and P&L performance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <span className="text-xs text-muted-foreground">
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <Badge variant={marketOpen ? "default" : "secondary"}>
              {marketOpen ? "Live" : "Market Closed"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={triggerUpdate}
              disabled={updating}
            >
              <RefreshCw
                className={`w-4 h-4 mr-1 ${updating ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* Portfolio Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="w-4 h-4" />
                Invested
              </div>
              <p className="text-2xl font-bold font-mono">
                {formatCurrency(totalInvested)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Briefcase className="w-4 h-4" />
                Current Value
              </div>
              <p className="text-2xl font-bold font-mono">
                {formatCurrency(totalCurrentValue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                {totalUnrealizedPnl >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                Unrealized P&L
              </div>
              <p
                className={`text-2xl font-bold font-mono ${
                  totalUnrealizedPnl >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {totalUnrealizedPnl >= 0 ? "+" : ""}
                {formatCurrency(totalUnrealizedPnl)}
              </p>
              <p
                className={`text-sm font-mono ${
                  totalUnrealizedPnl >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {formatPercent(totalUnrealizedPnlPercent)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                {totalRealizedPnl >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                Realized P&L
              </div>
              <p
                className={`text-2xl font-bold font-mono ${
                  totalRealizedPnl >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {totalRealizedPnl >= 0 ? "+" : ""}
                {formatCurrency(totalRealizedPnl)}
              </p>
              {closedTrades.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Win rate: {winRate.toFixed(0)}%
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Trades Tabs */}
        <Tabs defaultValue="open">
          <TabsList>
            <TabsTrigger value="open">
              Open Positions ({openTrades.length})
            </TabsTrigger>
            <TabsTrigger value="closed">
              Closed Trades ({closedTrades.length})
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="w-4 h-4 mr-1" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="space-y-2 mt-4">
            {loading ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Loading trades...
                </CardContent>
              </Card>
            ) : openTrades.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No open positions</p>
                  <p className="text-sm mt-1">
                    Use the &quot;Paper Buy&quot; button on the Dashboard or
                    Screener to add stocks
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {/* Rebalancing Summary Alert */}
                {rebalanceResult.summary.totalFlagged > 0 && (
                  <Card
                    className={`border ${
                      rebalanceResult.summary.criticalCount > 0
                        ? "border-red-500/40 bg-red-500/5"
                        : "border-amber-500/40 bg-amber-500/5"
                    }`}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle
                            className={`w-4 h-4 ${
                              rebalanceResult.summary.criticalCount > 0
                                ? "text-red-500"
                                : "text-amber-500"
                            }`}
                          />
                          <span className="text-sm font-medium">
                            {rebalanceResult.summary.totalFlagged} position
                            {rebalanceResult.summary.totalFlagged !== 1
                              ? "s"
                              : ""}{" "}
                            need
                            {rebalanceResult.summary.totalFlagged === 1
                              ? "s"
                              : ""}{" "}
                            attention
                          </span>
                          {rebalanceResult.summary.criticalCount > 0 && (
                            <Badge
                              variant="destructive"
                              className="text-[10px]"
                            >
                              {rebalanceResult.summary.criticalCount} Critical
                            </Badge>
                          )}
                          {rebalanceResult.summary.warningCount > 0 && (
                            <Badge className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30">
                              {rebalanceResult.summary.warningCount} Warning
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {rebalanceResult.summary.isStale ? (
                            <span className="text-amber-400">
                              Screener data is &gt;24h old — rebalance
                              recommended
                            </span>
                          ) : (
                            <span>
                              Last screener:{" "}
                              {rebalanceResult.summary.lastScreenerRun.toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Table header */}
                <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium uppercase">
                  <div className="col-span-2"><SortableHeader label="Symbol" sortKey="symbol" sortIndicator={getSortIndicatorOpen("symbol")} onSort={requestSortOpen} className="text-xs" /></div>
                  <div className="col-span-1 text-right"><SortableHeader label="Qty" sortKey="quantity" sortIndicator={getSortIndicatorOpen("quantity")} onSort={requestSortOpen} className="text-xs justify-end" /></div>
                  <div className="col-span-2 text-right"><SortableHeader label="Entry" sortKey="entryPrice" sortIndicator={getSortIndicatorOpen("entryPrice")} onSort={requestSortOpen} className="text-xs justify-end" /></div>
                  <div className="col-span-2 text-right"><SortableHeader label="Current" sortKey="currentPrice" sortIndicator={getSortIndicatorOpen("currentPrice")} onSort={requestSortOpen} className="text-xs justify-end" /></div>
                  <div className="col-span-2 text-right"><SortableHeader label="P&L" sortKey="_pnl" sortIndicator={getSortIndicatorOpen("_pnl")} onSort={requestSortOpen} className="text-xs justify-end" /></div>
                  <div className="col-span-1 text-right text-muted-foreground">SL</div>
                  <div className="col-span-2 text-right text-muted-foreground">Actions</div>
                </div>

                {sortedOpen.map((trade) => {
                  const currentPrice = trade.currentPrice ?? trade.entryPrice;
                  const pnl =
                    (currentPrice - trade.entryPrice) * trade.quantity;
                  const pnlPercent =
                    trade.entryPrice > 0
                      ? ((currentPrice - trade.entryPrice) /
                          trade.entryPrice) *
                        100
                      : 0;

                  return (
                    <Card
                      key={trade.id}
                      className={`hover:border-primary/30 transition-colors ${
                        rebalanceResult.trades.get(trade.id)?.hasCritical
                          ? "border-red-500/30"
                          : rebalanceResult.trades.get(trade.id)?.hasWarning
                            ? "border-amber-500/20"
                            : ""
                      }`}
                    >
                      <CardContent className="py-3 px-4">
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-12 md:col-span-2">
                            <p className="font-semibold">{trade.symbol}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {trade.name}
                            </p>
                            {/* Rebalancing & Exit Signal Badges */}
                            {(() => {
                              const tradeAlerts =
                                rebalanceResult.trades.get(trade.id);
                              if (
                                !tradeAlerts ||
                                tradeAlerts.flags.length === 0
                              )
                                return null;
                              return (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {tradeAlerts.flags.map((flag) => (
                                    <Tooltip key={flag.type}>
                                      <TooltipTrigger asChild>
                                        <Badge
                                          className={`text-[10px] ${
                                            flag.severity === "critical"
                                              ? "bg-red-500/15 text-red-400 border-red-500/30"
                                              : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                          }`}
                                        >
                                          {flag.label}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="bottom"
                                        className="max-w-xs"
                                      >
                                        <p className="text-xs">
                                          {flag.description}
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="col-span-3 md:col-span-1 text-right font-mono">
                            {trade.quantity}
                          </div>
                          <div className="col-span-3 md:col-span-2 text-right font-mono">
                            {formatCurrency(trade.entryPrice)}
                          </div>
                          <div className="col-span-3 md:col-span-2 text-right font-mono">
                            {formatCurrency(currentPrice)}
                          </div>
                          <div className="col-span-3 md:col-span-2 text-right">
                            <span
                              className={`font-mono font-medium ${pnl >= 0 ? "text-green-500" : "text-red-500"}`}
                            >
                              {pnl >= 0 ? "+" : ""}
                              {formatCurrency(pnl)}
                            </span>
                            <br />
                            <span
                              className={`text-xs font-mono ${pnl >= 0 ? "text-green-500" : "text-red-500"}`}
                            >
                              {formatPercent(pnlPercent)}
                            </span>
                          </div>
                          <div className="col-span-6 md:col-span-1 text-right font-mono text-sm text-muted-foreground">
                            {trade.stopLoss
                              ? formatCurrency(trade.stopLoss)
                              : "\u2014"}
                          </div>
                          <div className="col-span-6 md:col-span-2 text-right space-x-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setClosingTrade(trade)}
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Close
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Close this position</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteTrade(trade.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete trade</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="closed" className="space-y-2 mt-4">
            {closedTrades.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No closed trades yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium uppercase">
                  <div className="col-span-2"><SortableHeader label="Symbol" sortKey="symbol" sortIndicator={getSortIndicatorClosed("symbol")} onSort={requestSortClosed} className="text-xs" /></div>
                  <div className="col-span-1 text-right"><SortableHeader label="Qty" sortKey="quantity" sortIndicator={getSortIndicatorClosed("quantity")} onSort={requestSortClosed} className="text-xs justify-end" /></div>
                  <div className="col-span-2 text-right"><SortableHeader label="Entry" sortKey="entryPrice" sortIndicator={getSortIndicatorClosed("entryPrice")} onSort={requestSortClosed} className="text-xs justify-end" /></div>
                  <div className="col-span-2 text-right"><SortableHeader label="Exit" sortKey="exitPrice" sortIndicator={getSortIndicatorClosed("exitPrice")} onSort={requestSortClosed} className="text-xs justify-end" /></div>
                  <div className="col-span-2 text-right"><SortableHeader label="P&L" sortKey="_pnl" sortIndicator={getSortIndicatorClosed("_pnl")} onSort={requestSortClosed} className="text-xs justify-end" /></div>
                  <div className="col-span-2 text-right text-muted-foreground">Reason</div>
                  <div className="col-span-1 text-right text-muted-foreground">Action</div>
                </div>

                {sortedClosed.map((trade) => {
                  const pnl = trade.realizedPnl ?? 0;
                  const pnlPercent =
                    trade.entryPrice > 0 && trade.exitPrice
                      ? ((trade.exitPrice - trade.entryPrice) /
                          trade.entryPrice) *
                        100
                      : 0;

                  return (
                    <Card key={trade.id} className="opacity-80">
                      <CardContent className="py-3 px-4">
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-12 md:col-span-2">
                            <p className="font-semibold">{trade.symbol}</p>
                            <p className="text-xs text-muted-foreground">
                              {trade.name}
                            </p>
                          </div>
                          <div className="col-span-2 md:col-span-1 text-right font-mono">
                            {trade.quantity}
                          </div>
                          <div className="col-span-2 md:col-span-2 text-right font-mono">
                            {formatCurrency(trade.entryPrice)}
                          </div>
                          <div className="col-span-2 md:col-span-2 text-right font-mono">
                            {trade.exitPrice
                              ? formatCurrency(trade.exitPrice)
                              : "\u2014"}
                          </div>
                          <div className="col-span-3 md:col-span-2 text-right">
                            <span
                              className={`font-mono font-medium ${pnl >= 0 ? "text-green-500" : "text-red-500"}`}
                            >
                              {pnl >= 0 ? "+" : ""}
                              {formatCurrency(pnl)}
                            </span>
                            <br />
                            <span
                              className={`text-xs font-mono ${pnl >= 0 ? "text-green-500" : "text-red-500"}`}
                            >
                              {formatPercent(pnlPercent)}
                            </span>
                          </div>
                          <div className="col-span-2 md:col-span-2 text-right">
                            <Badge variant="outline" className="text-xs">
                              {trade.exitReason || "manual"}
                            </Badge>
                          </div>
                          <div className="col-span-1 md:col-span-1 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => deleteTrade(trade.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ---- Analytics Tab ---- */}
          <TabsContent value="analytics" className="space-y-6 mt-4">
            {/* Portfolio Risk Section — renders from open trades, independent of closedTrades */}
            {openTrades.length > 0 && (
              <Card className="bg-card/50 backdrop-blur border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" />
                      <CardTitle className="text-lg">Portfolio Risk</CardTitle>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        riskMetrics.overallRiskLevel === "high"
                          ? "border-red-500/50 text-red-400"
                          : riskMetrics.overallRiskLevel === "moderate"
                            ? "border-amber-500/50 text-amber-400"
                            : "border-green-500/50 text-green-400"
                      }`}
                    >
                      {riskMetrics.overallRiskLevel === "high"
                        ? "High Risk"
                        : riskMetrics.overallRiskLevel === "moderate"
                          ? "Moderate Risk"
                          : "Low Risk"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Risk Metric Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <Card>
                      <CardContent className="pt-4 pb-3 px-4">
                        <p className="text-xs text-muted-foreground mb-1">
                          Portfolio Heat
                        </p>
                        <p
                          className={`text-xl font-bold font-mono ${
                            riskMetrics.heatLevel === "high"
                              ? "text-red-500"
                              : riskMetrics.heatLevel === "moderate"
                                ? "text-amber-400"
                                : "text-green-500"
                          }`}
                        >
                          {formatNumber(riskMetrics.portfolioHeatPercent, 1)}%
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatCurrency(riskMetrics.totalRiskAmount)} at risk
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-4 pb-3 px-4">
                        <p className="text-xs text-muted-foreground mb-1">
                          Worst-Case Loss
                        </p>
                        <p className="text-xl font-bold font-mono text-red-500">
                          {formatCurrency(riskMetrics.worstCaseLoss)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatNumber(riskMetrics.worstCaseLossPercent, 1)}% of
                          capital
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-4 pb-3 px-4">
                        <p className="text-xs text-muted-foreground mb-1">
                          Avg Risk:Reward
                        </p>
                        <p
                          className={`text-xl font-bold font-mono ${
                            (riskMetrics.avgRiskReward ?? 0) >= 2
                              ? "text-green-500"
                              : (riskMetrics.avgRiskReward ?? 0) >= 1
                                ? "text-amber-400"
                                : "text-red-500"
                          }`}
                        >
                          {riskMetrics.avgRiskReward != null
                            ? `1:${formatNumber(riskMetrics.avgRiskReward)}`
                            : "N/A"}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {riskMetrics.positionsWithRR} of{" "}
                          {riskMetrics.totalPositions} positions
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-4 pb-3 px-4">
                        <p className="text-xs text-muted-foreground mb-1">
                          Positions at Risk
                        </p>
                        <p
                          className={`text-xl font-bold font-mono ${
                            riskMetrics.positionsWithoutSL > 0
                              ? "text-amber-400"
                              : "text-green-500"
                          }`}
                        >
                          {riskMetrics.positionsWithoutSL}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          without stop-loss
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-4 pb-3 px-4">
                        <p className="text-xs text-muted-foreground mb-1">
                          Max Sector Exposure
                        </p>
                        <p
                          className={`text-xl font-bold font-mono ${
                            riskMetrics.hasConcentrationWarning
                              ? "text-red-500"
                              : "text-green-500"
                          }`}
                        >
                          {formatNumber(riskMetrics.maxSectorPercent, 1)}%
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {riskMetrics.maxSectorName || "\u2014"}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-4 pb-3 px-4">
                        <p className="text-xs text-muted-foreground mb-1">
                          Open Positions
                        </p>
                        <p className="text-xl font-bold font-mono text-muted-foreground">
                          {riskMetrics.totalPositions}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          actively tracked
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Sector Donut + Risk Controls */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Sector Allocation Donut Chart */}
                    <div>
                      <p className="text-sm font-medium mb-3">
                        Sector Allocation
                      </p>
                      {riskMetrics.sectorAllocations.length > 0 ? (
                        <>
                          <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={riskMetrics.sectorAllocations.map(
                                    (s) => ({
                                      name: s.sector,
                                      value: s.value,
                                    })
                                  )}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={80}
                                  paddingAngle={3}
                                  dataKey="value"
                                >
                                  {riskMetrics.sectorAllocations.map((_, i) => (
                                    <Cell
                                      key={`sector-${i}`}
                                      fill={
                                        SECTOR_COLORS[
                                          i % SECTOR_COLORS.length
                                        ]
                                      }
                                    />
                                  ))}
                                </Pie>
                                <RechartsTooltip
                                  {...CHART_TOOLTIP_STYLE}
                                  formatter={(value) => [
                                    formatCurrency(Number(value ?? 0)),
                                    "Value",
                                  ]}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex flex-wrap justify-center gap-3 mt-2">
                            {riskMetrics.sectorAllocations.map((s, i) => (
                              <div
                                key={s.sector}
                                className="flex items-center gap-1.5"
                              >
                                <div
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{
                                    backgroundColor:
                                      SECTOR_COLORS[
                                        i % SECTOR_COLORS.length
                                      ],
                                  }}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {s.sector} ({formatNumber(s.percent, 0)}%)
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No sector data
                        </p>
                      )}
                    </div>

                    {/* Risk Checks */}
                    <div>
                      <p className="text-sm font-medium mb-3">Risk Checks</p>
                      <div className="space-y-2">
                        <RiskCheckItem
                          label="Portfolio Heat"
                          value={`${formatNumber(riskMetrics.portfolioHeatPercent, 1)}% of capital`}
                          passed={riskMetrics.heatLevel !== "high"}
                        />
                        <RiskCheckItem
                          label="Sector Concentration"
                          value={
                            riskMetrics.hasConcentrationWarning
                              ? `${riskMetrics.maxSectorName} at ${formatNumber(riskMetrics.maxSectorPercent, 0)}%`
                              : "Below 40% threshold"
                          }
                          passed={!riskMetrics.hasConcentrationWarning}
                        />
                        <RiskCheckItem
                          label="Stop-Loss Coverage"
                          value={
                            riskMetrics.positionsWithoutSL === 0
                              ? "All positions covered"
                              : `${riskMetrics.positionsWithoutSL} position${riskMetrics.positionsWithoutSL !== 1 ? "s" : ""} exposed`
                          }
                          passed={riskMetrics.positionsWithoutSL === 0}
                        />
                        <RiskCheckItem
                          label="Risk:Reward Ratio"
                          value={
                            riskMetrics.avgRiskReward != null
                              ? `1:${formatNumber(riskMetrics.avgRiskReward)} avg`
                              : "No data"
                          }
                          passed={(riskMetrics.avgRiskReward ?? 0) >= 2}
                        />
                        <RiskCheckItem
                          label="Worst-Case Drawdown"
                          value={`${formatNumber(riskMetrics.worstCaseLossPercent, 1)}% of capital`}
                          passed={riskMetrics.worstCaseLossPercent <= 30}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {closedTrades.length === 0 ? (
              openTrades.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No closed trades to analyze</p>
                    <p className="text-sm mt-1">
                      Close some trades to see portfolio analytics
                    </p>
                  </CardContent>
                </Card>
              ) : null
            ) : (
              <>
                {/* Section A: Metric Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {[
                    {
                      label: "Sharpe Ratio",
                      value:
                        analytics.sharpeRatio != null
                          ? formatNumber(analytics.sharpeRatio)
                          : "N/A",
                      color:
                        (analytics.sharpeRatio ?? 0) >= 1
                          ? "text-green-500"
                          : (analytics.sharpeRatio ?? 0) >= 0
                            ? "text-amber-400"
                            : "text-red-500",
                    },
                    {
                      label: "Sortino Ratio",
                      value:
                        analytics.sortinoRatio != null
                          ? formatNumber(analytics.sortinoRatio)
                          : "N/A",
                      color:
                        (analytics.sortinoRatio ?? 0) >= 1.5
                          ? "text-green-500"
                          : (analytics.sortinoRatio ?? 0) >= 0
                            ? "text-amber-400"
                            : "text-red-500",
                    },
                    {
                      label: "Max Drawdown",
                      value:
                        analytics.maxDrawdown != null
                          ? `${formatNumber(analytics.maxDrawdown)}%`
                          : "N/A",
                      color: "text-red-500",
                    },
                    {
                      label: "Profit Factor",
                      value:
                        analytics.profitFactor != null
                          ? formatNumber(analytics.profitFactor)
                          : "N/A",
                      color:
                        (analytics.profitFactor ?? 0) >= 1.5
                          ? "text-green-500"
                          : "text-amber-400",
                    },
                    {
                      label: "Win Rate",
                      value: `${formatNumber(analytics.winRate, 0)}%`,
                      color:
                        analytics.winRate >= 50
                          ? "text-green-500"
                          : "text-red-500",
                    },
                    {
                      label: "Avg Win",
                      value:
                        analytics.avgWin != null
                          ? formatCurrency(analytics.avgWin)
                          : "N/A",
                      color: "text-green-500",
                    },
                    {
                      label: "Avg Loss",
                      value:
                        analytics.avgLoss != null
                          ? formatCurrency(Math.abs(analytics.avgLoss))
                          : "N/A",
                      color: "text-red-500",
                    },
                    {
                      label: "Consec. Wins",
                      value: String(analytics.maxConsecutiveWins),
                      color: "text-green-500",
                    },
                    {
                      label: "Consec. Losses",
                      value: String(analytics.maxConsecutiveLosses),
                      color: "text-red-500",
                    },
                    {
                      label: "Avg Hold",
                      value:
                        analytics.avgHoldingPeriodDays != null
                          ? `${formatNumber(analytics.avgHoldingPeriodDays, 1)}d`
                          : "N/A",
                      color: "text-muted-foreground",
                    },
                  ].map((metric) => (
                    <Card key={metric.label}>
                      <CardContent className="pt-4 pb-3 px-4">
                        <p className="text-xs text-muted-foreground mb-1">
                          {metric.label}
                        </p>
                        <p
                          className={`text-xl font-bold font-mono ${metric.color}`}
                        >
                          {metric.value}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Section B: Equity Curve + Drawdown */}
                <Card className="bg-card/50 backdrop-blur border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Equity Curve</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics.equityCurve}>
                          <defs>
                            <linearGradient
                              id="equityGradient"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#10b981"
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="95%"
                                stopColor="#10b981"
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
                          <RechartsTooltip
                            {...CHART_TOOLTIP_STYLE}
                            labelFormatter={(v) =>
                              new Date(String(v)).toLocaleDateString("en-IN")
                            }
                            formatter={(value) => [
                              formatCurrency(Number(value ?? 0)),
                              "Equity",
                            ]}
                          />
                          <ReferenceLine
                            y={100000}
                            stroke="#94a3b8"
                            strokeDasharray="3 3"
                            label={{
                              value: "Starting Capital",
                              position: "right",
                              fill: "#94a3b8",
                              fontSize: 10,
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="equity"
                            stroke="#10b981"
                            fill="url(#equityGradient)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Drawdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics.equityCurve}>
                          <defs>
                            <linearGradient
                              id="drawdownGradient"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#ef4444"
                                stopOpacity={0.4}
                              />
                              <stop
                                offset="95%"
                                stopColor="#ef4444"
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
                          <YAxis
                            stroke="#94a3b8"
                            fontSize={12}
                            tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
                          />
                          <RechartsTooltip
                            {...CHART_TOOLTIP_STYLE}
                            labelFormatter={(v) =>
                              new Date(String(v)).toLocaleDateString("en-IN")
                            }
                            formatter={(value) => [
                              `${Number(value ?? 0).toFixed(2)}%`,
                              "Drawdown",
                            ]}
                          />
                          <ReferenceLine y={0} stroke="#94a3b8" />
                          <Area
                            type="monotone"
                            dataKey="drawdown"
                            stroke="#ef4444"
                            fill="url(#drawdownGradient)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Section C: Monthly Heatmap + Win Rate by Signal */}
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="bg-card/50 backdrop-blur border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Monthly Returns</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <MonthlyReturnsHeatmap data={analytics.monthlyReturns} />
                    </CardContent>
                  </Card>

                  <Card className="bg-card/50 backdrop-blur border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">
                        Win Rate by Signal
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {analytics.winRateBySignal.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No signal data
                        </p>
                      ) : (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={analytics.winRateBySignal}
                              layout="vertical"
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#1e293b"
                              />
                              <XAxis
                                type="number"
                                stroke="#94a3b8"
                                fontSize={12}
                                domain={[0, 100]}
                                tickFormatter={(v) => `${v}%`}
                              />
                              <YAxis
                                type="category"
                                dataKey="group"
                                stroke="#94a3b8"
                                fontSize={11}
                                width={100}
                              />
                              <RechartsTooltip
                                {...CHART_TOOLTIP_STYLE}
                                formatter={(value) => [
                                  `${Number(value ?? 0).toFixed(1)}%`,
                                  "Win Rate",
                                ]}
                              />
                              <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                                {analytics.winRateBySignal.map(
                                  (entry, index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={
                                        entry.winRate >= 50
                                          ? "#10b981"
                                          : "#ef4444"
                                      }
                                    />
                                  )
                                )}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Section D: Win Rate by Sector Table */}
                {analytics.winRateBySector.length > 0 && (
                  <Card className="bg-card/50 backdrop-blur border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">
                        Win Rate by Sector
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">
                                Sector
                              </th>
                              <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">
                                Trades
                              </th>
                              <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">
                                Wins
                              </th>
                              <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">
                                Win Rate
                              </th>
                              <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">
                                Total P&L
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.winRateBySector.map((s) => (
                              <tr
                                key={s.group}
                                className="border-b border-border/50 hover:bg-secondary/30"
                              >
                                <td className="py-2 px-2 text-sm">
                                  {s.group}
                                </td>
                                <td className="text-right py-2 px-2 font-mono text-sm">
                                  {s.total}
                                </td>
                                <td className="text-right py-2 px-2 font-mono text-sm">
                                  {s.wins}
                                </td>
                                <td className="text-right py-2 px-2 font-mono text-sm">
                                  <span
                                    className={
                                      s.winRate >= 50
                                        ? "text-green-500"
                                        : "text-red-500"
                                    }
                                  >
                                    {s.winRate.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="text-right py-2 px-2 font-mono text-sm">
                                  <span
                                    className={
                                      s.totalPnl >= 0
                                        ? "text-green-500"
                                        : "text-red-500"
                                    }
                                  >
                                    {s.totalPnl >= 0 ? "+" : ""}
                                    {formatCurrency(s.totalPnl)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Close Trade Dialog */}
      {closingTrade && (
        <CloseTradeDialog
          open={!!closingTrade}
          onOpenChange={(open) => !open && setClosingTrade(null)}
          trade={closingTrade}
        />
      )}
    </div>
  );
}

// ---- Risk Check Item Component ----

function RiskCheckItem({
  label,
  value,
  passed,
}: {
  label: string;
  value: string;
  passed: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            passed ? "bg-accent" : "bg-destructive"
          }`}
        />
        <span className="text-sm">{label}</span>
      </div>
      <Badge variant="outline" className="text-xs">
        {value}
      </Badge>
    </div>
  );
}
