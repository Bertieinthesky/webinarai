/**
 * middleware.ts — Next.js middleware entry point
 *
 * PURPOSE:
 *   Intercepts every incoming request to refresh the Supabase auth session
 *   and redirect unauthenticated users away from protected routes.
 *
 * VIEWER ID COOKIE:
 *   For embed pages (/e/*), generates a viewer ID cookie (wai_vid) if one
 *   doesn't exist. This cookie is set on the REQUEST (so server components
 *   can read it in the same request cycle) and on the RESPONSE (so the
 *   browser stores it for consistent A/B variant assignment on future visits).
 *
 * ARCHITECTURE:
 *   - Delegates to: lib/supabase/middleware.ts (session refresh + auth guard)
 *   - Runs on: Every non-static request
 *   - Skips: _next/static, _next/image, favicon, embed scripts, image files
 */

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { generateViewerId } from "@/lib/variant/assignment";

export async function middleware(request: NextRequest) {
  // Generate viewer ID for embed pages so the server component can read it
  // on the very first visit (before the browser has the cookie)
  let newViewerId: string | null = null;
  if (
    request.nextUrl.pathname.startsWith("/e/") &&
    !request.cookies.get("wai_vid")
  ) {
    newViewerId = generateViewerId();
    request.cookies.set("wai_vid", newViewerId);
  }

  const response = await updateSession(request);

  // Persist the new viewer ID cookie to the browser for future visits
  if (newViewerId) {
    response.cookies.set("wai_vid", newViewerId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 365 * 24 * 60 * 60, // 1 year
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|embed\\.js|embed-player\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
