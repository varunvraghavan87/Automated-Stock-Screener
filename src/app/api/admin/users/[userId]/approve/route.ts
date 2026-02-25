// POST /api/admin/users/[userId]/approve — Approve a pending user (admin only)

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/validation";

export async function POST(
  _request: Request,
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
  if (targetProfile.approval_status === "approved") {
    return NextResponse.json(
      { error: "User is already approved" },
      { status: 409 }
    );
  }

  // Approve the user
  const { error } = await supabase
    .from("user_profiles")
    .update({
      approval_status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      rejected_at: null,
      rejection_reason: null,
    })
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to approve user:", error);
    return NextResponse.json(
      { error: "Failed to approve user" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
