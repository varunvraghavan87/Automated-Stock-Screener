import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  mapSignalSnapshotRow,
  mapScreenerSnapshotRow,
} from "@/lib/supabase/helpers";

// GET /api/signal-performance?days=30
export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const days = Math.min(
    Math.max(parseInt(searchParams.get("days") || "30", 10), 7),
    90
  );

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffISO = cutoff.toISOString();

  // Fetch signal snapshots and screener snapshots in parallel
  const [signalsRes, snapshotsRes] = await Promise.all([
    supabase
      .from("signal_snapshots")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", cutoffISO)
      .order("created_at", { ascending: false }),
    supabase
      .from("screener_snapshots")
      .select("*")
      .eq("user_id", user.id)
      .gte("run_date", cutoffISO)
      .order("run_date", { ascending: false }),
  ]);

  if (signalsRes.error) {
    console.error("Failed to fetch signal snapshots:", signalsRes.error);
    return NextResponse.json(
      { error: "Failed to fetch signal data" },
      { status: 500 }
    );
  }

  if (snapshotsRes.error) {
    console.error("Failed to fetch screener snapshots:", snapshotsRes.error);
    return NextResponse.json(
      { error: "Failed to fetch snapshot data" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    signals: (signalsRes.data || []).map(mapSignalSnapshotRow),
    snapshots: (snapshotsRes.data || []).map(mapScreenerSnapshotRow),
    days,
  });
}
