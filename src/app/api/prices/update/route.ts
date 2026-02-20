import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/kite-session";
import { KiteAPI } from "@/lib/kite-api";
import { acquireKiteLock, releaseKiteLock } from "@/lib/kite-lock";
import type { PriceUpdateResult } from "@/lib/types";

// POST /api/prices/update — Fetch live quotes and update paper_trades + watchlist
export async function POST() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check Kite session
  const session = await getSession();
  if (!session) {
    return NextResponse.json({
      mode: "demo",
      prices: [],
      message: "Kite not connected — prices not updated",
    });
  }

  // Gather symbols from both tables
  const [tradesResult, watchlistResult] = await Promise.all([
    supabase
      .from("paper_trades")
      .select("symbol, exchange")
      .eq("user_id", user.id)
      .eq("status", "open"),
    supabase
      .from("watchlist")
      .select("symbol, exchange")
      .eq("user_id", user.id),
  ]);

  const tradeSymbols = (tradesResult.data || []).map(
    (t) => `${t.exchange}:${t.symbol}`
  );
  const watchSymbols = (watchlistResult.data || []).map(
    (w) => `${w.exchange}:${w.symbol}`
  );
  const allSymbols = [...new Set([...tradeSymbols, ...watchSymbols])];

  if (allSymbols.length === 0) {
    return NextResponse.json({
      mode: "live",
      prices: [],
      message: "No stocks to update",
    });
  }

  // Acquire the Kite API lock (wait up to 60s for screener to finish)
  const locked = await acquireKiteLock("price_update", 60_000);
  if (!locked) {
    return NextResponse.json(
      {
        error: "Screener is currently running. Prices will update after it finishes.",
        retryAfter: 30,
      },
      { status: 503 }
    );
  }

  try {
    const kite = new KiteAPI({
      apiKey: session.apiKey,
      accessToken: session.accessToken,
    });

    const quotes = await kite.fetchQuotes(allSymbols);
    const now = new Date().toISOString();
    const prices: PriceUpdateResult[] = [];

    // Build updates for each symbol
    for (const [key, quote] of quotes) {
      const symbol = key.split(":")[1];
      const price = quote.last_price;
      const previousClose = quote.ohlc.close;
      const change = price - previousClose;
      const changePercent =
        previousClose > 0 ? (change / previousClose) * 100 : 0;

      prices.push({
        symbol,
        price,
        change,
        changePercent,
        updatedAt: now,
      });

      // Update paper_trades (all open trades for this symbol)
      await supabase
        .from("paper_trades")
        .update({
          current_price: price,
          last_price_update: now,
        })
        .eq("user_id", user.id)
        .eq("symbol", symbol)
        .eq("status", "open");

      // Update watchlist
      await supabase
        .from("watchlist")
        .update({
          current_price: price,
          last_price_update: now,
        })
        .eq("user_id", user.id)
        .eq("symbol", symbol);
    }

    return NextResponse.json({
      mode: "live",
      prices,
      updatedAt: now,
      count: prices.length,
    });
  } catch (error) {
    console.error("Price update failed:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch prices",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    );
  } finally {
    releaseKiteLock();
  }
}
