-- Paper trades table for virtual portfolio tracking
-- Run this in Supabase Dashboard → SQL Editor

-- ─── Table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS paper_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  exchange TEXT NOT NULL DEFAULT 'NSE',
  name TEXT NOT NULL,
  sector TEXT DEFAULT 'Unknown',
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  entry_price NUMERIC(12,2) NOT NULL CHECK (entry_price > 0),
  entry_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  stop_loss NUMERIC(12,2),
  target_price NUMERIC(12,2),
  signal TEXT,
  overall_score INTEGER,
  current_price NUMERIC(12,2),
  last_price_update TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  exit_price NUMERIC(12,2),
  exit_date TIMESTAMPTZ,
  exit_reason TEXT,
  realized_pnl NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_paper_trades_user_id
  ON paper_trades(user_id);

CREATE INDEX IF NOT EXISTS idx_paper_trades_user_status
  ON paper_trades(user_id, status);

CREATE INDEX IF NOT EXISTS idx_paper_trades_user_symbol_status
  ON paper_trades(user_id, symbol, status);

-- ─── Row Level Security ─────────────────────────────────────────────────

ALTER TABLE paper_trades ENABLE ROW LEVEL SECURITY;

-- Drop + create for idempotency (safe to re-run)
DROP POLICY IF EXISTS "Users can view own trades" ON paper_trades;
CREATE POLICY "Users can view own trades"
  ON paper_trades FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own trades" ON paper_trades;
CREATE POLICY "Users can insert own trades"
  ON paper_trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own trades" ON paper_trades;
CREATE POLICY "Users can update own trades"
  ON paper_trades FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own trades" ON paper_trades;
CREATE POLICY "Users can delete own trades"
  ON paper_trades FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Auto-update updated_at ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_paper_trades_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS paper_trades_updated_at ON paper_trades;
CREATE TRIGGER paper_trades_updated_at
  BEFORE UPDATE ON paper_trades
  FOR EACH ROW
  EXECUTE FUNCTION update_paper_trades_timestamp();
