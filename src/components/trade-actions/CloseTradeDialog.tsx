"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, XCircle } from "lucide-react";
import { usePaperTrade } from "@/contexts/PaperTradeContext";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { PaperTrade } from "@/lib/types";

interface CloseTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: PaperTrade;
}

export function CloseTradeDialog({
  open,
  onOpenChange,
  trade,
}: CloseTradeDialogProps) {
  const { closeTrade } = usePaperTrade();
  const [exitPrice, setExitPrice] = useState(
    (trade.currentPrice ?? trade.entryPrice).toString()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const price = parseFloat(exitPrice) || 0;
  const pnl = (price - trade.entryPrice) * trade.quantity;
  const pnlPercent =
    trade.entryPrice > 0
      ? ((price - trade.entryPrice) / trade.entryPrice) * 100
      : 0;

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (price <= 0) {
      setError("Exit price must be positive");
      return;
    }

    setLoading(true);
    try {
      await closeTrade(trade.id, {
        exitPrice: price,
        exitReason: "manual",
      });
      onOpenChange(false);
    } catch {
      setError("Failed to close trade");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-destructive" />
            Close Trade — {trade.symbol}
          </DialogTitle>
          <DialogDescription>
            {trade.name} • {trade.quantity} shares @ {formatCurrency(trade.entryPrice)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleClose} className="space-y-4">
          {error && (
            <div className="p-2 rounded bg-destructive/10 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="exitPrice">Exit Price (₹)</Label>
            <Input
              id="exitPrice"
              type="number"
              step="0.01"
              min="0.01"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              required
            />
          </div>

          {price > 0 && (
            <div className="p-3 rounded-md bg-secondary/50 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Realized P&L</span>
                <span
                  className={`font-mono font-medium ${pnl >= 0 ? "text-green-500" : "text-red-500"}`}
                >
                  {pnl >= 0 ? "+" : ""}
                  {formatCurrency(pnl)} ({formatPercent(pnlPercent)})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entry Value</span>
                <span className="font-mono">
                  {formatCurrency(trade.quantity * trade.entryPrice)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Exit Value</span>
                <span className="font-mono">
                  {formatCurrency(trade.quantity * price)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Closing...
                </>
              ) : (
                "Close Trade"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
