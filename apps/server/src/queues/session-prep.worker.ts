import { Worker } from "bullmq";

import { redis } from "../redis/client";
import { SESSION_PREP_QUEUE } from "./session-prep.queue";

// Placeholder worker — full implementation in Issue #29
new Worker(
  SESSION_PREP_QUEUE,
  (_job) => {
    // TODO(#29): run SM-2 question selection and cache result in Redis
    return Promise.resolve();
  },
  { connection: redis },
);
