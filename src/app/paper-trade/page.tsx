"use client";

import { useState, useMemo } from "react";
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
  LineChart,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Briefcase,
  Trash2,
  XCircle,
  RefreshCw,
  Clock,
} from "lucide-react";
import { usePaperTrade } from "@/contexts/PaperTradeContext";
import { usePriceUpdate } from "@/contexts/PriceUpdateContext";
import { useScreenerData } from "@/hooks/useScreenerData";
import { CloseTradeDialog } from "@/components/trade-actions/CloseTradeDialog";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { PaperTrade, DivergenceResult } from "@/lib/types";

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
  const { results: screenerResults } = useScreenerData();

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

  const [closingTrade, setClosingTrade] = useState<PaperTrade | null>(null);

  const winCount = closedTrades.filter((t) => (t.realizedPnl ?? 0) > 0).length;
  const winRate =
    closedTrades.length > 0 ? (winCount / closedTrades.length) * 100 : 0;

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
                {/* Table header */}
                <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-xs text-muted-foreground font-medium uppercase">
                  <div className="col-span-2">Symbol</div>
                  <div className="col-span-1 text-right">Qty</div>
                  <div className="col-span-2 text-right">Entry</div>
                  <div className="col-span-2 text-right">Current</div>
                  <div className="col-span-2 text-right">P&L</div>
                  <div className="col-span-1 text-right">SL</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>

                {openTrades.map((trade) => {
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
                    <Card key={trade.id} className="hover:border-primary/30 transition-colors">
                      <CardContent className="py-3 px-4">
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-12 md:col-span-2">
                            <p className="font-semibold">{trade.symbol}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {trade.name}
                            </p>
                            {bearishDivergenceMap.has(trade.symbol) && (
                              <Badge variant="destructive" className="text-[10px] mt-0.5">
                                Bearish Divergence
                              </Badge>
                            )}
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
                              : "—"}
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
                <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-xs text-muted-foreground font-medium uppercase">
                  <div className="col-span-2">Symbol</div>
                  <div className="col-span-1 text-right">Qty</div>
                  <div className="col-span-2 text-right">Entry</div>
                  <div className="col-span-2 text-right">Exit</div>
                  <div className="col-span-2 text-right">P&L</div>
                  <div className="col-span-2 text-right">Reason</div>
                  <div className="col-span-1 text-right">Action</div>
                </div>

                {closedTrades.map((trade) => {
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
                              : "—"}
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
