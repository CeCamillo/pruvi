import { Worker, Queue, type Job } from "bullmq";
import { Expo } from "expo-server-sdk";
import { env } from "@pruvi/env/server";
import { db } from "@pruvi/db";
import { parseRedisUrl } from "../utils/redis";
import { TokensRepository } from "../features/notifications/tokens.repository";
import { TokensService } from "../features/notifications/tokens.service";
import { PreferencesRepository } from "../features/notifications/preferences.repository";
import { SweepRepository } from "../features/notifications/sweep.repository";
import { Dispatcher, type SendJobData } from "../features/notifications/dispatcher";
import { PushClient } from "../features/notifications/push.client";

export function startNotificationsWorker() {
  if (!env.REDIS_URL) {
    console.log("No REDIS_URL — notifications worker disabled");
    return null;
  }

  const connection = parseRedisUrl(env.REDIS_URL);

  const tokensRepo = new TokensRepository(db);
  const prefsRepo = new PreferencesRepository(db);
  const sweepRepo = new SweepRepository(db);
  const tokensService = new TokensService(tokensRepo);
  const sendQueue = new Queue<SendJobData>("notifications-send", { connection });
  const dispatcher = new Dispatcher({ tokensService, prefsRepo, sweepRepo, sendQueue });

  const expoInstance = new Expo(
    env.EXPO_ACCESS_TOKEN ? { accessToken: env.EXPO_ACCESS_TOKEN } : {},
  );
  // Expo.isExpoPushToken is a static method; adapt to ExpoLike interface shape
  const expoAdapter = {
    sendPushNotificationsAsync: (msgs: Parameters<typeof expoInstance.sendPushNotificationsAsync>[0]) =>
      expoInstance.sendPushNotificationsAsync(msgs),
    isExpoPushToken: (token: unknown) => Expo.isExpoPushToken(token),
  };
  const pushClient = new PushClient(expoAdapter);

  const cronWorker = new Worker(
    "notifications-cron",
    async (_job: Job<{ kind: "sweep" }>) => {
      const utcHour = new Date().getUTCHours();
      const brtHour = (utcHour + 24 - 3) % 24;
      await dispatcher.dispatchStreakReminder({ brtHour, variant: "primary" });
      await dispatcher.dispatchStreakReminder({ brtHour, variant: "late" });
      return { brtHour };
    },
    { connection, concurrency: 1 },
  );

  const sendWorker = new Worker<SendJobData>(
    "notifications-send",
    async (job: Job<SendJobData>) => {
      const { tokens, title, body, data } = job.data;
      const tickets = await pushClient.sendBatch(tokens, { title, body }, data);
      const pruned = pushClient.pruneTokensFromTickets(tokens, tickets);
      if (pruned.length > 0) {
        await tokensRepo.deleteTokens(pruned);
      }
      return { sent: tokens.length, pruned: pruned.length };
    },
    { connection, concurrency: 5 },
  );

  cronWorker.on("failed", (job, err) => console.error("cron job failed:", job?.id, err));
  sendWorker.on("failed", (job, err) => console.error("send job failed:", job?.id, err));

  const cleanup = async () => {
    await Promise.all([cronWorker.close(), sendWorker.close(), sendQueue.close()]);
  };

  return { cleanup };
}
