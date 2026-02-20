import { NextResponse } from "next/server";
import { getKiteLockStatus } from "@/lib/kite-lock";
import { isIndianMarketOpen, getMarketStatus } from "@/lib/market-hours";

// GET /api/prices/status — Check Kite lock status and market hours
export async function GET() {
  const lockStatus = getKiteLockStatus();
  const marketStatus = getMarketStatus();

  return NextResponse.json({
    lock: lockStatus,
    market: {
      isOpen: isIndianMarketOpen(),
      label: marketStatus.label,
    },
  });
}
