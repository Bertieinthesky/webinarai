/**
 * connection.ts — Redis connection config for BullMQ job queues
 *
 * PURPOSE:
 *   Provides the Redis connection configuration used by all BullMQ queues
 *   and workers. Redis acts as the message broker between the Next.js API
 *   (which enqueues jobs) and the video-processor worker (which runs them).
 *
 * ENVIRONMENTS:
 *   - Development: Upstash Redis (serverless, TLS-enabled)
 *   - Production: Upstash Redis (serverless, TLS-enabled, pay-per-request)
 *
 * ARCHITECTURE:
 *   - Used by: queues.ts (queue definitions), video-processor.ts (worker)
 *   - Parses the REDIS_URL env var into BullMQ's ConnectionOptions format
 *   - Automatically enables TLS for rediss:// (Upstash) connections
 *   - Uses lazy evaluation so env vars can be loaded before first access
 */

import { ConnectionOptions } from "bullmq";

function parseRedisUrl(url: string): ConnectionOptions {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port, 10) || 6379,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      username: parsed.username || undefined,
      // Upstash requires TLS
      tls: parsed.protocol === "rediss:" ? {} : undefined,
      maxRetriesPerRequest: null,
    };
  } catch {
    return { host: "localhost", port: 6379, maxRetriesPerRequest: null };
  }
}

let _cached: ConnectionOptions | null = null;

export function getRedisConnection(): ConnectionOptions {
  if (!_cached) {
    _cached = parseRedisUrl(process.env.REDIS_URL || "redis://localhost:6379");
  }
  return _cached;
}
