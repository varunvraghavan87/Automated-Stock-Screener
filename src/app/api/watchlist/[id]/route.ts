import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapWatchlistRow } from "@/lib/supabase/helpers";
import { isValidUUID, WatchlistUpdateSchema } from "@/lib/validation";

// PATCH /api/watchlist/[id] — Update watchlist item (targets, notes)
export async function PATCH(
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
    return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
  }

  let body;
  try {
    const raw = await request.json();
    body = WatchlistUpdateSchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.targetBuy !== undefined) updateData.target_buy = body.targetBuy;
  if (body.targetSell !== undefined) updateData.target_sell = body.targetSell;
  if (body.notes !== undefined) updateData.notes = body.notes;

  const { data, error } = await supabase
    .from("watchlist")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update watchlist item:", error);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json({ item: mapWatchlistRow(data) });
}

// DELETE /api/watchlist/[id] — Remove from watchlist
export async function DELETE(
  _request: Request,
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
    return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
  }

  const { error } = await supabase
    .from("watchlist")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to delete watchlist item:", error);
    return NextResponse.json({ error: "Failed to remove item" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
