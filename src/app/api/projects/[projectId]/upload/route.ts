/**
 * /api/projects/[projectId]/upload — Chunked upload proxy to R2
 *
 * Handles multipart uploads for large video files (up to multi-GB).
 * The browser sends the file in 4MB chunks, each goes through this
 * proxy to R2. This avoids Vercel's 4.5MB body limit AND avoids
 * needing CORS on R2 for direct browser uploads.
 *
 * FLOW:
 *   1. POST   — Initiate multipart upload → returns uploadId
 *   2. PUT    — Upload a single chunk (part) → returns ETag
 *   3. PATCH  — Complete the multipart upload (finalize all parts)
 *   4. DELETE — Abort a failed multipart upload
 */

import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { handleApiError, errorResponse } from "@/lib/utils/errors";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

/**
 * POST — Initiate multipart upload
 * Body: { key, contentType }
 * Returns: { uploadId }
 */
export async function POST(req: NextRequest) {
  try {
    const { key, contentType } = await req.json();
    if (!key) return errorResponse("Missing key", 400);

    const command = new CreateMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType || "video/mp4",
    });

    const result = await r2.send(command);
    return NextResponse.json({ uploadId: result.UploadId });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT — Upload a single chunk (part)
 * Query: ?key=...&uploadId=...&partNumber=...
 * Body: raw chunk bytes
 * Returns: { etag }
 */
export async function PUT(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get("key");
    const uploadId = req.nextUrl.searchParams.get("uploadId");
    const partNumber = parseInt(
      req.nextUrl.searchParams.get("partNumber") || "1"
    );

    if (!key || !uploadId) {
      return errorResponse("Missing key or uploadId", 400);
    }

    const body = await req.arrayBuffer();

    const command = new UploadPartCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: Buffer.from(body),
    });

    const result = await r2.send(command);
    return NextResponse.json({ etag: result.ETag });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH — Complete multipart upload
 * Body: { key, uploadId, parts: [{ partNumber, etag }] }
 */
export async function PATCH(req: NextRequest) {
  try {
    const { key, uploadId, parts } = await req.json();
    if (!key || !uploadId || !parts) {
      return errorResponse("Missing key, uploadId, or parts", 400);
    }

    const command = new CompleteMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map(
          (p: { partNumber: number; etag: string }) => ({
            PartNumber: p.partNumber,
            ETag: p.etag,
          })
        ),
      },
    });

    await r2.send(command);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE — Abort multipart upload (cleanup on failure)
 * Query: ?key=...&uploadId=...
 */
export async function DELETE(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get("key");
    const uploadId = req.nextUrl.searchParams.get("uploadId");

    if (!key || !uploadId) {
      return errorResponse("Missing key or uploadId", 400);
    }

    const command = new AbortMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
    });

    await r2.send(command);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
