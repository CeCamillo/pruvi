import { Queue } from "bullmq";

import { redis } from "../redis/client";

export const SESSION_PREP_QUEUE = "session-prep";

export const sessionPrepQueue = new Queue(SESSION_PREP_QUEUE, {
  connection: redis,
});
