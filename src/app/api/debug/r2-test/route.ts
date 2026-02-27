import { NextResponse } from "next/server";
import { getPresignedUploadUrl } from "@/lib/storage/r2";

export async function GET() {
  try {
    // 1. Generate a presigned URL
    const key = `test/debug-${Date.now()}.txt`;
    const url = await getPresignedUploadUrl(key, "text/plain", 300);

    // 2. Try uploading to it from the server
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: "r2 upload test",
    });

    const responseBody = await res.text();

    return NextResponse.json({
      presignedUrlHost: new URL(url).hostname,
      presignedUrlPath: new URL(url).pathname,
      fullUrl: url,
      uploadStatus: res.status,
      uploadOk: res.ok,
      r2Response: responseBody.slice(0, 500),
      r2AccountId: process.env.R2_ACCOUNT_ID?.slice(0, 8) + "...",
      r2Bucket: process.env.R2_BUCKET_NAME,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
