import { startSessionPrefetchWorker } from "./workers/session-prefetch.worker";
import { startNotificationsWorker } from "./workers/notifications.worker";
import { startBillingSweepWorker } from "./workers/billing-sweep.worker";

const prefetch = startSessionPrefetchWorker();
const notifications = startNotificationsWorker();
const billing = startBillingSweepWorker();

if (!prefetch && !notifications && !billing) {
  console.error("All workers failed to start — REDIS_URL required");
  process.exit(1);
}

console.log("Workers started:", {
  prefetch: !!prefetch,
  notifications: !!notifications,
  billing: !!billing,
});

const shutdown = async () => {
  console.log("Shutting down workers...");
  if (prefetch) await prefetch.cleanup();
  if (notifications) await notifications.cleanup();
  if (billing) await billing.cleanup();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
