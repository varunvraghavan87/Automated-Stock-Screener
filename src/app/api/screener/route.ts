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
import { ScreenerConfigSchema } from "@/lib/validation";

// Extend serverless function timeout for live data fetching (500 stocks)
// Vercel Pro: up to 300s. Hobby: up to 60s.
export const maxDuration = 300;

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

  // Priority: 1) Active Kite session (cookie), 2) Env vars, 3) Demo mode
  const session = await getSession();
  const kiteApiKey = session?.apiKey || process.env.KITE_API_KEY;
  const kiteAccessToken = session?.accessToken || process.env.KITE_ACCESS_TOKEN;

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
