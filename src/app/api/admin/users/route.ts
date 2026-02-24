// GET /api/admin/users — List all user profiles (admin only)

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
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

  // Verify caller is admin
  const { data: callerProfile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Admin RLS policy allows reading all rows
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    users: (data || []).map(
      (row: {
        id: string;
        user_id: string;
        email: string;
        display_name: string;
        role: string;
        approval_status: string;
        rejection_reason: string | null;
        approved_by: string | null;
        approved_at: string | null;
        rejected_at: string | null;
        created_at: string;
        updated_at: string;
      }) => ({
        id: row.id,
        userId: row.user_id,
        email: row.email,
        displayName: row.display_name,
        role: row.role,
        approvalStatus: row.approval_status,
        rejectionReason: row.rejection_reason,
        approvedBy: row.approved_by,
        approvedAt: row.approved_at,
        rejectedAt: row.rejected_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })
    ),
  });
}
