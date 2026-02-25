// POST /api/auth/signout — Server-side sign-out proxy
// Proxies signOut through the server to bypass ISP DNS blocking of supabase.co

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Authentication service is not configured." },
        { status: 503 }
      );
    }

    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Sign-out API error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
