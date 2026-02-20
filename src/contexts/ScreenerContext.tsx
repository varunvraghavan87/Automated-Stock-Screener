"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { MOCK_STOCKS } from "@/lib/mock-data";
import {
  runScreener,
  detectMarketRegime,
  getAdaptiveThresholds,
  computeSectorRankings,
} from "@/lib/screener-engine";
import type {
  ScreenerResult,
  ScreenerConfig,
  MarketRegimeInfo,
  AdaptiveThresholds,
  SectorRankings,
} from "@/lib/types";
import { EMPTY_SECTOR_RANKINGS } from "@/lib/types";

interface KiteStatus {
  connected: boolean;
  configured: boolean;
  userId?: string;
  loginTime?: string;
}

interface ScreenerContextValue {
  results: ScreenerResult[];
  mode: "live" | "demo";
  loading: boolean;
  lastRefresh: Date;
  kiteStatus: KiteStatus;
  marketRegime: MarketRegimeInfo;
  adaptiveThresholds: AdaptiveThresholds;
  sectorRankings: SectorRankings;
  refresh: (config?: Partial<ScreenerConfig>) => Promise<void>;
  checkKiteStatus: () => Promise<void>;
  connectKite: () => void;
  disconnectKite: () => Promise<void>;
}

const ScreenerContext = createContext<ScreenerContextValue | null>(null);

export function useScreenerContext(): ScreenerContextValue {
  const context = useContext(ScreenerContext);
  if (!context) {
    throw new Error(
      "useScreenerContext must be used within a ScreenerProvider"
    );
  }
  return context;
}

// Default demo regime — assumes Nifty in bull market for mock data
const DEFAULT_DEMO_REGIME: MarketRegimeInfo = detectMarketRegime(
  22500, 22400, 22200, 28, null
);

export function ScreenerProvider({ children }: { children: ReactNode }) {
  // Initialize with client-side screener results (demo data)
  const defaultThresholds = getAdaptiveThresholds(DEFAULT_DEMO_REGIME.regime);
  const defaultSectorRankings = computeSectorRankings(MOCK_STOCKS);
  const [results, setResults] = useState<ScreenerResult[]>(() =>
    runScreener(MOCK_STOCKS, undefined, defaultThresholds, defaultSectorRankings)
  );
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [sectorRankings, setSectorRankings] = useState<SectorRankings>(defaultSectorRankings);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [kiteStatus, setKiteStatus] = useState<KiteStatus>({
    connected: false,
    configured: false,
  });
  const [marketRegime, setMarketRegime] = useState<MarketRegimeInfo>(DEFAULT_DEMO_REGIME);
  const [adaptiveThresholds, setAdaptiveThresholds] = useState<AdaptiveThresholds>(defaultThresholds);

  // Track whether we've already done the initial auto-refresh
  const hasAutoRefreshed = useRef(false);

  // Check Kite connection status
  const checkKiteStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/kite/status");
      if (response.ok) {
        const status = await response.json();
        setKiteStatus(status);
        return status;
      }
    } catch {
      // Silently fail — status check is non-critical
    }
    return null;
  }, []);

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

        // Update market regime & adaptive thresholds from API
        if (data.marketRegime) {
          setMarketRegime(data.marketRegime as MarketRegimeInfo);
        }
        if (data.adaptiveThresholds) {
          setAdaptiveThresholds(data.adaptiveThresholds as AdaptiveThresholds);
        }

        if (data.mode === "live" && data.results?.length > 0) {
          // Use full ScreenerResult[] from API (screener ran server-side with live Kite data)
          setResults(data.results as ScreenerResult[]);
          if (data.sectorRankings) {
            setSectorRankings(data.sectorRankings as SectorRankings);
          }
        } else {
          // Demo mode: run screener client-side with mock data + adaptive thresholds
          const regime = data.marketRegime || DEFAULT_DEMO_REGIME;
          const thresholds = getAdaptiveThresholds(regime.regime, config as ScreenerConfig);
          const demoSectorRankings = computeSectorRankings(MOCK_STOCKS);
          const freshResults = runScreener(MOCK_STOCKS, config as ScreenerConfig, thresholds, demoSectorRankings);
          setResults(freshResults);
          setMarketRegime(regime);
          setAdaptiveThresholds(thresholds);
          setSectorRankings(demoSectorRankings);
        }

        // Also refresh Kite status
        await checkKiteStatus();
      } catch (error) {
        console.error("Failed to refresh from API, using client-side data:", error);
        // Fallback: re-run screener client-side with default regime
        const thresholds = getAdaptiveThresholds(DEFAULT_DEMO_REGIME.regime, config as ScreenerConfig);
        const fallbackSectorRankings = computeSectorRankings(MOCK_STOCKS);
        const freshResults = runScreener(MOCK_STOCKS, config as ScreenerConfig, thresholds, fallbackSectorRankings);
        setResults(freshResults);
        setMode("demo");
        setLastRefresh(new Date());
        setMarketRegime(DEFAULT_DEMO_REGIME);
        setAdaptiveThresholds(thresholds);
        setSectorRankings(fallbackSectorRankings);
      } finally {
        setLoading(false);
      }
    },
    [checkKiteStatus]
  );

  // On mount: check Kite status, auto-refresh if connected
  useEffect(() => {
    const init = async () => {
      const status = await checkKiteStatus();
      if (status?.connected && !hasAutoRefreshed.current) {
        hasAutoRefreshed.current = true;
        await refresh();
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirect to Kite OAuth login
  const connectKite = useCallback(() => {
    window.location.href = "/api/kite/auth";
  }, []);

  // Disconnect from Kite — revert to demo data
  const disconnectKite = useCallback(async () => {
    try {
      await fetch("/api/kite/logout", { method: "POST" });
      setKiteStatus({ connected: false, configured: kiteStatus.configured });
      setMode("demo");
      // Revert to demo data since Kite is disconnected
      const thresholds = getAdaptiveThresholds(DEFAULT_DEMO_REGIME.regime);
      const demoSectorRankings = computeSectorRankings(MOCK_STOCKS);
      const demoResults = runScreener(MOCK_STOCKS, undefined, thresholds, demoSectorRankings);
      setResults(demoResults);
      setLastRefresh(new Date());
      setMarketRegime(DEFAULT_DEMO_REGIME);
      setAdaptiveThresholds(thresholds);
      setSectorRankings(demoSectorRankings);
    } catch {
      // Silently fail
    }
  }, [kiteStatus.configured]);

  return (
    <ScreenerContext.Provider
      value={{
        results,
        mode,
        loading,
        lastRefresh,
        kiteStatus,
        marketRegime,
        adaptiveThresholds,
        sectorRankings,
        refresh,
        checkKiteStatus,
        connectKite,
        disconnectKite,
      }}
    >
      {children}
    </ScreenerContext.Provider>
  );
}
