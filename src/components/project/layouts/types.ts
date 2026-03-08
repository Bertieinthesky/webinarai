/**
 * layouts/types.ts — Shared types for all project detail layout variants
 *
 * Each layout receives the same props and arranges the content differently.
 * The data-fetching stays in page.tsx; layouts are pure presentation.
 */

import type { Database } from "@/lib/supabase/types";
import type { AnalyticsData } from "@/hooks/use-analytics";

export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Segment = Database["public"]["Tables"]["segments"]["Row"];
export type Variant = Database["public"]["Tables"]["variants"]["Row"];

export type { AnalyticsData };

export interface ProjectLayoutProps {
  // Core data
  project: Project;
  segments: Segment[];
  variants: Variant[];
  analytics: AnalyticsData | undefined;
  projectId: string;

  // Derived data (pre-computed in page.tsx)
  hooks: Segment[];
  bodies: Segment[];
  ctas: Segment[];
  renderedVariants: Variant[];
  activeVariants: Variant[];
  failedSegments: Segment[];
  failedVariants: Variant[];
  isSplitTest: boolean;
  hasFailures: boolean;
  bestSegmentIds: {
    hook: string | null;
    body: string | null;
    cta: string | null;
  };

  // State + callbacks
  selectedVariantId: string | null;
  onRefresh: () => void;
  onSelectVariant: (id: string | null) => void;
}
