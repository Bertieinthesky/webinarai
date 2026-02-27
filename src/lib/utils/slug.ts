import { nanoid } from "nanoid";

/**
 * Generate a URL-safe slug for projects.
 * Used in embed URLs: /e/{slug}
 */
export function generateSlug(): string {
  return nanoid(10);
}
