"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  sortIndicator: "asc" | "desc" | null;
  onSort: (key: string) => void;
  className?: string;
}

export function SortableHeader({
  label,
  sortKey,
  sortIndicator,
  onSort,
  className,
}: SortableHeaderProps) {
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={cn(
        "inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group cursor-pointer select-none",
        className
      )}
    >
      {label}
      <span className="inline-flex w-3.5">
        {sortIndicator === "asc" ? (
          <ChevronUp className="w-3.5 h-3.5 text-primary" />
        ) : sortIndicator === "desc" ? (
          <ChevronDown className="w-3.5 h-3.5 text-primary" />
        ) : (
          <ChevronsUpDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
        )}
      </span>
    </button>
  );
}
