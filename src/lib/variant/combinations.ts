/**
 * combinations.ts — Cartesian product generator for variant creation
 *
 * PURPOSE:
 *   Given a set of segments (hooks, bodies, CTAs), generates every possible
 *   combination. Each combination becomes a "variant" — a complete video
 *   that will be pre-rendered and served to a subset of viewers.
 *
 * EXAMPLE:
 *   3 hooks × 2 bodies × 2 CTAs = 12 variants
 *   Each variant gets a code like "h1-b2-c2" for easy identification in
 *   the dashboard and analytics.
 *
 * SCALING:
 *   The combinatorial growth is multiplicative. This is manageable for
 *   typical A/B tests (3-5 of each type = 27-125 variants). Since
 *   stitching uses stream-copy (no re-encoding), even 125 variants
 *   render in minutes. The system warns users if the count gets high.
 *
 * ARCHITECTURE:
 *   - Called by: process API route (to create variant records before processing)
 *   - Returns: Array of {hook, body, cta, variantCode} objects
 */

interface Segment {
  id: string;
  type: "hook" | "body" | "cta";
  label: string;
  sort_order: number;
}

interface VariantCombination {
  hook: Segment;
  body: Segment;
  cta: Segment;
  variantCode: string;
}

/**
 * Generate all hook × body × cta combinations.
 * Each variant gets a code like "h1-b2-c1" for easy identification.
 */
export function generateCombinations(
  segments: Segment[]
): VariantCombination[] {
  const hooks = segments
    .filter((s) => s.type === "hook")
    .sort((a, b) => a.sort_order - b.sort_order);
  const bodies = segments
    .filter((s) => s.type === "body")
    .sort((a, b) => a.sort_order - b.sort_order);
  const ctas = segments
    .filter((s) => s.type === "cta")
    .sort((a, b) => a.sort_order - b.sort_order);

  if (!hooks.length || !bodies.length || !ctas.length) {
    throw new Error(
      `Need at least one of each segment type. Got: ${hooks.length} hooks, ${bodies.length} bodies, ${ctas.length} CTAs`
    );
  }

  const combinations: VariantCombination[] = [];

  hooks.forEach((hook, hi) => {
    bodies.forEach((body, bi) => {
      ctas.forEach((cta, ci) => {
        combinations.push({
          hook,
          body,
          cta,
          variantCode: `h${hi + 1}-b${bi + 1}-c${ci + 1}`,
        });
      });
    });
  });

  return combinations;
}

/**
 * Calculate total variant count from segment counts.
 */
export function variantCount(
  hookCount: number,
  bodyCount: number,
  ctaCount: number
): number {
  return hookCount * bodyCount * ctaCount;
}
