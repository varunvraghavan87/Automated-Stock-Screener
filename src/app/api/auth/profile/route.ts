// GET /api/auth/profile — Returns the authenticated user's role and approval status.
// Used by AuthContext to avoid browser-side RLS issues with direct Supabase queries.

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ role: null, approvalStatus: null });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ role: null, approvalStatus: null });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, approval_status")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    role: profile?.role ?? null,
    approvalStatus: profile?.approval_status ?? null,
  });
}
