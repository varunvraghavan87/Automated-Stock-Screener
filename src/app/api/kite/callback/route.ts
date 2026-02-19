// GET /api/kite/callback — Kite Connect OAuth callback
// Receives request_token, exchanges for access_token, stores session

import { NextResponse } from "next/server";
import { exchangeToken, storeSession } from "@/lib/kite-session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestToken = url.searchParams.get("request_token");
  const status = url.searchParams.get("status");

  // Determine the app's base URL for redirect
  const baseUrl = url.origin;

  if (status !== "success" || !requestToken) {
    // User cancelled login or error occurred
    return NextResponse.redirect(
      `${baseUrl}/screener?kite_error=${encodeURIComponent("Login cancelled or failed")}`
    );
  }

  const apiKey = process.env.KITE_API_KEY;
  const apiSecret = process.env.KITE_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.redirect(
      `${baseUrl}/screener?kite_error=${encodeURIComponent("Server not configured for Kite Connect")}`
    );
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
    const message =
      error instanceof Error ? error.message : "Token exchange failed";
    return NextResponse.redirect(
      `${baseUrl}/screener?kite_error=${encodeURIComponent(message)}`
    );
  }
}
