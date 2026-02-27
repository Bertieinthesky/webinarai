/**
 * middleware.ts — Auth gate + Supabase session refresh
 *
 * PURPOSE:
 *   1. Refreshes the Supabase auth session on every request (keeps JWT alive)
 *   2. Protects dashboard routes using the simple password cookie
 *
 * PUBLIC ROUTES (no auth required):
 *   - /login (password gate)
 *   - /e/* (embed pages — public-facing player pages)
 *   - /api/* (all API routes handle their own auth)
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Refresh Supabase session (keeps JWT alive between requests)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // This call refreshes the session if expired
  await supabase.auth.getUser();

  // Check the simple password gate cookie
  const isAuthenticated =
    request.cookies.get("webinar_auth")?.value === "authenticated";

  const isPublicRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/callback") ||
    request.nextUrl.pathname.startsWith("/e/") ||
    request.nextUrl.pathname.startsWith("/api/");

  if (!isAuthenticated && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If authenticated and on login page, redirect to dashboard
  if (isAuthenticated && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
