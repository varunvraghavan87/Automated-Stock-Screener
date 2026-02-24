// CRUD for per-user Kite Connect API credentials
// GET: Check if user has credentials (returns masked key, never the secret)
// POST: Store/update API key + secret (encrypted)
// DELETE: Remove stored credentials

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  checkUserHasCredentials,
  storeUserKiteCredentials,
  deleteUserKiteCredentials,
} from "@/lib/kite-credentials";
import { KiteCredentialsSchema } from "@/lib/validation";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await checkUserHasCredentials();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    const raw = await request.json();
    body = KiteCredentialsSchema.parse(raw);
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid credentials format. API Key and Secret must be alphanumeric.",
      },
      { status: 400 }
    );
  }

  const result = await storeUserKiteCredentials(body.apiKey, body.apiSecret);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await deleteUserKiteCredentials();

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
