// GET /api/kite/status — Check if user has an active Kite session
// Requires authentication to prevent server configuration info leakage.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/kite-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  // Require authentication — prevents unauthenticated callers from
  // discovering whether Kite API is configured on this server.
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

  if (!session) {
    return NextResponse.json({
      connected: false,
      configured: !!process.env.KITE_API_KEY,
    });
  }

  return NextResponse.json({
    connected: true,
    configured: true,
  });
}
