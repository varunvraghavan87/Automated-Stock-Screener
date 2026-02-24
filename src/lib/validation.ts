// Centralized Zod validation schemas for all API inputs
// Prevents prototype pollution, enforces bounds, and validates types

import { z } from "zod";

// ─── Shared Helpers ─────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

const symbolField = z.string().min(1).max(20);
const nameField = z.string().min(1).max(255);
const exchangeField = z.string().max(10).optional().default("NSE");
const sectorField = z.string().max(100).optional().default("Unknown");
const notesField = z.string().max(2000).nullable().optional();
const signalField = z.string().max(20).nullable().optional();
const scoreField = z.number().int().min(0).max(100).nullable().optional();
const priceField = z.number().positive().max(9_999_999);
const optionalPriceField = z.number().positive().max(9_999_999).nullable().optional();

// ─── Paper Trade Schemas ────────────────────────────────────────────────

export const PaperTradeInputSchema = z.object({
  symbol: symbolField,
  exchange: exchangeField,
  name: nameField,
  sector: sectorField,
  quantity: z.number().int().positive().max(1_000_000),
  entryPrice: priceField,
  stopLoss: optionalPriceField,
  targetPrice: optionalPriceField,
  signal: signalField,
  overallScore: scoreField,
  notes: notesField,
}).strict(); // Reject unknown keys to prevent prototype pollution

export const PaperTradeUpdateSchema = z.object({
  notes: notesField,
  stopLoss: optionalPriceField,
  targetPrice: optionalPriceField,
}).strict();

export const PaperTradeCloseSchema = z.object({
  exitPrice: priceField,
  exitReason: z.enum(["manual", "stop_loss_hit", "target_hit"]).optional().default("manual"),
}).strict();

// ─── Watchlist Schemas ──────────────────────────────────────────────────

export const WatchlistInputSchema = z.object({
  symbol: symbolField,
  exchange: exchangeField,
  name: nameField,
  sector: sectorField,
  addedPrice: priceField,
  targetBuy: optionalPriceField,
  targetSell: optionalPriceField,
  signal: signalField,
  overallScore: scoreField,
  notes: notesField,
}).strict();

export const WatchlistUpdateSchema = z.object({
  targetBuy: z.number().positive().max(9_999_999).nullable().optional(),
  targetSell: z.number().positive().max(9_999_999).nullable().optional(),
  notes: notesField,
}).strict();

// ─── Screener Config Schema ────────────────────────────────────────────

export const ScreenerConfigSchema = z.object({
  minAvgDailyTurnover: z.number().positive().max(10000).optional(),
  excludeASMGSM: z.boolean().optional(),
  minADX: z.number().min(0).max(100).optional(),
  rsiLow: z.number().min(0).max(100).optional(),
  rsiHigh: z.number().min(0).max(100).optional(),
  maxEMAProximity: z.number().min(0).max(100).optional(),
  volumeMultiplier: z.number().min(0).max(100).optional(),
  mfiLow: z.number().min(0).max(100).optional(),
  mfiHigh: z.number().min(0).max(100).optional(),
  maxATRPercent: z.number().min(0).max(100).optional(),
  atrMultiple: z.number().min(0).max(100).optional(),
  minRiskReward: z.number().min(0).max(100).optional(),
  maxCapitalRisk: z.number().min(0).max(100).optional(),
}).strict();

// ─── Record Count Limits ────────────────────────────────────────────────

export const MAX_OPEN_TRADES = 100;
export const MAX_WATCHLIST_ITEMS = 200;
export const MAX_PRICE_UPDATE_SYMBOLS = 500;

// ─── Snapshot Limits ────────────────────────────────────────────────────

export const MAX_SNAPSHOTS_PER_USER = 270;    // ~90 days * 3 runs/day
export const MAX_SIGNALS_PER_SNAPSHOT = 50;
export const SNAPSHOT_RETENTION_DAYS = 90;

// ─── Kite Credentials Schema ──────────────────────────────────────────

export const KiteCredentialsSchema = z
  .object({
    apiKey: z
      .string()
      .min(4, "API Key must be at least 4 characters")
      .max(40, "API Key must be at most 40 characters")
      .regex(/^[a-zA-Z0-9]+$/, "API Key must be alphanumeric"),
    apiSecret: z
      .string()
      .min(4, "API Secret must be at least 4 characters")
      .max(60, "API Secret must be at most 60 characters")
      .regex(/^[a-zA-Z0-9]+$/, "API Secret must be alphanumeric"),
  })
  .strict();

// ─── Admin Schemas ──────────────────────────────────────────────────────

export const AdminRejectSchema = z
  .object({
    reason: z.string().max(500).optional().default(""),
  })
  .strict();
