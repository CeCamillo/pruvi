# Phase 1C — Progress & Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /users/me/progress` (per-subject lifetime accuracy) and `GET /users/me/calendar?from=...&to=...` (completed-session dates in range).

**Architecture:** New feature module `apps/server/src/features/progress/` following the existing repository → service → route pattern. Shared Zod schemas in `@pruvi/shared/progress.ts`. Progress cache invalidated by `POST /questions/:id/answer`; calendar relies on TTL only.

**Tech Stack:** Drizzle ORM, Fastify with `fastify-type-provider-zod`, Vitest + PGlite, Zod via `@pruvi/shared`, `neverthrow` Results, Redis cache.

**Reference spec:** `docs/superpowers/specs/2026-05-10-phase-1c-progress-calendar-design.md`

---

## File Structure

### Created
- `packages/shared/src/progress.ts` — Zod schemas for both endpoints
- `apps/server/src/features/progress/index.ts`
- `apps/server/src/features/progress/progress.repository.ts`
- `apps/server/src/features/progress/progress.service.ts`
- `apps/server/src/features/progress/progress.route.ts`
- `apps/server/src/features/progress/progress.service.test.ts`
- `apps/server/src/features/progress/progress.repository.integration.test.ts`

### Modified
- `packages/shared/src/index.ts` — re-export progress
- `apps/server/src/features/reviews/reviews.route.ts` — invalidate `progress:{userId}` cache after answer write
- `apps/server/src/index.ts` — register `progressRoutes`

---

## Task 0: Branch setup

**Files:** none (branching only)

- [ ] **Step 1: Verify on `phase-1a-onboarding-identity` and clean**

```bash
cd /Users/cesarcamillo/dev/pruvi
git status --short
git log --oneline -3
```

Expected: branch is `phase-1a-onboarding-identity`; clean working tree (untracked docs are OK).

- [ ] **Step 2: Create Phase 1C branch off Phase 1A**

```bash
git checkout -b phase-1c-progress-calendar
git log --oneline -3
```

Expected: HEAD matches `phase-1a-onboarding-identity`.

- [ ] **Step 3: Verify baseline still passes**

```bash
pnpm run check-types 2>&1 | grep "error TS" | grep -v "test\.ts\|integration\.test" | head -5
pnpm --filter server test 2>&1 | tail -5
```

Expected: zero non-test errors; 58/58 unit tests pass.

No commit needed for Task 0.

---

## Task 1: Add shared Zod schemas

**Files:**
- Create: `packages/shared/src/progress.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create `packages/shared/src/progress.ts`**

```typescript
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const SubjectProgressSchema = z.object({
  subjectSlug: z.string(),
  subjectName: z.string(),
  totalReviews: z.number().int().nonnegative(),
  totalCorrect: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(1),
});

export type SubjectProgress = z.infer<typeof SubjectProgressSchema>;

export const ProgressResponseSchema = z.object({
  totalReviews: z.number().int().nonnegative(),
  totalCorrect: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(1),
  bySubject: z.array(SubjectProgressSchema),
});

export type ProgressResponse = z.infer<typeof ProgressResponseSchema>;

export const CalendarQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
});

export type CalendarQuery = z.infer<typeof CalendarQuerySchema>;

export const CalendarResponseSchema = z.object({
  dates: z.array(isoDate),
});

export type CalendarResponse = z.infer<typeof CalendarResponseSchema>;
```

- [ ] **Step 2: Append re-export to `packages/shared/src/index.ts`**

Read the file first to see current state. Add at the end:

```typescript
export * from "./progress";
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/cesarcamillo/dev/pruvi
pnpm run check-types 2>&1 | grep "error TS" | grep -v "test\.ts\|integration\.test" | head -5
```

Expected: zero non-test errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/progress.ts packages/shared/src/index.ts
git commit -m "feat(shared): add progress + calendar Zod schemas"
```

---

## Task 2: Progress feature module (repository + service + route + unit tests)

**Files:**
- Create: `apps/server/src/features/progress/progress.repository.ts`
- Create: `apps/server/src/features/progress/progress.service.ts`
- Create: `apps/server/src/features/progress/progress.route.ts`
- Create: `apps/server/src/features/progress/index.ts`
- Create: `apps/server/src/features/progress/progress.service.test.ts`

- [ ] **Step 1: Create `progress.repository.ts`**

```typescript
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { reviewLog } from "@pruvi/db/schema/review-log";
import { question } from "@pruvi/db/schema/questions";
import { subject } from "@pruvi/db/schema/subjects";
import { dailySession } from "@pruvi/db/schema/daily-sessions";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export interface SubjectAggregate {
  subjectSlug: string;
  subjectName: string;
  totalReviews: number;
  totalCorrect: number;
}

export class ProgressRepository {
  constructor(private db: DbClient) {}

  /** Aggregate review_log per subject for a user. Returns one row per subject the user has reviewed. */
  async getProgressBySubject(userId: string): Promise<SubjectAggregate[]> {
    const rows = await this.db
      .select({
        subjectSlug: subject.slug,
        subjectName: subject.name,
        totalReviews: sql<number>`COUNT(*)::int`,
        totalCorrect: sql<number>`SUM(CASE WHEN ${reviewLog.quality} >= 3 THEN 1 ELSE 0 END)::int`,
      })
      .from(reviewLog)
      .innerJoin(question, eq(question.id, reviewLog.questionId))
      .innerJoin(subject, eq(subject.id, question.subjectId))
      .where(eq(reviewLog.userId, userId))
      .groupBy(subject.id, subject.slug, subject.name)
      .orderBy(subject.name);

    return rows;
  }

  /** Distinct dates (YYYY-MM-DD) where user completed at least one daily_session in [from, to]. */
  async getCompletedDatesInRange(
    userId: string,
    from: string,
    to: string
  ): Promise<string[]> {
    const rows = await this.db
      .select({
        day: sql<string>`(${dailySession.createdAt}::date)::text`,
      })
      .from(dailySession)
      .where(
        and(
          eq(dailySession.userId, userId),
          eq(dailySession.status, "completed"),
          gte(dailySession.createdAt, sql`${from}::timestamp`),
          lt(dailySession.createdAt, sql`(${to}::date + INTERVAL '1 day')::timestamp`)
        )
      )
      .groupBy(sql`(${dailySession.createdAt}::date)`)
      .orderBy(sql`(${dailySession.createdAt}::date)`);

    return rows.map((r) => r.day);
  }
}
```

- [ ] **Step 2: Create `progress.service.ts`**

```typescript
import { err, ok, type Result } from "neverthrow";
import { ValidationError, AppError } from "../../utils/errors";
import type { ProgressRepository } from "./progress.repository";

const MAX_RANGE_DAYS = 400;

export interface ProgressView {
  totalReviews: number;
  totalCorrect: number;
  accuracy: number;
  bySubject: Array<{
    subjectSlug: string;
    subjectName: string;
    totalReviews: number;
    totalCorrect: number;
    accuracy: number;
  }>;
}

function safeAccuracy(correct: number, reviews: number): number {
  if (reviews === 0) return 0;
  return correct / reviews;
}

function daysBetween(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  return Math.floor((toMs - fromMs) / 86400000);
}

export class ProgressService {
  constructor(private repo: ProgressRepository) {}

  async getProgress(userId: string): Promise<Result<ProgressView, AppError>> {
    const rows = await this.repo.getProgressBySubject(userId);

    const bySubject = rows.map((r) => ({
      subjectSlug: r.subjectSlug,
      subjectName: r.subjectName,
      totalReviews: r.totalReviews,
      totalCorrect: r.totalCorrect,
      accuracy: safeAccuracy(r.totalCorrect, r.totalReviews),
    }));

    const totalReviews = bySubject.reduce((sum, s) => sum + s.totalReviews, 0);
    const totalCorrect = bySubject.reduce((sum, s) => sum + s.totalCorrect, 0);

    return ok({
      totalReviews,
      totalCorrect,
      accuracy: safeAccuracy(totalCorrect, totalReviews),
      bySubject,
    });
  }

  async getCalendar(
    userId: string,
    from: string,
    to: string
  ): Promise<Result<{ dates: string[] }, AppError>> {
    const diff = daysBetween(from, to);
    if (Number.isNaN(diff)) {
      return err(new ValidationError("Invalid date format"));
    }
    if (diff < 0) {
      return err(new ValidationError("'to' must be on or after 'from'"));
    }
    if (diff > MAX_RANGE_DAYS) {
      return err(
        new AppError(
          `Range exceeds ${MAX_RANGE_DAYS} days`,
          400,
          "RANGE_TOO_LARGE"
        )
      );
    }

    const dates = await this.repo.getCompletedDatesInRange(userId, from, to);
    return ok({ dates });
  }
}
```

- [ ] **Step 3: Create `progress.route.ts`**

```typescript
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { CalendarQuerySchema } from "@pruvi/shared";
import { db } from "@pruvi/db";
import { ProgressRepository } from "./progress.repository";
import { ProgressService } from "./progress.service";
import { successResponse, unwrapResult } from "../../types";

const repo = new ProgressRepository(db);
const service = new ProgressService(repo);

const PROGRESS_CACHE_TTL = 300;
const CALENDAR_CACHE_TTL = 60;

export const progressRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/users/me/progress",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const cacheKey = `progress:${request.userId}`;
      const cached = await fastify.cache.get<unknown>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }
      const result = await service.getProgress(request.userId);
      const response = unwrapResult(result);
      await fastify.cache.set(cacheKey, response.data, PROGRESS_CACHE_TTL);
      return response;
    }
  );

  fastify.get(
    "/users/me/calendar",
    {
      preHandler: [fastify.authenticate],
      schema: { querystring: CalendarQuerySchema },
    },
    async (request) => {
      const { from, to } = request.query;
      const cacheKey = `calendar:${request.userId}:${from}:${to}`;
      const cached = await fastify.cache.get<unknown>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }
      const result = await service.getCalendar(request.userId, from, to);
      const response = unwrapResult(result);
      await fastify.cache.set(cacheKey, response.data, CALENDAR_CACHE_TTL);
      return response;
    }
  );
};
```

- [ ] **Step 4: Create `index.ts`**

```typescript
export { progressRoutes } from "./progress.route";
```

- [ ] **Step 5: Create `progress.service.test.ts`**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProgressService } from "./progress.service";
import type { ProgressRepository } from "./progress.repository";

const USER_ID = "user-1";

function makeMockRepo() {
  return {
    getProgressBySubject: vi.fn(),
    getCompletedDatesInRange: vi.fn(),
  } as unknown as ProgressRepository & {
    getProgressBySubject: ReturnType<typeof vi.fn>;
    getCompletedDatesInRange: ReturnType<typeof vi.fn>;
  };
}

describe("ProgressService", () => {
  let repo: ReturnType<typeof makeMockRepo>;
  let service: ProgressService;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new ProgressService(repo);
  });

  describe("getProgress", () => {
    it("returns zero accuracy when no reviews", async () => {
      repo.getProgressBySubject.mockResolvedValue([]);
      const result = await service.getProgress(USER_ID);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual({
          totalReviews: 0,
          totalCorrect: 0,
          accuracy: 0,
          bySubject: [],
        });
      }
    });

    it("computes per-subject and global accuracy", async () => {
      repo.getProgressBySubject.mockResolvedValue([
        {
          subjectSlug: "matematica",
          subjectName: "Matemática",
          totalReviews: 10,
          totalCorrect: 8,
        },
        {
          subjectSlug: "biologia",
          subjectName: "Biologia",
          totalReviews: 5,
          totalCorrect: 5,
        },
      ]);
      const result = await service.getProgress(USER_ID);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.totalReviews).toBe(15);
        expect(result.value.totalCorrect).toBe(13);
        expect(result.value.accuracy).toBeCloseTo(13 / 15);
        expect(result.value.bySubject[0]?.accuracy).toBeCloseTo(0.8);
        expect(result.value.bySubject[1]?.accuracy).toBe(1);
      }
    });
  });

  describe("getCalendar", () => {
    it("returns dates from repo on valid range", async () => {
      repo.getCompletedDatesInRange.mockResolvedValue(["2026-05-01", "2026-05-03"]);
      const result = await service.getCalendar(USER_ID, "2026-05-01", "2026-05-31");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.dates).toEqual(["2026-05-01", "2026-05-03"]);
      }
    });

    it("rejects when to < from", async () => {
      const result = await service.getCalendar(USER_ID, "2026-05-10", "2026-05-01");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.statusCode).toBe(400);
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("rejects when range > 400 days with RANGE_TOO_LARGE", async () => {
      const result = await service.getCalendar(USER_ID, "2024-01-01", "2026-01-01");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.statusCode).toBe(400);
        expect(result.error.code).toBe("RANGE_TOO_LARGE");
      }
    });

    it("accepts exactly 400-day range", async () => {
      repo.getCompletedDatesInRange.mockResolvedValue([]);
      const result = await service.getCalendar(USER_ID, "2026-01-01", "2027-02-05");
      expect(result.isOk()).toBe(true);
    });
  });
});
```

- [ ] **Step 6: Run unit tests**

```bash
cd /Users/cesarcamillo/dev/pruvi
pnpm --filter server exec vitest run src/features/progress/progress.service.test.ts 2>&1 | tail -15
```

Expected: 6 tests pass.

- [ ] **Step 7: Typecheck**

```bash
pnpm run check-types 2>&1 | grep "error TS" | grep -v "test\.ts\|integration\.test" | head -5
```

Expected: zero non-test errors.

- [ ] **Step 8: Commit**

```bash
git add apps/server/src/features/progress/
git commit -m "feat(server): add progress feature (per-subject accuracy + activity calendar)"
```

---

## Task 3: Integration tests for progress queries

**Files:**
- Create: `apps/server/src/features/progress/progress.repository.integration.test.ts`

- [ ] **Step 1: Read existing integration test pattern**

```bash
head -40 /Users/cesarcamillo/dev/pruvi/apps/server/src/features/sessions/sessions.repository.integration.test.ts
```

Note the imports: `setupTestDb`, `cleanupTestDb`, `teardownTestDb`, `getTestDb` from `../../test/db-helpers`. Mirror this pattern.

- [ ] **Step 2: Create the integration test**

Path: `apps/server/src/features/progress/progress.repository.integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDb, teardownTestDb, cleanupTestDb, getTestDb } from "../../test/db-helpers";
import { user } from "@pruvi/db/schema/auth";
import { subject } from "@pruvi/db/schema/subjects";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import { dailySession } from "@pruvi/db/schema/daily-sessions";
import { ProgressRepository } from "./progress.repository";

const USER_ID = "test-progress-user";

describe("ProgressRepository integration", () => {
  let repo: ProgressRepository;

  beforeAll(async () => {
    await setupTestDb();
    repo = new ProgressRepository(getTestDb());
  });

  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("getProgressBySubject aggregates reviews per subject and counts correct vs wrong", async () => {
    const db = getTestDb();

    await db.insert(user).values({
      id: USER_ID,
      name: "Test",
      email: "test@example.com",
      emailVerified: false,
      updatedAt: new Date(),
    });

    const [subjA] = await db
      .insert(subject)
      .values({ name: "Matemática", slug: "matematica" })
      .returning();
    const [subjB] = await db
      .insert(subject)
      .values({ name: "Biologia", slug: "biologia" })
      .returning();

    if (!subjA || !subjB) throw new Error("Failed to seed subjects");

    const [q1] = await db
      .insert(question)
      .values({
        content: "Q1",
        options: ["a", "b", "c", "d"],
        correctOptionIndex: 0,
        difficulty: "easy",
        subjectId: subjA.id,
      })
      .returning();
    const [q2] = await db
      .insert(question)
      .values({
        content: "Q2",
        options: ["a", "b", "c", "d"],
        correctOptionIndex: 1,
        difficulty: "medium",
        subjectId: subjB.id,
      })
      .returning();

    if (!q1 || !q2) throw new Error("Failed to seed questions");

    // 2 reviews on subjA (1 correct, 1 wrong), 1 review on subjB (correct)
    await db.insert(reviewLog).values([
      {
        userId: USER_ID,
        questionId: q1.id,
        quality: 4,
        easinessFactor: "2.50",
        interval: 1,
        repetitions: 1,
        nextReviewAt: new Date(Date.now() + 86400000),
      },
      {
        userId: USER_ID,
        questionId: q1.id,
        quality: 1,
        easinessFactor: "2.50",
        interval: 1,
        repetitions: 0,
        nextReviewAt: new Date(Date.now() + 86400000),
      },
      {
        userId: USER_ID,
        questionId: q2.id,
        quality: 4,
        easinessFactor: "2.50",
        interval: 1,
        repetitions: 1,
        nextReviewAt: new Date(Date.now() + 86400000),
      },
    ]);

    const rows = await repo.getProgressBySubject(USER_ID);

    expect(rows).toHaveLength(2);
    const biologia = rows.find((r) => r.subjectSlug === "biologia");
    const matematica = rows.find((r) => r.subjectSlug === "matematica");

    expect(biologia).toEqual({
      subjectSlug: "biologia",
      subjectName: "Biologia",
      totalReviews: 1,
      totalCorrect: 1,
    });
    expect(matematica).toEqual({
      subjectSlug: "matematica",
      subjectName: "Matemática",
      totalReviews: 2,
      totalCorrect: 1,
    });
  });

  it("getCompletedDatesInRange returns distinct completed-session dates within [from, to]", async () => {
    const db = getTestDb();

    await db.insert(user).values({
      id: USER_ID,
      name: "Test",
      email: "test@example.com",
      emailVerified: false,
      updatedAt: new Date(),
    });

    // Three sessions across three different dates; only two are completed.
    // Use explicit createdAt to control the date bucket.
    await db.insert(dailySession).values([
      {
        userId: USER_ID,
        status: "completed",
        questionsAnswered: 10,
        questionsCorrect: 8,
        completedAt: new Date("2026-05-01T15:00:00Z"),
        createdAt: new Date("2026-05-01T15:00:00Z"),
      },
      {
        userId: USER_ID,
        status: "completed",
        questionsAnswered: 10,
        questionsCorrect: 7,
        completedAt: new Date("2026-05-03T15:00:00Z"),
        createdAt: new Date("2026-05-03T15:00:00Z"),
      },
      {
        userId: USER_ID,
        status: "active",
        createdAt: new Date("2026-05-05T15:00:00Z"),
      },
    ]);

    const dates = await repo.getCompletedDatesInRange(USER_ID, "2026-05-01", "2026-05-31");

    expect(dates).toEqual(["2026-05-01", "2026-05-03"]);
  });

  it("getCompletedDatesInRange excludes dates outside the range", async () => {
    const db = getTestDb();

    await db.insert(user).values({
      id: USER_ID,
      name: "Test",
      email: "test@example.com",
      emailVerified: false,
      updatedAt: new Date(),
    });

    await db.insert(dailySession).values([
      {
        userId: USER_ID,
        status: "completed",
        completedAt: new Date("2026-04-30T15:00:00Z"),
        createdAt: new Date("2026-04-30T15:00:00Z"),
      },
      {
        userId: USER_ID,
        status: "completed",
        completedAt: new Date("2026-05-15T15:00:00Z"),
        createdAt: new Date("2026-05-15T15:00:00Z"),
      },
      {
        userId: USER_ID,
        status: "completed",
        completedAt: new Date("2026-06-01T15:00:00Z"),
        createdAt: new Date("2026-06-01T15:00:00Z"),
      },
    ]);

    const dates = await repo.getCompletedDatesInRange(USER_ID, "2026-05-01", "2026-05-31");

    expect(dates).toEqual(["2026-05-15"]);
  });
});
```

- [ ] **Step 3: Run integration tests**

```bash
cd /Users/cesarcamillo/dev/pruvi
pnpm --filter server test:integration -- src/features/progress/progress.repository.integration.test.ts 2>&1 | tail -15
```

Expected: 3 tests pass.

- [ ] **Step 4: Run full integration suite to confirm no regression**

```bash
pnpm --filter server test:integration 2>&1 | tail -10
```

Expected: all integration tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/features/progress/progress.repository.integration.test.ts
git commit -m "test(server): integration tests for progress aggregation and date-range queries"
```

---

## Task 4: Invalidate progress cache from reviews route

**Files:**
- Modify: `apps/server/src/features/reviews/reviews.route.ts`

- [ ] **Step 1: Add `progress:${userId}` to the existing `Promise.all` invalidation block**

Read `apps/server/src/features/reviews/reviews.route.ts`. Find the block:

```typescript
      // Invalidate lives and XP caches
      await Promise.all([
        fastify.cache.del(`lives:${request.userId}`),
        fastify.cache.del(`xp:${request.userId}`),
      ]);
```

Replace with:

```typescript
      // Invalidate lives, XP, and progress caches
      await Promise.all([
        fastify.cache.del(`lives:${request.userId}`),
        fastify.cache.del(`xp:${request.userId}`),
        fastify.cache.del(`progress:${request.userId}`),
      ]);
```

- [ ] **Step 2: Typecheck**

```bash
pnpm run check-types 2>&1 | grep "error TS" | grep -v "test\.ts\|integration\.test" | head -5
```

Expected: zero non-test errors.

- [ ] **Step 3: Unit tests still pass**

```bash
pnpm --filter server test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/features/reviews/reviews.route.ts
git commit -m "fix(server): invalidate progress cache after answer write"
```

---

## Task 5: Register progressRoutes in server

**Files:**
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Add import**

Open `apps/server/src/index.ts`. Find the feature-routes import block (alphabetized by feature name):

```typescript
import { gamificationRoutes } from "./features/gamification";
import { livesRoutes } from "./features/lives";
import { onboardingRoutes } from "./features/onboarding";
import { reviewsRoutes } from "./features/reviews";
import { sessionsRoutes } from "./features/sessions";
import { streaksRoutes } from "./features/streaks";
import { usersRoutes } from "./features/users";
```

Replace with (inserts `progressRoutes` in alphabetical order):

```typescript
import { gamificationRoutes } from "./features/gamification";
import { livesRoutes } from "./features/lives";
import { onboardingRoutes } from "./features/onboarding";
import { progressRoutes } from "./features/progress";
import { reviewsRoutes } from "./features/reviews";
import { sessionsRoutes } from "./features/sessions";
import { streaksRoutes } from "./features/streaks";
import { usersRoutes } from "./features/users";
```

- [ ] **Step 2: Register the route**

Find the registration block:

```typescript
  await app.register(sessionsRoutes);
  await app.register(reviewsRoutes);
  await app.register(livesRoutes);
  await app.register(streaksRoutes);
  await app.register(gamificationRoutes);
  await app.register(onboardingRoutes);
  await app.register(usersRoutes);
```

Add `progressRoutes` at the end:

```typescript
  await app.register(sessionsRoutes);
  await app.register(reviewsRoutes);
  await app.register(livesRoutes);
  await app.register(streaksRoutes);
  await app.register(gamificationRoutes);
  await app.register(onboardingRoutes);
  await app.register(usersRoutes);
  await app.register(progressRoutes);
```

- [ ] **Step 3: Typecheck + tests**

```bash
pnpm run check-types 2>&1 | grep "error TS" | grep -v "test\.ts\|integration\.test" | head -5
pnpm --filter server test 2>&1 | tail -5
```

Expected: zero non-test errors; all tests pass (64 total = 58 + 6 new).

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/index.ts
git commit -m "feat(server): register progressRoutes"
```

---

## Task 6: Final verification + PR

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

```bash
cd /Users/cesarcamillo/dev/pruvi
pnpm run check-types 2>&1 | grep "error TS" | grep -v "test\.ts\|integration\.test" | head -5
```

Expected: zero non-test errors.

- [ ] **Step 2: Unit tests**

```bash
pnpm --filter server test 2>&1 | tail -8
```

Expected: all tests pass.

- [ ] **Step 3: Integration tests**

```bash
pnpm --filter server test:integration 2>&1 | tail -8
```

Expected: all integration tests pass (including 3 new progress integration tests).

- [ ] **Step 4: Migration smoke test**

```bash
pnpm verify:migration 2>&1 | tail -8
```

Expected: `✓ Migration smoke test passed`.

- [ ] **Step 5: No stale refs**

```bash
grep -rn "TODO\|FIXME" apps/server/src/features/progress/ packages/shared/src/progress.ts 2>/dev/null || echo "clean"
```

Expected: `clean`.

- [ ] **Step 6: Push and open PR**

```bash
git push -u origin phase-1c-progress-calendar
gh pr create --base phase-1a-onboarding-identity --head phase-1c-progress-calendar \
  --title "Phase 1C: progress + calendar endpoints" \
  --body "$(cat <<'EOF'
## Summary

Adds two read-only endpoints the frontend progress screen needs:
- `GET /users/me/progress` — per-subject lifetime accuracy + global totals
- `GET /users/me/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` — completed-session dates in range

Stacked on Phase 1A (#11). Independent of Phase 0/1A changes; rebases cleanly if needed.

## Behavior

- Progress aggregates from `review_log`: a review is "correct" iff `quality >= 3` (canonical SM-2 threshold). Returns only subjects the user has reviewed.
- Calendar uses `daily_session.status = 'completed'` (same definition the streak logic uses).
- Calendar range capped at 400 days; over that returns `400 RANGE_TOO_LARGE`. `to < from` returns `400 VALIDATION_ERROR`.
- Progress cached 300s, invalidated on `POST /questions/:id/answer`.
- Calendar cached 60s; TTL-only (no active invalidation).

## Known limitations (deferred to Phase 2)

- Server-local timezone for date bucketing (`created_at::date`). Same convention as existing streak logic. Phase 2 timezone work fixes all three together.

## Test plan

- [x] 6 new unit tests
- [x] 3 new integration tests (subject aggregation, date range, range filter)
- [x] Full integration suite passes
- [x] Smoke test passes
EOF
)" 2>&1 | tail -3
```

- [ ] **Step 7: Confirm PR opened**

The output of `gh pr create` should print the PR URL.

---

## Definition of Done (from spec)

- [ ] `progress/` feature module created with all 6 files
- [ ] `@pruvi/shared/progress.ts` created and re-exported
- [ ] Both endpoints respond correctly per spec
- [ ] Range validation works (`to >= from`, 400-day cap)
- [ ] `reviews.route.ts` invalidates `progress:{userId}` after answer write
- [ ] ~6 new unit tests pass
- [ ] ~2 new integration tests pass (we wrote 3 — even better)
- [ ] `pnpm verify:migration` still passes
- [ ] No regression in existing endpoints

---

## Notes for the implementing agent

- **`getTestDb()` vs constructing drizzle in tests**: the existing pattern uses `getTestDb()` from `db-helpers.ts` (returns a ready-to-use Drizzle client). Don't construct a new drizzle instance from the pool — use the helper.
- **`cleanupTestDb()` between tests**: the helper truncates tables but preserves schema. The `beforeEach(cleanupTestDb)` pattern ensures test isolation. Without it, the `USER_ID = "test-progress-user"` insert in test 2 would collide with test 1.
- **The SQL `(${dailySession.createdAt}::date)::text` cast**: returns a string in `YYYY-MM-DD` format. Don't try to parse and reformat it — Postgres returns the canonical ISO string.
- **`COUNT(*)::int`**: without the explicit cast, pg returns a `string` for COUNT (because of bigint). The `::int` cast forces a TS `number` via Drizzle's type inference.
- **The `AppError` import**: re-imported as `AppErrorType` in service to avoid name collision with the runtime class. Both refer to the same thing; the alias is for type-only usage.
