import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { Queue } from "bullmq";
import { env } from "@pruvi/env/server";
import { parseRedisUrl } from "../utils/redis";
import type { SendJobData } from "../features/notifications/dispatcher";

declare module "fastify" {
  interface FastifyInstance {
    queues: {
      sessionPrefetch: Queue | null;
      notificationsCron: Queue | null;
      notificationsSend: Queue<SendJobData> | null;
    };
  }
}

export type SessionPrefetchJobData = {
  userId: string;
  mode: "all" | "theoretical";
};

export type NotificationsCronJobData = { kind: "sweep" };

const plugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  if (!env.REDIS_URL) {
    fastify.log.info("No REDIS_URL — BullMQ queues disabled");
    fastify.decorate("queues", {
      sessionPrefetch: null,
      notificationsCron: null,
      notificationsSend: null,
    });
    return;
  }

  const connection = parseRedisUrl(env.REDIS_URL);

  const sessionPrefetchQueue = new Queue<SessionPrefetchJobData>("session-prefetch", { connection });
  const notificationsCronQueue = new Queue<NotificationsCronJobData>("notifications-cron", { connection });
  const notificationsSendQueue = new Queue<SendJobData>("notifications-send", { connection });

  // Hourly cron — BullMQ dedupes repeatable jobs by name + pattern, so re-registration on boot is idempotent
  await notificationsCronQueue.add(
    "sweep",
    { kind: "sweep" },
    { repeat: { pattern: "0 * * * *" }, removeOnComplete: true, removeOnFail: true },
  );

  fastify.decorate("queues", {
    sessionPrefetch: sessionPrefetchQueue,
    notificationsCron: notificationsCronQueue,
    notificationsSend: notificationsSendQueue,
  });

  fastify.addHook("onClose", async () => {
    await Promise.all([
      sessionPrefetchQueue.close(),
      notificationsCronQueue.close(),
      notificationsSendQueue.close(),
    ]);
  });
};

export const queuePlugin = fp(plugin, {
  name: "queue",
  dependencies: ["redis"],
});
