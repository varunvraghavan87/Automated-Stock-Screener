// GET /api/auth/profile — Returns the authenticated user's info, role, and approval status.
// Used by AuthContext to get auth state entirely server-side (bypasses ISP DNS blocking).

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({
      authenticated: false,
      user: null,
      role: null,
      approvalStatus: null,
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({
      authenticated: false,
      user: null,
      role: null,
      approvalStatus: null,
    });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, approval_status, rejection_reason")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
    },
    role: profile?.role ?? null,
    approvalStatus: profile?.approval_status ?? null,
    rejectionReason: profile?.rejection_reason ?? null,
  });
}
