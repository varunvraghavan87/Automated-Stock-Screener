// GET /api/kite/auth — Initiates Kite Connect OAuth login
// Generates CSRF state token and stores in cookie for callback validation

import { NextResponse } from "next/server";
import { getKiteLoginURL } from "@/lib/kite-session";
import { cookies } from "next/headers";

export async function GET() {
  const apiKey = process.env.KITE_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Kite Connect is not configured on this server" },
      { status: 500 }
    );
  }

  // Generate a CSRF state token for OAuth callback validation
  const stateBytes = new Uint8Array(32);
  crypto.getRandomValues(stateBytes);
  const state = Array.from(stateBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

  // Store state in HTTP-only cookie for validation in callback
  const cookieStore = await cookies();
  cookieStore.set("kite_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300, // 5 minutes — enough time to complete OAuth flow
    path: "/",
  });

  // Pass state as redirect_params so Kite returns it in callback
  const loginURL = getKiteLoginURL(apiKey, `state=${state}`);

  return NextResponse.redirect(loginURL);
}
