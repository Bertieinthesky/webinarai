/**
 * projects/[projectId]/embed/page.tsx — Embed code generator
 *
 * PURPOSE:
 *   Provides copy-pasteable embed code for deploying the A/B test on
 *   any website. Shows three options:
 *     1. Iframe embed (works everywhere, just paste into HTML)
 *     2. Direct link (shareable URL for testing)
 *     3. Live preview (iframe preview right in the dashboard)
 */

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/types";

type Project = Database["public"]["Tables"]["projects"]["Row"];

function CopyIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
  );
}

export default function EmbedPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();
      setProject(data as Project | null);
    }
    load();
  }, [projectId, supabase]);

  if (!project) return null;

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  const embedCode = `<!-- webinar.ai Video Player -->
<div style="position: relative; width: 100%; padding-top: 56.25%; overflow: hidden;">
  <iframe
    src="${appUrl}/e/${project.slug}"
    frameborder="0"
    allow="autoplay; fullscreen"
    allowfullscreen
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;">
  </iframe>
</div>`;

  const directUrl = `${appUrl}/e/${project.slug}`;

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Embed Code</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add this to your website to run the A/B test
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

      {project.status !== "ready" && project.status !== "processing" ? (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Process your variants first before getting the embed code.
            </p>
            <Link href={`/projects/${projectId}`}>
              <Button variant="outline">Go to Project</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-[15px] font-medium text-foreground">
                Iframe Embed
              </CardTitle>
              <CardDescription>
                Paste this into any HTML page. Works everywhere.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <pre className="overflow-x-auto rounded-xl bg-background p-4 text-[13px] leading-relaxed text-foreground/70 border border-border">
                  <code>{embedCode}</code>
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute right-3 top-3"
                  onClick={() => copyToClipboard(embedCode, "Embed code")}
                >
                  <CopyIcon />
                  Copy
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-[15px] font-medium text-foreground">
                Direct Link
              </CardTitle>
              <CardDescription>
                Share this URL directly to test the video player
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <code className="flex-1 rounded-xl bg-background border border-border px-4 py-2.5 text-[13px] text-primary">
                  {directUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(directUrl, "Direct link")}
                >
                  <CopyIcon />
                  Copy
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-[15px] font-medium text-foreground">
                Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-xl border border-border">
                <iframe
                  src={`/e/${project.slug}`}
                  className="aspect-video w-full"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
