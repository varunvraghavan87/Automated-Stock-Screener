// POST /api/admin/users/[userId]/reject — Reject a user (admin only)

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isValidUUID, AdminRejectSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
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

  const { userId } = await params;
  if (!isValidUUID(userId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  // Cannot modify your own approval status
  if (userId === user.id) {
    return NextResponse.json(
      { error: "Cannot modify your own approval status" },
      { status: 400 }
    );
  }

  // Verify caller is admin
  const { data: callerProfile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify target user exists and check current status
  const { data: targetProfile } = await supabase
    .from("user_profiles")
    .select("approval_status")
    .eq("user_id", userId)
    .single();

  if (!targetProfile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (targetProfile.approval_status === "rejected") {
    return NextResponse.json(
      { error: "User is already rejected" },
      { status: 409 }
    );
  }

  // Parse rejection reason from body
  let body;
  try {
    const raw = await request.json();
    body = AdminRejectSchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Reject the user
  const { error } = await supabase
    .from("user_profiles")
    .update({
      approval_status: "rejected",
      rejected_at: new Date().toISOString(),
      rejection_reason: body.reason || null,
      approved_at: null,
      approved_by: null,
    })
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to reject user:", error);
    return NextResponse.json(
      { error: "Failed to reject user" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
