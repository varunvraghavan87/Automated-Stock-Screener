// POST /api/kite/logout — Clear the Kite session (requires authentication)

import { NextResponse } from "next/server";
import { clearSession } from "@/lib/kite-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  // Require authenticated user to prevent unauthorized session clearing
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await clearSession();
  return NextResponse.json({ success: true });
}
