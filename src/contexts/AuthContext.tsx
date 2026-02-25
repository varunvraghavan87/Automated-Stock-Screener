"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User, Session, SupabaseClient } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: string | null;
  approvalStatus: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);

  // Store supabase client in a ref so it's created once
  const supabaseRef = useRef<SupabaseClient | null>(null);
  if (supabaseRef.current === null) {
    supabaseRef.current = createSupabaseBrowserClient();
  }
  const supabase = supabaseRef.current;

  useEffect(() => {
    // If Supabase is not configured (e.g., during build), skip auth
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get the initial session
    const getInitialSession = async () => {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();
        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        // Fetch user profile via server API (avoids browser-side RLS issues)
        if (initialSession?.user) {
          try {
            const res = await fetch("/api/auth/profile", {
              credentials: "same-origin",
            });
            if (res.ok) {
              const profile = await res.json();
              setRole(profile.role);
              setApprovalStatus(profile.approvalStatus);
            }
          } catch (profileError) {
            console.error("Failed to fetch profile:", profileError);
          }
        }
      } catch (error) {
        console.error("Error getting initial session:", error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        try {
          const res = await fetch("/api/auth/profile", {
            credentials: "same-origin",
          });
          if (res.ok) {
            const profile = await res.json();
            setRole(profile.role);
            setApprovalStatus(profile.approvalStatus);
          }
        } catch (profileError) {
          console.error("Failed to fetch profile:", profileError);
        }
      } else {
        setRole(null);
        setApprovalStatus(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    // Use server-side proxy to bypass ISP DNS blocking of supabase.co
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch (err) {
      console.error("Sign-out API error:", err);
    }
    setUser(null);
    setSession(null);
    setRole(null);
    setApprovalStatus(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, role, approvalStatus, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
