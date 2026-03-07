/**
 * SplitterEditor.tsx — Orchestrator for video + waveform + markers + labels
 *
 * Composes VideoPreview + WaveformTimeline + SegmentLabelList.
 * Manages markers state, syncs video currentTime with timeline playhead,
 * and integrates scene detection suggestions + thumbnail strip.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { VideoPreview } from "./VideoPreview";
import { WaveformTimeline, type Marker, type SuggestedMarker } from "./WaveformTimeline";
import { SegmentLabelList } from "./SegmentLabelList";
import { useWaveform } from "@/hooks/use-waveform";
import { useThumbnails } from "@/hooks/use-thumbnails";
import { useSceneDetection } from "@/hooks/use-scene-detection";
import { Button } from "@/components/ui/button";
import { randomId } from "./utils";

interface SplitterEditorProps {
  splitId: string;
  file: File;
  videoUrl: string;
  onSplitStart: () => void;
}

export function SplitterEditor({
  splitId,
  file,
  videoUrl,
  onSplitStart,
}: SplitterEditorProps) {
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [splitting, setSplitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suggestions from scene detection
  const [suggestions, setSuggestions] = useState<SuggestedMarker[]>([]);
  const [dismissedTimes, setDismissedTimes] = useState<Set<number>>(new Set());

  const { peaks, loading: waveformLoading } = useWaveform(file);
  const { thumbnails } = useThumbnails(videoUrl, durationMs);
  const { scenePoints, analyzing, startAnalysis } = useSceneDetection(splitId);

  // Auto-trigger analysis when video metadata loads
  const handleLoadedMetadata = useCallback(
    (meta: { width: number; height: number; duration: number }) => {
      // Update split record with source dimensions
      fetch(`/api/tools/splitter/${splitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_duration_ms: Math.round(meta.duration),
          source_width: meta.width,
          source_height: meta.height,
        }),
      })
        .then(() => {
          // Start scene detection after metadata is saved
          startAnalysis();
        })
        .catch(() => {});
    },
    [splitId, startAnalysis]
  );

  // When scene points arrive, populate suggestions
  useEffect(() => {
    if (scenePoints.length > 0) {
      setSuggestions(
        scenePoints.map((p) => ({
          timeMs: p.timeMs,
          confidence: p.confidence,
          type: p.type,
        }))
      );
    }
  }, [scenePoints]);

  // Filter out dismissed suggestions
  const visibleSuggestions = suggestions.filter(
    (s) => !dismissedTimes.has(s.timeMs)
  );

  // Accept a suggestion = create a real marker at that time
  const handleSuggestionAccept = useCallback((timeMs: number) => {
    setMarkers((prev) => [
      ...prev,
      { id: randomId(), timeMs, label: `Split ${prev.length + 1}` },
    ]);
    // Remove from suggestions
    setDismissedTimes((prev) => new Set(prev).add(timeMs));
  }, []);

  // Dismiss a suggestion
  const handleSuggestionDismiss = useCallback((timeMs: number) => {
    setDismissedTimes((prev) => new Set(prev).add(timeMs));
  }, []);

  // Accept all visible suggestions
  const handleAcceptAll = useCallback(() => {
    setMarkers((prev) => {
      const newMarkers = visibleSuggestions.map((s, i) => ({
        id: randomId(),
        timeMs: s.timeMs,
        label: `Split ${prev.length + i + 1}`,
      }));
      return [...prev, ...newMarkers];
    });
    setDismissedTimes((prev) => {
      const next = new Set(prev);
      for (const s of visibleSuggestions) next.add(s.timeMs);
      return next;
    });
  }, [visibleSuggestions]);

  // Clear all suggestions
  const handleDismissAll = useCallback(() => {
    setDismissedTimes((prev) => {
      const next = new Set(prev);
      for (const s of suggestions) next.add(s.timeMs);
      return next;
    });
  }, [suggestions]);

  // Marker management
  const handleMarkerAdd = useCallback(
    (timeMs: number) => {
      setMarkers((prev) => [
        ...prev,
        { id: randomId(), timeMs, label: `Split ${prev.length + 1}` },
      ]);
      // Auto-dismiss nearby suggestion (within 500ms)
      const nearby = suggestions.find(
        (s) => Math.abs(s.timeMs - timeMs) < 500
      );
      if (nearby) {
        setDismissedTimes((prev) => new Set(prev).add(nearby.timeMs));
      }
    },
    [suggestions]
  );

  const handleMarkerMove = useCallback((id: string, timeMs: number) => {
    setMarkers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, timeMs } : m))
    );
  }, []);

  const handleMarkerRemove = useCallback((id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleMarkerLabelChange = useCallback((id: string, label: string) => {
    setMarkers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, label } : m))
    );
  }, []);

  // Trigger split
  const handleSplit = useCallback(async () => {
    if (markers.length === 0) return;

    setSplitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/tools/splitter/${splitId}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markers: markers.map((m) => ({
            time_ms: Math.round(m.timeMs),
            label: m.label,
          })),
          durationMs: Math.round(durationMs),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to start split");
      }

      onSplitStart();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start split");
      setSplitting(false);
    }
  }, [markers, durationMs, splitId, onSplitStart]);

  return (
    <div className="space-y-6">
      {/* Video preview */}
      <VideoPreview
        src={videoUrl}
        currentTime={currentTimeMs}
        duration={durationMs}
        playing={playing}
        onTimeUpdate={setCurrentTimeMs}
        onDurationChange={setDurationMs}
        onPlayPause={setPlaying}
        onLoadedMetadata={handleLoadedMetadata}
      />

      {/* Scene detection status + controls */}
      {(analyzing || visibleSuggestions.length > 0) && (
        <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
          <div className="flex items-center gap-2 text-xs">
            {analyzing ? (
              <>
                <svg
                  className="h-3.5 w-3.5 animate-spin text-amber-400/70"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <span className="text-white/40">
                  Analyzing video for scene changes...
                </span>
              </>
            ) : (
              <>
                <svg
                  className="h-3.5 w-3.5 text-emerald-400/70"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5.002 5.002 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                <span className="text-white/40">
                  <span className="text-white/60 font-mono">
                    {visibleSuggestions.length}
                  </span>{" "}
                  suggested split{" "}
                  {visibleSuggestions.length === 1 ? "point" : "points"}{" "}
                  detected
                </span>
              </>
            )}
          </div>
          {visibleSuggestions.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleAcceptAll}
                className="rounded px-2 py-0.5 text-[11px] font-medium text-emerald-400/80 transition-colors hover:bg-emerald-500/10"
              >
                Accept All
              </button>
              <button
                onClick={handleDismissAll}
                className="rounded px-2 py-0.5 text-[11px] font-medium text-white/30 transition-colors hover:bg-white/5 hover:text-white/50"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      )}

      {/* Waveform timeline */}
      <div>
        {waveformLoading ? (
          <div className="flex h-[120px] items-center justify-center rounded-md bg-white/[0.03]">
            <span className="text-xs text-white/40">
              Extracting waveform...
            </span>
          </div>
        ) : (
          <WaveformTimeline
            peaks={peaks}
            durationMs={durationMs}
            currentTimeMs={currentTimeMs}
            markers={markers}
            playing={playing}
            thumbnails={thumbnails}
            suggestedMarkers={visibleSuggestions}
            onSeek={(t) => {
              setCurrentTimeMs(t);
              setPlaying(false);
            }}
            onMarkerAdd={handleMarkerAdd}
            onMarkerMove={handleMarkerMove}
            onMarkerRemove={handleMarkerRemove}
            onSuggestionAccept={handleSuggestionAccept}
            onSuggestionDismiss={handleSuggestionDismiss}
          />
        )}
      </div>

      {/* Segment labels */}
      <SegmentLabelList
        markers={markers}
        durationMs={durationMs}
        onMarkerLabelChange={handleMarkerLabelChange}
      />

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Split button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSplit}
          disabled={markers.length === 0 || splitting || durationMs === 0}
          className="px-6"
        >
          {splitting ? (
            <>
              <svg
                className="mr-2 h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Starting split...
            </>
          ) : (
            <>
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.848 8.25l1.536.887M7.848 8.25a3 3 0 11-5.196-3 3 3 0 015.196 3zm1.536.887a2.165 2.165 0 011.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 11-5.196 3 3 3 0 015.196-3zm1.536-.887a2.165 2.165 0 001.083-1.838c.005-.352.054-.695.14-1.025"
                />
              </svg>
              Split Video ({markers.length}{" "}
              {markers.length === 1 ? "marker" : "markers"})
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
