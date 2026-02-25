import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client with the service_role/secret key for admin operations.
 * This client bypasses Row Level Security and can perform privileged operations
 * like resetting user passwords via supabase.auth.admin.*.
 *
 * MUST only be used in server-side API routes — never expose to the browser.
 * Returns null if the service role key is not configured.
 */
export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
