"use client";

import { useMemo, useState, useCallback } from "react";

export type SortDirection = "asc" | "desc";

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

/**
 * Reusable hook for sortable data tables.
 *
 * @param data - The array of items to sort.
 * @param defaultSort - Optional default sort configuration.
 * @returns sortedData, sortConfig state, requestSort toggle, and getSortIndicator helper.
 *
 * Supports nested keys via dot notation (e.g., "stock.symbol", "indicators.rsi14").
 * Click cycle: none → asc → desc → none.
 */
export function useSortable<T>(data: T[], defaultSort?: SortConfig) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(
    defaultSort ?? null
  );

  const requestSort = useCallback((key: string) => {
    setSortConfig((prev) => {
      if (prev === null || prev.key !== key) {
        return { key, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { key, direction: "desc" };
      }
      return null;
    });
  }, []);

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const aVal = getNestedValue(a, sortConfig.key);
      const bVal = getNestedValue(b, sortConfig.key);

      // Push nulls/undefined to end regardless of direction
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let comparison = 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      } else if (typeof aVal === "string" && typeof bVal === "string") {
        comparison = aVal.localeCompare(bVal);
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  const getSortIndicator = useCallback(
    (key: string): "asc" | "desc" | null => {
      if (!sortConfig || sortConfig.key !== key) return null;
      return sortConfig.direction;
    },
    [sortConfig]
  );

  return { sortedData, sortConfig, requestSort, getSortIndicator };
}
