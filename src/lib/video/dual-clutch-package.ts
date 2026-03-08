/**
 * dual-clutch-package.ts — Per-segment HLS packaging for the Dual Clutch Player
 *
 * PURPOSE:
 *   Packages each normalized segment (hook, body, CTA) into its own HLS
 *   fMP4 segment set, then generates a combined manifest that chains them
 *   using #EXT-X-DISCONTINUITY tags. This lets hls.js play all segments
 *   through a single <video> element with seamless transitions — no
 *   stitching, no dual-video swap, no PTS discontinuities.
 *
 * HOW IT WORKS:
 *   1. Each normalized MP4 is stream-copied into HLS fMP4 segments (instant)
 *   2. A combined manifest chains the segments with #EXT-X-DISCONTINUITY
 *   3. hls.js buffers ahead — body segments pre-buffer while hook plays
 *   4. At the boundary, hls.js reinitializes the decoder (instant since
 *      all segments have identical specs) and continues playback seamlessly
 *
 * USED BY:
 *   - video-processor.ts (processRender job handler)
 */

import { runFFmpeg } from "./commands";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Package a single normalized MP4 into HLS fMP4 segments via stream-copy.
 * Stream-copy is instant (no re-encoding) — typically < 1 second.
 *
 * Output structure:
 *   {outputDir}/{segmentName}/
 *     playlist.m3u8
 *     init.mp4
 *     seg000.m4s, seg001.m4s, ...
 */
export async function packageSegmentHls(
  inputPath: string,
  outputDir: string,
  segmentName: string
): Promise<void> {
  const segDir = path.join(outputDir, segmentName);
  await fs.mkdir(segDir, { recursive: true });

  const playlistPath = path.join(segDir, "playlist.m3u8");

  const args: string[] = [
    "-i", inputPath,
    // Stream-copy — no re-encoding, instant
    "-c:v", "copy",
    "-c:a", "copy",
    // HLS fMP4 output
    "-f", "hls",
    "-hls_time", "6",
    "-hls_playlist_type", "vod",
    "-hls_segment_type", "fmp4",
    "-hls_fmp4_init_filename", "init.mp4",
    "-hls_segment_filename", path.join(segDir, "seg%03d.m4s"),
    "-y",
    playlistPath,
  ];

  // Stream-copy should complete in seconds
  await runFFmpeg(args, 120_000);
}

/**
 * Generate a combined HLS manifest that chains multiple segment playlists
 * using #EXT-X-DISCONTINUITY tags.
 *
 * Reads each segment's playlist.m3u8 to extract EXTINF entries and segment
 * filenames, then writes a single combined.m3u8 that plays them sequentially.
 *
 * @returns The durations of each segment in milliseconds (for UI boundary markers)
 */
export async function generateCombinedManifest(
  outputDir: string,
  segmentNames: string[]
): Promise<{ manifestPath: string; segmentDurationsMs: number[] }> {
  const lines: string[] = [
    "#EXTM3U",
    "#EXT-X-VERSION:7",
  ];

  let maxTargetDuration = 6;
  const segmentDurationsMs: number[] = [];

  for (let i = 0; i < segmentNames.length; i++) {
    const name = segmentNames[i];
    const playlistPath = path.join(outputDir, name, "playlist.m3u8");
    const playlistContent = await fs.readFile(playlistPath, "utf-8");
    const playlistLines = playlistContent.split("\n");

    // Add discontinuity tag between segments (not before the first one)
    if (i > 0) {
      lines.push("#EXT-X-DISCONTINUITY");
    }

    // Add init segment map for this segment
    lines.push(`#EXT-X-MAP:URI="${name}/init.mp4"`);

    // Extract EXTINF + segment file entries from the playlist
    let segmentTotalDuration = 0;

    for (let j = 0; j < playlistLines.length; j++) {
      const line = playlistLines[j].trim();

      // Parse target duration to find the maximum
      if (line.startsWith("#EXT-X-TARGETDURATION:")) {
        const td = parseInt(line.split(":")[1], 10);
        if (td > maxTargetDuration) maxTargetDuration = td;
        continue;
      }

      // Extract EXTINF duration and the following segment filename
      if (line.startsWith("#EXTINF:")) {
        const duration = parseFloat(line.replace("#EXTINF:", "").replace(",", ""));
        segmentTotalDuration += duration;

        lines.push(line);

        // Next non-empty line should be the segment filename
        const nextLine = playlistLines[j + 1]?.trim();
        if (nextLine && !nextLine.startsWith("#")) {
          // Extract just the filename (e.g., "seg000.m4s")
          const filename = path.basename(nextLine);
          lines.push(`${name}/${filename}`);
          j++; // Skip the next line since we consumed it
        }
      }
    }

    segmentDurationsMs.push(Math.round(segmentTotalDuration * 1000));
  }

  // Insert target duration after the version tag
  lines.splice(2, 0, `#EXT-X-TARGETDURATION:${maxTargetDuration}`);
  lines.splice(3, 0, "#EXT-X-PLAYLIST-TYPE:VOD");

  lines.push("#EXT-X-ENDLIST");

  const manifestPath = path.join(outputDir, "combined.m3u8");
  await fs.writeFile(manifestPath, lines.join("\n") + "\n");

  return { manifestPath, segmentDurationsMs };
}
