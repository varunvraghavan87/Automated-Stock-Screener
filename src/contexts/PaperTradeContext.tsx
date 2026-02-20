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
import type { PaperTrade, PaperTradeInput, PaperTradeCloseInput } from "@/lib/types";

interface PaperTradeContextValue {
  trades: PaperTrade[];
  openTrades: PaperTrade[];
  closedTrades: PaperTrade[];
  loading: boolean;
  error: string | null;
  // Portfolio metrics
  totalInvested: number;
  totalCurrentValue: number;
  totalUnrealizedPnl: number;
  totalUnrealizedPnlPercent: number;
  totalRealizedPnl: number;
  // CRUD
  addTrade: (input: PaperTradeInput) => Promise<PaperTrade | null>;
  closeTrade: (id: string, input: PaperTradeCloseInput) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
  updateTrade: (id: string, updates: Partial<PaperTradeInput>) => Promise<void>;
  refreshTrades: () => Promise<void>;
}

const PaperTradeContext = createContext<PaperTradeContextValue | null>(null);

export function usePaperTrade(): PaperTradeContextValue {
  const context = useContext(PaperTradeContext);
  if (!context) {
    throw new Error("usePaperTrade must be used within PaperTradeProvider");
  }
  return context;
}

export function PaperTradeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { prices } = usePriceUpdate();
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch trades from API
  const refreshTrades = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch("/api/paper-trades");
      if (!response.ok) throw new Error("Failed to fetch trades");
      const data = await response.json();
      setTrades(data.trades || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch trades");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    if (user) {
      refreshTrades();
    } else {
      setTrades([]);
      setLoading(false);
    }
  }, [user, refreshTrades]);

  // Update local trade prices when price update context changes
  useEffect(() => {
    if (prices.size === 0) return;
    setTrades((prev) =>
      prev.map((trade) => {
        if (trade.status !== "open") return trade;
        const priceData = prices.get(trade.symbol);
        if (!priceData) return trade;
        return {
          ...trade,
          currentPrice: priceData.price,
          lastPriceUpdate: priceData.updatedAt,
        };
      })
    );
  }, [prices]);

  // CRUD operations
  const addTrade = useCallback(async (input: PaperTradeInput): Promise<PaperTrade | null> => {
    try {
      const response = await fetch("/api/paper-trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create trade");
      }
      const data = await response.json();
      setTrades((prev) => [data.trade, ...prev]);
      return data.trade;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create trade");
      return null;
    }
  }, []);

  const closeTrade = useCallback(async (id: string, input: PaperTradeCloseInput) => {
    try {
      const response = await fetch(`/api/paper-trades/${id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to close trade");
      }
      const data = await response.json();
      setTrades((prev) =>
        prev.map((t) => (t.id === id ? data.trade : t))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close trade");
    }
  }, []);

  const deleteTrade = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/paper-trades/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete trade");
      setTrades((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete trade");
    }
  }, []);

  const updateTrade = useCallback(async (id: string, updates: Partial<PaperTradeInput>) => {
    try {
      const response = await fetch(`/api/paper-trades/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Failed to update trade");
      const data = await response.json();
      setTrades((prev) =>
        prev.map((t) => (t.id === id ? data.trade : t))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update trade");
    }
  }, []);

  // Computed values
  const openTrades = useMemo(() => trades.filter((t) => t.status === "open"), [trades]);
  const closedTrades = useMemo(() => trades.filter((t) => t.status === "closed"), [trades]);

  const totalInvested = useMemo(
    () => openTrades.reduce((sum, t) => sum + t.quantity * t.entryPrice, 0),
    [openTrades]
  );

  const totalCurrentValue = useMemo(
    () =>
      openTrades.reduce(
        (sum, t) => sum + t.quantity * (t.currentPrice ?? t.entryPrice),
        0
      ),
    [openTrades]
  );

  const totalUnrealizedPnl = totalCurrentValue - totalInvested;
  const totalUnrealizedPnlPercent =
    totalInvested > 0 ? (totalUnrealizedPnl / totalInvested) * 100 : 0;

  const totalRealizedPnl = useMemo(
    () => closedTrades.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0),
    [closedTrades]
  );

  return (
    <PaperTradeContext.Provider
      value={{
        trades,
        openTrades,
        closedTrades,
        loading,
        error,
        totalInvested,
        totalCurrentValue,
        totalUnrealizedPnl,
        totalUnrealizedPnlPercent,
        totalRealizedPnl,
        addTrade,
        closeTrade,
        deleteTrade,
        updateTrade,
        refreshTrades,
      }}
    >
      {children}
    </PaperTradeContext.Provider>
  );
}
