// Per-user Kite Connect credential management with AES-256-GCM encryption
// Credentials are stored in Supabase with the API secret encrypted at rest.
// The encryption key lives only in the server env var KITE_CREDENTIALS_ENCRYPTION_KEY.

import { createServerSupabaseClient } from "@/lib/supabase/server";

// ─── Encryption ─────────────────────────────────────────────────────────

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12; // 96 bits for AES-GCM

function getEncryptionKey(): Uint8Array {
  const hex = process.env.KITE_CREDENTIALS_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "KITE_CREDENTIALS_ENCRYPTION_KEY must be a 64-character hex string"
    );
  }
  return new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
}

async function importKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    rawKey.buffer as ArrayBuffer,
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await importKey(getEncryptionKey());
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );
  // Store as base64(iv + ciphertext + auth_tag)
  // AES-GCM appends the 16-byte auth tag to the ciphertext automatically
  const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptSecret(encrypted: string): Promise<string> {
  const key = await importKey(getEncryptionKey());
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plainBuffer);
}

// ─── Credential CRUD ────────────────────────────────────────────────────

export interface KiteCredentials {
  apiKey: string;
  apiSecret: string;
}

/**
 * Retrieve the authenticated user's Kite credentials from the database.
 * Returns null if no credentials are stored or if the user is not authenticated.
 */
export async function getUserKiteCredentials(): Promise<KiteCredentials | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("kite_credentials")
    .select("kite_api_key, kite_api_secret_encrypted")
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;

  try {
    const apiSecret = await decryptSecret(data.kite_api_secret_encrypted);
    return { apiKey: data.kite_api_key, apiSecret };
  } catch {
    console.error("Failed to decrypt Kite API secret for user", user.id);
    return null;
  }
}

/**
 * Check if the authenticated user has stored Kite credentials.
 * Returns { hasCredentials, maskedApiKey } without decrypting the secret.
 */
export async function checkUserHasCredentials(): Promise<{
  hasCredentials: boolean;
  maskedApiKey?: string;
}> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { hasCredentials: false };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hasCredentials: false };

  const { data, error } = await supabase
    .from("kite_credentials")
    .select("kite_api_key")
    .eq("user_id", user.id)
    .single();

  if (error || !data) return { hasCredentials: false };

  // Mask: show first 4 and last 4 chars
  const key = data.kite_api_key;
  const masked =
    key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : "****";

  return { hasCredentials: true, maskedApiKey: masked };
}

/**
 * Store or update the authenticated user's Kite credentials.
 */
export async function storeUserKiteCredentials(
  apiKey: string,
  apiSecret: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { success: false, error: "Server not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  let encryptedSecret: string;
  try {
    encryptedSecret = await encryptSecret(apiSecret);
  } catch (encErr) {
    console.error("Failed to encrypt Kite API secret:", encErr);
    return {
      success: false,
      error: "Encryption failed — check KITE_CREDENTIALS_ENCRYPTION_KEY env var.",
    };
  }

  const { error } = await supabase.from("kite_credentials").upsert(
    {
      user_id: user.id,
      kite_api_key: apiKey,
      kite_api_secret_encrypted: encryptedSecret,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("Failed to store Kite credentials:", error);
    return {
      success: false,
      error: `Database error: ${error.message}`,
    };
  }

  return { success: true };
}

/**
 * Delete the authenticated user's Kite credentials.
 */
export async function deleteUserKiteCredentials(): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { success: false, error: "Server not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("kite_credentials")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to delete Kite credentials:", error);
    return { success: false, error: "Failed to delete credentials" };
  }

  return { success: true };
}
