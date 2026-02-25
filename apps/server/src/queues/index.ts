import { Queue } from "bullmq";
import { redis } from "../redis/client";

export const prefetchQueue = new Queue("prefetch-questions", {
  connection: redis,
});
