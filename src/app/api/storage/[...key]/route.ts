import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, BUCKET } from "@/lib/storage/r2";

/**
 * Proxy route for serving videos from R2 with proper Range request support.
 *
 * WHY RANGE REQUESTS MATTER:
 *   Browsers use HTTP Range requests to stream video efficiently. Without
 *   them, the entire file must download before playback can start. With
 *   Range support, the browser fetches just the bytes it needs — enabling
 *   instant playback start, smooth seeking, and minimal memory usage.
 *
 *   R2 natively supports Range requests, so we forward the Range header
 *   from the browser directly to R2 and stream the response back.
 *
 * In production, this would be replaced by a Cloudflare CDN custom domain
 * pointed at the R2 bucket (zero-config Range support, global edge caching).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const { key } = await params;
    const storageKey = key.join("/");

    // Forward Range header from browser to R2
    const rangeHeader = req.headers.get("range");

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
      ...(rangeHeader ? { Range: rangeHeader } : {}),
    });

    const response = await r2Client.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Stream the response body directly (no buffering in memory)
    const webStream = response.Body.transformToWebStream();

    const headers: Record<string, string> = {
      "Content-Type": response.ContentType || "video/mp4",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
    };

    if (response.ContentLength !== undefined) {
      headers["Content-Length"] = String(response.ContentLength);
    }

    // For Range responses, include Content-Range header
    if (response.ContentRange) {
      headers["Content-Range"] = response.ContentRange;
    }

    // 206 Partial Content for Range requests, 200 for full requests
    const status = rangeHeader && response.ContentRange ? 206 : 200;

    return new NextResponse(webStream, { status, headers });
  } catch (error) {
    console.error("Storage proxy error:", error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
