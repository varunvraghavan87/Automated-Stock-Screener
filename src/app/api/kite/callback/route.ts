// GET /api/kite/callback — Kite Connect OAuth callback
// Receives request_token, exchanges for access_token, stores session
// Errors are stored in a short-lived cookie (not URL params) to avoid leaking info

import { NextResponse } from "next/server";
import { exchangeToken, storeSession } from "@/lib/kite-session";
import { cookies } from "next/headers";

const FLASH_COOKIE_OPTIONS = {
  httpOnly: false, // Readable by client JS to display error
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 30, // 30 seconds — just long enough to read and display
  path: "/",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestToken = url.searchParams.get("request_token");
  const status = url.searchParams.get("status");

  // Determine the app's base URL for redirect
  const baseUrl = url.origin;
  const cookieStore = await cookies();

  if (status !== "success" || !requestToken) {
    cookieStore.set("kite_flash_error", "Login cancelled or failed", FLASH_COOKIE_OPTIONS);
    return NextResponse.redirect(`${baseUrl}/screener`);
  }

  // Validate CSRF state parameter
  const callbackState = url.searchParams.get("state");
  const storedState = cookieStore.get("kite_oauth_state")?.value;

  // Clean up state cookie regardless of validation result
  cookieStore.delete("kite_oauth_state");

  if (!storedState || !callbackState || storedState !== callbackState) {
    console.error("Kite OAuth CSRF validation failed: state mismatch");
    cookieStore.set("kite_flash_error", "Authentication failed. Please try again.", FLASH_COOKIE_OPTIONS);
    return NextResponse.redirect(`${baseUrl}/screener`);
  }

  const apiKey = process.env.KITE_API_KEY;
  const apiSecret = process.env.KITE_API_SECRET;

  if (!apiKey || !apiSecret) {
    cookieStore.set("kite_flash_error", "Server configuration error", FLASH_COOKIE_OPTIONS);
    return NextResponse.redirect(`${baseUrl}/screener`);
  }

  try {
    // Exchange request_token for access_token
    const { accessToken, userId } = await exchangeToken(
      apiKey,
      apiSecret,
      requestToken
    );

    // Store session in HTTP-only cookie
    await storeSession({
      apiKey,
      accessToken,
      userId,
      loginTime: new Date().toISOString(),
    });

    // Redirect back to screener with success
    return NextResponse.redirect(`${baseUrl}/screener?kite_connected=true`);
  } catch (error) {
    console.error("Kite token exchange failed:", error);
    cookieStore.set("kite_flash_error", "Authentication failed. Please try again.", FLASH_COOKIE_OPTIONS);
    return NextResponse.redirect(`${baseUrl}/screener`);
  }
}
