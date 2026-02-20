"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePriceUpdate } from "@/contexts/PriceUpdateContext";
import type { WatchlistItem, WatchlistInput } from "@/lib/types";

interface WatchlistContextValue {
  items: WatchlistItem[];
  loading: boolean;
  error: string | null;
  // CRUD
  addToWatchlist: (input: WatchlistInput) => Promise<WatchlistItem | null>;
  removeFromWatchlist: (id: string) => Promise<void>;
  updateTargets: (
    id: string,
    targets: { targetBuy?: number | null; targetSell?: number | null; notes?: string }
  ) => Promise<void>;
  refreshWatchlist: () => Promise<void>;
  // Helpers
  isInWatchlist: (symbol: string) => boolean;
  getWatchlistItem: (symbol: string) => WatchlistItem | undefined;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function useWatchlist(): WatchlistContextValue {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error("useWatchlist must be used within WatchlistProvider");
  }
  return context;
}

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { prices } = usePriceUpdate();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch watchlist from API
  const refreshWatchlist = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch("/api/watchlist");
      if (!response.ok) throw new Error("Failed to fetch watchlist");
      const data = await response.json();
      setItems(data.items || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch watchlist");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    if (user) {
      refreshWatchlist();
    } else {
      setItems([]);
      setLoading(false);
    }
  }, [user, refreshWatchlist]);

  // Update local prices when price update context changes
  useEffect(() => {
    if (prices.size === 0) return;
    setItems((prev) =>
      prev.map((item) => {
        const priceData = prices.get(item.symbol);
        if (!priceData) return item;
        return {
          ...item,
          currentPrice: priceData.price,
          lastPriceUpdate: priceData.updatedAt,
        };
      })
    );
  }, [prices]);

  // CRUD
  const addToWatchlist = useCallback(async (input: WatchlistInput): Promise<WatchlistItem | null> => {
    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (response.status === 409) {
        setError("Stock is already in your watchlist");
        return null;
      }
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add to watchlist");
      }
      const data = await response.json();
      setItems((prev) => [data.item, ...prev]);
      setError(null);
      return data.item;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add to watchlist");
      return null;
    }
  }, []);

  const removeFromWatchlist = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/watchlist/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to remove from watchlist");
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove from watchlist");
    }
  }, []);

  const updateTargets = useCallback(
    async (
      id: string,
      targets: { targetBuy?: number | null; targetSell?: number | null; notes?: string }
    ) => {
      try {
        const response = await fetch(`/api/watchlist/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(targets),
        });
        if (!response.ok) throw new Error("Failed to update targets");
        const data = await response.json();
        setItems((prev) =>
          prev.map((item) => (item.id === id ? data.item : item))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update targets");
      }
    },
    []
  );

  // Helper: quick check if a symbol is in the watchlist
  const symbolSet = useMemo(
    () => new Set(items.map((item) => item.symbol)),
    [items]
  );

  const isInWatchlist = useCallback(
    (symbol: string) => symbolSet.has(symbol),
    [symbolSet]
  );

  const getWatchlistItem = useCallback(
    (symbol: string) => items.find((item) => item.symbol === symbol),
    [items]
  );

  return (
    <WatchlistContext.Provider
      value={{
        items,
        loading,
        error,
        addToWatchlist,
        removeFromWatchlist,
        updateTargets,
        refreshWatchlist,
        isInWatchlist,
        getWatchlistItem,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
}
