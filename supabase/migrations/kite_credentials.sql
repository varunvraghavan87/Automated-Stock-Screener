-- Per-user Kite Connect API credentials storage
-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE kite_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  kite_api_key TEXT NOT NULL,
  kite_api_secret_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE kite_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own row
CREATE POLICY "Users can view own credentials"
  ON kite_credentials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credentials"
  ON kite_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials"
  ON kite_credentials FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own credentials"
  ON kite_credentials FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_kite_credentials_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kite_credentials_updated_at
  BEFORE UPDATE ON kite_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_kite_credentials_timestamp();
