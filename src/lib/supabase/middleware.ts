import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured, allow all requests through
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Do NOT use getSession() here — it reads from storage (cookies)
  // and is not guaranteed to be authentic. Use getUser() which validates with
  // the Supabase Auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const isAuthRoute = pathname.startsWith("/auth");
  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/api/auth");

  // Allow static assets and API auth routes through
  if (isStaticAsset) {
    return supabaseResponse;
  }

  // If not authenticated and trying to access a protected route, redirect to login
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // ─── Approval Status Check ──────────────────────────────────────────
  // Authenticated users must have an approved profile to access the app.
  if (user) {
    // Routes that pending/rejected users ARE allowed to access
    const pendingAllowedPaths = [
      "/auth/pending",
      "/auth/callback",
      "/auth/update-password",
    ];
    const isAllowedForPending =
      pendingAllowedPaths.includes(pathname) ||
      pathname.startsWith("/api/auth");

    // Query the user's approval status (indexed on user_id UNIQUE — sub-5ms)
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("approval_status, role")
      .eq("user_id", user.id)
      .single();

    const status = profile?.approval_status;

    // Block unapproved users from accessing the app
    if (!status || status === "pending" || status === "rejected") {
      // API routes: return 403 JSON (not redirect)
      if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
        return NextResponse.json(
          { error: "Account not approved" },
          { status: 403 }
        );
      }
      // Page routes: redirect to pending page
      if (!isAllowedForPending) {
        const url = request.nextUrl.clone();
        url.pathname = "/auth/pending";
        if (status === "rejected") {
          url.searchParams.set("status", "rejected");
        }
        return NextResponse.redirect(url);
      }
      return supabaseResponse;
    }

    // Admin route protection — only admin role can access /admin/*
    if (pathname.startsWith("/admin") && profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    // Approved user on auth pages (except callback/update-password) → redirect to home
    if (
      isAuthRoute &&
      pathname !== "/auth/callback" &&
      pathname !== "/auth/update-password"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
