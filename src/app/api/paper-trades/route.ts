import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapPaperTradeRow } from "@/lib/supabase/helpers";
import { PaperTradeInputSchema, MAX_OPEN_TRADES } from "@/lib/validation";

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
  const status = searchParams.get("status");

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
    console.error("Failed to fetch paper trades:", error);
    return NextResponse.json({ error: "Failed to fetch trades" }, { status: 500 });
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

  // Parse and validate input with Zod
  let body;
  try {
    const raw = await request.json();
    body = PaperTradeInputSchema.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid input. Check quantity, price, and field formats." },
      { status: 400 }
    );
  }

  // Enforce record count limit
  const { count, error: countError } = await supabase
    .from("paper_trades")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "open");

  if (countError) {
    console.error("Failed to check trade count:", countError);
    return NextResponse.json({ error: "Failed to create trade" }, { status: 500 });
  }

  if ((count || 0) >= MAX_OPEN_TRADES) {
    return NextResponse.json(
      { error: `Maximum of ${MAX_OPEN_TRADES} open trades allowed. Close some trades first.` },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("paper_trades")
    .insert({
      user_id: user.id,
      symbol: body.symbol,
      exchange: body.exchange,
      name: body.name,
      sector: body.sector,
      quantity: body.quantity,
      entry_price: body.entryPrice,
      stop_loss: body.stopLoss || null,
      target_price: body.targetPrice || null,
      signal: body.signal || null,
      overall_score: body.overallScore || null,
      current_price: body.entryPrice,
      last_price_update: new Date().toISOString(),
      notes: body.notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create paper trade:", error);
    return NextResponse.json({ error: "Failed to create trade" }, { status: 500 });
  }

  return NextResponse.json({ trade: mapPaperTradeRow(data) }, { status: 201 });
}
