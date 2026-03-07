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
 *   projects/{projectId}/variants/{variantId}/hls/master.m3u8
 *   projects/{projectId}/variants/{variantId}/hls/{rendition}/playlist.m3u8
 *   projects/{projectId}/variants/{variantId}/hls/{rendition}/init.mp4
 *   projects/{projectId}/variants/{variantId}/hls/{rendition}/seg{index}.m4s
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

export function variantMicroSegmentKey(
  projectId: string,
  variantId: string
): string {
  return `projects/${projectId}/variants/${variantId}/micro-segment.mp4`;
}

export function variant720pVideoKey(
  projectId: string,
  variantId: string
): string {
  return `projects/${projectId}/variants/${variantId}/video-720p.mp4`;
}

// ─── HLS adaptive streaming keys ───

export function variantHlsPrefix(
  projectId: string,
  variantId: string
): string {
  return `projects/${projectId}/variants/${variantId}/hls`;
}

export function variantHlsMasterKey(
  projectId: string,
  variantId: string
): string {
  return `${variantHlsPrefix(projectId, variantId)}/master.m3u8`;
}

export function variantHlsRenditionPlaylistKey(
  projectId: string,
  variantId: string,
  rendition: string
): string {
  return `${variantHlsPrefix(projectId, variantId)}/${rendition}/playlist.m3u8`;
}

export function variantHlsInitSegmentKey(
  projectId: string,
  variantId: string,
  rendition: string
): string {
  return `${variantHlsPrefix(projectId, variantId)}/${rendition}/init.mp4`;
}

export function variantHlsSegmentKey(
  projectId: string,
  variantId: string,
  rendition: string,
  segmentIndex: number
): string {
  const padded = String(segmentIndex).padStart(3, "0");
  return `${variantHlsPrefix(projectId, variantId)}/${rendition}/seg${padded}.m4s`;
}

export function tempWorkDir(jobId: string): string {
  return `temp/${jobId}`;
}
