/**
 * callback/route.ts — OAuth / email confirmation callback handler
 *
 * PURPOSE:
 *   Handles the redirect after email confirmation or OAuth login.
 *   Supabase sends users here with an auth code in the URL query params.
 *   This route exchanges that code for a session (setting auth cookies),
 *   then redirects the user to the app root.
 *
 * FLOW:
 *   1. User clicks confirmation link in email → redirected here with ?code=xxx
 *   2. This route calls supabase.auth.exchangeCodeForSession(code)
 *   3. Supabase sets session cookies on the response
 *   4. User is redirected to the app root (/)
 *
 * ARCHITECTURE:
 *   - Uses: Server Supabase client (lib/supabase/server.ts)
 *   - Called by: Supabase Auth after email confirmation or OAuth flow
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(origin);
}
