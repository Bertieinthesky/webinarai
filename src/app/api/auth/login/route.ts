/**
 * api/auth/login — Simple password gate + Supabase session
 *
 * Verifies the gate password, then signs into Supabase as the
 * configured user so all client-side queries and RLS still work.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

const GATE_PASSWORD = "webinar123";
const SUPABASE_EMAIL = "tyler@rocketfunnels.com";
const SUPABASE_PASSWORD = "webinar123";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (password !== GATE_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  // Create the response we'll return — all cookies go on this
  const response = NextResponse.json({ ok: true });

  // Create Supabase client that sets cookies on our response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Try signing in to Supabase
  let { error } = await supabase.auth.signInWithPassword({
    email: SUPABASE_EMAIL,
    password: SUPABASE_PASSWORD,
  });

  // If sign-in fails (e.g. password mismatch), reset password via admin and retry
  if (error) {
    try {
      const admin = createAdminClient();
      const { data: { users } } = await admin.auth.admin.listUsers();
      const user = users.find((u) => u.email === SUPABASE_EMAIL);

      if (user) {
        await admin.auth.admin.updateUserById(user.id, {
          password: SUPABASE_PASSWORD,
        });
        // Retry sign-in
        const retry = await supabase.auth.signInWithPassword({
          email: SUPABASE_EMAIL,
          password: SUPABASE_PASSWORD,
        });
        error = retry.error;
      }
    } catch {
      // Admin fallback failed — continue without Supabase session
    }
  }

  // Set the simple gate cookie
  response.cookies.set("webinar_auth", "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
