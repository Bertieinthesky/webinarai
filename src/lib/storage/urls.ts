/**
 * urls.ts — Public URL builder for stored files
 *
 * PURPOSE:
 *   Converts internal R2 storage keys into publicly accessible URLs.
 *   Two functions for two contexts:
 *
 *   publicUrl()  — Server-side (API routes, workers). Uses R2_PUBLIC_URL.
 *   storageUrl() — Client-side (React components). Uses NEXT_PUBLIC_CDN_URL.
 *
 * ENVIRONMENTS:
 *   - Development: Falls back to /api/storage/ proxy route
 *   - Production: Uses Cloudflare CDN domain (e.g., https://cdn.webinar.ai)
 *     for global low-latency delivery with zero proxy overhead
 *
 * USED BY:
 *   - /api/embed/[slug] route (publicUrl — returns video URLs to clients)
 *   - Preview player, Smart player (storageUrl — builds src for <video>)
 */

const PUBLIC_URL = process.env.R2_PUBLIC_URL || "http://localhost:3000/api/storage";

/** Server-side URL builder (API routes, embed endpoint) */
export function publicUrl(storageKey: string): string {
  return `${PUBLIC_URL}/${storageKey}`;
}

/** Client-side URL builder (React components) */
export function storageUrl(key: string): string {
  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;
  if (cdnUrl) {
    return `${cdnUrl}/${key}`;
  }
  return `/api/storage/${key}`;
}
