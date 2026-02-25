// POST /api/admin/users/[userId]/reset-password — Admin-only password reset
// Uses the Supabase Admin API to set a user's password directly,
// bypassing the email flow (which is broken by Jio ISP DNS poisoning).

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  // 1. Authenticate the caller
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Validate target userId
  const { userId } = await params;
  if (!isValidUUID(userId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  // 3. Safety guard: cannot reset own password via admin endpoint
  if (userId === user.id) {
    return NextResponse.json(
      { error: "Cannot reset your own password via admin. Use the normal password change flow." },
      { status: 400 }
    );
  }

  // 4. Verify caller is admin
  const { data: callerProfile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 5. Parse and validate the new password
  let password: string;
  try {
    const body = await request.json();
    password = body.password;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters long." },
      { status: 400 }
    );
  }
  if (!/[A-Z]/.test(password)) {
    return NextResponse.json(
      { error: "Password must contain at least one uppercase letter." },
      { status: 400 }
    );
  }
  if (!/[0-9]/.test(password)) {
    return NextResponse.json(
      { error: "Password must contain at least one number." },
      { status: 400 }
    );
  }

  // 6. Create admin client and reset the password
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Admin service is temporarily unavailable." },
      { status: 503 }
    );
  }

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) {
    console.error("Failed to reset user password:", error);
    return NextResponse.json(
      { error: "Failed to reset password. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
