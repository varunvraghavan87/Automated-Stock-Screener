"use client";

import { useTheme } from "next-themes";

/**
 * Returns theme-aware hex color values for Recharts components.
 * Recharts requires raw hex strings (not CSS variables), so this hook
 * provides the correct palette based on the current light/dark theme.
 */
export function useChartColors() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return {
    // Structural chart colors (adapt to background)
    tooltipBg: isDark ? "#141826" : "#ffffff",
    tooltipBorder: isDark ? "#1e293b" : "#e2e8f0",
    gridStroke: isDark ? "#1e293b" : "#e2e8f0",
    axisStroke: isDark ? "#94a3b8" : "#64748b",

    // Semantic colors
    accent: isDark ? "#10b981" : "#059669",
    destructive: isDark ? "#ef4444" : "#dc2626",
    primary: isDark ? "#3b82f6" : "#2563eb",
    warning: isDark ? "#f59e0b" : "#d97706",
    purple: isDark ? "#8b5cf6" : "#7c3aed",
    pink: "#ec4899",
    cyan: isDark ? "#06b6d4" : "#0891b2",
    lime: "#84cc16",
    orange: "#f97316",
    indigo: "#6366f1",
    muted: isDark ? "#94a3b8" : "#64748b",
  };
}
