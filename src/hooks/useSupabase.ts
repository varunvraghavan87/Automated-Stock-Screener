"use client";

import { useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Singleton client cached at module level (only created once in the browser)
let cachedClient: SupabaseClient | null = null;

function getOrCreateClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  cachedClient = createBrowserClient(url, key);
  return cachedClient;
}

/**
 * Hook that returns a Supabase browser client for use in auth pages.
 * Returns null when env vars are not set (e.g., during build/SSR pre-rendering).
 * The client is a module-level singleton — safe and efficient across re-renders.
 */
export function useSupabase(): SupabaseClient | null {
  return useMemo(() => getOrCreateClient(), []);
}
