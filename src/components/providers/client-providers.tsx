"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { ScreenerProvider } from "@/contexts/ScreenerContext";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ScreenerProvider>{children}</ScreenerProvider>
    </AuthProvider>
  );
}
