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
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingCart } from "lucide-react";
import { usePaperTrade } from "@/contexts/PaperTradeContext";
import { formatCurrency } from "@/lib/utils";

interface PaperBuyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stock: {
    symbol: string;
    name: string;
    exchange: string;
    sector: string;
    lastPrice: number;
    signal?: string;
    overallScore?: number;
    stopLoss?: number;
    target?: number;
  };
}

export function PaperBuyDialog({
  open,
  onOpenChange,
  stock,
}: PaperBuyDialogProps) {
  const { addTrade } = usePaperTrade();
  const [quantity, setQuantity] = useState("1");
  const [entryPrice, setEntryPrice] = useState(stock.lastPrice.toString());
  const [stopLoss, setStopLoss] = useState(stock.stopLoss?.toFixed(2) || "");
  const [targetPrice, setTargetPrice] = useState(
    stock.target?.toFixed(2) || ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const qty = parseInt(quantity) || 0;
  const price = parseFloat(entryPrice) || 0;
  const totalValue = qty * price;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (qty <= 0) {
      setError("Quantity must be at least 1");
      return;
    }
    if (price <= 0) {
      setError("Entry price must be positive");
      return;
    }

    setLoading(true);
    try {
      const result = await addTrade({
        symbol: stock.symbol,
        exchange: stock.exchange,
        name: stock.name,
        sector: stock.sector,
        quantity: qty,
        entryPrice: price,
        stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
        targetPrice: targetPrice ? parseFloat(targetPrice) : undefined,
        signal: stock.signal,
        overallScore: stock.overallScore,
      });

      if (result) {
        onOpenChange(false);
        // Reset form
        setQuantity("1");
        setEntryPrice(stock.lastPrice.toString());
      }
    } catch {
      setError("Failed to create paper trade");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-accent" />
            Paper Buy — {stock.symbol}
          </DialogTitle>
          <DialogDescription>
            {stock.name} • {stock.sector}
            {stock.signal && (
              <Badge variant="outline" className="ml-2">
                {stock.signal}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2 rounded bg-destructive/10 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entryPrice">Entry Price (₹)</Label>
              <Input
                id="entryPrice"
                type="number"
                step="0.01"
                min="0.01"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stopLoss">Stop Loss (₹)</Label>
              <Input
                id="stopLoss"
                type="number"
                step="0.01"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetPrice">Target (₹)</Label>
              <Input
                id="targetPrice"
                type="number"
                step="0.01"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          {totalValue > 0 && (
            <div className="p-3 rounded-md bg-secondary/50 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Value</span>
                <span className="font-mono font-medium">
                  {formatCurrency(totalValue)}
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
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Buying...
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Paper Buy
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
