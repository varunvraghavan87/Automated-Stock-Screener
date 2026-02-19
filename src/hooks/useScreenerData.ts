"use client";

import { useScreenerContext } from "@/contexts/ScreenerContext";
import type { ScreenerResult, ScreenerConfig } from "@/lib/types";

interface KiteStatus {
  connected: boolean;
  configured: boolean;
  userId?: string;
  loginTime?: string;
}

export interface UseScreenerDataReturn {
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
  return useScreenerContext();
}
