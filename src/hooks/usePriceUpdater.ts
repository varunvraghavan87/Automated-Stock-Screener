"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { isIndianMarketOpen } from "@/lib/market-hours";
import type { PriceUpdateResult } from "@/lib/types";

const UPDATE_INTERVAL = 180_000; // 3 minutes
const RETRY_DELAY = 30_000; // 30 seconds on 503

interface PriceUpdaterState {
  prices: Map<string, PriceUpdateResult>;
  lastUpdate: Date | null;
  updating: boolean;
  error: string | null;
  marketOpen: boolean;
}

export function usePriceUpdater(enabled: boolean) {
  const [state, setState] = useState<PriceUpdaterState>({
    prices: new Map(),
    lastUpdate: null,
    updating: false,
    error: null,
    marketOpen: isIndianMarketOpen(),
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPrices = useCallback(async () => {
    setState((prev) => ({ ...prev, updating: true, error: null }));

    try {
      const response = await fetch("/api/prices/update", { method: "POST" });

      if (response.status === 503) {
        // Lock held by screener — retry after delay
        const data = await response.json();
        setState((prev) => ({
          ...prev,
          updating: false,
          error: data.error || "Waiting for screener to finish...",
        }));

        // Schedule a retry
        retryTimeoutRef.current = setTimeout(fetchPrices, RETRY_DELAY);
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        setState((prev) => ({
          ...prev,
          updating: false,
          error: data.error || "Failed to update prices",
        }));
        return;
      }

      const data = await response.json();
      const newPrices = new Map<string, PriceUpdateResult>();
      for (const p of data.prices || []) {
        newPrices.set(p.symbol, p);
      }

      setState((prev) => ({
        ...prev,
        prices: newPrices,
        lastUpdate: data.updatedAt ? new Date(data.updatedAt) : new Date(),
        updating: false,
        error: null,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        updating: false,
        error: "Network error updating prices",
      }));
    }
  }, []);

  // Check market hours periodically
  useEffect(() => {
    const checkMarket = () => {
      setState((prev) => ({ ...prev, marketOpen: isIndianMarketOpen() }));
    };
    const marketCheck = setInterval(checkMarket, 60_000); // Check every minute
    return () => clearInterval(marketCheck);
  }, []);

  // Main polling interval
  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchPrices();

    // Set up interval
    intervalRef.current = setInterval(() => {
      // Only fetch during market hours and when tab is visible
      if (isIndianMarketOpen() && document.visibilityState === "visible") {
        fetchPrices();
      }
    }, UPDATE_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [enabled, fetchPrices]);

  // Pause/resume on visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        enabled &&
        isIndianMarketOpen()
      ) {
        // Fetch immediately when tab becomes visible
        fetchPrices();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, fetchPrices]);

  return {
    ...state,
    triggerUpdate: fetchPrices,
  };
}
