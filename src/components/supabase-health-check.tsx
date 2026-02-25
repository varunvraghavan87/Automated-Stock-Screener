"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Pings the Supabase project URL on mount and shows a warning banner
 * if the project is unreachable (e.g., paused free-tier project).
 * This helps users understand "Failed to fetch" errors.
 */
export function SupabaseHealthCheck() {
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) {
      setUnreachable(true);
      return;
    }

    // Ping the Supabase REST endpoint with a lightweight HEAD request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch(`${url}/rest/v1/`, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
    })
      .then((res) => {
        // Any response (even 4xx) means the server is reachable
        clearTimeout(timeoutId);
        if (!res.ok && res.status === 0) {
          setUnreachable(true);
        }
      })
      .catch(() => {
        clearTimeout(timeoutId);
        setUnreachable(true);
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  if (!unreachable) return null;

  return (
    <div className="w-full max-w-md mb-4 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <div>
        <p className="font-medium">Authentication service unreachable</p>
        <p className="mt-1 text-xs opacity-80">
          The database project may be paused or offline. If you&apos;re the admin, check the{" "}
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-100"
          >
            Supabase Dashboard
          </a>{" "}
          and restore the project if it&apos;s paused.
        </p>
      </div>
    </div>
  );
}
