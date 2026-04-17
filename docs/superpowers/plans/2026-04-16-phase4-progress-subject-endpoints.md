# Phase 4: Progress & Subject Endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three authenticated GET endpoints (`/users/me/progress`, `/subjects/:slug/reviews`, `/users/me/calendar`) plus the native service/hooks/components/screens that consume them, so the Progress, Subject detail, and Profile screens become functional.

**Architecture:** Backend mirrors the existing lives/xp/streaks pattern — one feature folder (`apps/server/src/features/progress/`) with repository → service → route + cache-first reads. Cross-feature cache invalidation happens in the **route layer** (not service), matching the `reviews.route.ts` / `sessions.route.ts` convention. Native mirrors Phase 2 — one service file, three `useQuery` hooks, existing mutations extended with new query-key invalidations, three FlashList-rendered memo'd components, and screen wiring through TanStack Query.

**Tech Stack:** Fastify 5 + Drizzle + PostgreSQL + Redis (CacheHelper) + neverthrow + Zod on the server; Expo Router + TanStack Query v5 + Reanimated v3 + FlashList + HeroUI Native on the client; `@pruvi/shared` for schemas; Vitest for server tests.

**Base branch:** `fix/post-review-followups` (PR #6). Phase 4 depends on the db `pool` restore, `PORT` env default, and `_legacy/` move from that branch to run end-to-end locally.

---

## Spec reference

Full spec: `docs/superpowers/specs/2026-04-16-phase4-progress-subject-endpoints-design.md`

Response shapes (locked by integration map):

- `GET /users/me/progress` → `{ subjects: [{ slug, name, totalQuestions, correctCount, accuracy }] }`
- `GET /subjects/:slug/reviews` → `{ reviews: [{ questionId, body, correct, reviewedAt }] }`
- `GET /users/me/calendar?month=YYYY-MM` → `{ dates: string[] }`

Caching strategy:

| Key | TTL | Invalidated on |
|-----|-----|----------------|
| `progress:{userId}` | 60s | answer, session complete |
| `subject-reviews:{userId}:{slug}` | 60s | answer (for that subject) |
| `calendar:{userId}:{YYYY-MM}` + `calendar:{userId}:current` | until midnight | session complete |

---

## Task plan — 34 tasks, grouped in 7 milestones

### Milestone 0 — Branch setup

### Task 1: Create feature branch off PR #6

**Files:** none modified yet; this task only sets up the branch.

- [ ] **Step 1: Fetch + checkout the PR #6 branch**

```bash
cd /Users/cesarcamillo/dev/pruvi
git fetch origin
git checkout fix/post-review-followups
git pull origin fix/post-review-followups
```

- [ ] **Step 2: Create the Phase 4 feature branch**

```bash
git checkout -b feature/phase4-progress-subject
```

- [ ] **Step 3: Verify clean workspace**

Run: `git status`
Expected: `On branch feature/phase4-progress-subject` + `nothing to commit, working tree clean`.

---

### Milestone 1 — Shared Zod schemas + SM-2 helper

### Task 2: Add `qualityToCorrect` helper to sm2.ts

**Files:**
- Modify: `packages/shared/src/sm2.ts`
- Test: `packages/shared/src/__tests__/sm2.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/shared/src/__tests__/sm2.test.ts` (add the existing imports if missing):

```ts
import { qualityToCorrect } from "../sm2";

describe("qualityToCorrect", () => {
  it("returns true for quality >= 3", () => {
    expect(qualityToCorrect(3)).toBe(true);
    expect(qualityToCorrect(4)).toBe(true);
    expect(qualityToCorrect(5)).toBe(true);
  });

  it("returns false for quality < 3", () => {
    expect(qualityToCorrect(0)).toBe(false);
    expect(qualityToCorrect(1)).toBe(false);
    expect(qualityToCorrect(2)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/cesarcamillo/dev/pruvi/packages/shared && bun test __tests__/sm2.test.ts`
Expected: FAIL with "qualityToCorrect is not exported" (or similar module resolution error).

- [ ] **Step 3: Add the helper to `packages/shared/src/sm2.ts`**

Append at the end of the file:

```ts
/** Map an SM-2 quality score (0-5) to a correct/wrong boolean. Quality >= 3 is "correct". */
export function qualityToCorrect(quality: number): boolean {
  return quality >= 3;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/cesarcamillo/dev/pruvi/packages/shared && bun test __tests__/sm2.test.ts`
Expected: PASS (all sm2 tests including the 2 new ones).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/sm2.ts packages/shared/src/__tests__/sm2.test.ts
git commit -m "feat(shared): add qualityToCorrect helper for SM-2 booleans"
```

---

### Task 3: Create `progress.ts` shared schema

**Files:**
- Create: `packages/shared/src/progress.ts`

- [ ] **Step 1: Create the file**

Write `packages/shared/src/progress.ts`:

```ts
import { z } from "zod";

export const subjectProgressSchema = z.object({
  slug: z.string(),
  name: z.string(),
  totalQuestions: z.number().int().min(0),
  correctCount: z.number().int().min(0),
  accuracy: z.number().int().min(0).max(100),
});
export type SubjectProgress = z.infer<typeof subjectProgressSchema>;

export const progressResponseSchema = z.object({
  subjects: z.array(subjectProgressSchema),
});
export type ProgressResponse = z.infer<typeof progressResponseSchema>;
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/packages/shared && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/progress.ts
git commit -m "feat(shared): add progress response schemas"
```

---

### Task 4: Create `subject-reviews.ts` shared schema

**Files:**
- Create: `packages/shared/src/subject-reviews.ts`

- [ ] **Step 1: Create the file**

Write `packages/shared/src/subject-reviews.ts`:

```ts
import { z } from "zod";

export const reviewItemSchema = z.object({
  questionId: z.number().int(),
  body: z.string(),
  correct: z.boolean(),
  reviewedAt: z.string(),
});
export type ReviewItem = z.infer<typeof reviewItemSchema>;

export const subjectReviewsResponseSchema = z.object({
  reviews: z.array(reviewItemSchema),
});
export type SubjectReviewsResponse = z.infer<typeof subjectReviewsResponseSchema>;
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/packages/shared && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/subject-reviews.ts
git commit -m "feat(shared): add subject reviews response schemas"
```

---

### Task 5: Create `calendar.ts` shared schema

**Files:**
- Create: `packages/shared/src/calendar.ts`

- [ ] **Step 1: Create the file**

Write `packages/shared/src/calendar.ts`:

```ts
import { z } from "zod";

export const calendarQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
});
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;

export const calendarResponseSchema = z.object({
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});
export type CalendarResponse = z.infer<typeof calendarResponseSchema>;
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/packages/shared && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/calendar.ts
git commit -m "feat(shared): add calendar query and response schemas"
```

---

### Task 6: Re-export new schemas from `packages/shared/src/index.ts`

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Update the index**

Replace the entire content of `packages/shared/src/index.ts` with:

```ts
export * from "./questions";
export * from "./subjects";
export * from "./sessions";
export * from "./sm2";
export * from "./xp";
export * from "./lives";
export * from "./auth";
export * from "./progress";
export * from "./subject-reviews";
export * from "./calendar";
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/packages/shared && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Verify imports work from the server side**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/server && bun -e 'import("@pruvi/shared").then(m => console.log(Object.keys(m).filter(k => k.toLowerCase().includes("progress") || k.toLowerCase().includes("review") || k.toLowerCase().includes("calendar"))))'`
Expected output includes: `progressResponseSchema`, `subjectProgressSchema`, `subjectReviewsResponseSchema`, `reviewItemSchema`, `calendarResponseSchema`, `calendarQuerySchema`.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): re-export progress, subject-reviews, calendar schemas"
```

---

### Milestone 2 — Backend progress feature

### Task 7: Create `month-utils.ts` with unit tests

**Files:**
- Create: `apps/server/src/features/progress/month-utils.ts`
- Test: `apps/server/src/features/progress/month-utils.test.ts`

- [ ] **Step 1: Create `apps/server/src/features/progress/` directory**

```bash
mkdir -p /Users/cesarcamillo/dev/pruvi/apps/server/src/features/progress
```

- [ ] **Step 2: Write the failing test**

Write `apps/server/src/features/progress/month-utils.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { formatMonth, isFutureMonth, monthBoundaries } from "./month-utils";

afterEach(() => {
  vi.useRealTimers();
});

describe("formatMonth", () => {
  it("formats a Date to YYYY-MM", () => {
    expect(formatMonth(new Date(2026, 3, 16))).toBe("2026-04");
    expect(formatMonth(new Date(2026, 0, 1))).toBe("2026-01");
    expect(formatMonth(new Date(2026, 11, 31))).toBe("2026-12");
  });
});

describe("isFutureMonth", () => {
  it("returns false for current month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16));
    expect(isFutureMonth("2026-04")).toBe(false);
  });

  it("returns false for past month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16));
    expect(isFutureMonth("2025-12")).toBe(false);
    expect(isFutureMonth("2026-03")).toBe(false);
  });

  it("returns true for future month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16));
    expect(isFutureMonth("2026-05")).toBe(true);
    expect(isFutureMonth("2027-01")).toBe(true);
  });
});

describe("monthBoundaries", () => {
  it("returns inclusive start and exclusive end dates for a month", () => {
    const { start, end } = monthBoundaries("2026-04");
    expect(start.toISOString().slice(0, 10)).toBe("2026-04-01");
    expect(end.toISOString().slice(0, 10)).toBe("2026-05-01");
  });

  it("handles year rollover (December → next January)", () => {
    const { start, end } = monthBoundaries("2026-12");
    expect(start.toISOString().slice(0, 10)).toBe("2026-12-01");
    expect(end.toISOString().slice(0, 10)).toBe("2027-01-01");
  });

  it("handles leap year February", () => {
    const { start, end } = monthBoundaries("2024-02");
    expect(start.toISOString().slice(0, 10)).toBe("2024-02-01");
    expect(end.toISOString().slice(0, 10)).toBe("2024-03-01");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/server && bun run test src/features/progress/month-utils.test.ts`
Expected: FAIL — module `./month-utils` not found.

- [ ] **Step 4: Implement `month-utils.ts`**

Write `apps/server/src/features/progress/month-utils.ts`:

```ts
/** Format a Date as YYYY-MM (UTC not used — server local time matches streak/session logic). */
export function formatMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** True if the YYYY-MM string is strictly after the current month (server time). */
export function isFutureMonth(month: string): boolean {
  return month > formatMonth(new Date());
}

/**
 * Inclusive start (first-of-month, local midnight) and exclusive end (first-of-next-month).
 * Used for SQL range queries: `date >= start AND date < end`.
 */
export function monthBoundaries(month: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 1);
  return { start, end };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/server && bun run test src/features/progress/month-utils.test.ts`
Expected: PASS (all 8 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/features/progress/month-utils.ts apps/server/src/features/progress/month-utils.test.ts
git commit -m "feat(server): add month-utils for progress feature (YYYY-MM parsing + boundaries)"
```

---

### Task 8: Create `ProgressRepository` skeleton

**Files:**
- Create: `apps/server/src/features/progress/progress.repository.ts`

- [ ] **Step 1: Create the file with all 4 methods**

Write `apps/server/src/features/progress/progress.repository.ts`:

```ts
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { dailySession } from "@pruvi/db/schema/daily-sessions";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import { subject } from "@pruvi/db/schema/subjects";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export interface SubjectProgressRow {
  slug: string;
  name: string;
  totalQuestions: number;
  correctCount: number;
}

export interface SubjectReviewRow {
  questionId: number;
  body: string;
  quality: number;
  reviewedAt: Date;
}

export class ProgressRepository {
  constructor(private db: DbClient) {}

  /** Aggregate review_log by subject for a user. Only subjects with >= 1 row surface. */
  async getProgressForUser(userId: string): Promise<SubjectProgressRow[]> {
    const rows = await this.db
      .select({
        slug: subject.slug,
        name: subject.name,
        totalQuestions: sql<number>`COUNT(*)::int`,
        correctCount: sql<number>`SUM(CASE WHEN ${reviewLog.quality} >= 3 THEN 1 ELSE 0 END)::int`,
        lastActivity: sql<Date>`MAX(${reviewLog.reviewedAt})`,
      })
      .from(reviewLog)
      .innerJoin(question, eq(question.id, reviewLog.questionId))
      .innerJoin(subject, eq(subject.id, question.subjectId))
      .where(eq(reviewLog.userId, userId))
      .groupBy(subject.slug, subject.name)
      .orderBy(desc(sql`MAX(${reviewLog.reviewedAt})`));

    return rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      totalQuestions: r.totalQuestions,
      correctCount: r.correctCount,
    }));
  }

  /** Most recent N review_log rows for a user scoped to one subject slug. */
  async getSubjectReviews(
    userId: string,
    slug: string,
    limit = 50,
  ): Promise<SubjectReviewRow[]> {
    const rows = await this.db
      .select({
        questionId: reviewLog.questionId,
        body: question.body,
        quality: reviewLog.quality,
        reviewedAt: reviewLog.reviewedAt,
      })
      .from(reviewLog)
      .innerJoin(question, eq(question.id, reviewLog.questionId))
      .innerJoin(subject, eq(subject.id, question.subjectId))
      .where(and(eq(reviewLog.userId, userId), eq(subject.slug, slug)))
      .orderBy(desc(reviewLog.reviewedAt))
      .limit(limit);

    return rows;
  }

  async subjectExists(slug: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: subject.id })
      .from(subject)
      .where(eq(subject.slug, slug))
      .limit(1);
    return rows.length > 0;
  }

  /** Distinct YYYY-MM-DD strings of completed daily_session rows inside [start, end). */
  async getCalendarDates(
    userId: string,
    monthStart: Date,
    monthEnd: Date,
  ): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({
        date: sql<string>`to_char(${dailySession.date}, 'YYYY-MM-DD')`,
      })
      .from(dailySession)
      .where(
        and(
          eq(dailySession.userId, userId),
          gte(dailySession.date, monthStart.toISOString().slice(0, 10)),
          lt(dailySession.date, monthEnd.toISOString().slice(0, 10)),
          sql`${dailySession.completedAt} IS NOT NULL`,
        ),
      )
      .orderBy(sql`to_char(${dailySession.date}, 'YYYY-MM-DD')`);

    return rows.map((r) => r.date);
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/server && npx tsc --noEmit 2>&1 | grep progress || echo "clean"`
Expected: `clean` (no errors referencing `progress`).

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/features/progress/progress.repository.ts
git commit -m "feat(server): add ProgressRepository with 4 Drizzle queries"
```

---

### Task 9: Write integration test for `ProgressRepository`

**Files:**
- Test: `apps/server/src/features/progress/progress.repository.integration.test.ts`

**Note:** Requires local Postgres running (`make db-start`). Uses the same `setupTestDb`/`cleanupTestDb` pattern as `questions.repository.integration.test.ts`.

- [ ] **Step 1: Write the integration test**

Write `apps/server/src/features/progress/progress.repository.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../test/db-helpers";
import { ProgressRepository } from "./progress.repository";
import { user } from "@pruvi/db/schema/auth";
import { subject } from "@pruvi/db/schema/subjects";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import { dailySession } from "@pruvi/db/schema/daily-sessions";

describe("ProgressRepository (integration)", () => {
  const db = getTestDb();
  const repo = new ProgressRepository(db);

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function seedUser(id: string) {
    await db.insert(user).values({
      id,
      name: id,
      email: `${id}@test.com`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async function seedSubject(slug: string, name: string) {
    const [row] = await db.insert(subject).values({ slug, name }).returning();
    return row;
  }

  async function seedQuestion(subjectId: number, body: string) {
    const [row] = await db
      .insert(question)
      .values({
        subjectId,
        body,
        options: ["a", "b", "c", "d"],
        correctOptionIndex: 0,
        difficulty: 3,
      })
      .returning();
    return row;
  }

  async function seedReview(
    userId: string,
    questionId: number,
    quality: number,
    reviewedAt: Date,
  ) {
    await db.insert(reviewLog).values({
      userId,
      questionId,
      quality,
      easinessFactor: "2.50",
      interval: 1,
      repetitions: 1,
      nextReviewAt: new Date(reviewedAt.getTime() + 86400000),
      reviewedAt,
    });
  }

  describe("getProgressForUser", () => {
    it("returns empty array for user with no reviews", async () => {
      await seedUser("u1");
      expect(await repo.getProgressForUser("u1")).toEqual([]);
    });

    it("aggregates totalQuestions and correctCount per subject", async () => {
      await seedUser("u1");
      const sMath = await seedSubject("matematica", "Matemática");
      const q1 = await seedQuestion(sMath.id, "q1");
      const q2 = await seedQuestion(sMath.id, "q2");
      const q3 = await seedQuestion(sMath.id, "q3");
      const now = new Date();
      await seedReview("u1", q1.id, 4, now); // correct
      await seedReview("u1", q2.id, 1, now); // wrong
      await seedReview("u1", q3.id, 5, now); // correct

      const result = await repo.getProgressForUser("u1");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        slug: "matematica",
        name: "Matemática",
        totalQuestions: 3,
        correctCount: 2,
      });
    });

    it("orders subjects by most recent activity (DESC)", async () => {
      await seedUser("u1");
      const sA = await seedSubject("a", "A");
      const sB = await seedSubject("b", "B");
      const qA = await seedQuestion(sA.id, "qa");
      const qB = await seedQuestion(sB.id, "qb");
      const older = new Date(Date.now() - 86400000);
      const newer = new Date();
      await seedReview("u1", qA.id, 3, older);
      await seedReview("u1", qB.id, 3, newer);

      const result = await repo.getProgressForUser("u1");
      expect(result.map((r) => r.slug)).toEqual(["b", "a"]);
    });

    it("isolates users — one user's reviews don't appear for another", async () => {
      await seedUser("u1");
      await seedUser("u2");
      const s = await seedSubject("a", "A");
      const q = await seedQuestion(s.id, "qa");
      await seedReview("u1", q.id, 3, new Date());

      expect(await repo.getProgressForUser("u2")).toEqual([]);
    });
  });

  describe("getSubjectReviews", () => {
    it("returns reviews for the given subject slug, newest first, capped", async () => {
      await seedUser("u1");
      const s = await seedSubject("biologia", "Biologia");
      const q1 = await seedQuestion(s.id, "q1 body");
      const q2 = await seedQuestion(s.id, "q2 body");
      const older = new Date(Date.now() - 1000);
      const newer = new Date();
      await seedReview("u1", q1.id, 3, older);
      await seedReview("u1", q2.id, 1, newer);

      const result = await repo.getSubjectReviews("u1", "biologia", 10);
      expect(result).toHaveLength(2);
      expect(result[0].questionId).toBe(q2.id);
      expect(result[0].quality).toBe(1);
      expect(result[0].body).toBe("q2 body");
      expect(result[1].questionId).toBe(q1.id);
    });

    it("respects the limit parameter", async () => {
      await seedUser("u1");
      const s = await seedSubject("a", "A");
      for (let i = 0; i < 5; i++) {
        const q = await seedQuestion(s.id, `q${i}`);
        await seedReview("u1", q.id, 3, new Date(Date.now() + i * 1000));
      }
      const result = await repo.getSubjectReviews("u1", "a", 3);
      expect(result).toHaveLength(3);
    });

    it("returns empty array for unknown slug", async () => {
      await seedUser("u1");
      expect(await repo.getSubjectReviews("u1", "nonexistent", 10)).toEqual([]);
    });
  });

  describe("subjectExists", () => {
    it("returns true when slug is present", async () => {
      await seedSubject("a", "A");
      expect(await repo.subjectExists("a")).toBe(true);
    });

    it("returns false when slug is absent", async () => {
      expect(await repo.subjectExists("ghost")).toBe(false);
    });
  });

  describe("getCalendarDates", () => {
    it("returns distinct completed dates in range", async () => {
      await seedUser("u1");
      // Completed sessions
      await db.insert(dailySession).values([
        {
          userId: "u1",
          date: "2026-04-01",
          questionsAnswered: 10,
          questionsCorrect: 8,
          completedAt: new Date(),
        },
        {
          userId: "u1",
          date: "2026-04-15",
          questionsAnswered: 10,
          questionsCorrect: 9,
          completedAt: new Date(),
        },
        // Incomplete session — should not appear
        {
          userId: "u1",
          date: "2026-04-20",
          questionsAnswered: 5,
          questionsCorrect: 3,
          completedAt: null,
        },
        // Out-of-range session
        {
          userId: "u1",
          date: "2026-05-01",
          questionsAnswered: 10,
          questionsCorrect: 10,
          completedAt: new Date(),
        },
      ]);

      const start = new Date(2026, 3, 1);
      const end = new Date(2026, 4, 1);
      const result = await repo.getCalendarDates("u1", start, end);
      expect(result).toEqual(["2026-04-01", "2026-04-15"]);
    });

    it("isolates users", async () => {
      await seedUser("u1");
      await seedUser("u2");
      await db.insert(dailySession).values({
        userId: "u1",
        date: "2026-04-01",
        questionsAnswered: 10,
        questionsCorrect: 10,
        completedAt: new Date(),
      });
      const start = new Date(2026, 3, 1);
      const end = new Date(2026, 4, 1);
      expect(await repo.getCalendarDates("u2", start, end)).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Ensure Postgres is running**

Run: `cd /Users/cesarcamillo/dev/pruvi && make db-start`
Expected: Postgres and Redis containers healthy (or already running — idempotent).

- [ ] **Step 3: Run the integration test**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/server && bun run test:integration src/features/progress/progress.repository.integration.test.ts`
Expected: PASS (all 10 test cases).

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/features/progress/progress.repository.integration.test.ts
git commit -m "test(server): add integration tests for ProgressRepository"
```

---

### Task 10: Create `ProgressService` with unit tests

**Files:**
- Create: `apps/server/src/features/progress/progress.service.ts`
- Test: `apps/server/src/features/progress/progress.service.test.ts`

- [ ] **Step 1: Write the failing unit test**

Write `apps/server/src/features/progress/progress.service.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { ProgressService } from "./progress.service";
import type { ProgressRepository } from "./progress.repository";
import { NotFoundError, ValidationError } from "../../utils/errors";

afterEach(() => {
  vi.useRealTimers();
});

function makeRepo(overrides: Partial<ProgressRepository> = {}): ProgressRepository {
  return {
    getProgressForUser: vi.fn().mockResolvedValue([]),
    getSubjectReviews: vi.fn().mockResolvedValue([]),
    subjectExists: vi.fn().mockResolvedValue(true),
    getCalendarDates: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as ProgressRepository;
}

describe("ProgressService.getProgress", () => {
  it("derives accuracy as round(correctCount / totalQuestions * 100)", async () => {
    const repo = makeRepo({
      getProgressForUser: vi.fn().mockResolvedValue([
        { slug: "a", name: "A", totalQuestions: 3, correctCount: 2 },
        { slug: "b", name: "B", totalQuestions: 10, correctCount: 10 },
        { slug: "c", name: "C", totalQuestions: 10, correctCount: 0 },
      ]),
    });
    const service = new ProgressService(repo);
    const result = await service.getProgress("u1");
    expect(result.isOk()).toBe(true);
    const { subjects } = result._unsafeUnwrap();
    expect(subjects[0]).toMatchObject({ slug: "a", accuracy: 67 });
    expect(subjects[1]).toMatchObject({ slug: "b", accuracy: 100 });
    expect(subjects[2]).toMatchObject({ slug: "c", accuracy: 0 });
  });

  it("returns empty subjects array when repo returns none", async () => {
    const service = new ProgressService(makeRepo());
    const result = await service.getProgress("u1");
    expect(result._unsafeUnwrap()).toEqual({ subjects: [] });
  });
});

describe("ProgressService.getSubjectReviews", () => {
  it("returns NotFoundError when subject doesn't exist", async () => {
    const service = new ProgressService(
      makeRepo({ subjectExists: vi.fn().mockResolvedValue(false) }),
    );
    const result = await service.getSubjectReviews("u1", "ghost");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(NotFoundError);
  });

  it("maps quality >= 3 to correct=true via qualityToCorrect", async () => {
    const now = new Date("2026-04-16T10:00:00Z");
    const service = new ProgressService(
      makeRepo({
        getSubjectReviews: vi.fn().mockResolvedValue([
          { questionId: 1, body: "q1", quality: 5, reviewedAt: now },
          { questionId: 2, body: "q2", quality: 2, reviewedAt: now },
          { questionId: 3, body: "q3", quality: 3, reviewedAt: now },
        ]),
      }),
    );
    const result = await service.getSubjectReviews("u1", "a");
    const { reviews } = result._unsafeUnwrap();
    expect(reviews).toEqual([
      { questionId: 1, body: "q1", correct: true, reviewedAt: now.toISOString() },
      { questionId: 2, body: "q2", correct: false, reviewedAt: now.toISOString() },
      { questionId: 3, body: "q3", correct: true, reviewedAt: now.toISOString() },
    ]);
  });
});

describe("ProgressService.getCalendar", () => {
  it("defaults month to current when not provided", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16));
    const getCalendarDates = vi.fn().mockResolvedValue(["2026-04-01"]);
    const service = new ProgressService(makeRepo({ getCalendarDates }));
    const result = await service.getCalendar("u1", undefined);
    expect(result.isOk()).toBe(true);
    const [, start, end] = getCalendarDates.mock.calls[0];
    expect((start as Date).getMonth()).toBe(3); // April = index 3
    expect((end as Date).getMonth()).toBe(4); // May = index 4
  });

  it("rejects future month with ValidationError", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16));
    const service = new ProgressService(makeRepo());
    const result = await service.getCalendar("u1", "2026-05");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
  });

  it("accepts past month", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16));
    const service = new ProgressService(makeRepo());
    const result = await service.getCalendar("u1", "2025-12");
    expect(result.isOk()).toBe(true);
  });

  it("accepts current month", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16));
    const service = new ProgressService(makeRepo());
    const result = await service.getCalendar("u1", "2026-04");
    expect(result.isOk()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/server && bun run test src/features/progress/progress.service.test.ts`
Expected: FAIL — module `./progress.service` not found.

- [ ] **Step 3: Implement `progress.service.ts`**

Write `apps/server/src/features/progress/progress.service.ts`:

```ts
import { err, ok, type Result } from "neverthrow";
import {
  qualityToCorrect,
  type ProgressResponse,
  type SubjectReviewsResponse,
  type CalendarResponse,
} from "@pruvi/shared";
import type { AppError } from "../../utils/errors";
import { NotFoundError, ValidationError } from "../../utils/errors";
import type { ProgressRepository } from "./progress.repository";
import { formatMonth, isFutureMonth, monthBoundaries } from "./month-utils";

export class ProgressService {
  constructor(private repo: ProgressRepository) {}

  async getProgress(userId: string): Promise<Result<ProgressResponse, AppError>> {
    const rows = await this.repo.getProgressForUser(userId);
    return ok({
      subjects: rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        totalQuestions: r.totalQuestions,
        correctCount: r.correctCount,
        accuracy:
          r.totalQuestions === 0
            ? 0
            : Math.round((r.correctCount / r.totalQuestions) * 100),
      })),
    });
  }

  async getSubjectReviews(
    userId: string,
    slug: string,
  ): Promise<Result<SubjectReviewsResponse, AppError>> {
    if (!(await this.repo.subjectExists(slug))) {
      return err(new NotFoundError("Subject not found"));
    }
    const rows = await this.repo.getSubjectReviews(userId, slug, 50);
    return ok({
      reviews: rows.map((r) => ({
        questionId: r.questionId,
        body: r.body,
        correct: qualityToCorrect(r.quality),
        reviewedAt: r.reviewedAt.toISOString(),
      })),
    });
  }

  async getCalendar(
    userId: string,
    month: string | undefined,
  ): Promise<Result<CalendarResponse, AppError>> {
    const target = month ?? formatMonth(new Date());
    if (isFutureMonth(target)) {
      return err(new ValidationError("month cannot be in the future"));
    }
    const { start, end } = monthBoundaries(target);
    const dates = await this.repo.getCalendarDates(userId, start, end);
    return ok({ dates });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/server && bun run test src/features/progress/progress.service.test.ts`
Expected: PASS (all 10 test cases).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/features/progress/progress.service.ts apps/server/src/features/progress/progress.service.test.ts
git commit -m "feat(server): add ProgressService with accuracy + correct derivation"
```

---

### Task 11: Create `progress.route.ts` with 3 cache-first handlers

**Files:**
- Create: `apps/server/src/features/progress/progress.route.ts`

- [ ] **Step 1: Create the route file**

Write `apps/server/src/features/progress/progress.route.ts`:

```ts
import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { calendarQuerySchema } from "@pruvi/shared";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";
import { ProgressRepository } from "./progress.repository";
import { ProgressService } from "./progress.service";

const repo = new ProgressRepository(db);
const service = new ProgressService(repo);

const PROGRESS_TTL = 60; // seconds — matches xp TTL

export const progressRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /users/me/progress
  fastify.get(
    "/users/me/progress",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const cacheKey = `progress:${request.userId}`;

      const cached = await fastify.cache.get<{
        subjects: Array<{
          slug: string;
          name: string;
          totalQuestions: number;
          correctCount: number;
          accuracy: number;
        }>;
      }>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const result = await service.getProgress(request.userId);
      const response = unwrapResult(result);
      await fastify.cache.set(cacheKey, response.data, PROGRESS_TTL);
      return response;
    },
  );

  // GET /subjects/:slug/reviews
  fastify.get(
    "/subjects/:slug/reviews",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({
          slug: z.string().min(1),
        }),
      },
    },
    async (request) => {
      const { slug } = request.params as { slug: string };
      const cacheKey = `subject-reviews:${request.userId}:${slug}`;

      const cached = await fastify.cache.get<{
        reviews: Array<{
          questionId: number;
          body: string;
          correct: boolean;
          reviewedAt: string;
        }>;
      }>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const result = await service.getSubjectReviews(request.userId, slug);
      const response = unwrapResult(result);
      await fastify.cache.set(cacheKey, response.data, PROGRESS_TTL);
      return response;
    },
  );

  // GET /users/me/calendar?month=YYYY-MM
  fastify.get(
    "/users/me/calendar",
    {
      preHandler: [fastify.authenticate],
      schema: {
        querystring: calendarQuerySchema,
      },
    },
    async (request) => {
      const { month } = request.query as { month?: string };
      const cacheKey = `calendar:${request.userId}:${month ?? "current"}`;

      const cached = await fastify.cache.get<{ dates: string[] }>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const result = await service.getCalendar(request.userId, month);
      const response = unwrapResult(result);
      await fastify.cache.setUntilMidnight(cacheKey, response.data);
      return response;
    },
  );
};
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/server && npx tsc --noEmit 2>&1 | grep progress || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/features/progress/progress.route.ts
git commit -m "feat(server): add progress routes with cache-first reads"
```

---

### Task 12: Export `progressRoutes` + register in `apps/server/src/index.ts`

**Files:**
- Create: `apps/server/src/features/progress/index.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Create feature-folder index**

Write `apps/server/src/features/progress/index.ts`:

```ts
export { progressRoutes } from "./progress.route";
```

- [ ] **Step 2: Register the routes in the app**

Modify `apps/server/src/index.ts`. Add the import alongside the other feature imports (after `gamificationRoutes`):

```ts
import { progressRoutes } from "./features/progress";
```

Add the registration in the feature-routes block (after `gamificationRoutes`):

```ts
  await app.register(progressRoutes);
```

- [ ] **Step 3: Type-check + restart dev server sanity check**

Run: `cd /Users/cesarcamillo/dev/pruvi && make db-start`
Then: `cd /Users/cesarcamillo/dev/pruvi && bun run dev:server 2>&1 | head -20`
Expected (within 10s): `Server listening at http://127.0.0.1:3000` and `Redis connected`.
Kill the dev server with Ctrl-C after confirming.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/features/progress/index.ts apps/server/src/index.ts
git commit -m "feat(server): register progressRoutes with Fastify app"
```

---

### Milestone 3 — Cross-feature cache invalidation

### Task 13: Add `getSubjectSlugForQuestion` to `QuestionsRepository`

**Files:**
- Modify: `apps/server/src/features/questions/questions.repository.ts`
- Test: `apps/server/src/features/questions/questions.repository.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/server/src/features/questions/questions.repository.integration.test.ts` (inside the existing `describe("QuestionsRepository (integration)"...` block, after any existing `describe()` sections for `selectQuestions`):

```ts
  describe("getSubjectSlugForQuestion", () => {
    it("returns the slug of the subject owning the question", async () => {
      const [s] = await db
        .insert(subject)
        .values({ slug: "fisica", name: "Física" })
        .returning();
      const [q] = await db
        .insert(question)
        .values({
          subjectId: s.id,
          body: "q",
          options: ["a", "b", "c", "d"],
          correctOptionIndex: 0,
          difficulty: 3,
        })
        .returning();
      expect(await repo.getSubjectSlugForQuestion(q.id)).toBe("fisica");
    });

    it("returns null for unknown question id", async () => {
      expect(await repo.getSubjectSlugForQuestion(999999)).toBeNull();
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/server && bun run test:integration src/features/questions/questions.repository.integration.test.ts`
Expected: FAIL — `repo.getSubjectSlugForQuestion is not a function`.

- [ ] **Step 3: Add the method to `QuestionsRepository`**

Modify `apps/server/src/features/questions/questions.repository.ts`. Add these imports at the top (if not already present):

```ts
import { subject } from "@pruvi/db/schema/subjects";
```

Add the method inside the `QuestionsRepository` class (after `selectQuestions`):

```ts
  /** Look up the slug of the subject owning a question. Used by cache invalidation. */
  async getSubjectSlugForQuestion(questionId: number): Promise<string | null> {
    const rows = await this.db
      .select({ slug: subject.slug })
      .from(question)
      .innerJoin(subject, eq(subject.id, question.subjectId))
      .where(eq(question.id, questionId))
      .limit(1);
    return rows[0]?.slug ?? null;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/server && bun run test:integration src/features/questions/questions.repository.integration.test.ts`
Expected: PASS (existing tests + 2 new ones).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/features/questions/questions.repository.ts apps/server/src/features/questions/questions.repository.integration.test.ts
git commit -m "feat(server): add getSubjectSlugForQuestion to QuestionsRepository"
```

---

### Task 14: Extend `reviews.route.ts` to invalidate progress + subject-reviews on answer

**Files:**
- Modify: `apps/server/src/features/reviews/reviews.route.ts`

- [ ] **Step 1: Update the route**

Replace the entire content of `apps/server/src/features/reviews/reviews.route.ts` with:

```ts
import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { AnswerQuestionBodySchema } from "@pruvi/shared";
import { ReviewsService } from "./reviews.service";
import { ReviewsRepository } from "./reviews.repository";
import { QuestionsRepository } from "../questions/questions.repository";
import { db } from "@pruvi/db";
import { unwrapResult } from "../../types";

const repo = new ReviewsRepository(db);
const questionsRepo = new QuestionsRepository(db);
const service = new ReviewsService(repo);

export const reviewsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // POST /questions/:questionId/answer
  fastify.post(
    "/questions/:questionId/answer",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({
          questionId: z.coerce.number().int(),
        }),
        body: AnswerQuestionBodySchema,
      },
    },
    async (request) => {
      const { questionId } = request.params;
      const { selectedOptionIndex } = request.body;
      const result = await service.answerQuestion(
        request.userId,
        questionId,
        selectedOptionIndex,
      );
      const response = unwrapResult(result);

      // Invalidate lives, XP, progress, and subject-specific review caches
      const slug = await questionsRepo.getSubjectSlugForQuestion(questionId);
      const invalidations: Promise<unknown>[] = [
        fastify.cache.del(`lives:${request.userId}`),
        fastify.cache.del(`xp:${request.userId}`),
        fastify.cache.del(`progress:${request.userId}`),
      ];
      if (slug) {
        invalidations.push(
          fastify.cache.del(`subject-reviews:${request.userId}:${slug}`),
        );
      }
      await Promise.all(invalidations);

      return response;
    },
  );
};
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/server && npx tsc --noEmit 2>&1 | grep reviews.route || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Re-run full server test suite to confirm no regression**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/server && bun run test`
Expected: PASS (all existing tests + the progress-feature tests from tasks 7, 10).

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/features/reviews/reviews.route.ts
git commit -m "feat(server): invalidate progress + subject-reviews on answer"
```

---

### Task 15: Extend `sessions.route.ts` to invalidate progress + calendar on complete

**Files:**
- Modify: `apps/server/src/features/sessions/sessions.route.ts`

- [ ] **Step 1: Update the complete handler**

Modify `apps/server/src/features/sessions/sessions.route.ts`. Add the import at the top (with the other imports):

```ts
import { formatMonth } from "../progress/month-utils";
```

Replace the `Promise.all` invalidation block inside the `POST /sessions/:id/complete` handler (currently the two-item array after `const session = unwrapResult(result).data;`) with:

```ts
      // Invalidate caches that depend on session completion
      const currentMonthKey = `calendar:${request.userId}:${formatMonth(new Date())}`;
      await Promise.all([
        fastify.cache.del(`session-today:${request.userId}`),
        fastify.cache.del(`streaks:${request.userId}`),
        fastify.cache.del(`progress:${request.userId}`),
        fastify.cache.del(currentMonthKey),
        fastify.cache.del(`calendar:${request.userId}:current`),
      ]);
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/server && npx tsc --noEmit 2>&1 | grep sessions.route || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Re-run full server test suite**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/server && bun run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/features/sessions/sessions.route.ts
git commit -m "feat(server): invalidate progress + calendar caches on session complete"
```

---

### Milestone 4 — Backend smoke test

### Task 16: Curl all 3 endpoints against local dev

**Files:** none modified — this is a manual smoke check.

- [ ] **Step 1: Start dev server in background**

Run: `cd /Users/cesarcamillo/dev/pruvi && make db-start && bun run dev:server &`
Wait for `Server listening at http://127.0.0.1:3000`.

- [ ] **Step 2: Capture a valid session cookie**

Authenticate in the iOS simulator first (log in via the running native app), or use the Better Auth signup route via curl to get a cookie. Save the cookie string as `COOKIE` in your shell.

- [ ] **Step 3: Hit `/users/me/progress`**

Run:
```bash
curl -s -H "Cookie: $COOKIE" http://localhost:3000/users/me/progress | jq .
```

Expected shape: `{ "success": true, "data": { "subjects": [...] } }`.

- [ ] **Step 4: Hit `/subjects/:slug/reviews`**

Run (substitute a real slug from your seed data, e.g. `matematica`):
```bash
curl -s -H "Cookie: $COOKIE" http://localhost:3000/subjects/matematica/reviews | jq .
```

Expected shape: `{ "success": true, "data": { "reviews": [...] } }`.

Test the 404 path with a made-up slug:
```bash
curl -s -H "Cookie: $COOKIE" http://localhost:3000/subjects/ghost/reviews | jq .
```

Expected: `{ "success": false, "error": "Subject not found", "code": "NOT_FOUND" }` (status 404).

- [ ] **Step 5: Hit `/users/me/calendar`**

Run:
```bash
curl -s -H "Cookie: $COOKIE" "http://localhost:3000/users/me/calendar" | jq .
curl -s -H "Cookie: $COOKIE" "http://localhost:3000/users/me/calendar?month=2026-03" | jq .
curl -s -H "Cookie: $COOKIE" "http://localhost:3000/users/me/calendar?month=2030-01" | jq .
```

Expected: first two succeed with `{ "dates": [...] }`; the third returns 400 with `ValidationError`.

- [ ] **Step 6: Stop the dev server**

Run: `kill %1` (or find the bun process and kill it). Milestone complete — no commit (smoke test only).

---

### Milestone 5 — Native service + hooks

### Task 17: Create `services/progress.service.ts`

**Files:**
- Create: `apps/native/services/progress.service.ts`

- [ ] **Step 1: Create the file**

Write `apps/native/services/progress.service.ts`:

```ts
import {
  calendarResponseSchema,
  progressResponseSchema,
  subjectReviewsResponseSchema,
} from "@pruvi/shared";

import { apiRequest } from "@/lib/api-client";

export const progressService = {
  getProgress: () =>
    apiRequest("/users/me/progress", { method: "GET" }, progressResponseSchema),

  getSubjectReviews: (slug: string) =>
    apiRequest(
      `/subjects/${encodeURIComponent(slug)}/reviews`,
      { method: "GET" },
      subjectReviewsResponseSchema,
    ),

  getCalendar: (month?: string) =>
    apiRequest(
      `/users/me/calendar${month ? `?month=${month}` : ""}`,
      { method: "GET" },
      calendarResponseSchema,
    ),
};
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit services/progress.service.ts 2>&1 | grep -v "_legacy" | grep -v "modal.tsx" | grep -v "+not-found" || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add apps/native/services/progress.service.ts
git commit -m "feat(native): add progress service with 3 typed endpoints"
```

---

### Task 18: Create `hooks/useProgress.ts`

**Files:**
- Create: `apps/native/hooks/useProgress.ts`

- [ ] **Step 1: Create the hook**

Write `apps/native/hooks/useProgress.ts`:

```ts
import { useQuery } from "@tanstack/react-query";

import { progressService } from "@/services/progress.service";

export function useProgress() {
  return useQuery({
    queryKey: ["progress"],
    queryFn: progressService.getProgress,
    staleTime: 60 * 1000,
  });
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit hooks/useProgress.ts 2>&1 | grep -v "_legacy" | grep -v "modal.tsx" | grep -v "+not-found" || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add apps/native/hooks/useProgress.ts
git commit -m "feat(native): add useProgress query hook"
```

---

### Task 19: Create `hooks/useSubjectReviews.ts`

**Files:**
- Create: `apps/native/hooks/useSubjectReviews.ts`

- [ ] **Step 1: Create the hook**

Write `apps/native/hooks/useSubjectReviews.ts`:

```ts
import { useQuery } from "@tanstack/react-query";

import { progressService } from "@/services/progress.service";

export function useSubjectReviews(slug: string | undefined) {
  return useQuery({
    queryKey: ["subject-reviews", slug],
    queryFn: () => progressService.getSubjectReviews(slug!),
    enabled: !!slug,
    staleTime: 60 * 1000,
  });
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit 2>&1 | grep -v "_legacy" | grep -v "modal.tsx" | grep -v "+not-found" | head -5`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add apps/native/hooks/useSubjectReviews.ts
git commit -m "feat(native): add useSubjectReviews query hook"
```

---

### Task 20: Create `hooks/useCalendar.ts`

**Files:**
- Create: `apps/native/hooks/useCalendar.ts`

- [ ] **Step 1: Create the hook**

Write `apps/native/hooks/useCalendar.ts`:

```ts
import { useQuery } from "@tanstack/react-query";

import { progressService } from "@/services/progress.service";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function useCalendar(month?: string) {
  const m = month ?? currentMonth();
  return useQuery({
    queryKey: ["calendar", m],
    queryFn: () => progressService.getCalendar(m),
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit 2>&1 | grep -v "_legacy" | grep -v "modal.tsx" | grep -v "+not-found" | head -5`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/native/hooks/useCalendar.ts
git commit -m "feat(native): add useCalendar query hook with month default"
```

---

### Task 21: Extend mutation invalidations in `hooks/useSessionQuery.ts`

**Files:**
- Modify: `apps/native/hooks/useSessionQuery.ts`

- [ ] **Step 1: Update the two `onSuccess` callbacks**

Replace the entire content of `apps/native/hooks/useSessionQuery.ts` with:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { sessionService } from "@/services/session.service";

export function useTodaySession() {
  return useQuery({
    queryKey: ["session", "today"],
    queryFn: sessionService.getToday,
  });
}

export function useStartSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mode: "all" | "theoretical") =>
      sessionService.startSession(mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", "today"] });
      queryClient.invalidateQueries({ queryKey: ["lives"] });
    },
  });
}

export function useAnswerQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { questionId: number; selectedOptionIndex: number }) =>
      sessionService.answerQuestion(vars.questionId, vars.selectedOptionIndex),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lives"] });
      queryClient.invalidateQueries({ queryKey: ["xp"] });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
      queryClient.invalidateQueries({ queryKey: ["subject-reviews"] });
    },
  });
}

export function useCompleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: number;
      questionCount: number;
      correctCount: number;
    }) =>
      sessionService.completeSession(
        vars.id,
        vars.questionCount,
        vars.correctCount,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", "today"] });
      queryClient.invalidateQueries({ queryKey: ["streaks"] });
      queryClient.invalidateQueries({ queryKey: ["xp"] });
      queryClient.invalidateQueries({ queryKey: ["lives"] });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit 2>&1 | grep -v "_legacy" | grep -v "modal.tsx" | grep -v "+not-found" | head -5`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/native/hooks/useSessionQuery.ts
git commit -m "feat(native): invalidate progress + calendar on session mutations"
```

---

### Milestone 6 — Native utility + common components

### Task 22: Create `lib/date-format.ts` with 4 helpers

**Files:**
- Create: `apps/native/lib/date-format.ts`

- [ ] **Step 1: Create the helpers file**

Write `apps/native/lib/date-format.ts`:

```ts
const WEEKDAYS_PT = ["D", "S", "T", "Q", "Q", "S", "S"] as const;
const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;

export { WEEKDAYS_PT };

/** Returns YYYY-MM for the given Date, defaulting to now. */
export function currentMonth(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** "Abril 2026" format for display. */
export function formatMonthLabelPt(date: Date): string {
  return `${MONTHS_PT[date.getMonth()]} ${date.getFullYear()}`;
}

/** "há 2h", "ontem", "há 3 dias", "há 2 semanas", "há 1 mês". */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `há ${diffMinutes}min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `há ${diffDays} dias`;
  if (diffWeeks < 4) return `há ${diffWeeks} ${diffWeeks === 1 ? "semana" : "semanas"}`;
  return `há ${diffMonths} ${diffMonths === 1 ? "mês" : "meses"}`;
}

export interface MonthCell {
  day: number | null;
  inMonth: boolean;
  isToday: boolean;
  studied: boolean;
  dateStr: string | null;
}

/**
 * Build a 42-cell (7 cols × 6 rows) grid for a month.
 * Cells outside the target month have `inMonth: false` and `day: null`.
 */
export function buildMonthGrid(
  month: string,
  studiedSet: Set<string>,
  today: Date = new Date(),
): MonthCell[] {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const firstDay = new Date(year, monthIndex, 1);
  const firstWeekday = firstDay.getDay(); // 0 = Sun
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const dayNum = i - firstWeekday + 1;
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
    const dateStr = inMonth
      ? `${year}-${monthStr}-${String(dayNum).padStart(2, "0")}`
      : null;
    cells.push({
      day: inMonth ? dayNum : null,
      inMonth,
      isToday: inMonth && dateStr === todayStr,
      studied: inMonth && dateStr !== null && studiedSet.has(dateStr),
      dateStr,
    });
  }
  return cells;
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit 2>&1 | grep -v "_legacy" | grep -v "modal.tsx" | grep -v "+not-found" | head -5`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/native/lib/date-format.ts
git commit -m "feat(native): add date-format helpers for relative time + month grid"
```

---

### Task 23: Create `components/common/ErrorState.tsx`

**Files:**
- Create: `apps/native/components/common/ErrorState.tsx`

- [ ] **Step 1: Create the component**

Write `apps/native/components/common/ErrorState.tsx`:

```tsx
import { Button } from "heroui-native";
import { Text, View } from "react-native";

import { colors } from "@/lib/design-tokens";

interface Props {
  text?: string;
  onRetry?: () => void;
}

export function ErrorState({
  text = "Não foi possível carregar. Tente novamente.",
  onRetry,
}: Props) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: "700",
          color: colors.textMuted,
          textAlign: "center",
        }}
      >
        {text}
      </Text>
      {onRetry && (
        <Button onPress={onRetry} size="sm" variant="secondary">
          <Button.Label>Tentar de novo</Button.Label>
        </Button>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit 2>&1 | grep -v "_legacy" | grep -v "modal.tsx" | grep -v "+not-found" | head -5`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/native/components/common/ErrorState.tsx
git commit -m "feat(native): add ErrorState common component"
```

---

### Task 24: Create `components/common/EmptyState.tsx`

**Files:**
- Create: `apps/native/components/common/EmptyState.tsx`

- [ ] **Step 1: Create the component**

Write `apps/native/components/common/EmptyState.tsx`:

```tsx
import { Text, View } from "react-native";

import { colors } from "@/lib/design-tokens";

interface Props {
  text: string;
}

export function EmptyState({ text }: Props) {
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 48,
        paddingHorizontal: 24,
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: "700",
          color: colors.textMuted,
          textAlign: "center",
        }}
      >
        {text}
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit 2>&1 | grep -v "_legacy" | grep -v "modal.tsx" | grep -v "+not-found" | head -5`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/native/components/common/EmptyState.tsx
git commit -m "feat(native): add EmptyState common component"
```

---

### Task 25: Create `components/common/NotFoundState.tsx`

**Files:**
- Create: `apps/native/components/common/NotFoundState.tsx`

- [ ] **Step 1: Create the component**

Write `apps/native/components/common/NotFoundState.tsx`:

```tsx
import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import { Text, View } from "react-native";

import { colors } from "@/lib/design-tokens";

interface Props {
  text?: string;
}

export function NotFoundState({ text = "Matéria não encontrada" }: Props) {
  const router = useRouter();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: "900",
          color: colors.text,
          textAlign: "center",
        }}
      >
        {text}
      </Text>
      <Button onPress={() => router.back()} size="sm" variant="secondary">
        <Button.Label>Voltar</Button.Label>
      </Button>
    </View>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit 2>&1 | grep -v "_legacy" | grep -v "modal.tsx" | grep -v "+not-found" | head -5`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/native/components/common/NotFoundState.tsx
git commit -m "feat(native): add NotFoundState common component"
```

---

### Milestone 7 — Native feature components

### Task 26: Extract `XpCard` from home screen into `components/gamification/XpCard.tsx`

**Files:**
- Create: `apps/native/components/gamification/XpCard.tsx`
- Modify: `apps/native/app/(app)/(tabs)/index.tsx`

- [ ] **Step 1: Create the extracted component**

Write `apps/native/components/gamification/XpCard.tsx`:

```tsx
import { Text, View } from "react-native";

import { colors } from "@/lib/design-tokens";

interface XpData {
  currentLevel: number;
  totalXp: number;
  xpForNextLevel: number;
}

interface Props {
  xp: XpData;
}

export function XpCard({ xp }: Props) {
  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        borderWidth: 2,
        borderColor: colors.border,
        padding: 20,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>
          Nível {xp.currentLevel}
        </Text>
        <Text style={{ fontSize: 14, fontWeight: "900", color: colors.primary }}>
          {xp.totalXp} XP
        </Text>
      </View>
      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted }}>
        Faltam {xp.xpForNextLevel} XP para o próximo nível
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Update the home screen to use the component**

Modify `apps/native/app/(app)/(tabs)/index.tsx`. Find the block that renders the inline XP card (the `xp.isLoading ? ... : xp.data ? <View ...> ... </View> : null` block around lines 99-129) and replace it with:

```tsx
        {xp.isLoading ? (
          <Skeleton width="100%" height={80} />
        ) : xp.data ? (
          <XpCard xp={xp.data} />
        ) : null}
```

Also add the import at the top (with the other component imports):

```tsx
import { XpCard } from "@/components/gamification/XpCard";
```

- [ ] **Step 3: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit 2>&1 | grep -v "_legacy" | grep -v "modal.tsx" | grep -v "+not-found" | head -5`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/native/components/gamification/XpCard.tsx apps/native/app/\(app\)/\(tabs\)/index.tsx
git commit -m "refactor(native): extract XpCard from home screen for reuse in profile"
```

---

### Task 27: Create `components/subject/SubjectCard.tsx`

**Files:**
- Create: `apps/native/components/subject/SubjectCard.tsx`

- [ ] **Step 1: Create the component**

Write `apps/native/components/subject/SubjectCard.tsx`:

```tsx
import { memo, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { SubjectProgress } from "@pruvi/shared";

import { colors, radii } from "@/lib/design-tokens";

interface Props {
  subject: SubjectProgress;
  onPress: () => void;
}

function SubjectCardImpl({ subject, onPress }: Props) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(subject.accuracy, { duration: 600 });
  }, [subject.accuracy, width]);

  const barStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: radii.xl,
        borderWidth: 2,
        borderColor: colors.border,
        padding: 16,
        gap: 12,
        marginBottom: 12,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: "900",
            color: colors.text,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {subject.name}
        </Text>
        <Text style={{ fontSize: 16, fontWeight: "900", color: colors.primary }}>
          {subject.accuracy}%
        </Text>
      </View>

      <View
        style={{
          height: 8,
          backgroundColor: colors.surface,
          borderRadius: radii.sm,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={[
            {
              height: "100%",
              backgroundColor: colors.primary,
              borderRadius: radii.sm,
            },
            barStyle,
          ]}
        />
      </View>

      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted }}>
        {subject.correctCount}/{subject.totalQuestions} corretas
      </Text>
    </Pressable>
  );
}

export const SubjectCard = memo(SubjectCardImpl);
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit 2>&1 | grep -v "_legacy" | grep -v "modal.tsx" | grep -v "+not-found" | head -5`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/native/components/subject/SubjectCard.tsx
git commit -m "feat(native): add memoized SubjectCard with animated accuracy bar"
```

---

### Task 28: Create `components/subject/ReviewHistoryItem.tsx`

**Files:**
- Create: `apps/native/components/subject/ReviewHistoryItem.tsx`

- [ ] **Step 1: Create the component**

Write `apps/native/components/subject/ReviewHistoryItem.tsx`:

```tsx
import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Text, View } from "react-native";

import type { ReviewItem } from "@pruvi/shared";

import { formatRelativeTime } from "@/lib/date-format";
import { colors, radii } from "@/lib/design-tokens";

interface Props {
  review: ReviewItem;
}

function ReviewHistoryItemImpl({ review }: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        padding: 16,
        backgroundColor: "#FFFFFF",
        borderRadius: radii.md,
        borderWidth: 2,
        borderColor: colors.border,
        marginBottom: 8,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: radii.sm,
          backgroundColor: review.correct ? colors.primary : colors.danger,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name={review.correct ? "checkmark" : "close"}
          size={16}
          color="#FFFFFF"
        />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          numberOfLines={2}
          style={{
            fontSize: 13,
            fontWeight: "500",
            lineHeight: 18,
            color: colors.text,
          }}
        >
          {review.body}
        </Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted }}>
          {formatRelativeTime(review.reviewedAt)}
        </Text>
      </View>
    </View>
  );
}

export const ReviewHistoryItem = memo(ReviewHistoryItemImpl);
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit 2>&1 | grep -v "_legacy" | grep -v "modal.tsx" | grep -v "+not-found" | head -5`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/native/components/subject/ReviewHistoryItem.tsx
git commit -m "feat(native): add memoized ReviewHistoryItem with correct/wrong badge"
```

---

### Task 29: Create `components/gamification/StudyCalendar.tsx`

**Files:**
- Create: `apps/native/components/gamification/StudyCalendar.tsx`

- [ ] **Step 1: Create the component**

Write `apps/native/components/gamification/StudyCalendar.tsx`:

```tsx
import { useMemo } from "react";
import { Text, View } from "react-native";

import { WEEKDAYS_PT, buildMonthGrid } from "@/lib/date-format";
import { colors, radii } from "@/lib/design-tokens";

interface Props {
  dates: string[];
  month: string;
}

export function StudyCalendar({ dates, month }: Props) {
  const cells = useMemo(
    () => buildMonthGrid(month, new Set(dates)),
    [month, dates],
  );

  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: radii.xl,
        borderWidth: 2,
        borderColor: colors.border,
        padding: 16,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row" }}>
        {WEEKDAYS_PT.map((d, i) => (
          <View key={`w-${i}`} style={{ flex: 1, alignItems: "center" }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "900",
                color: colors.textMuted,
                letterSpacing: 0.5,
              }}
            >
              {d}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((cell, i) => (
          <View
            key={`c-${i}`}
            style={{
              width: `${100 / 7}%`,
              aspectRatio: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 2,
            }}
          >
            <View
              style={{
                width: "80%",
                height: "80%",
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: cell.studied ? colors.primary : "transparent",
                borderWidth: cell.isToday ? 2 : 0,
                borderColor: cell.isToday ? colors.primary : "transparent",
              }}
            >
              {cell.inMonth && (
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: cell.studied ? "900" : "700",
                    color: cell.studied
                      ? "#FFFFFF"
                      : cell.isToday
                      ? colors.primary
                      : colors.text,
                  }}
                >
                  {cell.day}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit 2>&1 | grep -v "_legacy" | grep -v "modal.tsx" | grep -v "+not-found" | head -5`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/native/components/gamification/StudyCalendar.tsx
git commit -m "feat(native): add StudyCalendar monthly grid with studied-day highlights"
```

---

### Milestone 8 — Native screen wiring

### Task 30: Wire `(tabs)/progress.tsx`

**Files:**
- Modify: `apps/native/app/(app)/(tabs)/progress.tsx`

- [ ] **Step 1: Replace the placeholder with the wired screen**

Replace the entire content of `apps/native/app/(app)/(tabs)/progress.tsx` with:

```tsx
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Screen } from "@/components/common/Screen";
import { Skeleton } from "@/components/common/Skeleton";
import { SubjectCard } from "@/components/subject/SubjectCard";
import { useProgress } from "@/hooks/useProgress";
import { colors } from "@/lib/design-tokens";

export default function ProgressScreen() {
  const { data, isLoading, isError, refetch } = useProgress();
  const router = useRouter();

  if (isLoading) {
    return (
      <Screen scrollable={false}>
        <View style={{ gap: 12, paddingTop: 16 }}>
          <Skeleton width="100%" height={96} />
          <Skeleton width="100%" height={96} />
          <Skeleton width="100%" height={96} />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen scrollable={false}>
        <ErrorState onRetry={refetch} />
      </Screen>
    );
  }

  const subjects = data?.subjects ?? [];

  return (
    <Screen scrollable={false}>
      <View style={{ paddingTop: 16, paddingBottom: 12 }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "900",
            letterSpacing: -0.6,
            color: colors.text,
          }}
        >
          Seu progresso
        </Text>
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted }}>
          Matérias que você está estudando
        </Text>
      </View>
      <FlashList
        data={subjects}
        estimatedItemSize={108}
        keyExtractor={(s) => s.slug}
        renderItem={({ item }) => (
          <SubjectCard
            subject={item}
            onPress={() => router.push(`/subject/${item.slug}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState text="Complete uma sessão para ver seu progresso." />
        }
      />
    </Screen>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit 2>&1 | grep -v "_legacy" | grep -v "modal.tsx" | grep -v "+not-found" | head -5`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/native/app/\(app\)/\(tabs\)/progress.tsx
git commit -m "feat(native): wire Progress tab with FlashList of SubjectCard"
```

---

### Task 31: Wire `subject/[slug].tsx`

**Files:**
- Modify: `apps/native/app/(app)/subject/[slug].tsx`

- [ ] **Step 1: Replace the placeholder with the wired screen**

Replace the entire content of `apps/native/app/(app)/subject/[slug].tsx` with:

```tsx
import { FlashList } from "@shopify/flash-list";
import { Stack, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

import type { SubjectProgress } from "@pruvi/shared";

import { EmptyState } from "@/components/common/EmptyState";
import { NotFoundState } from "@/components/common/NotFoundState";
import { Screen } from "@/components/common/Screen";
import { Skeleton } from "@/components/common/Skeleton";
import { ReviewHistoryItem } from "@/components/subject/ReviewHistoryItem";
import { useProgress } from "@/hooks/useProgress";
import { useSubjectReviews } from "@/hooks/useSubjectReviews";
import { colors, radii } from "@/lib/design-tokens";

function SubjectHeader({ subject }: { subject: SubjectProgress }) {
  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: radii.xl,
        borderWidth: 2,
        borderColor: colors.border,
        padding: 20,
        marginVertical: 16,
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>
        {subject.name}
      </Text>
      <View style={{ flexDirection: "row", gap: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: "900", color: colors.primary }}>
          {subject.accuracy}% acerto
        </Text>
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textMuted }}>
          {subject.totalQuestions} questões
        </Text>
      </View>
    </View>
  );
}

export default function SubjectScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const progress = useProgress();
  const reviews = useSubjectReviews(slug);

  const subject = progress.data?.subjects.find((s) => s.slug === slug);

  if (progress.isLoading || reviews.isLoading) {
    return (
      <Screen scrollable={false}>
        <Skeleton width="100%" height={96} />
      </Screen>
    );
  }

  if (reviews.isError || !subject) {
    return (
      <>
        <Stack.Screen options={{ title: "Matéria" }} />
        <NotFoundState />
      </>
    );
  }

  return (
    <Screen scrollable={false}>
      <Stack.Screen options={{ title: subject.name, headerBackTitle: "Voltar" }} />
      <SubjectHeader subject={subject} />
      <FlashList
        data={reviews.data?.reviews ?? []}
        estimatedItemSize={88}
        keyExtractor={(r, i) => `${r.questionId}-${i}`}
        renderItem={({ item }) => <ReviewHistoryItem review={item} />}
        ListEmptyComponent={
          <EmptyState text="Você ainda não respondeu questões desta matéria." />
        }
      />
    </Screen>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit 2>&1 | grep -v "_legacy" | grep -v "modal.tsx" | grep -v "+not-found" | head -5`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/native/app/\(app\)/subject/\[slug\].tsx
git commit -m "feat(native): wire Subject detail screen with header + review history"
```

---

### Task 32: Wire `(tabs)/profile.tsx`

**Files:**
- Modify: `apps/native/app/(app)/(tabs)/profile.tsx`

- [ ] **Step 1: Replace the placeholder with the wired screen**

Replace the entire content of `apps/native/app/(app)/(tabs)/profile.tsx` with:

```tsx
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import { Text, View } from "react-native";

import { CharacterAvatar } from "@/components/gamification/CharacterAvatar";
import { StreakBadge } from "@/components/gamification/StreakBadge";
import { StudyCalendar } from "@/components/gamification/StudyCalendar";
import { XpCard } from "@/components/gamification/XpCard";
import { Screen } from "@/components/common/Screen";
import { Skeleton } from "@/components/common/Skeleton";
import { useCalendar } from "@/hooks/useCalendar";
import { useProfile } from "@/hooks/useProfile";
import { authClient } from "@/lib/auth-client";
import { currentMonth, formatMonthLabelPt } from "@/lib/date-format";
import { colors } from "@/lib/design-tokens";
import { authService } from "@/services/auth.service";

export default function ProfileScreen() {
  const profile = useProfile();
  const calendar = useCalendar();
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const router = useRouter();

  const currentMonthLabel = formatMonthLabelPt(new Date());

  const handleLogout = async () => {
    await authService.logout();
    queryClient.clear();
    router.replace("/(auth)/login");
  };

  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 16, paddingTop: 24 }}>
        <CharacterAvatar expression="happy" size={80} />
        <Text
          style={{
            fontSize: 22,
            fontWeight: "900",
            letterSpacing: -0.4,
            color: colors.text,
          }}
        >
          {session?.user?.name ?? "Estudante"}
        </Text>
        {profile.streaks && <StreakBadge count={profile.streaks.currentStreak} />}
      </View>

      <View style={{ marginTop: 24, gap: 16 }}>
        {profile.xp ? (
          <XpCard xp={profile.xp} />
        ) : (
          <Skeleton width="100%" height={80} />
        )}

        <Text
          style={{
            fontSize: 14,
            fontWeight: "900",
            letterSpacing: 0.5,
            textTransform: "uppercase",
            color: colors.textMuted,
            marginTop: 8,
          }}
        >
          {currentMonthLabel}
        </Text>

        {calendar.isLoading ? (
          <Skeleton width="100%" height={280} />
        ) : (
          <StudyCalendar
            dates={calendar.data?.dates ?? []}
            month={currentMonth()}
          />
        )}

        <Button variant="secondary" onPress={handleLogout} style={{ marginTop: 8 }}>
          <Button.Label>Sair</Button.Label>
        </Button>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit 2>&1 | grep -v "_legacy" | grep -v "modal.tsx" | grep -v "+not-found" | head -5`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/native/app/\(app\)/\(tabs\)/profile.tsx
git commit -m "feat(native): wire Profile tab with XpCard, StudyCalendar, streak, logout"
```

---

### Milestone 9 — Full verify + PR

### Task 33: Final verification — tsc + server tests + smoke test

**Files:** none modified.

- [ ] **Step 1: Type-check the entire native workspace**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit 2>&1 | grep -v "_legacy" | grep -v "modal.tsx" | grep -v "+not-found" | head -40`
Expected: no output (only pre-existing, filtered errors remain).

- [ ] **Step 2: Run the full server test suite**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/server && bun run test`
Expected: all PASS (new counts: at least the pre-Phase-4 total + ~18 new tests from tasks 7, 10).

- [ ] **Step 3: Run server integration tests**

Run: `cd /Users/cesarcamillo/dev/pruvi && make db-start && cd apps/server && bun run test:integration`
Expected: all PASS (pre-existing + ~12 new from tasks 9, 13).

- [ ] **Step 4: Smoke-test the app in iOS simulator**

Run: `cd /Users/cesarcamillo/dev/pruvi && bun run dev:server &` (wait for `Server listening at http://127.0.0.1:3000`)
Then: `cd apps/native && npx expo start --ios --clear`

Manually verify (from the simulator):
1. Log in → Home shows today's session card.
2. Tap "Começar" → answer at least 3 questions (mix correct/wrong).
3. Complete the session → Result screen shows.
4. Tap "Continuar" → returns to Home.
5. Open Progress tab → at least 1 `SubjectCard` with animated accuracy bar appears.
6. Tap a subject → Subject detail shows header (name + accuracy) and a FlashList with review rows.
7. Back to tabs → Profile tab shows `XpCard`, `StreakBadge`, `StudyCalendar` with today highlighted and at least 1 studied day (from the completed session).
8. Answer another question → Progress tab's accuracy updates within ~2s (invalidation works).

Kill the simulator + dev server when done.

- [ ] **Step 5: Confirm no new commits are needed for this task**

This is a verification-only task. If verification fails, go back and fix the failing task. No commit here.

---

### Task 34: Push branch + open PR

**Files:** none modified.

- [ ] **Step 1: Push the branch**

Run:
```bash
cd /Users/cesarcamillo/dev/pruvi
git push -u origin feature/phase4-progress-subject
```

- [ ] **Step 2: Open the PR against PR #6's branch**

Run:
```bash
gh pr create \
  --base fix/post-review-followups \
  --title "feat: Phase 4 — Progress & Subject Endpoints" \
  --body "$(cat <<'EOF'
## Summary

Implements Phase 4 of the Pruvi integration roadmap per spec `docs/superpowers/specs/2026-04-16-phase4-progress-subject-endpoints-design.md`.

- 3 authenticated GET endpoints (`/users/me/progress`, `/subjects/:slug/reviews`, `/users/me/calendar`)
- 3 new Zod schemas in `@pruvi/shared` + `qualityToCorrect` helper
- Native `progress.service.ts`, 3 query hooks (`useProgress`, `useSubjectReviews`, `useCalendar`)
- 3 new UI components (`SubjectCard`, `ReviewHistoryItem`, `StudyCalendar`)
- 3 common components (`ErrorState`, `EmptyState`, `NotFoundState`)
- `XpCard` extracted from Home for reuse in Profile
- `date-format.ts` lib with `buildMonthGrid`, `formatRelativeTime`, `formatMonthLabelPt`
- Wired Progress, Subject detail, Profile screens
- Extended session mutation invalidations; added backend cache invalidations on answer + complete

## Test plan

- [x] `bun run test` (server) — unit + integration pass
- [x] `bun run test:integration` (server) — `ProgressRepository` + `QuestionsRepository.getSubjectSlugForQuestion` pass
- [x] `npx tsc --noEmit` (native) — no new errors
- [ ] Manual: complete a session → Progress tab lists the subject; Subject detail shows the reviews; Profile calendar highlights today
- [ ] Manual: answer a question → Progress tab accuracy refetches within ~2s
EOF
)"
```

- [ ] **Step 3: Post the PR URL**

Capture the URL that `gh pr create` prints and share it (the reviewer needs it).

---

## Self-review notes

Spec coverage check:

| Spec section | Covered by |
|---|---|
| `progress.ts` schema | Task 3 |
| `subject-reviews.ts` schema | Task 4 |
| `calendar.ts` schema | Task 5 |
| `qualityToCorrect` helper | Task 2 |
| `@pruvi/shared` re-exports | Task 6 |
| `ProgressRepository` | Task 8, 9 |
| `getSubjectSlugForQuestion` in QuestionsRepository | Task 13 |
| `ProgressService` | Task 10 |
| `progress.route.ts` | Task 11 |
| `progress/index.ts` + register | Task 12 |
| `month-utils.ts` | Task 7 |
| Reviews invalidation | Task 14 |
| Sessions invalidation | Task 15 |
| `progress.service.ts` (native) | Task 17 |
| `useProgress`, `useSubjectReviews`, `useCalendar` | Tasks 18, 19, 20 |
| Session-query invalidations | Task 21 |
| `SubjectCard` | Task 27 |
| `ReviewHistoryItem` | Task 28 |
| `StudyCalendar` | Task 29 |
| `XpCard` extraction | Task 26 |
| `ErrorState`, `EmptyState`, `NotFoundState` | Tasks 23, 24, 25 |
| `date-format.ts` | Task 22 |
| Progress screen wire | Task 30 |
| Subject detail wire | Task 31 |
| Profile wire | Task 32 |
| Full verify | Task 33 |
| PR | Task 34 |

Every spec requirement has a task. No placeholders. Type names are consistent across tasks (`SubjectProgress`, `ReviewItem`, `CalendarResponse`, `ProgressResponse`, `SubjectReviewsResponse`, `MonthCell`).

Deviation from spec (intentional): the spec described cache invalidation as happening in `reviews.service.ts` / `sessions.service.ts`. The actual codebase puts invalidation in the **route layer** (confirmed by reading `reviews.route.ts` and `sessions.route.ts`). Tasks 14 and 15 follow the codebase convention, not the spec's mislocated callout. This is a docs-vs-code drift in the spec, not a plan gap.
