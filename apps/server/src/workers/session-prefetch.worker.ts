import { Worker, type Job } from "bullmq";
import { env } from "@pruvi/env/server";
import { db } from "@pruvi/db";
import { SessionsRepository } from "../features/sessions/sessions.repository";
import type { SessionPrefetchJobData } from "../plugins/queue";
import { parseRedisUrl } from "../utils/redis";
import Redis from "ioredis";

const PREFETCH_TTL = 3600; // 1 hour
const PREFETCH_QUESTION_COUNT = 10;

export function startSessionPrefetchWorker() {
  if (!env.REDIS_URL) {
    console.log("No REDIS_URL — session prefetch worker disabled");
    return null;
  }

  const connection = parseRedisUrl(env.REDIS_URL);

  // Separate Redis client for direct cache reads/writes
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  const repo = new SessionsRepository(db);

  const worker = new Worker<SessionPrefetchJobData>(
    "session-prefetch",
    async (job: Job<SessionPrefetchJobData>) => {
      const { userId, mode } = job.data;
      const cacheKey = `prefetch:${userId}`;

      // Idempotency: skip if already cached
      const existing = await redis.get(cacheKey);
      if (existing) {
        return { skipped: true };
      }

      // Run SM-2 selection algorithm
      const questions = await repo.selectQuestions(
        userId,
        PREFETCH_QUESTION_COUNT,
        mode
      );

      // Strip correctOptionIndex before caching
      const safeQuestions = questions.map(
        ({ correctOptionIndex: _, ...q }) => q
      );

      // Store in Redis with 1h TTL
      await redis.set(
        cacheKey,
        JSON.stringify(safeQuestions),
        "EX",
        PREFETCH_TTL
      );

      return { cached: safeQuestions.length };
    },
    { connection, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    console.error(`Session prefetch job ${job?.id} failed:`, err);
  });

  const cleanup = async () => {
    await worker.close();
    await redis.quit();
  };

  return { worker, cleanup };
}
