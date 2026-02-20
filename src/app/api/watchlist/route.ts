import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapWatchlistRow } from "@/lib/supabase/helpers";
import type { WatchlistInput } from "@/lib/types";

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
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  const body: WatchlistInput = await request.json();

  if (!body.symbol || !body.name || !body.addedPrice) {
    return NextResponse.json(
      { error: "Missing required fields: symbol, name, addedPrice" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("watchlist")
    .insert({
      user_id: user.id,
      symbol: body.symbol,
      exchange: body.exchange || "NSE",
      name: body.name,
      sector: body.sector || "Unknown",
      added_price: body.addedPrice,
      current_price: body.addedPrice, // Initialize to added price
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
    // Handle unique constraint violation (stock already in watchlist)
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Stock is already in your watchlist" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: mapWatchlistRow(data) }, { status: 201 });
}
