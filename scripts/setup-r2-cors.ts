/**
 * setup-r2-cors.ts — Configure CORS on the R2 bucket
 *
 * Run once: npx tsx scripts/setup-r2-cors.ts
 *
 * This allows browsers to upload directly to R2 via presigned URLs.
 * Without CORS rules, R2 blocks all cross-origin requests from browsers.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function main() {
  await r2.send(
    new PutBucketCorsCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ["http://localhost:3000"],
            AllowedMethods: ["GET", "PUT", "HEAD"],
            AllowedHeaders: ["*"],
            MaxAgeSeconds: 3600,
          },
          // Add your production domain here later:
          // {
          //   AllowedOrigins: ["https://webinar.ai"],
          //   AllowedMethods: ["GET", "PUT", "HEAD"],
          //   AllowedHeaders: ["*"],
          //   MaxAgeSeconds: 3600,
          // },
        ],
      },
    })
  );

  console.log("CORS configured on R2 bucket successfully.");
}

main().catch((err) => {
  console.error("Failed to configure CORS:", err.message);
  process.exit(1);
});
