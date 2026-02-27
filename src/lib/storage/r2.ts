/**
 * r2.ts — Cloudflare R2 storage client
 *
 * PURPOSE:
 *   Handles all video file storage operations. R2 is an S3-compatible object
 *   storage service from Cloudflare with ONE critical advantage: zero egress fees.
 *
 * WHY R2 OVER S3:
 *   Video files are large and served frequently. A single 50MB variant video
 *   served to 10,000 viewers = 500GB of egress. On AWS S3, that costs ~$45.
 *   On Cloudflare R2, it costs $0. At scale, this is the difference between
 *   a viable business and a bankrupt one.
 *
 * CAPABILITIES:
 *   - Generate presigned upload URLs (for direct browser-to-R2 uploads)
 *   - Generate presigned download URLs (for temporary access to private files)
 *   - Upload/download files as buffers (for worker-side operations)
 *   - Delete files (for cleanup)
 *
 * ARCHITECTURE:
 *   - Used by: API routes (presigned URLs for uploads), video-processor worker
 *     (download originals, upload normalized/stitched), storage proxy route
 *   - In production: Videos are served via Cloudflare CDN (cdn.webinar.ai)
 *     pointing at this R2 bucket, with aggressive caching (immutable content)
 *   - In development: Videos are proxied through /api/storage/[...key]
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.R2_BUCKET_NAME!;

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2Client, command, { expiresIn });
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  return getSignedUrl(r2Client, command, { expiresIn });
}

export async function downloadToBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  const response = await r2Client.send(command);
  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function uploadFromBuffer(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  await r2Client.send(command);
}

export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  await r2Client.send(command);
}

export { r2Client, BUCKET };
