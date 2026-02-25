"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Pings the server-side auth profile endpoint on mount and shows a warning
 * banner if the backend is unreachable (e.g., paused Supabase project or
 * ISP blocking supabase.co).
 */
export function SupabaseHealthCheck() {
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Ping our own API (server-side), which in turn contacts Supabase
    fetch("/api/auth/profile", {
      signal: controller.signal,
      credentials: "same-origin",
    })
      .then((res) => {
        clearTimeout(timeoutId);
        // 503 = Supabase not configured; 500 = server error reaching Supabase
        if (res.status === 503 || res.status === 500) {
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
