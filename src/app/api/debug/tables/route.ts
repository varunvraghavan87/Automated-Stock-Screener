// GET /api/debug/tables — Admin-only diagnostic endpoint
// Compares RLS-filtered vs admin (service-role) query counts to detect
// when Row Level Security is blocking access to paper_trades or watchlist.

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  // ─── Auth + admin check ──────────────────────────────────────────────
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

  const { data: callerProfile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ─── Admin client (bypasses RLS) ─────────────────────────────────────
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Admin service is temporarily unavailable." },
      { status: 503 }
    );
  }

  // ─── Query counts: RLS-filtered (anon) vs admin (service-role) ───────
  const [
    anonTrades,
    anonWatchlist,
    adminTrades,
    adminWatchlist,
    adminTradesAll,
    adminWatchlistAll,
  ] = await Promise.all([
    // Anon client (respects RLS) — what the user sees
    supabase
      .from("paper_trades")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("watchlist")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    // Admin client (bypasses RLS) — what actually exists for this user
    adminClient
      .from("paper_trades")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    adminClient
      .from("watchlist")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    // Admin client — total rows across all users
    adminClient
      .from("paper_trades")
      .select("*", { count: "exact", head: true }),
    adminClient
      .from("watchlist")
      .select("*", { count: "exact", head: true }),
  ]);

  const tradesVisible = anonTrades.count ?? 0;
  const tradesTotal = adminTrades.count ?? 0;
  const tradesTotalAll = adminTradesAll.count ?? 0;
  const watchlistVisible = anonWatchlist.count ?? 0;
  const watchlistTotal = adminWatchlist.count ?? 0;
  const watchlistTotalAll = adminWatchlistAll.count ?? 0;

  const tradesBlocked = tradesTotal > tradesVisible;
  const watchlistBlocked = watchlistTotal > watchlistVisible;

  let diagnosis = "All data is accessible. RLS policies are working correctly.";
  if (tradesBlocked || watchlistBlocked) {
    diagnosis =
      "RLS is blocking access to some data. Run the migration SQL files " +
      "(supabase/migrations/paper_trades.sql and watchlist.sql) in the " +
      "Supabase SQL Editor to fix RLS policies.";
  } else if (tradesTotal === 0 && watchlistTotal === 0) {
    diagnosis =
      "No paper trades or watchlist items exist in the database for this user.";
  }

  return NextResponse.json({
    userId: user.id,
    paper_trades: {
      visibleViaAnon: tradesVisible,
      totalForUser: tradesTotal,
      totalAllUsers: tradesTotalAll,
      rlsBlocking: tradesBlocked,
      anonError: anonTrades.error?.message ?? null,
      adminError: adminTrades.error?.message ?? null,
    },
    watchlist: {
      visibleViaAnon: watchlistVisible,
      totalForUser: watchlistTotal,
      totalAllUsers: watchlistTotalAll,
      rlsBlocking: watchlistBlocked,
      anonError: anonWatchlist.error?.message ?? null,
      adminError: adminWatchlist.error?.message ?? null,
    },
    diagnosis,
  });
}
