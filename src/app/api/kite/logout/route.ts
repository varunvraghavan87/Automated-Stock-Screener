// POST /api/kite/logout — Clear the Kite session

import { NextResponse } from "next/server";
import { clearSession } from "@/lib/kite-session";

export async function POST() {
  await clearSession();
  return NextResponse.json({ success: true });
}
