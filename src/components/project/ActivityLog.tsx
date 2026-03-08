/**
 * ActivityLog — Project activity timeline feed
 *
 * Collapsible section showing recent project events in chronological order.
 * Fetches from project_activity table. Subscribes to realtime inserts
 * so new events appear live during processing.
 */

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface ActivityEvent {
  id: string;
  event_type: string;
  title: string;
  detail: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ActivityLogProps {
  projectId: string;
}

const EVENT_COLORS: Record<string, string> = {
  segment_uploaded: "bg-sky-400",
  segment_deleted: "bg-zinc-400",
  processing_started: "bg-amber-400",
  processing_restarted: "bg-amber-400",
  segment_normalized: "bg-emerald-400",
  variant_rendered: "bg-emerald-400",
  variant_failed: "bg-red-400",
  segment_failed: "bg-red-400",
  project_ready: "bg-primary",
};

export function ActivityLog({ projectId }: ActivityLogProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("project_activity")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50);
    setEvents((data as ActivityEvent[]) || []);
    setLoading(false);
  }, [projectId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel(`activity-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_activity",
          filter: `project_id=eq.${projectId}`,
        },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, supabase, load]);

  if (loading || events.length === 0) return null;

  const displayEvents = expanded ? events : events.slice(0, 5);

  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-accent/30"
      >
        <div className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Activity
          </span>
          <span className="text-[10px] text-muted-foreground/50">
            {events.length}
          </span>
        </div>
        <svg
          className={`h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Timeline */}
      <div className="border-t border-border px-4 py-2">
        <div className="space-y-0">
          {displayEvents.map((event, i) => (
            <div key={event.id} className="flex gap-3 py-1.5">
              {/* Timeline dot + connector */}
              <div className="relative flex flex-col items-center pt-1">
                <div className={`h-1.5 w-1.5 rounded-full ${EVENT_COLORS[event.event_type] || "bg-muted-foreground/30"}`} />
                {i < displayEvents.length - 1 && (
                  <div className="flex-1 w-px bg-border mt-1" />
                )}
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-foreground/60 leading-tight">{event.title}</p>
                  {event.detail && (
                    <p className="text-[11px] text-muted-foreground/40 truncate leading-tight">{event.detail}</p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground/30 whitespace-nowrap tabular-nums shrink-0">
                  {formatRelativeTime(event.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {events.length > 5 && !expanded && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            className="mt-1 text-[11px] text-muted-foreground/30 hover:text-muted-foreground/50 transition"
          >
            Show {events.length - 5} more...
          </button>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
