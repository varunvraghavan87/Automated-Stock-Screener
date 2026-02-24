// GET /api/kite/status — Check if user has an active Kite session
// Also reports whether the user has API credentials configured in the database.
// Requires authentication to prevent information leakage.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/kite-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkUserHasCredentials } from "@/lib/kite-credentials";

export async function GET() {
  // Require authentication — prevents unauthenticated callers from
  // discovering whether a user has Kite credentials configured.
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const session = await getSession();

  // Check if user has API credentials stored in the database
  const { hasCredentials } = await checkUserHasCredentials();

  if (!session) {
    return NextResponse.json({
      connected: false,
      configured: hasCredentials,
    });
  }

  return NextResponse.json({
    connected: true,
    configured: true,
  });
}
