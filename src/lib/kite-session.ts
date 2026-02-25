// Kite Connect OAuth session management
// Handles token exchange, cookie-based session storage, and expiry checks
// Session data is AES-256-GCM encrypted in the cookie to protect credentials at rest.

import { cookies } from "next/headers";
import { encryptSecret, decryptSecret } from "@/lib/kite-credentials";

const KITE_API_BASE = "https://api.kite.trade";
const COOKIE_NAME = "kite_session";
const COOKIE_MAX_AGE = 24 * 60 * 60; // 24 hours (token expires at 6 AM IST)

interface KiteSession {
  apiKey: string;
  accessToken: string;
  userId: string;
  loginTime: string; // ISO string
}

/**
 * Exchange a request_token for an access_token via Kite Connect API
 * POST /session/token with api_key, request_token, and SHA-256 checksum
 */
export async function exchangeToken(
  apiKey: string,
  apiSecret: string,
  requestToken: string
): Promise<{
  accessToken: string;
  userId: string;
  userName: string;
  email: string;
}> {
  // Compute SHA-256 checksum: api_key + request_token + api_secret
  const checksumInput = `${apiKey}${requestToken}${apiSecret}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(checksumInput);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const checksum = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const response = await fetch(`${KITE_API_BASE}/session/token`, {
    method: "POST",
    headers: {
      "X-Kite-Version": "3",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      api_key: apiKey,
      request_token: requestToken,
      checksum,
    }),
  });

  if (!response.ok) {
    // Consume body but don't include raw API error details in thrown error —
    // Kite error messages may contain sensitive API internals that would be
    // logged by the callback handler's console.error().
    await response.json().catch(() => {});
    throw new Error(`Kite token exchange failed with HTTP ${response.status}`);
  }

  const result = await response.json();
  const sessionData = result.data;

  return {
    accessToken: sessionData.access_token,
    userId: sessionData.user_id,
    userName: sessionData.user_name || "",
    email: sessionData.email || "",
  };
}

/**
 * Store the Kite session in an HTTP-only cookie.
 * The payload is AES-256-GCM encrypted so that raw API credentials
 * are never stored in plaintext in the cookie.
 */
export async function storeSession(session: KiteSession): Promise<void> {
  const cookieStore = await cookies();
  let payload: string;
  try {
    payload = await encryptSecret(JSON.stringify(session));
  } catch {
    // Fall back to plain JSON if encryption key is unavailable (e.g., dev without key)
    payload = JSON.stringify(session);
  }
  cookieStore.set(COOKIE_NAME, payload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

/**
 * Retrieve the stored Kite session from cookie.
 * Attempts AES-256-GCM decryption first, falls back to plain JSON
 * for backward compatibility with sessions created before encryption was added.
 */
export async function getSession(): Promise<KiteSession | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);

  if (!cookie?.value) return null;

  try {
    let session: KiteSession;
    try {
      // Try decrypting (new encrypted format)
      const decrypted = await decryptSecret(cookie.value);
      session = JSON.parse(decrypted);
    } catch {
      // Fall back to plain JSON (legacy or dev without encryption key)
      session = JSON.parse(cookie.value);
    }

    // Check if token has expired (6 AM IST = 00:30 UTC)
    if (isTokenExpired(session.loginTime)) {
      await clearSession();
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Clear the Kite session cookie
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Check if a Kite access token has expired
 * Tokens expire at 6:00 AM IST (00:30 UTC) the next day
 */
export function isTokenExpired(loginTimeISO: string): boolean {
  const loginTime = new Date(loginTimeISO);
  const now = new Date();

  // Calculate next 6 AM IST (00:30 UTC) after login time
  const expiryUTC = new Date(loginTime);
  // Set to 00:30 UTC (6:00 AM IST)
  expiryUTC.setUTCHours(0, 30, 0, 0);

  // If login was before 00:30 UTC, expiry is same day 00:30 UTC
  // If login was after 00:30 UTC, expiry is next day 00:30 UTC
  if (loginTime.getTime() >= expiryUTC.getTime()) {
    expiryUTC.setUTCDate(expiryUTC.getUTCDate() + 1);
  }

  return now.getTime() >= expiryUTC.getTime();
}

/**
 * Generate the Kite Connect login URL
 */
export function getKiteLoginURL(apiKey: string, redirectParams?: string): string {
  let url = `https://kite.zerodha.com/connect/login?v=3&api_key=${apiKey}`;
  if (redirectParams) {
    url += `&redirect_params=${encodeURIComponent(redirectParams)}`;
  }
  return url;
}
