import { startSessionPrefetchWorker } from "./workers/session-prefetch.worker";

const worker = startSessionPrefetchWorker();

if (!worker) {
  console.error("Worker failed to start — REDIS_URL required");
  process.exit(1);
}

console.log("Session prefetch worker started");

// Graceful shutdown
const shutdown = async () => {
  console.log("Shutting down worker...");
  await worker.cleanup();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
