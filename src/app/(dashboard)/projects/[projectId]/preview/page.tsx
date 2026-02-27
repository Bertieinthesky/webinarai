/**
 * projects/[projectId]/preview/page.tsx — Variant preview player
 *
 * PURPOSE:
 *   Lets the marketer preview any rendered variant in-browser before
 *   deploying the embed code. Two viewing modes:
 *     1. Smart Player — The dual-video player that end-users will see
 *     2. Simple Player — Standard HTML5 video with native controls
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmbedPlayer } from "@/components/player/EmbedPlayer";
import { storageUrl } from "@/lib/storage/urls";
import { variantPosterKey } from "@/lib/storage/keys";
import { formatDuration, formatFileSize } from "@/lib/utils/format";
import type { Database } from "@/lib/supabase/types";

type Variant = Database["public"]["Tables"]["variants"]["Row"];

export default function PreviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [useSmartPlayer, setUseSmartPlayer] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("variants")
        .select("*")
        .eq("project_id", projectId)
        .eq("status", "rendered")
        .order("variant_code");
      if (data && data.length > 0) {
        setVariants(data as Variant[]);
        setSelectedId((data as Variant[])[0].id);
      }
    }
    load();
  }, [projectId, supabase]);

  const selected = variants.find((v) => v.id === selectedId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Preview Variants</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Watch any rendered variant combination
          </p>
        </div>
        <Link href={`/projects/${projectId}`}>
          <Button variant="outline">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Project
          </Button>
        </Link>
      </div>

      {variants.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">
              No rendered variants yet. Process your segments first.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            <Card className="border-border bg-card overflow-hidden">
              <CardContent className="p-0">
                {selected && useSmartPlayer && selected.hook_clip_storage_key && selected.video_storage_key ? (
                  <div key={selected.id}>
                    <EmbedPlayer
                      hookClipUrl={storageUrl(selected.hook_clip_storage_key)}
                      fullVideoUrl={storageUrl(selected.video_storage_key)}
                      hookEndTimeMs={selected.hook_end_time_ms || 0}
                      posterUrl={storageUrl(variantPosterKey(projectId, selected.id))}
                      variantId={selected.id}
                      projectSlug="preview"
                    />
                  </div>
                ) : selected?.video_storage_key ? (
                  <video
                    key={selected.id}
                    controls
                    preload="auto"
                    className="aspect-video w-full bg-black"
                    poster={storageUrl(variantPosterKey(projectId, selected.id))}
                    src={storageUrl(selected.video_storage_key)}
                  />
                ) : null}
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono text-base font-semibold text-foreground">
                      {selected?.variant_code}
                    </h3>
                    {selected && (
                      <div className="flex gap-3 text-sm text-muted-foreground">
                        {selected.video_duration_ms && (
                          <span>{formatDuration(selected.video_duration_ms)}</span>
                        )}
                        {selected.video_size_bytes && (
                          <span>{formatFileSize(selected.video_size_bytes)}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Player mode toggle */}
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
                <button
                  onClick={() => setUseSmartPlayer(true)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                    useSmartPlayer
                      ? "bg-primary/15 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Smart Player
                </button>
                <button
                  onClick={() => setUseSmartPlayer(false)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                    !useSmartPlayer
                      ? "bg-primary/15 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Simple Player
                </button>
              </div>
              <span className="text-xs text-muted-foreground ml-1">
                {useSmartPlayer
                  ? "Hook preloading + instant playback (what viewers see)"
                  : "Standard controls for scrubbing/debugging"}
              </span>
            </div>
          </div>

          <div>
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-[15px] font-medium text-foreground">
                  Select Variant
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedId(v.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-all duration-150 ${
                      v.id === selectedId
                        ? "border-primary/50 bg-primary/10"
                        : "border-border hover:border-muted-foreground/30 hover:bg-accent/50"
                    }`}
                  >
                    <span className={`font-mono text-sm ${v.id === selectedId ? "text-primary" : "text-foreground/80"}`}>
                      {v.variant_code}
                    </span>
                    {v.video_duration_ms && (
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(v.video_duration_ms)}
                      </span>
                    )}
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
