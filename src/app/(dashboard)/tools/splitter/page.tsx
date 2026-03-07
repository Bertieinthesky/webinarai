/**
 * /tools/splitter — Video Splitter page
 *
 * State machine flow:
 *   upload → edit → splitting → results
 *
 * Allows users to upload a video, mark split points on a visual timeline,
 * split the video server-side, and download clips or create a project.
 */

"use client";

import { useState, useCallback } from "react";
import { SplitterUploader } from "@/components/splitter/SplitterUploader";
import { SplitterEditor } from "@/components/splitter/SplitterEditor";
import { SplitProgress } from "@/components/splitter/SplitProgress";
import { SplitResults } from "@/components/splitter/SplitResults";

type Step = "upload" | "edit" | "splitting" | "results";

export default function SplitterPage() {
  const [step, setStep] = useState<Step>("upload");
  const [splitId, setSplitId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUploadComplete = useCallback(
    (id: string, uploadedFile: File, objectUrl: string) => {
      setSplitId(id);
      setFile(uploadedFile);
      setVideoUrl(objectUrl);
      setStep("edit");
    },
    []
  );

  const handleSplitStart = useCallback(() => {
    setStep("splitting");
  }, []);

  const handleSplitComplete = useCallback(() => {
    setStep("results");
  }, []);

  const handleSplitError = useCallback((message: string) => {
    setError(message);
    setStep("edit");
  }, []);

  const handleReset = useCallback(() => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setSplitId(null);
    setFile(null);
    setVideoUrl(null);
    setError(null);
    setStep("upload");
  }, [videoUrl]);

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Video Splitter
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a video, mark split points, and download individual clips.
          </p>
        </div>

        {step !== "upload" && (
          <button
            onClick={handleReset}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/50 transition hover:bg-white/5 hover:text-white/70"
          >
            Start Over
          </button>
        )}
      </div>

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2">
        {(["upload", "edit", "splitting", "results"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`h-px w-8 ${
                  stepIndex(step) >= i ? "bg-primary/50" : "bg-white/10"
                }`}
              />
            )}
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium ${
                step === s
                  ? "bg-primary text-primary-foreground"
                  : stepIndex(step) > i
                    ? "bg-primary/20 text-primary"
                    : "bg-white/5 text-white/30"
              }`}
            >
              {stepIndex(step) > i ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`text-xs ${
                step === s ? "text-white/70 font-medium" : "text-white/30"
              }`}
            >
              {stepLabels[s]}
            </span>
          </div>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-400/60 hover:text-red-400"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Content */}
      {step === "upload" && (
        <SplitterUploader onUploadComplete={handleUploadComplete} />
      )}

      {step === "edit" && splitId && file && videoUrl && (
        <SplitterEditor
          splitId={splitId}
          file={file}
          videoUrl={videoUrl}
          onSplitStart={handleSplitStart}
        />
      )}

      {step === "splitting" && splitId && (
        <SplitProgress
          splitId={splitId}
          onComplete={handleSplitComplete}
          onError={handleSplitError}
        />
      )}

      {step === "results" && splitId && (
        <SplitResults splitId={splitId} />
      )}
    </div>
  );
}

const stepLabels: Record<Step, string> = {
  upload: "Upload",
  edit: "Edit",
  splitting: "Processing",
  results: "Results",
};

function stepIndex(step: Step): number {
  return ["upload", "edit", "splitting", "results"].indexOf(step);
}
