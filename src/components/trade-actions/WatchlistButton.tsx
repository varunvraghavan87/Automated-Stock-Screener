"use client";

import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWatchlist } from "@/contexts/WatchlistContext";

interface WatchlistButtonProps {
  stock: {
    symbol: string;
    name: string;
    exchange: string;
    sector: string;
    lastPrice: number;
    signal?: string;
    overallScore?: number;
  };
  size?: "sm" | "default" | "icon";
}

export function WatchlistButton({ stock, size = "icon" }: WatchlistButtonProps) {
  const { isInWatchlist, addToWatchlist, removeFromWatchlist, getWatchlistItem } =
    useWatchlist();
  const [loading, setLoading] = useState(false);

  const inWatchlist = isInWatchlist(stock.symbol);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (inWatchlist) {
        const item = getWatchlistItem(stock.symbol);
        if (item) {
          await removeFromWatchlist(item.id);
        }
      } else {
        await addToWatchlist({
          symbol: stock.symbol,
          exchange: stock.exchange,
          name: stock.name,
          sector: stock.sector,
          addedPrice: stock.lastPrice,
          signal: stock.signal,
          overallScore: stock.overallScore,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Button variant="ghost" size={size} disabled>
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size={size}
          onClick={handleToggle}
          className={inWatchlist ? "text-yellow-500 hover:text-yellow-600" : "text-muted-foreground hover:text-yellow-500"}
        >
          <Star
            className="w-4 h-4"
            fill={inWatchlist ? "currentColor" : "none"}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
      </TooltipContent>
    </Tooltip>
  );
}
