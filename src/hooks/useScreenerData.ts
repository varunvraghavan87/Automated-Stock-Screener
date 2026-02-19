"use client";

import { useState, useCallback, useEffect } from "react";
import { MOCK_STOCKS } from "@/lib/mock-data";
import { runScreener } from "@/lib/screener-engine";
import type { ScreenerResult, ScreenerConfig } from "@/lib/types";

interface KiteStatus {
  connected: boolean;
  configured: boolean;
  userId?: string;
  loginTime?: string;
}

interface UseScreenerDataReturn {
  results: ScreenerResult[];
  mode: "live" | "demo";
  loading: boolean;
  lastRefresh: Date;
  kiteStatus: KiteStatus;
  refresh: (config?: Partial<ScreenerConfig>) => Promise<void>;
  checkKiteStatus: () => Promise<void>;
  connectKite: () => void;
  disconnectKite: () => Promise<void>;
}

export function useScreenerData(): UseScreenerDataReturn {
  // Initialize with client-side screener results
  const [results, setResults] = useState<ScreenerResult[]>(() =>
    runScreener(MOCK_STOCKS)
  );
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [kiteStatus, setKiteStatus] = useState<KiteStatus>({
    connected: false,
    configured: false,
  });

  // Check Kite connection status on mount
  const checkKiteStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/kite/status");
      if (response.ok) {
        const status = await response.json();
        setKiteStatus(status);
      }
    } catch {
      // Silently fail — status check is non-critical
    }
  }, []);

  useEffect(() => {
    checkKiteStatus();
  }, [checkKiteStatus]);

  // Refresh data from API (uses live data if Kite is connected, demo data otherwise)
  const refresh = useCallback(
    async (config?: Partial<ScreenerConfig>) => {
      setLoading(true);
      try {
        const response = await fetch("/api/screener", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: config || {} }),
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();

        setMode(data.mode === "live" ? "live" : "demo");
        setLastRefresh(new Date(data.timestamp));

        if (data.mode === "live" && data.results?.length > 0) {
          // Use full ScreenerResult[] from API (screener ran server-side with live Kite data)
          setResults(data.results as ScreenerResult[]);
        } else {
          // Demo mode: run screener client-side with mock data
          const freshResults = runScreener(MOCK_STOCKS, config as ScreenerConfig);
          setResults(freshResults);
        }

        // Also refresh Kite status
        await checkKiteStatus();
      } catch (error) {
        console.error("Failed to refresh from API, using client-side data:", error);
        // Fallback: re-run screener client-side
        const freshResults = runScreener(MOCK_STOCKS, config as ScreenerConfig);
        setResults(freshResults);
        setMode("demo");
        setLastRefresh(new Date());
      } finally {
        setLoading(false);
      }
    },
    [checkKiteStatus]
  );

  // Redirect to Kite OAuth login
  const connectKite = useCallback(() => {
    window.location.href = "/api/kite/auth";
  }, []);

  // Disconnect from Kite
  const disconnectKite = useCallback(async () => {
    try {
      await fetch("/api/kite/logout", { method: "POST" });
      setKiteStatus({ connected: false, configured: kiteStatus.configured });
      setMode("demo");
    } catch {
      // Silently fail
    }
  }, [kiteStatus.configured]);

  return {
    results,
    mode,
    loading,
    lastRefresh,
    kiteStatus,
    refresh,
    checkKiteStatus,
    connectKite,
    disconnectKite,
  };
}
