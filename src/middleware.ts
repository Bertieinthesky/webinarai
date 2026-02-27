/**
 * middleware.ts — Next.js middleware entry point
 *
 * PURPOSE:
 *   Intercepts every incoming request to refresh the Supabase auth session
 *   and redirect unauthenticated users away from protected routes.
 *
 * HOW IT WORKS:
 *   Delegates all logic to `updateSession` in lib/supabase/middleware.ts.
 *   The matcher config below ensures this middleware runs on all routes
 *   EXCEPT static assets (images, fonts, Next.js internals) and the
 *   standalone embed scripts (embed.js, embed-player.js).
 *
 * ARCHITECTURE:
 *   - Delegates to: lib/supabase/middleware.ts (session refresh + auth guard)
 *   - Runs on: Every non-static request
 *   - Skips: _next/static, _next/image, favicon, embed scripts, image files
 */

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|embed\\.js|embed-player\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
