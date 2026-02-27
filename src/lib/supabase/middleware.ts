/**
 * middleware.ts — Supabase session management for Next.js middleware
 *
 * PURPOSE:
 *   Refreshes the Supabase auth session on every request and protects
 *   dashboard routes from unauthenticated access. Public routes (embed
 *   pages, tracking API, auth pages) are excluded from protection.
 *
 * HOW IT WORKS:
 *   1. Reads the auth session from cookies
 *   2. Refreshes the session if it's expired (Supabase uses JWTs with short TTL)
 *   3. If the user is NOT authenticated and the route is protected,
 *      redirects to /login
 *   4. If the user IS authenticated or the route is public, passes through
 *
 * PUBLIC ROUTES (no auth required):
 *   - /login, /signup, /callback (auth flow)
 *   - /e/* (embed pages — these are public-facing player pages)
 *   - /api/embed/* (variant assignment API — called by embed player)
 *   - /api/track (event tracking — called by embed player)
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login (except public routes)
  const isPublicRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/callback") ||
    request.nextUrl.pathname.startsWith("/e/") ||
    request.nextUrl.pathname.startsWith("/api/embed") ||
    request.nextUrl.pathname.startsWith("/api/track");

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
