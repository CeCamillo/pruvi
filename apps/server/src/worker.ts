import { startSessionPrefetchWorker } from "./workers/session-prefetch.worker";
import { startWeeklyXpResetWorker } from "./workers/weekly-xp-reset.worker";

const sessionPrefetch = startSessionPrefetchWorker();
const weeklyReset = startWeeklyXpResetWorker();

if (!sessionPrefetch || !weeklyReset) {
  console.error("Worker failed to start — REDIS_URL required");
  process.exit(1);
}

console.log("Workers started: session-prefetch, weekly-xp-reset");

// Graceful shutdown
const shutdown = async () => {
  console.log("Shutting down workers...");
  await sessionPrefetch.cleanup();
  await weeklyReset.cleanup();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
