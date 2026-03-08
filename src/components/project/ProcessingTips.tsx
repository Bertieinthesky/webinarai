/**
 * ProcessingTips.tsx — Cycling tips & stats carousel shown during video processing
 *
 * Displays rotating "Did you know?" style facts about video marketing and
 * Webinar AI features while the user waits for processing to complete.
 * Auto-cycles every 6 seconds with crossfade animation.
 */

"use client";

import { useState, useEffect, useCallback } from "react";

const TIPS = [
  {
    stat: "43%",
    label: "higher completion",
    text: "Videos under 2 minutes see 43% higher completion rates than longer formats.",
    icon: "clock",
  },
  {
    stat: "3x",
    label: "conversion lift",
    text: "A/B testing your video hooks can increase conversions up to 3x over a single version.",
    icon: "trending",
  },
  {
    stat: "8 sec",
    label: "critical window",
    text: "65% of viewers who make it past the first 8 seconds will watch to the halfway point.",
    icon: "zap",
  },
  {
    stat: "0 ms",
    label: "editing needed",
    text: "Upload your segments once — Webinar AI handles stitching, encoding, and delivery automatically.",
    icon: "magic",
  },
  {
    stat: "VMAF",
    label: "quality targeting",
    text: "Every video is encoded with perceptual quality optimization — smallest file, best visual quality.",
    icon: "eye",
  },
  {
    stat: "<200ms",
    label: "instant start",
    text: "Our dual-player architecture delivers sub-200ms video starts so viewers never wait.",
    icon: "rocket",
  },
  {
    stat: "1",
    label: "embed code",
    text: "A single embed code serves all your variants. No code changes needed to run new tests.",
    icon: "code",
  },
  {
    stat: "HLS",
    label: "adaptive streaming",
    text: "Adaptive bitrate streaming automatically adjusts quality to each viewer's connection speed.",
    icon: "signal",
  },
  {
    stat: "72%",
    label: "of marketers",
    text: "72% of marketers say video has improved their conversion rates — but most never test variations.",
    icon: "chart",
  },
  {
    stat: "Auto",
    label: "combinations",
    text: "Upload 3 hooks, 2 bodies, and 2 CTAs — Webinar AI generates and tests all 12 combinations.",
    icon: "grid",
  },
] as const;

const CYCLE_MS = 6000;

function TipIcon({ icon }: { icon: string }) {
  const iconPaths: Record<string, string> = {
    clock:
      "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
    trending:
      "M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941",
    zap:
      "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z",
    magic:
      "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z",
    eye:
      "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    rocket:
      "M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.841m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z",
    code:
      "M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5",
    signal:
      "M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12.75h.008v.008H12v-.008z",
    chart:
      "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
    grid:
      "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z",
  };

  // Some icons use two paths (eye)
  const paths = (iconPaths[icon] || iconPaths.zap).split(" M");

  return (
    <svg
      className="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      {paths.map((d, i) => (
        <path
          key={i}
          strokeLinecap="round"
          strokeLinejoin="round"
          d={i === 0 ? d : `M${d}`}
        />
      ))}
    </svg>
  );
}

export function ProcessingTips() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const advance = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % TIPS.length);
      setIsTransitioning(false);
    }, 400);
  }, []);

  useEffect(() => {
    const interval = setInterval(advance, CYCLE_MS);
    return () => clearInterval(interval);
  }, [advance]);

  const tip = TIPS[activeIndex];

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-r from-primary/[0.08] via-primary/[0.04] to-transparent px-5 py-4">
      {/* Subtle animated background shimmer */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.03] to-transparent"
        style={{ animation: "processingTipShimmer 3s ease-in-out infinite" }}
      />

      <div className="relative flex items-center gap-4">
        {/* Icon */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all duration-400 ${
            isTransitioning ? "scale-90 opacity-0" : "scale-100 opacity-100"
          }`}
        >
          <TipIcon icon={tip.icon} />
        </div>

        {/* Content */}
        <div
          className={`min-w-0 flex-1 transition-all duration-400 ${
            isTransitioning
              ? "translate-y-2 opacity-0"
              : "translate-y-0 opacity-100"
          }`}
        >
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-lg font-bold tracking-tight text-primary">
              {tip.stat}
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-primary/60">
              {tip.label}
            </span>
          </div>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            {tip.text}
          </p>
        </div>

        {/* Progress dots */}
        <div className="hidden shrink-0 flex-col items-center gap-1 sm:flex">
          {TIPS.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setIsTransitioning(true);
                setTimeout(() => {
                  setActiveIndex(i);
                  setIsTransitioning(false);
                }, 400);
              }}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === activeIndex
                  ? "w-4 bg-primary"
                  : "w-1 bg-white/10 hover:bg-white/20"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Progress bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.03]">
        <div
          className="h-full bg-primary/30 transition-none"
          style={{
            animation: `processingTipProgress ${CYCLE_MS}ms linear infinite`,
          }}
        />
      </div>

      {/* Keyframes for animations */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes processingTipProgress {
              from { width: 0% }
              to { width: 100% }
            }
            @keyframes processingTipShimmer {
              0%, 100% { transform: translateX(-100%) }
              50% { transform: translateX(100%) }
            }
          `,
        }}
      />
    </div>
  );
}
