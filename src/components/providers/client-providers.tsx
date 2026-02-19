"use client";

import { ScreenerProvider } from "@/contexts/ScreenerContext";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return <ScreenerProvider>{children}</ScreenerProvider>;
}
