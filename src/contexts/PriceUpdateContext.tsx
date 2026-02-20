"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { usePriceUpdater } from "@/hooks/usePriceUpdater";
import { useAuth } from "@/contexts/AuthContext";
import type { PriceUpdateResult } from "@/lib/types";

interface PriceUpdateContextValue {
  prices: Map<string, PriceUpdateResult>;
  lastUpdate: Date | null;
  updating: boolean;
  error: string | null;
  marketOpen: boolean;
  triggerUpdate: () => Promise<void>;
}

const PriceUpdateContext = createContext<PriceUpdateContextValue | null>(null);

export function usePriceUpdate(): PriceUpdateContextValue {
  const context = useContext(PriceUpdateContext);
  if (!context) {
    throw new Error("usePriceUpdate must be used within PriceUpdateProvider");
  }
  return context;
}

export function PriceUpdateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Only enable the price updater when the user is authenticated
  const { prices, lastUpdate, updating, error, marketOpen, triggerUpdate } =
    usePriceUpdater(!!user);

  return (
    <PriceUpdateContext.Provider
      value={{ prices, lastUpdate, updating, error, marketOpen, triggerUpdate }}
    >
      {children}
    </PriceUpdateContext.Provider>
  );
}
