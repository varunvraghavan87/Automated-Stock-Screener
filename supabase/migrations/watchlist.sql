-- Watchlist table for tracking stocks of interest
-- Run this in Supabase Dashboard → SQL Editor

-- ─── Table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  exchange TEXT NOT NULL DEFAULT 'NSE',
  name TEXT NOT NULL,
  sector TEXT DEFAULT 'Unknown',
  added_price NUMERIC(12,2) NOT NULL CHECK (added_price > 0),
  current_price NUMERIC(12,2),
  last_price_update TIMESTAMPTZ,
  target_buy NUMERIC(12,2),
  target_sell NUMERIC(12,2),
  signal TEXT,
  overall_score INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, symbol)
);

-- ─── Indexes ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_watchlist_user_id
  ON watchlist(user_id);

-- ─── Row Level Security ─────────────────────────────────────────────────

ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- Drop + create for idempotency (safe to re-run)
DROP POLICY IF EXISTS "Users can view own watchlist" ON watchlist;
CREATE POLICY "Users can view own watchlist"
  ON watchlist FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own watchlist" ON watchlist;
CREATE POLICY "Users can insert own watchlist"
  ON watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own watchlist" ON watchlist;
CREATE POLICY "Users can update own watchlist"
  ON watchlist FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own watchlist" ON watchlist;
CREATE POLICY "Users can delete own watchlist"
  ON watchlist FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Auto-update updated_at ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_watchlist_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS watchlist_updated_at ON watchlist;
CREATE TRIGGER watchlist_updated_at
  BEFORE UPDATE ON watchlist
  FOR EACH ROW
  EXECUTE FUNCTION update_watchlist_timestamp();
