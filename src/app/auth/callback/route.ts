import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Sanitize the redirect path to prevent open redirect attacks.
 * Only allows relative paths starting with a single slash.
 * Blocks protocol-relative URLs (//evil.com), absolute URLs (https://...),
 * and backslash variants (/\evil.com).
 */
function sanitizeRedirectPath(path: string | null): string {
  if (!path) return "/";
  if (!path.startsWith("/")) return "/";
  if (path.startsWith("//")) return "/";
  if (path.startsWith("/\\")) return "/";
  if (path.includes("://")) return "/";
  return path;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.redirect(`${origin}/auth/login?error=Auth not configured`);
    }
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return to login with an error if code exchange failed
  return NextResponse.redirect(`${origin}/auth/login?error=Could not authenticate`);
}
