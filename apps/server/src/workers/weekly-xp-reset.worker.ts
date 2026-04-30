import { Worker, type Job } from "bullmq";
import Redis from "ioredis";
import { env } from "@pruvi/env/server";
import { db } from "@pruvi/db";
import { MeRepository } from "../features/me/me.repository";
import type { WeeklyXpResetJobData } from "../plugins/queue";
import { parseRedisUrl } from "../utils/redis";

export function startWeeklyXpResetWorker() {
  if (!env.REDIS_URL) {
    console.log("No REDIS_URL — weekly-xp-reset worker disabled");
    return null;
  }

  const connection = parseRedisUrl(env.REDIS_URL);
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
  const repo = new MeRepository(db);

  const worker = new Worker<WeeklyXpResetJobData>(
    "weekly-xp-reset",
    async (job: Job<WeeklyXpResetJobData>) => {
      if (job.data.scope === "user" && job.data.userId) {
        await repo.resetWeeklyXpForUser(job.data.userId);
        await redis.del(`me:${job.data.userId}`);
        return { mode: "user", userId: job.data.userId };
      }

      // scope === "all"
      await repo.resetWeeklyXpForAll();
      // Pattern delete me:* — fine at current scale
      const stream = redis.scanStream({ match: "me:*", count: 100 });
      const keys: string[] = [];
      for await (const batch of stream) {
        keys.push(...(batch as string[]));
      }
      if (keys.length > 0) await redis.del(...keys);
      return { mode: "all", invalidatedKeys: keys.length };
    },
    { connection, concurrency: 1 }
  );

  worker.on("failed", (job, err) => {
    console.error("weekly-xp-reset failed", job?.id, err);
  });

  return {
    worker,
    cleanup: async () => {
      await worker.close();
      await redis.quit();
    },
  };
}
