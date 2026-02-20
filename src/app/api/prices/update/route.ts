import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/kite-session";
import { KiteAPI } from "@/lib/kite-api";
import { acquireKiteLock, releaseKiteLock } from "@/lib/kite-lock";
import { MAX_PRICE_UPDATE_SYMBOLS } from "@/lib/validation";
import { countTradingDays } from "@/lib/market-hours";
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

  // Gather symbols from paper trades, watchlist, and pending signal snapshots
  const [tradesResult, watchlistResult, signalResult] = await Promise.all([
    supabase
      .from("paper_trades")
      .select("symbol, exchange")
      .eq("user_id", user.id)
      .eq("status", "open"),
    supabase
      .from("watchlist")
      .select("symbol, exchange")
      .eq("user_id", user.id),
    supabase
      .from("signal_snapshots")
      .select("symbol, exchange")
      .eq("user_id", user.id)
      .eq("outcome", "pending"),
  ]);

  const tradeSymbols = (tradesResult.data || []).map(
    (t) => `${t.exchange}:${t.symbol}`
  );
  const watchSymbols = (watchlistResult.data || []).map(
    (w) => `${w.exchange}:${w.symbol}`
  );
  const signalSymbols = (signalResult.data || []).map(
    (s) => `${s.exchange}:${s.symbol}`
  );
  const allSymbols = [...new Set([...tradeSymbols, ...watchSymbols, ...signalSymbols])];

  if (allSymbols.length === 0) {
    return NextResponse.json({
      mode: "live",
      prices: [],
      message: "No stocks to update",
    });
  }

  // Guard against exceeding Kite API symbol limit
  if (allSymbols.length > MAX_PRICE_UPDATE_SYMBOLS) {
    return NextResponse.json(
      { error: `Too many symbols to update (${allSymbols.length}). Maximum is ${MAX_PRICE_UPDATE_SYMBOLS}.` },
      { status: 400 }
    );
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

    // ---- Signal Snapshot Price Fill-Forward ----
    // Fill in price_after_1d/3d/5d/10d for pending signal snapshots
    try {
      const { data: pendingSignals } = await supabase
        .from("signal_snapshots")
        .select("id, symbol, exchange, created_at, price_after_1d, price_after_3d, price_after_5d, price_after_10d, entry_price, stop_loss, target_price, outcome")
        .eq("user_id", user.id)
        .eq("outcome", "pending")
        .order("created_at", { ascending: true })
        .limit(200);

      if (pendingSignals && pendingSignals.length > 0) {
        const nowDate = new Date();

        // Build a quick-lookup map from the quotes we already fetched
        const priceMap = new Map<string, number>();
        for (const p of prices) {
          priceMap.set(p.symbol, p.price);
        }

        for (const sig of pendingSignals) {
          const currentPrice = priceMap.get(sig.symbol);
          if (currentPrice === undefined) continue;

          const createdAt = new Date(sig.created_at);
          const tradingDays = countTradingDays(createdAt, nowDate);

          const updates: Record<string, number | string> = {};

          // Fill price at each interval if elapsed and still null
          if (tradingDays >= 1 && sig.price_after_1d === null) {
            updates.price_after_1d = currentPrice;
          }
          if (tradingDays >= 3 && sig.price_after_3d === null) {
            updates.price_after_3d = currentPrice;
          }
          if (tradingDays >= 5 && sig.price_after_5d === null) {
            updates.price_after_5d = currentPrice;
          }
          if (tradingDays >= 10 && sig.price_after_10d === null) {
            updates.price_after_10d = currentPrice;
          }

          // Determine outcome once we have 10+ trading days
          if (tradingDays >= 10 && sig.outcome === "pending") {
            const entryPrice = Number(sig.entry_price);
            const targetPrice = Number(sig.target_price);
            const stopLoss = Number(sig.stop_loss);

            // Collect all recorded price points (use updated values if just filled)
            const p1 = sig.price_after_1d !== null ? Number(sig.price_after_1d) : null;
            const p3 = sig.price_after_3d !== null ? Number(sig.price_after_3d) : null;
            const p5 = sig.price_after_5d !== null ? Number(sig.price_after_5d) : null;
            const p10 = updates.price_after_10d !== undefined
              ? Number(updates.price_after_10d)
              : (sig.price_after_10d !== null ? Number(sig.price_after_10d) : null);

            const pricePoints = [p1, p3, p5, p10].filter(
              (p): p is number => p !== null
            );

            if (pricePoints.length > 0 && entryPrice > 0) {
              const hitTarget = pricePoints.some((p) => p >= targetPrice);
              const hitStop = pricePoints.some((p) => p <= stopLoss);

              if (hitTarget && !hitStop) {
                updates.outcome = "target_hit";
              } else if (hitStop && !hitTarget) {
                updates.outcome = "stopped_out";
              } else if (hitTarget && hitStop) {
                // Both hit — check which interval hit first
                const intervals = [p1, p3, p5, p10];
                const firstTarget = intervals.findIndex(
                  (p) => p !== null && p >= targetPrice
                );
                const firstStop = intervals.findIndex(
                  (p) => p !== null && p <= stopLoss
                );
                updates.outcome =
                  firstStop <= firstTarget ? "stopped_out" : "target_hit";
              } else {
                updates.outcome = "expired";
              }
            } else {
              updates.outcome = "expired";
            }
          }

          if (Object.keys(updates).length > 0) {
            await supabase
              .from("signal_snapshots")
              .update(updates)
              .eq("id", sig.id);
          }
        }
      }
    } catch (fillError) {
      // Non-blocking: fill-forward errors don't affect price update response
      console.error("Signal snapshot fill-forward error:", fillError);
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
      { error: "Failed to fetch prices" },
      { status: 502 }
    );
  } finally {
    releaseKiteLock();
  }
}
