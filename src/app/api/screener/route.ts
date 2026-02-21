import { NextResponse } from "next/server";
import { MOCK_STOCKS } from "@/lib/mock-data";
import {
  runScreener,
  detectMarketRegime,
  getAdaptiveThresholds,
  computeSectorRankings,
} from "@/lib/screener-engine";
import { KiteAPI } from "@/lib/kite-api";
import { LiveDataService, NIFTY_500_SYMBOLS } from "@/lib/live-data-service";
import { getSession } from "@/lib/kite-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { acquireKiteLock, releaseKiteLock } from "@/lib/kite-lock";
import {
  type ScreenerConfig,
  type MarketRegimeInfo,
  DEFAULT_SCREENER_CONFIG,
} from "@/lib/types";
import {
  ScreenerConfigSchema,
  MAX_SNAPSHOTS_PER_USER,
  MAX_SIGNALS_PER_SNAPSHOT,
  SNAPSHOT_RETENTION_DAYS,
} from "@/lib/validation";
import type { ScreenerResult, ScreenerResultsSummary } from "@/lib/types";

// Extend serverless function timeout for live data fetching (500 stocks)
// Vercel Pro: up to 300s. Hobby: up to 60s.
export const maxDuration = 300;

/**
 * Save a screener run snapshot to Supabase. Fire-and-forget: errors here
 * never block the screener response.
 */
async function saveScreenerSnapshot(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  userId: string,
  mode: string,
  marketRegime: string,
  totalScanned: number,
  results: ScreenerResult[]
): Promise<void> {
  try {
    // 1. Build results summary
    const signalCounts: Record<string, number> = {
      STRONG_BUY: 0, BUY: 0, WATCH: 0, NEUTRAL: 0, AVOID: 0,
    };
    results.forEach((r) => { signalCounts[r.signal]++; });

    const topStocks = results
      .filter((r) => r.phase1Pass && r.overallScore > 0)
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 10)
      .map((r) => ({
        symbol: r.stock.symbol,
        signal: r.signal,
        score: r.overallScore,
        entryPrice: r.phase6.entryPrice,
      }));

    const resultsSummary: ScreenerResultsSummary = { signalCounts, topStocks };

    // 2. Insert snapshot
    const { data: snapshot, error: snapError } = await supabase
      .from("screener_snapshots")
      .insert({
        user_id: userId,
        run_date: new Date().toISOString(),
        mode,
        market_regime: marketRegime,
        total_scanned: totalScanned,
        results_summary: resultsSummary,
      })
      .select("id")
      .single();

    if (snapError || !snapshot) {
      console.error("Failed to save screener snapshot:", snapError);
      return;
    }

    // 3. Insert individual signal snapshots (phase1Pass + score > 0, capped)
    const signalResults = results
      .filter((r) => r.phase1Pass && r.overallScore > 0)
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, MAX_SIGNALS_PER_SNAPSHOT);

    if (signalResults.length > 0) {
      const signalRows = signalResults.map((r) => ({
        snapshot_id: snapshot.id,
        user_id: userId,
        symbol: r.stock.symbol,
        exchange: r.stock.exchange || "NSE",
        name: r.stock.name,
        sector: r.stock.sector,
        signal: r.signal,
        score: r.overallScore,
        entry_price: r.phase6.entryPrice,
        stop_loss: r.phase6.stopLoss,
        target_price: r.phase6.target,
        risk_reward: r.phase6.riskRewardRatio,
        outcome: "pending",
      }));

      const { error: sigError } = await supabase
        .from("signal_snapshots")
        .insert(signalRows);

      if (sigError) {
        console.error("Failed to save signal snapshots:", sigError);
      }
    }

    // 4. Enforce retention: delete snapshots older than SNAPSHOT_RETENTION_DAYS
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - SNAPSHOT_RETENTION_DAYS);

    await supabase
      .from("screener_snapshots")
      .delete()
      .eq("user_id", userId)
      .lt("run_date", cutoff.toISOString());

    // 5. Enforce max count
    const { count } = await supabase
      .from("screener_snapshots")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (count && count > MAX_SNAPSHOTS_PER_USER) {
      const excess = count - MAX_SNAPSHOTS_PER_USER;
      const { data: oldest } = await supabase
        .from("screener_snapshots")
        .select("id")
        .eq("user_id", userId)
        .order("run_date", { ascending: true })
        .limit(excess);

      if (oldest && oldest.length > 0) {
        await supabase
          .from("screener_snapshots")
          .delete()
          .in("id", oldest.map((s: { id: string }) => s.id));
      }
    }
  } catch (error) {
    console.error("Snapshot save error (non-blocking):", error);
  }
}

export async function GET() {
  // Verify user authentication
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Check if there's an active Kite session
  const session = await getSession();
  let stocks = MOCK_STOCKS;
  let mode = "demo";
  let marketRegime: MarketRegimeInfo | null = null;

  if (session) {
    // Acquire lock before making Kite API calls
    const locked = await acquireKiteLock("screener", 300_000);
    if (!locked) {
      return NextResponse.json(
        { error: "Another API operation is in progress. Please try again." },
        { status: 503 }
      );
    }
    try {
      const kite = new KiteAPI({
        apiKey: session.apiKey,
        accessToken: session.accessToken,
      });
      const liveService = new LiveDataService(kite);
      const liveData = await liveService.fetchAndComputeIndicatorsWithRegime(NIFTY_500_SYMBOLS);
      stocks = liveData.stocks;
      marketRegime = liveData.marketRegime;
      mode = "live";
    } catch (error) {
      console.error("Kite API failed, falling back to demo:", error);
      // Fall through to demo mode
    } finally {
      releaseKiteLock();
    }
  }

  // Use demo regime if no live regime available
  if (!marketRegime) {
    marketRegime = detectMarketRegime(22500, 22400, 22200, 28, null);
  }

  const adaptiveThresholds = getAdaptiveThresholds(marketRegime.regime);
  const sectorRankings = computeSectorRankings(stocks);
  const results = runScreener(stocks, DEFAULT_SCREENER_CONFIG, adaptiveThresholds, sectorRankings);

  // Save snapshot (fire-and-forget — never blocks response)
  if (supabase) {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      saveScreenerSnapshot(
        supabase, authUser.id, mode, marketRegime.regime,
        stocks.length, results
      ).catch(() => {});
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    mode,
    totalScanned: stocks.length,
    marketRegime,
    adaptiveThresholds,
    sectorRankings,
    pipeline: {
      phase1: results.filter((r) => r.phase1Pass).length,
      phase2: results.filter((r) => r.phase2Pass).length,
      phase3: results.filter((r) => r.phase3Pass).length,
      phase4Volume: results.filter((r) => r.phase4VolumePass).length,
      phase5Volatility: results.filter((r) => r.phase5VolatilityPass).length,
    },
    results,
  });
}

export async function POST(request: Request) {
  // Verify user authentication
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await request.json();

  // Validate config with Zod to prevent prototype pollution
  let validatedConfig = {};
  try {
    if (body.config) {
      validatedConfig = ScreenerConfigSchema.parse(body.config);
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid screener configuration" },
      { status: 400 }
    );
  }

  const config: ScreenerConfig = {
    ...DEFAULT_SCREENER_CONFIG,
    ...validatedConfig,
  };

  const symbols = body.symbols || NIFTY_500_SYMBOLS;

  let stocks = MOCK_STOCKS;
  let mode = "demo";
  let marketRegime: MarketRegimeInfo | null = null;

  // Priority: 1) Active Kite session (cookie), 2) Demo mode
  // NOTE: Only the user's own OAuth session token is used for API access.
  // KITE_API_KEY env var is the public app identifier (needed for OAuth initiation).
  // KITE_ACCESS_TOKEN env var fallback was removed to prevent credential sharing
  // across users in multi-user deployments.
  const session = await getSession();
  const kiteApiKey = session?.apiKey || process.env.KITE_API_KEY;
  const kiteAccessToken = session?.accessToken;

  if (kiteApiKey && kiteAccessToken) {
    // Acquire lock before making Kite API calls
    const locked = await acquireKiteLock("screener", 300_000);
    if (!locked) {
      return NextResponse.json(
        { error: "Another API operation is in progress. Please try again." },
        { status: 503 }
      );
    }
    try {
      const kite = new KiteAPI({
        apiKey: kiteApiKey,
        accessToken: kiteAccessToken,
      });
      const liveService = new LiveDataService(kite);
      const liveData = await liveService.fetchAndComputeIndicatorsWithRegime(symbols);
      stocks = liveData.stocks;
      marketRegime = liveData.marketRegime;
      mode = "live";
    } catch (error) {
      // If session auth failed, return error. If env var auth, fall back silently.
      if (session) {
        console.error("Kite API connection failed:", error);
        releaseKiteLock();
        return NextResponse.json(
          {
            error: "Kite API connection failed. Try reconnecting to Kite.",
          },
          { status: 502 }
        );
      }
      // Env var auth failed — fall back to demo silently
      console.error("Kite env var auth failed, using demo data:", error);
    } finally {
      releaseKiteLock();
    }
  }

  // Use demo regime if no live regime available
  if (!marketRegime) {
    marketRegime = detectMarketRegime(22500, 22400, 22200, 28, null);
  }

  const adaptiveThresholds = getAdaptiveThresholds(marketRegime.regime, config);
  const sectorRankings = computeSectorRankings(stocks);
  const results = runScreener(stocks, config, adaptiveThresholds, sectorRankings);

  // Save snapshot (fire-and-forget — never blocks response)
  if (supabase) {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      saveScreenerSnapshot(
        supabase, authUser.id, mode, marketRegime.regime,
        stocks.length, results
      ).catch(() => {});
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    mode,
    config,
    totalScanned: stocks.length,
    marketRegime,
    adaptiveThresholds,
    sectorRankings,
    pipeline: {
      phase1: results.filter((r) => r.phase1Pass).length,
      phase2: results.filter((r) => r.phase2Pass).length,
      phase3: results.filter((r) => r.phase3Pass).length,
      phase4Volume: results.filter((r) => r.phase4VolumePass).length,
      phase5Volatility: results.filter((r) => r.phase5VolatilityPass).length,
    },
    results,
  });
}
