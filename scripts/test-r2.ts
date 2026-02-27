/**
 * Quick test: can we generate a presigned URL and PUT to R2?
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { S3Client, PutObjectCommand, ListBucketsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function main() {
  console.log("R2_ACCOUNT_ID:", process.env.R2_ACCOUNT_ID);
  console.log("R2_BUCKET_NAME:", process.env.R2_BUCKET_NAME);
  console.log("R2_ACCESS_KEY_ID:", process.env.R2_ACCESS_KEY_ID?.slice(0, 8) + "...");

  // Test 1: List buckets
  try {
    const buckets = await r2.send(new ListBucketsCommand({}));
    console.log("Buckets:", buckets.Buckets?.map(b => b.Name));
  } catch (err: any) {
    console.error("ListBuckets failed:", err.message);
  }

  // Test 2: Generate presigned URL
  try {
    const cmd = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: "test/upload-test.txt",
      ContentType: "text/plain",
    });
    const url = await getSignedUrl(r2, cmd, { expiresIn: 60 });
    console.log("Presigned URL generated:", url.slice(0, 80) + "...");

    // Test 3: Actually PUT to the presigned URL
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: "hello from test script",
    });
    console.log("PUT response:", res.status, res.statusText);
    if (!res.ok) {
      const text = await res.text();
      console.log("PUT error body:", text);
    }
  } catch (err: any) {
    console.error("Presigned URL test failed:", err.message);
  }
}

main();
