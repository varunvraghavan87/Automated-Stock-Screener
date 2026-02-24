-- Per-user profile with admin approval workflow
-- Run this in Supabase Dashboard → SQL Editor

-- ─── Table ──────────────────────────────────────────────────────────────

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_profiles_approval_status ON user_profiles(approval_status);

-- ─── Row Level Security ─────────────────────────────────────────────────

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Helper: check if the current user is an admin.
-- Uses SECURITY DEFINER to bypass RLS and avoid infinite recursion
-- (a policy on user_profiles cannot safely query user_profiles itself).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all profiles (uses SECURITY DEFINER function to avoid recursion)
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (public.is_admin());

-- Users can insert their own row (safety backup for trigger)
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can update any profile (for approve/reject)
CREATE POLICY "Admins can update profiles"
  ON user_profiles FOR UPDATE
  USING (public.is_admin());

-- ─── Auto-insert trigger on auth.users ──────────────────────────────────
-- Catches both email/password and Google OAuth signups.
-- SECURITY DEFINER is required because auth.uid() is not set during
-- the auth.users INSERT transaction.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─── Auto-update updated_at ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_user_profiles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_timestamp();

-- ─── Backfill existing users + seed admin ───────────────────────────────
-- Run after the above DDL. Existing users are auto-approved since they
-- predate the approval system. Replace '<owner-email>' with your email.

-- Backfill all existing users as approved
INSERT INTO user_profiles (user_id, email, display_name, role, approval_status, approved_at)
SELECT id, email,
       COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)),
       'user', 'approved', now()
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_profiles)
ON CONFLICT (user_id) DO NOTHING;

-- Promote the app owner to admin (replace with your email)
-- UPDATE user_profiles SET role = 'admin' WHERE email = '<owner-email>';
