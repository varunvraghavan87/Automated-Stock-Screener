import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/screener/previous-signals
 *
 * Returns signal data from the second-most-recent screener snapshot,
 * allowing the UI to compare current signals against the previous run
 * and show upgrade/downgrade/NEW badges.
 *
 * Returns `{ signals: {} }` on any error or when there's no prior run,
 * so the client can always safely consume the response.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ signals: {} });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ signals: {} });
  }

  // Fetch the 2 most recent screener snapshots.
  // We use snapshots[1] (the older one) to avoid a race condition with
  // the fire-and-forget snapshot save from the current screener run.
  const { data: snapshots, error: snapError } = await supabase
    .from("screener_snapshots")
    .select("id")
    .eq("user_id", user.id)
    .order("run_date", { ascending: false })
    .limit(2);

  if (snapError || !snapshots || snapshots.length < 2) {
    // No previous run to compare against (first run or error)
    return NextResponse.json({ signals: {} });
  }

  const previousSnapshotId = snapshots[1].id;

  // Fetch only the fields we need from the previous snapshot
  const { data: signals, error: sigError } = await supabase
    .from("signal_snapshots")
    .select("symbol, signal, score")
    .eq("snapshot_id", previousSnapshotId);

  if (sigError || !signals) {
    return NextResponse.json({ signals: {} });
  }

  // Build lookup map: { "RELIANCE": { signal: "BUY", score: 72 }, ... }
  const signalMap: Record<string, { signal: string; score: number }> = {};
  for (const s of signals) {
    signalMap[s.symbol] = { signal: s.signal, score: s.score };
  }

  return NextResponse.json({ signals: signalMap });
}
