import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { Queue } from "bullmq";
import { env } from "@pruvi/env/server";
import { parseRedisUrl } from "../utils/redis";

declare module "fastify" {
  interface FastifyInstance {
    queues: {
      sessionPrefetch: Queue | null;
      weeklyXpReset: Queue<WeeklyXpResetJobData> | null;
    };
  }
}

export type SessionPrefetchJobData = {
  userId: string;
  mode: "all" | "theoretical";
};

export type WeeklyXpResetJobData = {
  scope: "all" | "user";
  userId?: string;
};

const plugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  if (!env.REDIS_URL) {
    fastify.log.info("No REDIS_URL — BullMQ queues disabled");
    fastify.decorate("queues", { sessionPrefetch: null, weeklyXpReset: null });
    return;
  }

  const connection = parseRedisUrl(env.REDIS_URL);

  const sessionPrefetchQueue = new Queue<SessionPrefetchJobData>(
    "session-prefetch",
    { connection }
  );

  const weeklyXpResetQueue = new Queue<WeeklyXpResetJobData>(
    "weekly-xp-reset",
    { connection }
  );

  // Register the recurring Monday 00:00 BRT reset, idempotent.
  await weeklyXpResetQueue.add(
    "weekly-reset",
    { scope: "all" },
    {
      repeat: { pattern: "0 0 * * 1", tz: "America/Sao_Paulo" },
      jobId: "weekly-xp-reset:repeat",
    }
  );

  fastify.decorate("queues", {
    sessionPrefetch: sessionPrefetchQueue,
    weeklyXpReset: weeklyXpResetQueue,
  });

  fastify.addHook("onClose", async () => {
    await sessionPrefetchQueue.close();
    await weeklyXpResetQueue.close();
  });
};

export const queuePlugin = fp(plugin, {
  name: "queue",
  dependencies: ["redis"],
});
