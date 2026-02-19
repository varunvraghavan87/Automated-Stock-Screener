// GET /api/kite/status — Check if user has an active Kite session

import { NextResponse } from "next/server";
import { getSession } from "@/lib/kite-session";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({
      connected: false,
      configured: !!process.env.KITE_API_KEY,
    });
  }

  return NextResponse.json({
    connected: true,
    configured: true,
    userId: session.userId,
    loginTime: session.loginTime,
  });
}
