import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapWatchlistRow } from "@/lib/supabase/helpers";
import { WatchlistInputSchema, MAX_WATCHLIST_ITEMS } from "@/lib/validation";

// GET /api/watchlist — List user's watchlist items
export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("watchlist")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch watchlist:", error);
    return NextResponse.json({ error: "Failed to fetch watchlist" }, { status: 500 });
  }

  return NextResponse.json({
    items: (data || []).map(mapWatchlistRow),
  });
}

// POST /api/watchlist — Add stock to watchlist
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse and validate input with Zod
  let body;
  try {
    const raw = await request.json();
    body = WatchlistInputSchema.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid input. Check symbol, name, and price fields." },
      { status: 400 }
    );
  }

  // Enforce record count limit
  const { count, error: countError } = await supabase
    .from("watchlist")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (countError) {
    console.error("Failed to check watchlist count:", countError);
    return NextResponse.json({ error: "Failed to add to watchlist" }, { status: 500 });
  }

  if ((count || 0) >= MAX_WATCHLIST_ITEMS) {
    return NextResponse.json(
      { error: `Maximum of ${MAX_WATCHLIST_ITEMS} watchlist items allowed. Remove some items first.` },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("watchlist")
    .insert({
      user_id: user.id,
      symbol: body.symbol,
      exchange: body.exchange,
      name: body.name,
      sector: body.sector,
      added_price: body.addedPrice,
      current_price: body.addedPrice,
      last_price_update: new Date().toISOString(),
      target_buy: body.targetBuy || null,
      target_sell: body.targetSell || null,
      signal: body.signal || null,
      overall_score: body.overallScore || null,
      notes: body.notes || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Stock is already in your watchlist" },
        { status: 409 }
      );
    }
    console.error("Failed to add to watchlist:", error);
    return NextResponse.json({ error: "Failed to add to watchlist" }, { status: 500 });
  }

  return NextResponse.json({ item: mapWatchlistRow(data) }, { status: 201 });
}
