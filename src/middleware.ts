import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

// ─── Rate Limit Tiers ────────────────────────────────────────────────────
// Auth endpoints: 10 requests per 5 minutes (brute-force protection)
const AUTH_RATE_LIMIT = 10;
const AUTH_RATE_WINDOW_MS = 5 * 60_000;

// Screener POST: 2 requests per 60 seconds (expensive Kite API operation)
const SCREENER_RATE_LIMIT = 2;
const SCREENER_RATE_WINDOW_MS = 60_000;

// General API: 60 requests per 60 seconds
const API_RATE_LIMIT = 60;
const API_RATE_WINDOW_MS = 60_000;

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIP(request);

  // ─── Rate Limiting ───────────────────────────────────────────────────
  // Applied before auth checks so that brute-force attacks are blocked early.

  // Auth endpoints: login, register, password reset, Kite OAuth initiation
  if (pathname.startsWith("/auth/") || pathname === "/api/kite/auth") {
    const result = checkRateLimit(`auth:${ip}`, AUTH_RATE_LIMIT, AUTH_RATE_WINDOW_MS);
    if (!result.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(result.resetMs / 1000)) },
        }
      );
    }
  }

  // Screener POST: most expensive endpoint (triggers Kite API calls)
  if (pathname === "/api/screener" && request.method === "POST") {
    const result = checkRateLimit(
      `screener:${ip}`,
      SCREENER_RATE_LIMIT,
      SCREENER_RATE_WINDOW_MS
    );
    if (!result.allowed) {
      return NextResponse.json(
        { error: "Screener can only be run twice per minute. Please wait." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(result.resetMs / 1000)) },
        }
      );
    }
  }

  // General API: catch-all rate limit for all /api/* endpoints
  if (pathname.startsWith("/api/")) {
    const result = checkRateLimit(`api:${ip}`, API_RATE_LIMIT, API_RATE_WINDOW_MS);
    if (!result.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(result.resetMs / 1000)) },
        }
      );
    }
  }

  // ─── Supabase Session Handling ───────────────────────────────────────
  const response = await updateSession(request);

  // ─── Cache-Control Headers (M4) ─────────────────────────────────────
  // Prevent CDN or browser caching of API responses that may contain user data.
  if (pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store, private");
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
