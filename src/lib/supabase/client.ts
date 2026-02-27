/**
 * client.ts — Browser-side Supabase client
 *
 * PURPOSE:
 *   Creates a Supabase client for use in React components (client-side).
 *   This client respects Row Level Security (RLS) — it can only access
 *   data that belongs to the currently authenticated user.
 *
 * WHEN TO USE:
 *   In any "use client" component that needs to read/write data directly.
 *   For example: the dashboard project list, upload page, preview page.
 *
 * WHEN NOT TO USE:
 *   - In API routes or Server Components → use server.ts instead
 *   - In the video worker or admin operations → use admin.ts instead
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
