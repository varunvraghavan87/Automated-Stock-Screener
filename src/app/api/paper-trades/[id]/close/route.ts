import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapPaperTradeRow } from "@/lib/supabase/helpers";
import { isValidUUID, PaperTradeCloseSchema } from "@/lib/validation";

// POST /api/paper-trades/[id]/close — Close a paper trade
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid trade ID" }, { status: 400 });
  }

  let body;
  try {
    const raw = await request.json();
    body = PaperTradeCloseSchema.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid input. Exit price must be a positive number." },
      { status: 400 }
    );
  }

  // First fetch the trade to compute P&L
  const { data: trade, error: fetchError } = await supabase
    .from("paper_trades")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "open")
    .single();

  if (fetchError || !trade) {
    return NextResponse.json(
      { error: "Open trade not found" },
      { status: 404 }
    );
  }

  // Compute realized P&L
  const realizedPnl =
    (body.exitPrice - Number(trade.entry_price)) * Number(trade.quantity);

  const { data: updated, error: updateError } = await supabase
    .from("paper_trades")
    .update({
      status: "closed",
      exit_price: body.exitPrice,
      exit_date: new Date().toISOString(),
      exit_reason: body.exitReason,
      realized_pnl: realizedPnl,
      current_price: body.exitPrice,
      last_price_update: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (updateError) {
    console.error("Failed to close paper trade:", updateError);
    return NextResponse.json({ error: "Failed to close trade" }, { status: 500 });
  }

  return NextResponse.json({ trade: mapPaperTradeRow(updated) });
}
