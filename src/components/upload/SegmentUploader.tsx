/**
 * SegmentUploader.tsx — Drag-and-drop video segment upload component
 *
 * PURPOSE:
 *   Provides the upload interface for a single segment type (hook, body, or CTA).
 *   Three of these are rendered side-by-side on the upload page, one per type.
 *
 * UPLOAD STRATEGY:
 *   - Small files (<100MB): Direct browser-to-R2 upload via presigned URL (fast, simple)
 *   - Large files (>=100MB): Chunked upload through /api/projects/[id]/upload proxy
 *     (4MB chunks, avoids browser XHR timeouts on slow connections)
 */

"use client";

import { useCallback, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatFileSize, formatDuration } from "@/lib/utils/format";
import type { SegmentType, Database } from "@/lib/supabase/types";

type Segment = Database["public"]["Tables"]["segments"]["Row"];

interface SegmentUploaderProps {
  projectId: string;
  type: SegmentType;
  segments: Segment[];
  onUploadComplete: () => void;
}

interface UploadState {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error";
  error?: string;
  label: string;
  segmentId?: string;
}

const typeConfig = {
  hook: {
    title: "Hooks",
    description: "Opening segments that grab attention",
    color: "text-sky-400",
    borderActive: "border-sky-500/30",
    iconBg: "bg-sky-500/10",
  },
  body: {
    title: "Bodies",
    description: "Main content segments",
    color: "text-emerald-400",
    borderActive: "border-emerald-500/30",
    iconBg: "bg-emerald-500/10",
  },
  cta: {
    title: "CTAs",
    description: "Call-to-action closing segments",
    color: "text-violet-400",
    borderActive: "border-violet-500/30",
    iconBg: "bg-violet-500/10",
  },
};

const statusBadge: Record<string, string> = {
  normalized: "bg-emerald-500/10 text-emerald-400",
  failed: "bg-red-500/10 text-red-400",
  uploaded: "bg-zinc-500/10 text-zinc-400",
  normalizing: "bg-amber-500/10 text-amber-400",
};

// Chunked upload threshold: files >= 100MB use chunked upload
const CHUNK_THRESHOLD = 100 * 1024 * 1024;
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks

/**
 * Upload a large file using chunked multipart upload through the API proxy.
 * Each chunk goes through /api/projects/[id]/upload as a 4MB part.
 */
async function chunkedUpload(
  projectId: string,
  storageKey: string,
  file: File,
  contentType: string,
  onProgress: (pct: number) => void,
  abortSignal: AbortSignal,
): Promise<void> {
  const uploadBaseUrl = `/api/projects/${projectId}/upload`;

  // 1. Initiate multipart upload
  const initRes = await fetch(uploadBaseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: storageKey, contentType }),
    signal: abortSignal,
  });
  if (!initRes.ok) throw new Error("Failed to initiate chunked upload");
  const { uploadId } = await initRes.json();

  try {
    // 2. Upload chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const parts: { partNumber: number; etag: string }[] = [];

    for (let i = 0; i < totalChunks; i++) {
      if (abortSignal.aborted) throw new Error("Upload cancelled");

      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const partNumber = i + 1;

      const partRes = await fetch(
        `${uploadBaseUrl}?key=${encodeURIComponent(storageKey)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`,
        {
          method: "PUT",
          body: chunk,
          signal: abortSignal,
        }
      );

      if (!partRes.ok) {
        throw new Error(`Chunk ${partNumber}/${totalChunks} failed (${partRes.status})`);
      }

      const { etag } = await partRes.json();
      parts.push({ partNumber, etag });

      onProgress(Math.round((partNumber / totalChunks) * 100));
    }

    // 3. Complete multipart upload
    const completeRes = await fetch(uploadBaseUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: storageKey, uploadId, parts }),
      signal: abortSignal,
    });
    if (!completeRes.ok) throw new Error("Failed to complete chunked upload");
  } catch (err) {
    // Abort the multipart upload on failure
    await fetch(
      `${uploadBaseUrl}?key=${encodeURIComponent(storageKey)}&uploadId=${encodeURIComponent(uploadId)}`,
      { method: "DELETE" }
    ).catch(() => {});
    throw err;
  }
}

export function SegmentUploader({
  projectId,
  type,
  segments,
  onUploadComplete,
}: SegmentUploaderProps) {
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const config = typeConfig[type];
  const xhrMap = useRef<Map<File, XMLHttpRequest>>(new Map());
  const abortMap = useRef<Map<File, AbortController>>(new Map());

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter((f) =>
        f.type.startsWith("video/")
      );

      for (const file of fileArray) {
        const label = file.name.replace(/\.[^/.]+$/, "");
        const uploadState: UploadState = {
          file,
          progress: 0,
          status: "uploading",
          label,
        };

        setUploads((prev) => [...prev, uploadState]);

        try {
          // 1. Create segment record — API returns presigned R2 upload URL
          const segmentRes = await fetch(
            `/api/projects/${projectId}/segments`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type,
                label,
                filename: file.name,
                size: file.size,
                contentType: file.type,
              }),
            }
          );

          if (!segmentRes.ok) throw new Error("Failed to create segment");
          const { segment, uploadUrl } = await segmentRes.json();

          setUploads((prev) =>
            prev.map((u) =>
              u.file === file ? { ...u, segmentId: segment.id } : u
            )
          );

          // 2. Upload file — choose strategy based on size
          if (file.size >= CHUNK_THRESHOLD) {
            // Large file: chunked upload through API proxy
            const controller = new AbortController();
            abortMap.current.set(file, controller);

            await chunkedUpload(
              projectId,
              segment.original_storage_key,
              file,
              file.type,
              (pct) => {
                setUploads((prev) =>
                  prev.map((u) =>
                    u.file === file ? { ...u, progress: pct } : u
                  )
                );
              },
              controller.signal,
            );

            abortMap.current.delete(file);
          } else {
            // Small file: direct presigned URL upload (XHR for progress)
            await new Promise<void>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhrMap.current.set(file, xhr);

              xhr.upload.addEventListener("progress", (e) => {
                if (e.lengthComputable) {
                  const pct = Math.round((e.loaded / e.total) * 100);
                  setUploads((prev) =>
                    prev.map((u) =>
                      u.file === file ? { ...u, progress: pct } : u
                    )
                  );
                }
              });
              xhr.addEventListener("load", () => {
                xhrMap.current.delete(file);
                if (xhr.status >= 200 && xhr.status < 300) {
                  resolve();
                } else {
                  reject(
                    new Error(
                      `Upload failed (${xhr.status}): ${xhr.responseText?.slice(0, 200) || "No response"}`
                    )
                  );
                }
              });
              xhr.addEventListener("error", () => {
                xhrMap.current.delete(file);
                reject(new Error("Network error — check CORS configuration"));
              });
              xhr.addEventListener("abort", () => {
                xhrMap.current.delete(file);
                reject(new Error("Upload cancelled"));
              });

              xhr.open("PUT", uploadUrl);
              xhr.setRequestHeader("Content-Type", file.type);
              xhr.send(file);
            });
          }

          // 3. Mark segment as uploaded
          await fetch(
            `/api/projects/${projectId}/segments/${segment.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "uploaded" }),
            }
          );

          setUploads((prev) =>
            prev.map((u) =>
              u.file === file
                ? { ...u, status: "complete", progress: 100 }
                : u
            )
          );

          onUploadComplete();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Upload failed";
          if (message === "Upload cancelled") {
            setUploads((prev) => prev.filter((u) => u.file !== file));
          } else {
            setUploads((prev) =>
              prev.map((u) =>
                u.file === file
                  ? { ...u, status: "error", error: message }
                  : u
              )
            );
          }
        }
      }
    },
    [projectId, type, onUploadComplete]
  );

  function cancelUpload(upload: UploadState) {
    // Cancel XHR (small file) or AbortController (chunked)
    const xhr = xhrMap.current.get(upload.file);
    if (xhr) {
      xhr.abort();
    }
    const controller = abortMap.current.get(upload.file);
    if (controller) {
      controller.abort();
      abortMap.current.delete(upload.file);
    }
    if (upload.segmentId) {
      fetch(`/api/projects/${projectId}/segments/${upload.segmentId}`, {
        method: "DELETE",
      }).catch(() => {});
    }
  }

  function dismissUpload(file: File) {
    setUploads((prev) => prev.filter((u) => u.file !== file));
  }

  async function deleteSegment(segmentId: string) {
    setDeleting((prev) => new Set(prev).add(segmentId));
    try {
      const res = await fetch(
        `/api/projects/${projectId}/segments/${segmentId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        onUploadComplete();
      }
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(segmentId);
        return next;
      });
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  return (
    <Card
      className={`border-border bg-card transition-colors ${dragOver ? config.borderActive : ""}`}
    >
      <CardHeader className="pb-3">
        <CardTitle className={`text-[15px] font-medium ${config.color}`}>
          {config.title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{config.description}</p>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {/* Existing segments */}
        {segments.map((seg) => (
          <div
            key={seg.id}
            className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground/90">
                {seg.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {seg.original_filename}
                {seg.original_size_bytes &&
                  ` · ${formatFileSize(seg.original_size_bytes)}`}
                {seg.original_duration_ms &&
                  ` · ${formatDuration(seg.original_duration_ms)}`}
              </p>
            </div>
            <div className="ml-2 flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge[seg.status] || statusBadge.uploaded}`}
              >
                {seg.status}
              </span>
              <button
                onClick={() => deleteSegment(seg.id)}
                disabled={deleting.has(seg.id)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                title="Remove segment"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        ))}

        {/* Active uploads */}
        {uploads
          .filter((u) => u.status !== "complete")
          .map((upload, i) => (
            <div
              key={i}
              className="space-y-1.5 rounded-lg border border-border px-3 py-2.5"
            >
              <div className="flex items-center justify-between">
                <p className="truncate text-sm text-foreground/80">
                  {upload.label}
                </p>
                <div className="ml-2 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {upload.progress}%
                  </span>
                  {upload.status === "uploading" ? (
                    <button
                      onClick={() => cancelUpload(upload)}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                      title="Cancel upload"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  ) : upload.status === "error" ? (
                    <button
                      onClick={() => dismissUpload(upload.file)}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      title="Dismiss"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  ) : null}
                </div>
              </div>
              <Progress value={upload.progress} className="h-1" />
              {upload.error && (
                <p className="text-xs text-red-400">{upload.error}</p>
              )}
            </div>
          ))}

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setDragOver(false)}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-7 transition-all duration-150 ${
            dragOver
              ? "border-primary/50 bg-primary/5"
              : "border-border hover:border-muted-foreground/30 hover:bg-accent/50"
          }`}
        >
          <div
            className={`mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg ${config.iconBg}`}
          >
            <svg
              className={`h-4 w-4 ${config.color}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>
          <p className="text-sm text-foreground/70">
            Drop files here or{" "}
            <label className="cursor-pointer font-medium text-primary hover:text-primary/80">
              browse
              <Input
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                onChange={(e) =>
                  e.target.files && handleFiles(e.target.files)
                }
              />
            </label>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            MP4, MOV, WebM — any size, any resolution
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
