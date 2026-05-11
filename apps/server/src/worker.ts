import { startSessionPrefetchWorker } from "./workers/session-prefetch.worker";
import { startNotificationsWorker } from "./workers/notifications.worker";

const prefetch = startSessionPrefetchWorker();
const notifications = startNotificationsWorker();

if (!prefetch && !notifications) {
  console.error("All workers failed to start — REDIS_URL required");
  process.exit(1);
}

console.log("Workers started:", {
  prefetch: !!prefetch,
  notifications: !!notifications,
});

const shutdown = async () => {
  console.log("Shutting down workers...");
  if (prefetch) await prefetch.cleanup();
  if (notifications) await notifications.cleanup();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
