import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { Queue } from "bullmq";
import { env } from "@pruvi/env/server";
import { parseRedisUrl } from "../utils/redis";

declare module "fastify" {
  interface FastifyInstance {
    queues: {
      sessionPrefetch: Queue | null;
    };
  }
}

export type SessionPrefetchJobData = {
  userId: string;
  mode: "all" | "theoretical";
};

const plugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  if (!env.REDIS_URL) {
    fastify.log.info("No REDIS_URL — BullMQ queues disabled");
    fastify.decorate("queues", { sessionPrefetch: null });
    return;
  }

  const connection = parseRedisUrl(env.REDIS_URL);

  const sessionPrefetchQueue = new Queue<SessionPrefetchJobData>(
    "session-prefetch",
    { connection }
  );

  fastify.decorate("queues", {
    sessionPrefetch: sessionPrefetchQueue,
  });

  fastify.addHook("onClose", async () => {
    await sessionPrefetchQueue.close();
  });
};

export const queuePlugin = fp(plugin, {
  name: "queue",
  dependencies: ["redis"],
});
