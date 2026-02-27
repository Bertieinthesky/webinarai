/**
 * server.ts — Server-side Supabase client (for API routes and Server Components)
 *
 * PURPOSE:
 *   Creates a Supabase client that can read/write cookies for session management.
 *   This client also respects RLS — it operates as the authenticated user.
 *
 * WHEN TO USE:
 *   In Next.js API routes and Server Components where you need to access
 *   data scoped to the current user (e.g., listing their projects).
 *
 * WHEN NOT TO USE:
 *   - In "use client" components → use client.ts instead
 *   - For admin/worker operations that bypass RLS → use admin.ts instead
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}
