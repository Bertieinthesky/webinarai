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
 * 103 EARLY HINTS:
 *   For embed pages, adds HTTP Link preload headers to the response. CDNs
 *   like Cloudflare and Vercel cache these headers and send them as HTTP 103
 *   (Early Hints) on subsequent requests — the browser starts fetching the
 *   video and poster BEFORE the server even responds with the HTML.
 *
 *   To enable: Turn on "Early Hints" in your Cloudflare dashboard, or deploy
 *   to Vercel (automatic). First-time visitors still benefit from the
 *   <link rel="preload"> tags in the HTML.
 *
 * ARCHITECTURE:
 *   - Delegates to: lib/supabase/middleware.ts (session refresh + auth guard)
 *   - Runs on: Every non-static request
 *   - Skips: _next/static, _next/image, favicon, embed scripts, image files
 */

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { generateViewerId, assignVariant } from "@/lib/variant/assignment";

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

  // ─── 103 Early Hints: add Link preload headers for embed pages ───
  // CDNs cache these Link headers and send them as HTTP 103 on subsequent
  // requests, so the browser starts fetching video while the origin processes.
  if (request.nextUrl.pathname.startsWith("/e/")) {
    await addEarlyHints(request, response, newViewerId);
  }

  return response;
}

/**
 * Add Link preload headers for embed pages.
 * Uses a lightweight Supabase REST API fetch (no SDK import) to keep
 * the middleware bundle small. Best-effort — never blocks the response.
 */
async function addEarlyHints(
  request: NextRequest,
  response: Response,
  newViewerId: string | null
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const r2PublicUrl = process.env.R2_PUBLIC_URL;
    if (!supabaseUrl || !serviceKey || !r2PublicUrl) return;

    const slug = request.nextUrl.pathname.split("/e/")[1]?.split(/[/?#]/)[0];
    if (!slug) return;

    const viewerId =
      request.cookies.get("wai_vid")?.value || newViewerId;
    if (!viewerId) return;

    // Fetch project by slug
    const projectRes = await fetch(
      `${supabaseUrl}/rest/v1/projects?slug=eq.${encodeURIComponent(slug)}&status=eq.ready&select=id`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );
    if (!projectRes.ok) return;
    const projects = await projectRes.json();
    if (!projects?.[0]?.id) return;
    const projectId = projects[0].id;

    // Fetch rendered variants
    const variantRes = await fetch(
      `${supabaseUrl}/rest/v1/variants?project_id=eq.${projectId}&status=eq.rendered&select=id,hook_clip_storage_key&order=variant_code`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );
    if (!variantRes.ok) return;
    const variants = await variantRes.json();
    if (!variants?.length) return;

    // Assign variant (same deterministic hash as page.tsx)
    const variantIndex = assignVariant(viewerId, projectId, variants.length);
    const variant = variants[variantIndex];
    if (!variant) return;

    // Build URLs and add Link headers
    const posterUrl = `${r2PublicUrl}/projects/${projectId}/variants/${variant.id}/poster.jpg`;
    response.headers.append(
      "Link",
      `<${posterUrl}>; rel=preload; as=image`
    );

    if (variant.hook_clip_storage_key) {
      const hookUrl = `${r2PublicUrl}/${variant.hook_clip_storage_key}`;
      response.headers.append(
        "Link",
        `<${hookUrl}>; rel=preload; as=video; type="video/mp4"`
      );
    }
  } catch {
    // Early hints are best-effort — never block the response
  }
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|embed\\.js|embed-player\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
