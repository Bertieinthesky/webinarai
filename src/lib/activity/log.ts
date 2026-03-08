/**
 * log.ts — Project activity logger
 *
 * Append-only ledger of project management events.
 * Fire-and-forget: never throws, never blocks the calling operation.
 * Works from both Next.js API routes and the standalone worker.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityEventType =
  | "segment_uploaded"
  | "segment_deleted"
  | "processing_started"
  | "processing_restarted"
  | "segment_normalized"
  | "variant_rendered"
  | "variant_failed"
  | "segment_failed"
  | "project_ready";

interface LogActivityParams {
  supabase: SupabaseClient;
  projectId: string;
  eventType: ActivityEventType;
  title: string;
  detail?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logActivity({
  supabase,
  projectId,
  eventType,
  title,
  detail,
  metadata,
}: LogActivityParams) {
  try {
    await supabase.from("project_activity").insert({
      project_id: projectId,
      event_type: eventType,
      title,
      detail: detail ?? null,
      metadata: metadata ?? {},
    });
  } catch (err) {
    console.error(
      `[activity] Failed to log "${eventType}" for ${projectId}:`,
      err instanceof Error ? err.message : err
    );
  }
}
