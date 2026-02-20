import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapPaperTradeRow } from "@/lib/supabase/helpers";
import type { PaperTradeInput } from "@/lib/types";

// GET /api/paper-trades — List user's paper trades
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // 'open', 'closed', or null for all

  let query = supabase
    .from("paper_trades")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (status === "open" || status === "closed") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    trades: (data || []).map(mapPaperTradeRow),
  });
}

// POST /api/paper-trades — Create a new paper trade
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: PaperTradeInput = await request.json();

  // Validate required fields
  if (!body.symbol || !body.name || !body.quantity || !body.entryPrice) {
    return NextResponse.json(
      { error: "Missing required fields: symbol, name, quantity, entryPrice" },
      { status: 400 }
    );
  }

  if (body.quantity <= 0 || body.entryPrice <= 0) {
    return NextResponse.json(
      { error: "Quantity and entry price must be positive" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("paper_trades")
    .insert({
      user_id: user.id,
      symbol: body.symbol,
      exchange: body.exchange || "NSE",
      name: body.name,
      sector: body.sector || "Unknown",
      quantity: body.quantity,
      entry_price: body.entryPrice,
      stop_loss: body.stopLoss || null,
      target_price: body.targetPrice || null,
      signal: body.signal || null,
      overall_score: body.overallScore || null,
      current_price: body.entryPrice, // Initialize current price to entry price
      last_price_update: new Date().toISOString(),
      notes: body.notes || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ trade: mapPaperTradeRow(data) }, { status: 201 });
}
