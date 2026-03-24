# Backend Architecture Gaps Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all gaps between the architecture overview and the current implementation — BullMQ session pre-generation, Brotli compression, XP/levels, Docker pinning, lives bug fix, streak cache alignment, and questions module refactor.

**Architecture:** Five groups of changes, ordered to minimize churn. Group 1 is trivial config. Group 2 adds BullMQ infrastructure and session prefetch. Group 3 adds XP/level logic. Group 4 fixes bugs and aligns caching. Group 5 refactors question selection into its own module.

**Tech Stack:** Fastify 5, BullMQ, @fastify/compress, ioredis, Drizzle ORM, Vitest, neverthrow

---

## Chunk 1: Quick Wins + BullMQ Infrastructure

### Task 1: Pin Docker PostgreSQL image

**Files:**
- Modify: `packages/db/docker-compose.yml`

- [ ] **Step 1: Pin postgres image to 17-alpine**

```yaml
# Change line 5 from:
image: postgres
# To:
image: postgres:17-alpine
```

- [ ] **Step 2: Verify docker-compose is valid**

Run: `cd /Users/cesarcamillo/dev/pruvi/packages/db && docker compose config --quiet`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/db/docker-compose.yml
git commit -m "fix(db): pin PostgreSQL image to 17-alpine"
```

---

### Task 2: Add Brotli compression

**Files:**
- Modify: `apps/server/package.json` (add dependency)
- Modify: `apps/server/src/index.ts` (register plugin)

- [ ] **Step 1: Install @fastify/compress**

Run: `cd /Users/cesarcamillo/dev/pruvi && pnpm add @fastify/compress --filter server`

- [ ] **Step 2: Register compression plugin in server entrypoint**

In `apps/server/src/index.ts`, add import at top:

```typescript
import fastifyCompress from "@fastify/compress";
```

Register it right after CORS (before error handler), using Brotli as preferred encoding:

```typescript
await app.register(fastifyCompress, {
  brotli: (await import("node:zlib")).constants,
});
```

Full registration order becomes:
1. CORS
2. Compress (new)
3. Error handler
4. Redis
5. Auth

- [ ] **Step 3: Verify server starts**

Run: `cd /Users/cesarcamillo/dev/pruvi && pnpm run check-types`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add apps/server/package.json apps/server/src/index.ts pnpm-lock.yaml
git commit -m "feat(server): add Brotli compression via @fastify/compress"
```

---

### Task 3: Install BullMQ and create queue infrastructure

**Files:**
- Modify: `apps/server/package.json` (add bullmq dependency)
- Create: `apps/server/src/plugins/queue.ts` (BullMQ plugin)
- Modify: `apps/server/src/index.ts` (register queue plugin)

- [ ] **Step 1: Install BullMQ**

Run: `cd /Users/cesarcamillo/dev/pruvi && pnpm add bullmq --filter server`

- [ ] **Step 2: Create the queue plugin**

Create `apps/server/src/plugins/queue.ts`:

```typescript
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { env } from "@pruvi/env/server";

declare module "fastify" {
  interface FastifyInstance {
    queues: {
      sessionPrefetch: Queue | null;
    };
  }
}

export type SessionPrefetchJobData = {
  userId: string;
  mode: "all" | "theoretical";
};

const plugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  if (!env.REDIS_URL) {
    fastify.log.info("No REDIS_URL — BullMQ queues disabled");
    fastify.decorate("queues", { sessionPrefetch: null });
    return;
  }

  // BullMQ requires an ioredis instance with maxRetriesPerRequest: null.
  // Passing the full URL preserves TLS support for rediss:// (Upstash, etc.)
  const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  const sessionPrefetchQueue = new Queue<SessionPrefetchJobData>(
    "session-prefetch",
    { connection }
  );

  fastify.decorate("queues", {
    sessionPrefetch: sessionPrefetchQueue,
  });

  fastify.addHook("onClose", async () => {
    await sessionPrefetchQueue.close();
    await connection.quit();
  });
};

export const queuePlugin = fp(plugin, {
  name: "queue",
  dependencies: ["redis"],
});
```

- [ ] **Step 3: Create the session prefetch worker**

Create `apps/server/src/workers/session-prefetch.worker.ts`:

```typescript
import { Worker, type Job } from "bullmq";
import { env } from "@pruvi/env/server";
import { db } from "@pruvi/db";
import { SessionsRepository } from "../features/sessions/sessions.repository";
import type { SessionPrefetchJobData } from "../plugins/queue";
import Redis from "ioredis";

const PREFETCH_TTL = 3600; // 1 hour
const PREFETCH_QUESTION_COUNT = 10;

export function startSessionPrefetchWorker() {
  if (!env.REDIS_URL) {
    console.log("No REDIS_URL — session prefetch worker disabled");
    return null;
  }

  // BullMQ connection: requires maxRetriesPerRequest: null
  const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  // Separate Redis client for direct cache reads/writes
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  const repo = new SessionsRepository(db);

  const worker = new Worker<SessionPrefetchJobData>(
    "session-prefetch",
    async (job: Job<SessionPrefetchJobData>) => {
      const { userId, mode } = job.data;
      const cacheKey = `prefetch:${userId}`;

      // Idempotency: skip if already cached
      const existing = await redis.get(cacheKey);
      if (existing) {
        return { skipped: true };
      }

      // Run SM-2 selection algorithm
      const questions = await repo.selectQuestions(
        userId,
        PREFETCH_QUESTION_COUNT,
        mode
      );

      // Strip correctOptionIndex before caching
      const safeQuestions = questions.map(
        ({ correctOptionIndex: _, ...q }) => q
      );

      // Store in Redis with 1h TTL
      await redis.set(cacheKey, JSON.stringify(safeQuestions), "EX", PREFETCH_TTL);

      return { cached: safeQuestions.length };
    },
    { connection, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    console.error(`Session prefetch job ${job?.id} failed:`, err);
  });

  // Graceful cleanup — close both the worker's BullMQ connection and the cache client
  const cleanup = async () => {
    await worker.close();
    await connection.quit();
    await redis.quit();
  };

  return { worker, cleanup };
}
```

- [ ] **Step 4: Register queue plugin and start worker in server entrypoint**

In `apps/server/src/index.ts`:

Add import:
```typescript
import { queuePlugin } from "./plugins/queue";
import { startSessionPrefetchWorker } from "./workers/session-prefetch.worker";
```

Register after redis plugin:
```typescript
await app.register(queuePlugin);
```

In the `if (import.meta.main)` block, start the worker after building the app:

```typescript
if (import.meta.main) {
  const app = await buildApp();
  const prefetchWorker = startSessionPrefetchWorker();
  app.addHook("onClose", async () => {
    await prefetchWorker?.cleanup();
  });
  app.listen({ port: 3000 }, (err) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    }
  });
}
```

- [ ] **Step 5: Verify types**

Run: `cd /Users/cesarcamillo/dev/pruvi && pnpm run check-types`

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/plugins/queue.ts apps/server/src/workers/session-prefetch.worker.ts apps/server/src/index.ts apps/server/package.json pnpm-lock.yaml
git commit -m "feat(server): add BullMQ queue infrastructure and session prefetch worker"
```

---

### Task 4: Wire session prefetch — enqueue on complete, read on start

**Files:**
- Modify: `apps/server/src/features/sessions/sessions.route.ts` (enqueue job on complete, read cache on start)

- [ ] **Step 1: Update session complete route to enqueue prefetch job**

In `apps/server/src/features/sessions/sessions.route.ts`, in the `POST /sessions/:id/complete` handler, after cache invalidation, add:

```typescript
// Enqueue next session pre-generation
if (fastify.queues.sessionPrefetch) {
  await fastify.queues.sessionPrefetch.add(
    `prefetch-${request.userId}`,
    { userId: request.userId, mode: "all" },
    {
      removeOnComplete: true,
      removeOnFail: 100,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    }
  );
}
```

- [ ] **Step 2: Update session start route to check prefetch cache**

In `apps/server/src/features/sessions/sessions.route.ts`, in the `POST /sessions/start` handler, replace the entire handler body. The prefetch cache stores questions already stripped of `correctOptionIndex` (safe for client). When the cache hits, we skip both the service's question selection AND the route's strip logic:

```typescript
async (request) => {
  const { mode } = request.body;

  // Check for pre-generated questions in Redis (already stripped of correctOptionIndex)
  const prefetchKey = `prefetch:${request.userId}`;
  const cachedQuestions = await fastify.cache.get<unknown[]>(prefetchKey);

  const result = await service.startSession(request.userId, mode, !!cachedQuestions);
  const { session, questions } = unwrapResult(result).data;

  // If cache hit, use cached questions; otherwise strip correctOptionIndex from DB results
  const safeQuestions = cachedQuestions ?? questions.map(
    ({ correctOptionIndex: _, ...q }) => q
  );

  // Invalidate caches
  await Promise.all([
    fastify.cache.del(`session-today:${request.userId}`),
    fastify.cache.del(prefetchKey),
  ]);

  return successResponse({ session, questions: safeQuestions });
}
```

- [ ] **Step 3: Update SessionsService.startSession to accept skipQuestions flag**

In `apps/server/src/features/sessions/sessions.service.ts`, update `startSession` to accept a `skipQuestions` boolean. When true (cache hit), the service skips question selection — the route layer handles serving cached questions directly. This avoids a type lie (casting cached data as full DB rows):

```typescript
async startSession(
  userId: string,
  mode: "all" | "theoretical",
  skipQuestions = false
): Promise<
  Result<
    {
      session: Awaited<ReturnType<SessionsRepository["createSession"]>>;
      questions: Awaited<ReturnType<SessionsRepository["selectQuestions"]>>;
    },
    AppError
  >
> {
  // Check if there's already an active session today
  const existing = await this.repo.findTodaySession(userId);
  if (existing && existing.status === "active") {
    // Resume: always fetch fresh questions (cache is for new sessions)
    const questions = await this.repo.selectQuestions(
      userId,
      DEFAULT_QUESTION_COUNT,
      mode
    );
    return ok({ session: existing, questions });
  }

  if (existing && existing.status === "completed") {
    return err(
      new ValidationError("You already completed today's session")
    );
  }

  // Create new session
  const session = await this.repo.createSession(userId);

  // Skip question selection if caller has cached questions
  const questions = skipQuestions
    ? []
    : await this.repo.selectQuestions(userId, DEFAULT_QUESTION_COUNT, mode);

  return ok({ session, questions });
}
```

- [ ] **Step 4: Verify types**

Run: `cd /Users/cesarcamillo/dev/pruvi && pnpm run check-types`

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/features/sessions/sessions.route.ts apps/server/src/features/sessions/sessions.service.ts
git commit -m "feat(server): wire session prefetch — enqueue on complete, read cache on start"
```

---

## Chunk 2: XP/Level System

### Task 5: Add XP calculation logic to @pruvi/shared

**Files:**
- Create: `packages/shared/src/xp.ts`
- Create: `packages/shared/src/xp.test.ts`
- Modify: `packages/shared/src/index.ts` (re-export)

- [ ] **Step 1: Write failing tests for XP calculation**

Create `packages/shared/src/xp.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  calculateXpForAnswer,
  getLevelForXp,
  XP_PER_DIFFICULTY,
  LEVEL_THRESHOLDS,
} from "./xp";

describe("calculateXpForAnswer", () => {
  it("returns 0 XP for wrong answer", () => {
    expect(calculateXpForAnswer(false, "easy")).toBe(0);
    expect(calculateXpForAnswer(false, "hard")).toBe(0);
  });

  it("returns difficulty-scaled XP for correct answer", () => {
    expect(calculateXpForAnswer(true, "easy")).toBe(XP_PER_DIFFICULTY.easy);
    expect(calculateXpForAnswer(true, "medium")).toBe(XP_PER_DIFFICULTY.medium);
    expect(calculateXpForAnswer(true, "hard")).toBe(XP_PER_DIFFICULTY.hard);
  });
});

describe("getLevelForXp", () => {
  it("returns level 1 for 0 XP", () => {
    expect(getLevelForXp(0)).toBe(1);
  });

  it("returns level 2 at 100 XP", () => {
    expect(getLevelForXp(100)).toBe(2);
  });

  it("returns level 3 at 350 XP (100+250)", () => {
    expect(getLevelForXp(350)).toBe(3);
  });

  it("returns correct level for XP between thresholds", () => {
    expect(getLevelForXp(50)).toBe(1);
    expect(getLevelForXp(200)).toBe(2);
  });

  it("caps at max level for very high XP", () => {
    const maxLevel = LEVEL_THRESHOLDS.length + 1;
    expect(getLevelForXp(999999)).toBe(maxLevel);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/cesarcamillo/dev/pruvi && pnpm --filter @pruvi/shared run test`
Expected: FAIL — module `./xp` not found

- [ ] **Step 3: Implement XP logic**

Create `packages/shared/src/xp.ts`:

```typescript
import { z } from "zod";
import type { Difficulty } from "./questions";

export const XP_PER_DIFFICULTY: Record<Difficulty, number> = {
  easy: 10,
  medium: 20,
  hard: 35,
} as const;

/**
 * Exponential level thresholds: cumulative XP needed to reach each level.
 * Level 1 = 0 XP, Level 2 = 100 XP, Level 3 = 350 XP, etc.
 */
export const LEVEL_THRESHOLDS = [
  100, 350, 750, 1400, 2400, 3900, 6000, 9000, 13000, 18500,
] as const;

/** XP awarded for a single answer. 0 if wrong. */
export function calculateXpForAnswer(
  correct: boolean,
  difficulty: Difficulty
): number {
  if (!correct) return 0;
  return XP_PER_DIFFICULTY[difficulty];
}

/** Determine the level for a given total XP amount. */
export function getLevelForXp(totalXp: number): number {
  let level = 1;
  for (const threshold of LEVEL_THRESHOLDS) {
    if (totalXp >= threshold) {
      level += 1;
    } else {
      break;
    }
  }
  return level;
}

/** GET response schema for XP/level endpoint */
export const XpResponseSchema = z.object({
  totalXp: z.number().int().min(0),
  currentLevel: z.number().int().min(1),
  xpForNextLevel: z.number().int().min(0),
});

export type XpResponse = z.infer<typeof XpResponseSchema>;

/** Calculate XP remaining until next level */
export function xpForNextLevel(totalXp: number): number {
  for (const threshold of LEVEL_THRESHOLDS) {
    if (totalXp < threshold) {
      return threshold - totalXp;
    }
  }
  return 0; // max level reached
}
```

- [ ] **Step 4: Export from shared index**

In `packages/shared/src/index.ts`, add:

```typescript
export * from "./xp";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/cesarcamillo/dev/pruvi && pnpm --filter @pruvi/shared run test`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/xp.ts packages/shared/src/xp.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): add XP calculation and level threshold logic"
```

---

### Task 6: Add gamification module — XP service, repository, routes

**Files:**
- Create: `apps/server/src/features/gamification/gamification.repository.ts`
- Create: `apps/server/src/features/gamification/gamification.service.ts`
- Create: `apps/server/src/features/gamification/gamification.route.ts`
- Create: `apps/server/src/features/gamification/index.ts`
- Modify: `apps/server/src/index.ts` (register routes)

- [ ] **Step 1: Create gamification repository**

Create `apps/server/src/features/gamification/gamification.repository.ts`:

```typescript
import { eq, sql } from "drizzle-orm";
import { user } from "@pruvi/db/schema/auth";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export class GamificationRepository {
  constructor(private db: DbClient) {}

  /** Get user's XP and level */
  async getUserXp(userId: string) {
    const rows = await this.db
      .select({
        totalXp: user.totalXp,
        currentLevel: user.currentLevel,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Award XP and update level atomically */
  async awardXp(userId: string, xpAmount: number, newLevel: number) {
    const [row] = await this.db
      .update(user)
      .set({
        totalXp: sql`${user.totalXp} + ${xpAmount}`,
        currentLevel: newLevel,
      })
      .where(eq(user.id, userId))
      .returning({
        totalXp: user.totalXp,
        currentLevel: user.currentLevel,
      });
    return row;
  }
}
```

- [ ] **Step 2: Create gamification service**

Create `apps/server/src/features/gamification/gamification.service.ts`:

```typescript
import { ok, err, type Result } from "neverthrow";
import {
  calculateXpForAnswer,
  getLevelForXp,
  xpForNextLevel,
  type Difficulty,
} from "@pruvi/shared";
import type { AppError } from "../../utils/errors";
import { NotFoundError } from "../../utils/errors";
import type { GamificationRepository } from "./gamification.repository";

export class GamificationService {
  constructor(private repo: GamificationRepository) {}

  /** Get user's XP, level, and XP needed for next level */
  async getXp(
    userId: string
  ): Promise<
    Result<
      { totalXp: number; currentLevel: number; xpForNextLevel: number },
      AppError
    >
  > {
    const data = await this.repo.getUserXp(userId);
    if (!data) {
      return err(new NotFoundError("User not found"));
    }

    return ok({
      totalXp: data.totalXp,
      currentLevel: data.currentLevel,
      xpForNextLevel: xpForNextLevel(data.totalXp),
    });
  }

  /** Award XP for answering a question */
  async awardXpForAnswer(
    userId: string,
    correct: boolean,
    difficulty: Difficulty
  ): Promise<Result<{ xpAwarded: number; totalXp: number; currentLevel: number }, AppError>> {
    const xpAwarded = calculateXpForAnswer(correct, difficulty);
    if (xpAwarded === 0) {
      // No XP for wrong answers — return current state
      const data = await this.repo.getUserXp(userId);
      return ok({
        xpAwarded: 0,
        totalXp: data?.totalXp ?? 0,
        currentLevel: data?.currentLevel ?? 1,
      });
    }

    // Get current XP to calculate new level
    const current = await this.repo.getUserXp(userId);
    const currentXp = current?.totalXp ?? 0;
    const newLevel = getLevelForXp(currentXp + xpAwarded);

    const updated = await this.repo.awardXp(userId, xpAwarded, newLevel);

    return ok({
      xpAwarded,
      totalXp: updated?.totalXp ?? currentXp + xpAwarded,
      currentLevel: updated?.currentLevel ?? newLevel,
    });
  }
}
```

- [ ] **Step 3: Create gamification route**

Create `apps/server/src/features/gamification/gamification.route.ts`:

```typescript
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { GamificationService } from "./gamification.service";
import { GamificationRepository } from "./gamification.repository";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";

const repo = new GamificationRepository(db);
const service = new GamificationService(repo);

const CACHE_TTL = 60; // 60 seconds

export const gamificationRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /users/me/xp
  fastify.get(
    "/users/me/xp",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const cacheKey = `xp:${request.userId}`;

      const cached = await fastify.cache.get<{
        totalXp: number;
        currentLevel: number;
        xpForNextLevel: number;
      }>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const result = await service.getXp(request.userId);
      const response = unwrapResult(result);

      await fastify.cache.set(cacheKey, response.data, CACHE_TTL);

      return response;
    }
  );
};
```

- [ ] **Step 4: Create index file**

Create `apps/server/src/features/gamification/index.ts`:

```typescript
export { gamificationRoutes } from "./gamification.route";
```

- [ ] **Step 5: Register gamification routes in server entrypoint**

In `apps/server/src/index.ts`, add import:
```typescript
import { gamificationRoutes } from "./features/gamification";
```

Register after streaks routes:
```typescript
await app.register(gamificationRoutes);
```

- [ ] **Step 6: Verify types**

Run: `cd /Users/cesarcamillo/dev/pruvi && pnpm run check-types`

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/features/gamification/
git add apps/server/src/index.ts
git commit -m "feat(server): add gamification module with XP/level endpoint"
```

---

### Task 7: Wire XP awarding into the answer flow

**Files:**
- Modify: `apps/server/src/features/reviews/reviews.service.ts` (award XP after answer)
- Modify: `apps/server/src/features/reviews/reviews.repository.ts` (add getQuestionDifficulty)
- Modify: `apps/server/src/features/reviews/reviews.route.ts` (invalidate XP cache)

- [ ] **Step 1: Add difficulty to the answer response flow**

In `apps/server/src/features/reviews/reviews.service.ts`:

Add import at top:
```typescript
import { calculateXpForAnswer, getLevelForXp } from "@pruvi/shared";
import type { Difficulty } from "@pruvi/shared";
```

First, update the function signature's return type at lines 19-24 to include `xpAwarded`:

```typescript
async answerQuestion(
  userId: string,
  questionId: number,
  selectedOptionIndex: number
): Promise<
  Result<
    { correct: boolean; correctOptionIndex: number; livesRemaining: number; xpAwarded: number },
    AppError
  >
> {
```

The question is already fetched in `answerQuestion` (the `q` variable has all columns including `difficulty`). After inserting the review log (step 6), add XP awarding before the lives logic:

```typescript
// 6b. Award XP
const xpAwarded = calculateXpForAnswer(correct, q.difficulty as Difficulty);
if (xpAwarded > 0) {
  await this.repo.awardXp(userId, xpAwarded);
}
```

Also update the return value to include `xpAwarded`:
```typescript
return ok({
  correct,
  correctOptionIndex: q.correctOptionIndex,
  livesRemaining,
  xpAwarded,
});
```

- [ ] **Step 2: Add awardXp to ReviewsRepository**

In `apps/server/src/features/reviews/reviews.repository.ts`, add `sql` to the existing drizzle-orm import (it is not currently imported — the file only has `{ and, desc, eq }`):

```typescript
import { and, desc, eq, sql } from "drizzle-orm";
```

Add method:
```typescript
/** Award XP to user */
async awardXp(userId: string, xpAmount: number) {
  await this.db
    .update(user)
    .set({
      totalXp: sql`${user.totalXp} + ${xpAmount}`,
    })
    .where(eq(user.id, userId));
}
```

- [ ] **Step 3: Invalidate XP cache in reviews route**

In `apps/server/src/features/reviews/reviews.route.ts`, add XP cache invalidation alongside lives:

```typescript
// Invalidate lives and XP caches
await Promise.all([
  fastify.cache.del(`lives:${request.userId}`),
  fastify.cache.del(`xp:${request.userId}`),
]);
```

- [ ] **Step 4: Update AnswerQuestionResponseSchema in shared**

In `packages/shared/src/auth.ts`, update the response schema to include `xpAwarded`:

```typescript
export const AnswerQuestionResponseSchema = z.object({
  correct: z.boolean(),
  correctOptionIndex: z.number().int().min(0).max(3),
  livesRemaining: z.number().int().min(0),
  xpAwarded: z.number().int().min(0),
});
```

- [ ] **Step 5: Verify types**

Run: `cd /Users/cesarcamillo/dev/pruvi && pnpm run check-types`

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/features/reviews/ packages/shared/src/auth.ts
git commit -m "feat(server): award XP on correct answers and invalidate XP cache"
```

---

## Chunk 3: Fixes, Cache Alignment, and Questions Module Refactor

### Task 8: Fix lives auto-refill bug in reviews service

**Files:**
- Modify: `apps/server/src/features/reviews/reviews.service.ts`
- Modify: `apps/server/src/features/reviews/reviews.repository.ts`

The bug: In `reviews.service.ts:70-76`, when `livesResetAt < now`, the code sets `livesRemaining = 5` locally but never persists the refill to the database. The lives service does this correctly (calls `repo.resetLives`), but the reviews service doesn't.

- [ ] **Step 1: Add resetLives to ReviewsRepository**

In `apps/server/src/features/reviews/reviews.repository.ts`, add:

```typescript
/** Reset lives to MAX and clear the timer */
async resetLives(userId: string) {
  await this.db
    .update(user)
    .set({ lives: MAX_LIVES, livesResetAt: null })
    .where(eq(user.id, userId));
}
```

Add the import at the top (not currently present in `reviews.repository.ts`):
```typescript
import { MAX_LIVES } from "@pruvi/shared";
```

- [ ] **Step 2: Fix the auto-refill in answerQuestion**

In `apps/server/src/features/reviews/reviews.service.ts`, replace the lives logic block (lines 63-104) with:

```typescript
// 7. Handle lives
let livesRemaining = 5;
const userLives = await this.repo.getUserLives(userId);

if (userLives) {
  livesRemaining = userLives.lives;

  // Auto-refill if reset time has passed
  if (userLives.livesResetAt && userLives.livesResetAt < new Date()) {
    await this.repo.resetLives(userId);
    livesRemaining = 5;
  }

  if (!correct) {
    if (livesRemaining <= 0) {
      return err(
        new ValidationError("No lives remaining. Wait for refill.")
      );
    }

    const isFirstDecrement = livesRemaining === 5;
    await this.repo.decrementLives(userId, livesRemaining, isFirstDecrement);
    livesRemaining -= 1;
  }
}
```

- [ ] **Step 3: Verify types**

Run: `cd /Users/cesarcamillo/dev/pruvi && pnpm run check-types`

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/features/reviews/
git commit -m "fix(server): persist lives auto-refill in reviews service"
```

---

### Task 9: Align streak cache TTL to midnight

**Files:**
- Modify: `apps/server/src/features/streaks/streaks.route.ts`
- Modify: `apps/server/src/plugins/redis.ts` (add `setUntilMidnight` helper)

- [ ] **Step 1: Add setUntilMidnight to CacheHelper**

In `apps/server/src/plugins/redis.ts`, add method to `CacheHelper`:

```typescript
/** Cache until midnight (local server time). Min TTL: 60s. */
async setUntilMidnight(key: string, value: unknown): Promise<void> {
  if (!this.redis) return;
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const ttl = Math.max(60, Math.floor((midnight.getTime() - now.getTime()) / 1000));
  await this.redis.set(key, JSON.stringify(value), "EX", ttl);
}
```

- [ ] **Step 2: Update streaks route to use midnight TTL**

In `apps/server/src/features/streaks/streaks.route.ts`, replace:
```typescript
await fastify.cache.set(cacheKey, response.data, CACHE_TTL);
```
With:
```typescript
await fastify.cache.setUntilMidnight(cacheKey, response.data);
```

Remove the unused `CACHE_TTL` constant.

- [ ] **Step 3: Verify types**

Run: `cd /Users/cesarcamillo/dev/pruvi && pnpm run check-types`

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/plugins/redis.ts apps/server/src/features/streaks/streaks.route.ts
git commit -m "fix(server): align streak cache TTL to midnight instead of 60s"
```

---

### Task 10: Refactor question selection into questions module

**Files:**
- Create: `apps/server/src/features/questions/questions.repository.ts`
- Create: `apps/server/src/features/questions/questions.service.ts`
- Modify: `apps/server/src/features/questions/index.ts`
- Modify: `apps/server/src/features/sessions/sessions.repository.ts` (remove selectQuestions)
- Modify: `apps/server/src/features/sessions/sessions.service.ts` (use QuestionsService)
- Modify: `apps/server/src/features/sessions/sessions.route.ts` (inject QuestionsService)
- Modify: `apps/server/src/workers/session-prefetch.worker.ts` (use QuestionsRepository)

- [ ] **Step 1: Create questions repository**

Create `apps/server/src/features/questions/questions.repository.ts` by moving the `selectQuestions` method from `sessions.repository.ts`:

```typescript
import { and, asc, eq, lte, notInArray, sql, type SQL } from "drizzle-orm";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export class QuestionsRepository {
  constructor(private db: DbClient) {}

  /**
   * Smart question selection using SM-2 priority:
   * 1. Overdue questions (nextReviewAt <= now, most overdue first)
   * 2. Unseen questions (no review_log entry for this user)
   * 3. Least-recently-seen as fallback
   */
  async selectQuestions(
    userId: string,
    limit: number,
    mode: "all" | "theoretical"
  ) {
    const now = new Date();
    const selected: Array<typeof question.$inferSelect> = [];

    // Base filter for paper/pen mode
    const modeFilter: SQL | undefined =
      mode === "theoretical"
        ? eq(question.requiresCalculation, false)
        : undefined;

    // 1. Overdue questions
    if (selected.length < limit) {
      const overdue = await this.db
        .select({
          id: question.id,
          subjectId: question.subjectId,
          content: question.content,
          options: question.options,
          correctOptionIndex: question.correctOptionIndex,
          difficulty: question.difficulty,
          requiresCalculation: question.requiresCalculation,
          source: question.source,
        })
        .from(reviewLog)
        .innerJoin(question, eq(reviewLog.questionId, question.id))
        .where(
          and(
            eq(reviewLog.userId, userId),
            lte(reviewLog.nextReviewAt, now),
            modeFilter
          )
        )
        .orderBy(asc(reviewLog.nextReviewAt))
        .limit(limit - selected.length);

      selected.push(...overdue);
    }

    // 2. Unseen questions
    if (selected.length < limit) {
      const seenIds = await this.db
        .selectDistinct({ questionId: reviewLog.questionId })
        .from(reviewLog)
        .where(eq(reviewLog.userId, userId));

      const seenQuestionIds = seenIds.map((r) => r.questionId);

      const conditions: (SQL | undefined)[] = [modeFilter];
      if (seenQuestionIds.length > 0) {
        conditions.push(notInArray(question.id, seenQuestionIds));
      }

      const unseen = await this.db
        .select()
        .from(question)
        .where(and(...conditions))
        .limit(limit - selected.length);

      selected.push(...unseen);
    }

    // 3. Least-recently-seen fallback
    if (selected.length < limit) {
      const selectedIds = selected.map((q) => q.id);
      const conditions: (SQL | undefined)[] = [modeFilter];
      if (selectedIds.length > 0) {
        conditions.push(notInArray(question.id, selectedIds));
      }

      const fallback = await this.db
        .select({
          id: question.id,
          subjectId: question.subjectId,
          content: question.content,
          options: question.options,
          correctOptionIndex: question.correctOptionIndex,
          difficulty: question.difficulty,
          requiresCalculation: question.requiresCalculation,
          source: question.source,
        })
        .from(reviewLog)
        .innerJoin(question, eq(reviewLog.questionId, question.id))
        .where(and(eq(reviewLog.userId, userId), ...conditions))
        .orderBy(asc(reviewLog.reviewedAt))
        .limit(limit - selected.length);

      selected.push(...fallback);
    }

    return selected;
  }
}
```

- [ ] **Step 2: Create questions service**

Create `apps/server/src/features/questions/questions.service.ts`:

```typescript
import { ok, type Result } from "neverthrow";
import type { AppError } from "../../utils/errors";
import type { QuestionsRepository } from "./questions.repository";

const DEFAULT_QUESTION_COUNT = 10;

export class QuestionsService {
  constructor(private repo: QuestionsRepository) {}

  /** Select questions for a session using SM-2 priority */
  async selectForSession(
    userId: string,
    mode: "all" | "theoretical",
    count: number = DEFAULT_QUESTION_COUNT
  ): Promise<
    Result<
      Awaited<ReturnType<QuestionsRepository["selectQuestions"]>>,
      AppError
    >
  > {
    const questions = await this.repo.selectQuestions(userId, count, mode);
    return ok(questions);
  }
}
```

- [ ] **Step 3: Update questions index**

Replace the empty stub `apps/server/src/features/questions/index.ts` (currently just `export {}`):

```typescript
export { QuestionsRepository } from "./questions.repository";
export { QuestionsService } from "./questions.service";
```

- [ ] **Step 4: Remove selectQuestions from sessions repository**

In `apps/server/src/features/sessions/sessions.repository.ts`, remove the entire `selectQuestions` method (lines 66-166) and the now-unused imports (`asc`, `lte`, `notInArray`, `sql`, `SQL`, `question`, `reviewLog`).

The file should only have:
```typescript
import { and, eq, sql } from "drizzle-orm";
import { dailySession } from "@pruvi/db/schema/daily-sessions";
import type { db } from "@pruvi/db";

export type DbClient = typeof db;

export class SessionsRepository {
  constructor(private db: DbClient) {}

  async findTodaySession(userId: string) { /* unchanged */ }
  async createSession(userId: string) { /* unchanged */ }
  async completeSession(sessionId: number, questionCount: number, correctCount: number) { /* unchanged */ }
  async findSessionById(sessionId: number) { /* unchanged */ }
}
```

- [ ] **Step 5: Update sessions service to use QuestionsService**

In `apps/server/src/features/sessions/sessions.service.ts`:

Add imports:
```typescript
import type { QuestionsService } from "../questions/questions.service";
import type { QuestionsRepository } from "../questions/questions.repository";
```

Update constructor to accept QuestionsService:
```typescript
export class SessionsService {
  constructor(
    private repo: SessionsRepository,
    private questionsService: QuestionsService
  ) {}
```

**Critical:** Update the `startSession` return type annotation — it currently references `SessionsRepository["selectQuestions"]` which no longer exists after this refactor. Change the return type to use `QuestionsRepository["selectQuestions"]`:

```typescript
async startSession(
  userId: string,
  mode: "all" | "theoretical",
  skipQuestions = false
): Promise<
  Result<
    {
      session: Awaited<ReturnType<SessionsRepository["createSession"]>>;
      questions: Awaited<ReturnType<QuestionsRepository["selectQuestions"]>>;
    },
    AppError
  >
> {
```

Replace `this.repo.selectQuestions(...)` calls with `this.questionsService.selectForSession(...)`:

In `startSession`, the fresh-questions path becomes:
```typescript
const questionsResult = await this.questionsService.selectForSession(userId, mode);
if (questionsResult.isErr()) return err(questionsResult.error);
const questions = questionsResult.value;
```

Apply this pattern to both the resume path and the new-session path (where `skipQuestions` is false).

- [ ] **Step 6: Update sessions route to inject QuestionsService**

In `apps/server/src/features/sessions/sessions.route.ts`:

Replace repo/service instantiation:
```typescript
import { QuestionsRepository } from "../questions/questions.repository";
import { QuestionsService } from "../questions/questions.service";

const sessionsRepo = new SessionsRepository(db);
const questionsRepo = new QuestionsRepository(db);
const questionsService = new QuestionsService(questionsRepo);
const service = new SessionsService(sessionsRepo, questionsService);
```

- [ ] **Step 7: Update session prefetch worker**

In `apps/server/src/workers/session-prefetch.worker.ts`, replace:
```typescript
import { SessionsRepository } from "../features/sessions/sessions.repository";
```
With:
```typescript
import { QuestionsRepository } from "../features/questions/questions.repository";
```

And update the worker logic:
```typescript
const repo = new QuestionsRepository(db);

// Inside the job handler:
const questions = await repo.selectQuestions(
  userId,
  PREFETCH_QUESTION_COUNT,
  mode
);
```

- [ ] **Step 8: Verify types**

Run: `cd /Users/cesarcamillo/dev/pruvi && pnpm run check-types`

- [ ] **Step 9: Run all tests**

Run: `cd /Users/cesarcamillo/dev/pruvi && pnpm run test`
Expected: All pass

- [ ] **Step 10: Commit**

```bash
git add apps/server/src/features/questions/ apps/server/src/features/sessions/ apps/server/src/workers/
git commit -m "refactor(server): extract question selection into dedicated questions module"
```

---

## Verification

After all tasks are complete:

- [ ] **Full type check**: `pnpm run check-types`
- [ ] **Full test suite**: `pnpm run test`
- [ ] **Start server**: `pnpm run dev:server` — verify no startup errors
- [ ] **Health check**: `curl http://localhost:3000/health` — should return `{ success: true, data: "OK" }`
- [ ] **Verify compression**: `curl -H "Accept-Encoding: br" -v http://localhost:3000/health` — response should include `Content-Encoding: br`
