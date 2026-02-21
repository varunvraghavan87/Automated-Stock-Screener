// In-memory sliding-window rate limiter for API endpoint protection.
// Uses a Map of timestamp arrays per key (e.g., "api:192.168.1.1").
//
// ⚠️  SERVERLESS LIMITATION: Like kite-lock.ts, this uses module-level
// state and only works within a single Node.js process. On Vercel serverless,
// concurrent requests routed to different instances won't share state.
// For production with high traffic, replace with Vercel KV (Redis):
//
//   await kv.incr(`rate:${key}`, { ex: windowSec }) → check count
//
// The current implementation is adequate for single-user or low-concurrency
// scenarios where Vercel reuses the same serverless instance.

const store = new Map<string, number[]>();

// Periodic cleanup to prevent memory leaks from stale keys.
// Runs every 60 seconds, removes entries with no timestamps in the last 5 minutes.
const CLEANUP_INTERVAL_MS = 60_000;
const STALE_THRESHOLD_MS = 300_000;

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of store) {
      const valid = timestamps.filter((t) => now - t < STALE_THRESHOLD_MS);
      if (valid.length === 0) {
        store.delete(key);
      } else {
        store.set(key, valid);
      }
    }
  }, CLEANUP_INTERVAL_MS).unref?.();
}

/**
 * Check if a request is within the rate limit for the given key.
 * Uses a sliding-window algorithm: counts requests within the last `windowMs`.
 *
 * @param key - Unique identifier (e.g., "api:127.0.0.1", "screener:192.168.1.1")
 * @param maxRequests - Maximum allowed requests within the window
 * @param windowMs - Time window in milliseconds
 * @returns { allowed: boolean, resetMs: number } — resetMs is ms until the window resets
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; resetMs: number } {
  const now = Date.now();
  const timestamps = (store.get(key) || []).filter((t) => now - t < windowMs);

  if (timestamps.length >= maxRequests) {
    const resetMs = windowMs - (now - timestamps[0]);
    store.set(key, timestamps);
    return { allowed: false, resetMs: Math.max(resetMs, 0) };
  }

  timestamps.push(now);
  store.set(key, timestamps);
  return { allowed: true, resetMs: 0 };
}
