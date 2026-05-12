import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { Queue } from "bullmq";
import { env } from "@pruvi/env/server";
import { parseRedisUrl } from "../utils/redis";
import type { SendJobData } from "../features/notifications/dispatcher";

export type BillingSweepJobData = { kind: "sweep" };

declare module "fastify" {
  interface FastifyInstance {
    queues: {
      sessionPrefetch: Queue | null;
      notificationsCron: Queue | null;
      notificationsSend: Queue<SendJobData> | null;
      billingSweep: Queue<BillingSweepJobData> | null;
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
      billingSweep: null,
    });
    return;
  }

  const connection = parseRedisUrl(env.REDIS_URL);

  const sessionPrefetchQueue = new Queue<SessionPrefetchJobData>("session-prefetch", { connection });
  const notificationsCronQueue = new Queue<NotificationsCronJobData>("notifications-cron", { connection });
  const notificationsSendQueue = new Queue<SendJobData>("notifications-send", { connection });

  const billingSweepQueue = new Queue<BillingSweepJobData>("billing-cron", { connection });

  // Hourly cron — BullMQ dedupes repeatable jobs by name + pattern, so re-registration on boot is idempotent
  await notificationsCronQueue.add(
    "sweep",
    { kind: "sweep" },
    { repeat: { pattern: "0 * * * *" }, removeOnComplete: true, removeOnFail: true },
  );

  await billingSweepQueue.add(
    "sweep",
    { kind: "sweep" },
    { repeat: { pattern: "0 * * * *" }, removeOnComplete: true, removeOnFail: true },
  );

  fastify.decorate("queues", {
    sessionPrefetch: sessionPrefetchQueue,
    notificationsCron: notificationsCronQueue,
    notificationsSend: notificationsSendQueue,
    billingSweep: billingSweepQueue,
  });

  fastify.addHook("onClose", async () => {
    await Promise.all([
      sessionPrefetchQueue.close(),
      notificationsCronQueue.close(),
      notificationsSendQueue.close(),
      billingSweepQueue.close(),
    ]);
  });
};

export const queuePlugin = fp(plugin, {
  name: "queue",
  dependencies: ["redis"],
});
