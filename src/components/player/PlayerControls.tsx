"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface SegmentBoundary {
  time: number;
  label: string;
}

interface PlayerControlsProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  segmentBoundaries?: SegmentBoundary[];
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function PlayerControls({
  currentTime,
  duration,
  isPlaying,
  onSeek,
  onTogglePlay,
  segmentBoundaries,
}: PlayerControlsProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progress = duration > 0 ? currentTime / duration : 0;

  // Auto-hide controls after 3 seconds of no mouse movement
  const resetHideTimer = useCallback(() => {
    setIsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!isDragging) setIsVisible(false);
    }, 3000);
  }, [isDragging]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const getTimeFromPosition = useCallback(
    (clientX: number): number => {
      if (!trackRef.current || duration <= 0) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration]
  );

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      const time = getTimeFromPosition(e.clientX);
      onSeek(time);
    },
    [getTimeFromPosition, onSeek]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      const time = getTimeFromPosition(e.clientX);
      onSeek(time);
    },
    [getTimeFromPosition, onSeek]
  );

  // Handle drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const time = getTimeFromPosition(e.clientX);
      onSeek(time);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, getTimeFromPosition, onSeek]);

  const handleTrackHover = useCallback(
    (e: React.MouseEvent) => {
      const time = getTimeFromPosition(e.clientX);
      setHoverTime(time);
    },
    [getTimeFromPosition]
  );

  return (
    <div
      onMouseMove={resetHideTimer}
      onMouseEnter={() => setIsVisible(true)}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
        padding: "24px 12px 10px",
        opacity: isVisible || isDragging ? 1 : 0,
        transition: "opacity 0.3s ease",
        zIndex: 5,
        pointerEvents: isVisible || isDragging ? "auto" : "none",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Progress bar track */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleTrackHover}
        onMouseLeave={() => setHoverTime(null)}
        style={{
          position: "relative",
          height: 16,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* Background track */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: 4,
            borderRadius: 2,
            background: "rgba(255,255,255,0.2)",
          }}
        />

        {/* Hover preview position */}
        {hoverTime !== null && (
          <div
            style={{
              position: "absolute",
              left: 0,
              width: `${(hoverTime / duration) * 100}%`,
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,0.15)",
            }}
          />
        )}

        {/* Filled track */}
        <div
          style={{
            position: "absolute",
            left: 0,
            width: `${progress * 100}%`,
            height: 4,
            borderRadius: 2,
            background: "#fff",
            transition: isDragging ? "none" : "width 0.1s linear",
          }}
        />

        {/* Segment boundary markers */}
        {segmentBoundaries?.map((boundary) => {
          const pos = duration > 0 ? (boundary.time / duration) * 100 : 0;
          return (
            <div
              key={boundary.label}
              title={boundary.label}
              style={{
                position: "absolute",
                left: `${pos}%`,
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: 3,
                height: 10,
                borderRadius: 1,
                background: "rgba(255,255,255,0.5)",
              }}
            />
          );
        })}

        {/* Scrub handle */}
        <div
          style={{
            position: "absolute",
            left: `${progress * 100}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
            opacity: isDragging || hoverTime !== null ? 1 : 0,
            transition: "opacity 0.15s",
          }}
        />

        {/* Hover time tooltip */}
        {hoverTime !== null && !isDragging && (
          <div
            style={{
              position: "absolute",
              left: `${(hoverTime / duration) * 100}%`,
              bottom: 18,
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.8)",
              color: "#fff",
              fontSize: 11,
              padding: "2px 6px",
              borderRadius: 3,
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            {formatTime(hoverTime)}
          </div>
        )}
      </div>

      {/* Bottom row: play button + time */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 4,
        }}
      >
        <button
          onClick={onTogglePlay}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            display: "flex",
            alignItems: "center",
          }}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
              <rect x="5" y="3" width="5" height="18" rx="1" />
              <rect x="14" y="3" width="5" height="18" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          )}
        </button>

        <span
          style={{
            color: "rgba(255,255,255,0.8)",
            fontSize: 12,
            fontFamily: "monospace",
            letterSpacing: "0.02em",
          }}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
