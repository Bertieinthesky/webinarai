/**
 * LayoutSwitcher — Dev-mode toggle to switch between 5 layout variants
 *
 * Floating control at the top of the project detail page that lets the user
 * cycle through different layout approaches for review and feedback.
 * Persists selection to localStorage.
 */

"use client";

import { useState, useEffect } from "react";
import { TabbedFolioLayout } from "./TabbedFolioLayout";
import { SplitCockpitLayout } from "./SplitCockpitLayout";
import { ScrollspyCardsLayout } from "./ScrollspyCardsLayout";
import { BentoGridLayout } from "./BentoGridLayout";
import { PipelineStepperLayout } from "./PipelineStepperLayout";
import type { ProjectLayoutProps } from "./types";

const LAYOUTS = [
  {
    id: "tabbed-folio",
    label: "A",
    name: "Tabbed Folio",
    description: "File cabinet tabs, one section at a time",
    Component: TabbedFolioLayout,
  },
  {
    id: "split-cockpit",
    label: "B",
    name: "Split Cockpit",
    description: "Sidebar + main panel, always-visible context",
    Component: SplitCockpitLayout,
  },
  {
    id: "scrollspy-cards",
    label: "C",
    name: "Scrollspy Cards",
    description: "Sticky nav, scroll between distinct card sections",
    Component: ScrollspyCardsLayout,
  },
  {
    id: "bento-grid",
    label: "D",
    name: "Bento Grid",
    description: "Dense dashboard grid, click to expand",
    Component: BentoGridLayout,
  },
  {
    id: "pipeline-stepper",
    label: "E",
    name: "Pipeline Stepper",
    description: "Workflow stages: Upload > Process > Test > Analyze",
    Component: PipelineStepperLayout,
  },
] as const;

const STORAGE_KEY = "webinar-ai-layout-variant";

export function LayoutSwitcher(props: ProjectLayoutProps) {
  const [activeLayout, setActiveLayout] = useState<string>("bento-grid");
  const [isOpen, setIsOpen] = useState(false);

  // Restore from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LAYOUTS.some((l) => l.id === saved)) {
      setActiveLayout(saved);
    }
  }, []);

  const handleSelect = (layoutId: string) => {
    setActiveLayout(layoutId);
    localStorage.setItem(STORAGE_KEY, layoutId);
    setIsOpen(false);
  };

  const layout = LAYOUTS.find((l) => l.id === activeLayout) || LAYOUTS[0];
  const ActiveComponent = layout.Component;

  return (
    <div>
      {/* ── Floating Switcher Bar ── */}
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-2.5">
        {/* Label */}
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15">
            <svg
              className="h-3.5 w-3.5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42"
              />
            </svg>
          </div>
          <span className="text-xs font-medium text-primary/70">
            Layout Preview
          </span>
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-white/[0.06]" />

        {/* Layout pills */}
        <div className="flex items-center gap-1">
          {LAYOUTS.map((l) => {
            const isActive = activeLayout === l.id;
            return (
              <button
                key={l.id}
                onClick={() => handleSelect(l.id)}
                title={`${l.name}: ${l.description}`}
                className={`
                  relative rounded-lg px-3 py-1.5 text-xs font-medium transition-all
                  ${
                    isActive
                      ? "bg-primary/20 text-primary shadow-sm"
                      : "text-white/30 hover:text-white/50 hover:bg-white/[0.03]"
                  }
                `}
              >
                {l.label}
                {isActive && (
                  <span className="absolute -bottom-px left-1/2 h-[2px] w-3 -translate-x-1/2 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-white/[0.06]" />

        {/* Current layout name + info toggle */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-white/40 transition hover:bg-white/[0.03] hover:text-white/60"
        >
          <span className="font-medium">{layout.name}</span>
          <svg
            className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>

      {/* ── Layout Info Dropdown ── */}
      {isOpen && (
        <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
          <div className="grid gap-2 sm:grid-cols-5">
            {LAYOUTS.map((l) => {
              const isActive = activeLayout === l.id;
              return (
                <button
                  key={l.id}
                  onClick={() => handleSelect(l.id)}
                  className={`
                    rounded-lg border px-3 py-3 text-left transition-all
                    ${
                      isActive
                        ? "border-primary/30 bg-primary/[0.06]"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]"
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
                        isActive
                          ? "bg-primary/20 text-primary"
                          : "bg-white/[0.06] text-white/30"
                      }`}
                    >
                      {l.label}
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        isActive ? "text-white/80" : "text-white/40"
                      }`}
                    >
                      {l.name}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-white/25">
                    {l.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Active Layout ── */}
      <ActiveComponent {...props} />
    </div>
  );
}
