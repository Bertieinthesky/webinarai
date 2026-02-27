/**
 * assignment.ts — Deterministic A/B test variant assignment
 *
 * PURPOSE:
 *   Ensures each viewer consistently sees the same variant for a given project.
 *   This is critical for A/B test integrity — if a viewer saw variant A on
 *   their first visit but variant B on refresh, the test data would be
 *   meaningless (you couldn't attribute their conversion to either variant).
 *
 * HOW IT WORKS:
 *   Uses a simple string hash: hash(viewerId + projectId) % variantCount.
 *   The same viewer always gets the same index, so they always see the same
 *   variant. Different viewers get roughly uniformly distributed across variants.
 *
 * VIEWER IDENTIFICATION:
 *   The viewerId is a random string stored in the viewer's browser (localStorage
 *   + cookie). It persists across visits and page reloads. It's NOT tied to
 *   any personal information — it's a random anonymous identifier solely for
 *   consistent variant assignment.
 *
 * ARCHITECTURE:
 *   - Used by: /api/embed/[slug] route (server-side assignment)
 *   - The viewerId is read from a cookie, or generated on first visit
 *   - In Phase 2, this can be extended with weighted assignment for
 *     exploitation (sending more traffic to winning variants)
 */
export function assignVariant(
  viewerId: string,
  projectId: string,
  variantCount: number
): number {
  if (variantCount <= 0) return 0;

  const input = `${viewerId}:${projectId}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }

  return Math.abs(hash) % variantCount;
}

/**
 * Generate a viewer ID (stored in localStorage/cookie on client).
 */
export function generateViewerId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return `wai_${result}`;
}
