import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase browser client. Returns null if env vars are not set
 * (e.g., during build/static generation).
 */
export function createSupabaseBrowserClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

