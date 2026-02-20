// Helper functions for mapping between Supabase snake_case rows and camelCase TypeScript types

import type { PaperTrade, WatchlistItem } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function mapPaperTradeRow(row: any): PaperTrade {
  return {
    id: row.id,
    userId: row.user_id,
    symbol: row.symbol,
    exchange: row.exchange,
    name: row.name,
    sector: row.sector,
    quantity: Number(row.quantity),
    entryPrice: Number(row.entry_price),
    entryDate: row.entry_date,
    stopLoss: row.stop_loss ? Number(row.stop_loss) : null,
    targetPrice: row.target_price ? Number(row.target_price) : null,
    signal: row.signal,
    overallScore: row.overall_score,
    currentPrice: row.current_price ? Number(row.current_price) : null,
    lastPriceUpdate: row.last_price_update,
    status: row.status,
    exitPrice: row.exit_price ? Number(row.exit_price) : null,
    exitDate: row.exit_date,
    exitReason: row.exit_reason,
    realizedPnl: row.realized_pnl ? Number(row.realized_pnl) : null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapWatchlistRow(row: any): WatchlistItem {
  return {
    id: row.id,
    userId: row.user_id,
    symbol: row.symbol,
    exchange: row.exchange,
    name: row.name,
    sector: row.sector,
    addedPrice: Number(row.added_price),
    currentPrice: row.current_price ? Number(row.current_price) : null,
    lastPriceUpdate: row.last_price_update,
    targetBuy: row.target_buy ? Number(row.target_buy) : null,
    targetSell: row.target_sell ? Number(row.target_sell) : null,
    signal: row.signal,
    overallScore: row.overall_score,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
