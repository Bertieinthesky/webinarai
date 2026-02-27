/**
 * keys.ts — Storage key path builders
 *
 * PURPOSE:
 *   Constructs deterministic, hierarchical storage keys for all files in R2.
 *   Having a consistent key structure makes it easy to find, organize, and
 *   clean up files. It also enables content-addressed caching — since a
 *   rendered video never changes, its key can be cached indefinitely.
 *
 * KEY STRUCTURE:
 *   projects/{projectId}/segments/{segmentId}/original.mp4
 *   projects/{projectId}/segments/{segmentId}/normalized.mp4
 *   projects/{projectId}/variants/{variantId}/video.mp4
 *   projects/{projectId}/variants/{variantId}/hook-clip.mp4
 *
 * ARCHITECTURE:
 *   - Used by: API routes (when creating segment records), video-processor
 *     worker (when uploading processed files)
 *   - All keys are relative to the R2 bucket root
 */

export function originalSegmentKey(
  projectId: string,
  segmentId: string,
  ext: string
): string {
  return `projects/${projectId}/segments/${segmentId}/original${ext}`;
}

export function normalizedSegmentKey(
  projectId: string,
  segmentId: string
): string {
  return `projects/${projectId}/segments/${segmentId}/normalized.mp4`;
}

export function variantVideoKey(
  projectId: string,
  variantId: string
): string {
  return `projects/${projectId}/variants/${variantId}/video.mp4`;
}

export function variantHookClipKey(
  projectId: string,
  variantId: string
): string {
  return `projects/${projectId}/variants/${variantId}/hook-clip.mp4`;
}

export function variantPosterKey(
  projectId: string,
  variantId: string
): string {
  return `projects/${projectId}/variants/${variantId}/poster.jpg`;
}

export function tempWorkDir(jobId: string): string {
  return `temp/${jobId}`;
}
