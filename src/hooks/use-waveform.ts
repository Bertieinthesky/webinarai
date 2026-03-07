/**
 * use-waveform.ts — Client-side waveform peak extraction via Web Audio API
 *
 * Decodes audio from a video/audio file and downsamples to ~2000 peak values
 * for rendering a waveform timeline. Degrades gracefully — if audio decode
 * fails (e.g., codec not supported), returns an empty array so the timeline
 * still works without waveform visualization.
 */

"use client";

import { useState, useEffect, useRef } from "react";

const TARGET_PEAKS = 2000;
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB cap for in-memory decode

export interface UseWaveformResult {
  peaks: number[];
  loading: boolean;
  error: string | null;
}

/**
 * Extract waveform peaks from a File or Blob.
 * Returns normalized peaks (0–1) for rendering.
 */
export function useWaveform(file: File | Blob | null): UseWaveformResult {
  const [peaks, setPeaks] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    if (!file) {
      setPeaks([]);
      setLoading(false);
      setError(null);
      return;
    }

    abortRef.current = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        if (file.size > MAX_FILE_SIZE) {
          setError("File too large for waveform extraction");
          setLoading(false);
          return;
        }

        const arrayBuffer = await file.arrayBuffer();
        if (abortRef.current) return;

        const audioCtx = new AudioContext();
        try {
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          if (abortRef.current) return;

          const channelData = audioBuffer.getChannelData(0);
          const extracted = downsamplePeaks(channelData, TARGET_PEAKS);
          setPeaks(extracted);
        } finally {
          await audioCtx.close();
        }
      } catch (err) {
        if (!abortRef.current) {
          console.warn("Waveform extraction failed:", err);
          setError("Could not extract waveform");
          setPeaks([]);
        }
      } finally {
        if (!abortRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      abortRef.current = true;
    };
  }, [file]);

  return { peaks, loading, error };
}

/**
 * Downsample raw audio samples to a fixed number of peaks.
 * Each peak is the max absolute amplitude within its block.
 * Output is normalized to 0–1.
 */
function downsamplePeaks(channelData: Float32Array, targetPeaks: number): number[] {
  const totalSamples = channelData.length;
  const blockSize = Math.floor(totalSamples / targetPeaks);

  if (blockSize < 1) {
    // Audio is shorter than target peaks — use raw samples
    const raw: number[] = [];
    for (let i = 0; i < totalSamples; i++) {
      raw.push(Math.abs(channelData[i]));
    }
    return normalize(raw);
  }

  const peaks: number[] = [];
  for (let i = 0; i < targetPeaks; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, totalSamples);
    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > max) max = abs;
    }
    peaks.push(max);
  }

  return normalize(peaks);
}

/** Normalize peaks to 0–1 range. */
function normalize(peaks: number[]): number[] {
  let max = 0;
  for (const p of peaks) {
    if (p > max) max = p;
  }
  if (max === 0) return peaks.map(() => 0);
  return peaks.map((p) => p / max);
}
