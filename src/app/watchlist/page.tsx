"use client";

import { useState, useMemo } from "react";
import { useSortable } from "@/hooks/useSortable";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Navbar } from "@/components/layout/navbar";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Star,
  RefreshCw,
  Trash2,
  ShoppingCart,
  Edit3,
  Check,
  X,
} from "lucide-react";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { usePriceUpdate } from "@/contexts/PriceUpdateContext";
import { PaperBuyDialog } from "@/components/trade-actions/PaperBuyDialog";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { WatchlistItem } from "@/lib/types";

export default function WatchlistPage() {
  const { items, loading, removeFromWatchlist, updateTargets } = useWatchlist();
  const { lastUpdate, updating, marketOpen, triggerUpdate } = usePriceUpdate();

  const [buyingStock, setBuyingStock] = useState<WatchlistItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuy, setEditBuy] = useState("");
  const [editSell, setEditSell] = useState("");

  const startEditing = (item: WatchlistItem) => {
    setEditingId(item.id);
    setEditBuy(item.targetBuy?.toString() || "");
    setEditSell(item.targetSell?.toString() || "");
  };

  const saveTargets = async (id: string) => {
    await updateTargets(id, {
      targetBuy: editBuy ? parseFloat(editBuy) : null,
      targetSell: editSell ? parseFloat(editSell) : null,
    });
    setEditingId(null);
  };

  const itemsWithChange = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        _currentPrice: item.currentPrice ?? item.addedPrice,
        _changePercent:
          item.addedPrice > 0
            ? (((item.currentPrice ?? item.addedPrice) - item.addedPrice) / item.addedPrice) * 100
            : 0,
      })),
    [items]
  );
  const { sortedData: sortedItems, requestSort, getSortIndicator } =
    useSortable(itemsWithChange);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Star className="w-8 h-8 text-yellow-500" />
            <div>
              <h1 className="text-2xl font-bold">Watchlist</h1>
              <p className="text-sm text-muted-foreground">
                {items.length} stock{items.length !== 1 ? "s" : ""} monitored
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

        {/* Watchlist Table */}
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading watchlist...
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Your watchlist is empty</p>
              <p className="text-sm mt-1">
                Click the star icon on stocks in the Dashboard or Screener to
                add them here
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium uppercase">
              <div className="col-span-2"><SortableHeader label="Symbol" sortKey="symbol" sortIndicator={getSortIndicator("symbol")} onSort={requestSort} className="text-xs" /></div>
              <div className="col-span-1 text-right"><SortableHeader label="Added" sortKey="addedPrice" sortIndicator={getSortIndicator("addedPrice")} onSort={requestSort} className="text-xs justify-end" /></div>
              <div className="col-span-2 text-right"><SortableHeader label="Current" sortKey="_currentPrice" sortIndicator={getSortIndicator("_currentPrice")} onSort={requestSort} className="text-xs justify-end" /></div>
              <div className="col-span-2 text-right"><SortableHeader label="Change" sortKey="_changePercent" sortIndicator={getSortIndicator("_changePercent")} onSort={requestSort} className="text-xs justify-end" /></div>
              <div className="col-span-1 text-right text-muted-foreground">Buy Target</div>
              <div className="col-span-1 text-right text-muted-foreground">Sell Target</div>
              <div className="col-span-3 text-right text-muted-foreground">Actions</div>
            </div>

            {sortedItems.map((item) => {
              const currentPrice = item.currentPrice ?? item.addedPrice;
              const changeSinceAdded = currentPrice - item.addedPrice;
              const changePercent =
                item.addedPrice > 0
                  ? (changeSinceAdded / item.addedPrice) * 100
                  : 0;

              const isEditing = editingId === item.id;

              return (
                <Card key={item.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="py-3 px-4">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-12 md:col-span-2">
                        <p className="font-semibold">{item.symbol}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.name}
                        </p>
                        {item.signal && (
                          <Badge variant="outline" className="text-xs mt-1">
                            {item.signal}
                          </Badge>
                        )}
                      </div>

                      <div className="col-span-3 md:col-span-1 text-right font-mono text-sm">
                        {formatCurrency(item.addedPrice)}
                      </div>

                      <div className="col-span-3 md:col-span-2 text-right font-mono font-medium">
                        {formatCurrency(currentPrice)}
                      </div>

                      <div className="col-span-3 md:col-span-2 text-right">
                        <span
                          className={`font-mono font-medium ${changeSinceAdded >= 0 ? "text-green-500" : "text-red-500"}`}
                        >
                          {changeSinceAdded >= 0 ? "+" : ""}
                          {formatCurrency(changeSinceAdded)}
                        </span>
                        <br />
                        <span
                          className={`text-xs font-mono ${changeSinceAdded >= 0 ? "text-green-500" : "text-red-500"}`}
                        >
                          {formatPercent(changePercent)}
                        </span>
                      </div>

                      {/* Targets */}
                      {isEditing ? (
                        <>
                          <div className="col-span-3 md:col-span-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={editBuy}
                              onChange={(e) => setEditBuy(e.target.value)}
                              placeholder="Buy"
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="col-span-3 md:col-span-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={editSell}
                              onChange={(e) => setEditSell(e.target.value)}
                              placeholder="Sell"
                              className="h-8 text-xs"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="col-span-3 md:col-span-1 text-right font-mono text-sm text-muted-foreground">
                            {item.targetBuy
                              ? formatCurrency(item.targetBuy)
                              : "—"}
                          </div>
                          <div className="col-span-3 md:col-span-1 text-right font-mono text-sm text-muted-foreground">
                            {item.targetSell
                              ? formatCurrency(item.targetSell)
                              : "—"}
                          </div>
                        </>
                      )}

                      {/* Actions */}
                      <div className="col-span-12 md:col-span-3 text-right space-x-1">
                        {isEditing ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => saveTargets(item.id)}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Save
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setBuyingStock(item)
                                  }
                                >
                                  <ShoppingCart className="w-4 h-4 mr-1" />
                                  Buy
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Paper buy this stock</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => startEditing(item)}
                                >
                                  <Edit3 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit targets</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={() => removeFromWatchlist(item.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Remove from watchlist</TooltipContent>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Paper Buy Dialog */}
      {buyingStock && (
        <PaperBuyDialog
          open={!!buyingStock}
          onOpenChange={(open) => !open && setBuyingStock(null)}
          stock={{
            symbol: buyingStock.symbol,
            name: buyingStock.name,
            exchange: buyingStock.exchange,
            sector: buyingStock.sector,
            lastPrice: buyingStock.currentPrice ?? buyingStock.addedPrice,
            signal: buyingStock.signal || undefined,
            overallScore: buyingStock.overallScore || undefined,
          }}
        />
      )}
    </div>
  );
}
