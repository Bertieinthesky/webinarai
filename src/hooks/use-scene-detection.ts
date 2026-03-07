/**
 * use-scene-detection.ts — Trigger and poll server-side scene detection
 *
 * Starts an FFmpeg analysis job after upload, polls for results,
 * and returns detected scene change / silence boundary points.
 *
 * The hook auto-starts analysis when splitId is provided, and polls
 * every 2 seconds until scene_points appear on the split record.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface ScenePoint {
  timeMs: number;
  confidence: number;
  type: "scene_change" | "silence";
}

export interface UseSceneDetectionResult {
  scenePoints: ScenePoint[];
  analyzing: boolean;
  error: string | null;
  startAnalysis: () => void;
}

export function useSceneDetection(
  splitId: string | null
): UseSceneDetectionResult {
  const [scenePoints, setScenePoints] = useState<ScenePoint[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startAnalysis = useCallback(async () => {
    if (!splitId || startedRef.current) return;
    startedRef.current = true;
    setAnalyzing(true);
    setError(null);

    try {
      const res = await fetch(`/api/tools/splitter/${splitId}/analyze`, {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Analysis failed to start");
      }

      const data = await res.json();

      // If already analyzed, use cached results
      if (data.status === "already_analyzed") {
        // Fetch the split to get scene_points
        const splitRes = await fetch(`/api/tools/splitter/${splitId}`);
        if (splitRes.ok) {
          const splitData = await splitRes.json();
          if (splitData.split?.scene_points) {
            setScenePoints(splitData.split.scene_points as ScenePoint[]);
          }
        }
        setAnalyzing(false);
        return;
      }

      // Start polling for results
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setAnalyzing(false);
      startedRef.current = false;
    }
  }, [splitId]);

  // Poll for analysis results
  useEffect(() => {
    if (!analyzing || !splitId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/tools/splitter/${splitId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.split?.scene_points && data.split.scene_points.length > 0) {
          setScenePoints(data.split.scene_points as ScenePoint[]);
          setAnalyzing(false);
          stopPolling();
        }
      } catch {
        // retry on next poll
      }
    };

    pollRef.current = setInterval(poll, 2000);
    // First poll after a short delay (give worker time to pick up the job)
    const initialTimeout = setTimeout(poll, 1500);

    return () => {
      stopPolling();
      clearTimeout(initialTimeout);
    };
  }, [analyzing, splitId, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return { scenePoints, analyzing, error, startAnalysis };
}
