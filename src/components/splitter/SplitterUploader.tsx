/**
 * SplitterUploader.tsx — Drag-and-drop video upload for the splitter
 *
 * Creates a split record via API, gets a presigned URL,
 * uploads the file directly to R2, then transitions to the editor.
 */

"use client";

import { useCallback, useRef, useState } from "react";
import { formatFileSize } from "@/lib/utils/format";
import { Progress } from "@/components/ui/progress";

interface SplitterUploaderProps {
  onUploadComplete: (splitId: string, file: File, objectUrl: string) => void;
}

export function SplitterUploader({ onUploadComplete }: SplitterUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("video/")) {
        setError("Please upload a video file");
        return;
      }

      setUploading(true);
      setError(null);
      setFileName(file.name);
      setProgress(0);

      try {
        // 1. Create split record + get presigned URL
        const createRes = await fetch("/api/tools/splitter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            size: file.size,
            contentType: file.type,
          }),
        });

        if (!createRes.ok) {
          const err = await createRes.json();
          throw new Error(err.error || "Failed to create split");
        }

        const { split, uploadUrl } = await createRes.json();

        // 2. Upload file directly to R2 via presigned URL
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.send(file);
        });

        // 3. Create object URL for local preview
        const objectUrl = URL.createObjectURL(file);

        onUploadComplete(split.id, file, objectUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setUploading(false);
      }
    },
    [onUploadComplete]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  if (uploading) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-8 py-12">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-white/70">
            Uploading {fileName}...
          </span>
        </div>
        <div className="w-full max-w-md">
          <Progress value={progress} className="h-2" />
        </div>
        <span className="text-xs text-white/40">{progress}%</span>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
          {error}
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-4 rounded-xl border-2 border-dashed px-8 py-16 transition-all ${
          dragActive
            ? "border-primary/50 bg-primary/5"
            : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
        }`}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/5">
          <svg className="h-7 w-7 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>

        <div className="text-center">
          <p className="text-sm font-medium text-white/70">
            Drop a video here or click to browse
          </p>
          <p className="mt-1 text-xs text-white/40">
            MP4, MOV, WebM — up to 2GB
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          onChange={handleChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
