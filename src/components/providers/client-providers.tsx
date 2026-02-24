"use client";

import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ScreenerProvider } from "@/contexts/ScreenerContext";
import { PriceUpdateProvider } from "@/contexts/PriceUpdateContext";
import { PaperTradeProvider } from "@/contexts/PaperTradeContext";
import { WatchlistProvider } from "@/contexts/WatchlistContext";
import { TooltipProvider } from "@/components/ui/tooltip";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <ScreenerProvider>
          <PriceUpdateProvider>
            <PaperTradeProvider>
              <WatchlistProvider>
                <TooltipProvider delayDuration={300}>
                  {children}
                </TooltipProvider>
              </WatchlistProvider>
            </PaperTradeProvider>
          </PriceUpdateProvider>
        </ScreenerProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
