/**
 * admin.ts — Service role Supabase client (bypasses Row Level Security)
 *
 * PURPOSE:
 *   Creates a Supabase client using the service_role key, which has FULL
 *   access to all data regardless of RLS policies. This is necessary for:
 *     - The video-processor worker (needs to update any project's segments/variants)
 *     - The embed API (needs to read variants for any project, not just the user's)
 *     - Admin operations that cross user boundaries
 *
 * SECURITY:
 *   The service_role key is a secret and must NEVER be exposed to the browser.
 *   This module should only be imported in:
 *     - API routes (server-side)
 *     - The video-processor worker
 *   Never import this in a "use client" component.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
