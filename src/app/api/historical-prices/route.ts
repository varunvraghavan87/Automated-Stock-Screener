// GET /api/historical-prices?symbol=RELIANCE&exchange=NSE
// Returns 90 days of daily historical price data from Kite Connect.
// Falls back to empty array when Kite is not connected (demo mode).

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/kite-session";
import { KiteAPI } from "@/lib/kite-api";
import { acquireKiteLock, releaseKiteLock } from "@/lib/kite-lock";

export async function GET(request: Request) {
  // ─── Auth ────────────────────────────────────────────────────────────
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

  // ─── Parse query params ──────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const exchange = searchParams.get("exchange") || "NSE";

  if (!symbol) {
    return NextResponse.json(
      { error: "Missing required parameter: symbol" },
      { status: 400 }
    );
  }

  // ─── Kite session check ──────────────────────────────────────────────
  const session = await getSession();
  if (!session) {
    return NextResponse.json({
      prices: [],
      mode: "demo",
      message: "Kite not connected — historical prices unavailable",
    });
  }

  // ─── Acquire lock and fetch ──────────────────────────────────────────
  const locked = await acquireKiteLock("historical_prices", 30_000);
  if (!locked) {
    return NextResponse.json(
      {
        error: "Screener is currently running. Try again shortly.",
        retryAfter: 15,
      },
      { status: 503 }
    );
  }

  try {
    const kite = new KiteAPI({
      apiKey: session.apiKey,
      accessToken: session.accessToken,
    });

    // Resolve instrument token from symbol
    const instruments = await kite.fetchInstruments(exchange);
    const instrument = instruments.find(
      (i) => i.tradingsymbol === symbol && i.exchange === exchange
    );

    if (!instrument) {
      return NextResponse.json(
        { error: `Instrument not found: ${exchange}:${symbol}` },
        { status: 404 }
      );
    }

    // Fetch 90 days of daily candles
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 120); // fetch 120 calendar days to get ~90 trading days

    const candles = await kite.fetchHistorical(
      instrument.instrument_token,
      "day",
      from,
      to
    );

    // Map to the format the chart expects: { date, close, volume }
    const prices = candles.map((c) => ({
      date:
        typeof c.date === "string"
          ? c.date.split("T")[0]
          : new Date(c.date).toISOString().split("T")[0],
      close: c.close,
      volume: c.volume,
    }));

    return NextResponse.json({
      prices,
      mode: "live",
      symbol,
      exchange,
    });
  } catch (error) {
    console.error("Historical prices fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch historical prices" },
      { status: 502 }
    );
  } finally {
    releaseKiteLock();
  }
}
