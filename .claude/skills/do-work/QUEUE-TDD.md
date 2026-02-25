# QUEUE-TDD — BullMQ Processor TDD

## Pattern

Separate **processing logic** from **queue wiring**. The processor is a pure function that receives `db` + `redis` as arguments.

## Rules

1. **Processor is a pure function** — `(db, redis, jobData) => Promise<result>`
2. **Worker file is thin wiring** — <20 lines, just connects processor to queue
3. **Mock Redis with a simple Map** in tests — no real Redis needed
4. **Test the processor**, not the queue infrastructure
5. **One test at a time**: RED → GREEN → next

## Example

```typescript
// prefetch.processor.ts
export async function processPrefetch(db: Database, redis: RedisLike, data: { userId: string }) {
  // Query SM-2 due questions, cache in Redis
}

// prefetch.worker.ts (thin wiring)
import { Worker } from "bullmq";
import { redis } from "../redis/client";
import { db } from "@pruvi/db";
import { processPrefetch } from "./prefetch.processor";

new Worker(
  "prefetch-questions",
  async (job) => {
    await processPrefetch(db, redis, job.data);
  },
  { connection: redis },
);
```

```typescript
// __tests__/prefetch.processor.test.ts
it("caches tomorrow's questions in redis", async () => {
  const mockRedis = new Map();
  // seed db with user + questions + review logs
  await processPrefetch(db, mockRedis, { userId });
  expect(mockRedis.has(`prefetch:${userId}`)).toBe(true);
});
```

## Redis Mock

```typescript
// For tests, use a simple Map that implements the subset of Redis commands you need:
const mockRedis = {
  store: new Map<string, string>(),
  async set(key: string, value: string, _ex?: string, _ttl?: number) {
    this.store.set(key, value);
    return "OK";
  },
  async get(key: string) {
    return this.store.get(key) ?? null;
  },
  async del(key: string) {
    this.store.delete(key);
    return 1;
  },
};
```

## File Structure

```
apps/server/src/queues/
├── index.ts                    # Queue definitions
├── prefetch.processor.ts       # Pure logic (testable)
├── prefetch.worker.ts          # Thin wiring (<20 lines)
└── __tests__/
    └── prefetch.processor.test.ts
```
