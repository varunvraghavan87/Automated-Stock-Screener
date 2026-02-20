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

// ─── Session Storage Persistence ─────────────────────────────────────────────
const STORAGE_KEY = "nva_screener_state";
const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

interface PersistedScreenerState {
  version: 1;
  savedAt: number; // Date.now()
  results: ScreenerResult[];
  marketRegime: MarketRegimeInfo;
  adaptiveThresholds: AdaptiveThresholds;
  sectorRankings: SectorRankings;
  kiteStatus: KiteStatus;
  lastRefresh: string; // ISO string (Date is not JSON-serializable)
}

function saveToSessionStorage(state: {
  results: ScreenerResult[];
  marketRegime: MarketRegimeInfo;
  adaptiveThresholds: AdaptiveThresholds;
  sectorRankings: SectorRankings;
  kiteStatus: KiteStatus;
  lastRefresh: Date;
}): void {
  try {
    const payload: PersistedScreenerState = {
      version: 1,
      savedAt: Date.now(),
      results: state.results,
      marketRegime: state.marketRegime,
      adaptiveThresholds: state.adaptiveThresholds,
      sectorRankings: state.sectorRankings,
      kiteStatus: state.kiteStatus,
      lastRefresh: state.lastRefresh.toISOString(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Silently fail — QuotaExceededError or SecurityError in private browsing
  }
}

function loadFromSessionStorage(): PersistedScreenerState | null {
  try {
    if (typeof window === "undefined") return null; // SSR guard
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersistedScreenerState;

    // Version check
    if (parsed.version !== 1) return null;

    // Staleness check
    const age = Date.now() - parsed.savedAt;
    if (age > STALE_THRESHOLD_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    // Basic structural validation
    if (!Array.isArray(parsed.results) || parsed.results.length === 0) return null;
    if (!parsed.marketRegime?.regime) return null;

    return parsed;
  } catch {
    // JSON parse error or any other failure — clean up corrupted data
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

function clearSessionStorage(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not critical
  }
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
  // Attempt to restore persisted live state (called once during initialization)
  const cachedState = useRef(loadFromSessionStorage());

  // Initialize with cached live data if available, otherwise demo data
  const defaultThresholds = getAdaptiveThresholds(DEFAULT_DEMO_REGIME.regime);
  const defaultSectorRankings = computeSectorRankings(MOCK_STOCKS);
  const [results, setResults] = useState<ScreenerResult[]>(() =>
    cachedState.current?.results ??
    runScreener(MOCK_STOCKS, undefined, defaultThresholds, defaultSectorRankings)
  );
  const [mode, setMode] = useState<"live" | "demo">(
    cachedState.current ? "live" : "demo"
  );
  const [sectorRankings, setSectorRankings] = useState<SectorRankings>(
    cachedState.current?.sectorRankings ?? defaultSectorRankings
  );
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(
    cachedState.current ? new Date(cachedState.current.lastRefresh) : new Date()
  );
  const [kiteStatus, setKiteStatus] = useState<KiteStatus>(
    cachedState.current?.kiteStatus ?? { connected: false, configured: false }
  );
  const [marketRegime, setMarketRegime] = useState<MarketRegimeInfo>(
    cachedState.current?.marketRegime ?? DEFAULT_DEMO_REGIME
  );
  const [adaptiveThresholds, setAdaptiveThresholds] = useState<AdaptiveThresholds>(
    cachedState.current?.adaptiveThresholds ?? defaultThresholds
  );

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
          // Persist live state to sessionStorage for page-reload resilience
          saveToSessionStorage({
            results: data.results as ScreenerResult[],
            marketRegime: (data.marketRegime as MarketRegimeInfo) ?? marketRegime,
            adaptiveThresholds: (data.adaptiveThresholds as AdaptiveThresholds) ?? adaptiveThresholds,
            sectorRankings: (data.sectorRankings as SectorRankings) ?? sectorRankings,
            kiteStatus,
            lastRefresh: new Date(data.timestamp),
          });
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

  // On mount: check Kite status, auto-refresh if connected, handle stale cache
  useEffect(() => {
    const init = async () => {
      const status = await checkKiteStatus();
      if (status?.connected && !hasAutoRefreshed.current) {
        hasAutoRefreshed.current = true;
        await refresh();
      } else if (!status?.connected && cachedState.current) {
        // Kite disconnected but we loaded cached data — clear cache and revert to demo
        clearSessionStorage();
        setMode("demo");
        const thresholds = getAdaptiveThresholds(DEFAULT_DEMO_REGIME.regime);
        const demoSectorRankings = computeSectorRankings(MOCK_STOCKS);
        const freshResults = runScreener(MOCK_STOCKS, undefined, thresholds, demoSectorRankings);
        setResults(freshResults);
        setLastRefresh(new Date());
        setMarketRegime(DEFAULT_DEMO_REGIME);
        setAdaptiveThresholds(thresholds);
        setSectorRankings(demoSectorRankings);
      }
      // Allow GC of cached data after initialization
      cachedState.current = null;
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
      clearSessionStorage();
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
