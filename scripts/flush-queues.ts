/**
 * Flush BullMQ queues to clear stuck/failed jobs.
 * Run: npx tsx scripts/flush-queues.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Queue } from "bullmq";
import { getRedisConnection } from "../src/lib/queue/connection";

async function main() {
  const normalizeQueue = new Queue("normalize", { connection: getRedisConnection() });
  const renderQueue = new Queue("render", { connection: getRedisConnection() });

  console.log("Obliterating normalize queue...");
  await normalizeQueue.obliterate({ force: true });

  console.log("Obliterating render queue...");
  await renderQueue.obliterate({ force: true });

  await normalizeQueue.close();
  await renderQueue.close();

  console.log("Done! Queues cleared. Click 'Process All Variants' again.");
}

main().catch(console.error);
