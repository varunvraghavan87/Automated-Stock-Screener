"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: { user: AuthUser } | null;
  loading: boolean;
  role: string | null;
  approvalStatus: string | null;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);

  // Fetch auth state entirely from our own server API.
  // This avoids the browser Supabase client which can't reach supabase.co
  // when the ISP (e.g. Jio) DNS-poisons *.supabase.co domains.
  const fetchAuthState = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/profile", {
        credentials: "same-origin",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          setRole(data.role);
          setApprovalStatus(data.approvalStatus);
        } else {
          setUser(null);
          setRole(null);
          setApprovalStatus(null);
        }
      } else {
        setUser(null);
        setRole(null);
        setApprovalStatus(null);
      }
    } catch (err) {
      console.error("Failed to fetch auth state:", err);
      setUser(null);
      setRole(null);
      setApprovalStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch auth state on mount
  useEffect(() => {
    fetchAuthState();
  }, [fetchAuthState]);

  // Refresh auth state when user returns to the tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchAuthState();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchAuthState]);

  const signOut = useCallback(async () => {
    // Use server-side proxy to bypass ISP DNS blocking of supabase.co
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch (err) {
      console.error("Sign-out API error:", err);
    }
    setUser(null);
    setRole(null);
    setApprovalStatus(null);
  }, []);

  // Allow pages (e.g. login) to trigger an auth state refresh after server-side login
  const refreshAuth = useCallback(async () => {
    setLoading(true);
    await fetchAuthState();
  }, [fetchAuthState]);

  const session = user ? { user } : null;

  return (
    <AuthContext.Provider
      value={{ user, session, loading, role, approvalStatus, signOut, refreshAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}
