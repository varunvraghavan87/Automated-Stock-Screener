// GET /api/kite/auth — Initiates Kite Connect OAuth login
// Redirects user to Zerodha login page

import { NextResponse } from "next/server";
import { getKiteLoginURL } from "@/lib/kite-session";

export async function GET() {
  const apiKey = process.env.KITE_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "KITE_API_KEY not configured on server" },
      { status: 500 }
    );
  }

  const loginURL = getKiteLoginURL(apiKey);

  return NextResponse.redirect(loginURL);
}
