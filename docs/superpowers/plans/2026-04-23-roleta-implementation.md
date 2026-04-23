# Phase 6.1 Roleta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Roleta free-play mode — user configures eligible subjects, each spin picks a random subject and serves 3 questions from it. Answers log to `review_log` with `source='roleta'` and null `nextReviewAt` (hybrid: counts for accuracy, doesn't feed SM-2). No lives, half XP.

**Architecture:** New feature module `features/roleta/` on the server (repository + service + route), mirroring the onboarding pattern. Shared Zod schemas in `packages/shared/src/roleta.ts`. Native side gets `services/roleta.service.ts`, `hooks/useRoleta.ts`, `stores/roletaStore.ts`, and a `(app)/roleta/` route group with index/play/result/configurar screens. Session screen's option card is extracted into `components/session/OptionCard.tsx` so both modes share one pixel-perfect rendering.

**Tech Stack:** Fastify 5 + Drizzle ORM + Postgres + neverthrow `Result` types + Zod + Vitest on the server. Expo Router v4 + TanStack Query v5 + Zustand v5 + Reanimated v3 on the native side. Bun as the runtime.

---

## File Structure

**Server (new):**
- `apps/server/src/features/roleta/roleta.repository.ts` — Drizzle queries: config get/set, pool of questions for a subject, insertRoletaReview
- `apps/server/src/features/roleta/roleta.service.ts` — business logic + XP halving + subject resolution fallback
- `apps/server/src/features/roleta/roleta.route.ts` — four endpoints, cache invalidation
- `apps/server/src/features/roleta/roleta.service.test.ts` — unit tests against mocked repo
- `apps/server/src/features/roleta/roleta.repository.integration.test.ts` — DB-backed tests
- `apps/server/src/features/roleta/index.ts` — barrel export

**Server (modified):**
- `apps/server/src/index.ts` — register `roletaRoutes`

**Shared (new):**
- `packages/shared/src/roleta.ts` — `roletaConfigSchema`, `roletaConfigResponseSchema`, `roletaStartResponseSchema`, `roletaAnswerBodySchema`, `roletaAnswerResponseSchema`

**Shared (modified):**
- `packages/shared/src/index.ts` — re-export `./roleta`

**DB schema (modified):**
- `packages/db/src/schema/auth.ts` — add `roletaSubjects` jsonb column to `user`
- `packages/db/src/schema/review-log.ts` — add nullable `source` text column AND relax `nextReviewAt` to nullable

**DB migrations (new, auto-generated):**
- `packages/db/src/migrations/0001_<name>.sql`
- `packages/db/src/migrations/meta/0001_snapshot.json`
- `packages/db/src/migrations/meta/_journal.json` (append entry)

**Native (new):**
- `apps/native/components/session/OptionCard.tsx` — extracted from `session/[id].tsx`
- `apps/native/services/roleta.service.ts`
- `apps/native/hooks/useRoleta.ts`
- `apps/native/stores/roletaStore.ts`
- `apps/native/app/(app)/roleta/_layout.tsx`
- `apps/native/app/(app)/roleta/index.tsx`
- `apps/native/app/(app)/roleta/configurar.tsx`
- `apps/native/app/(app)/roleta/play.tsx`
- `apps/native/app/(app)/roleta/result.tsx`

**Native (modified):**
- `apps/native/app/(app)/session/[id].tsx` — replace inline option rendering with `<OptionCard />`
- `apps/native/app/(app)/(tabs)/index.tsx` — swap the "Desafios" tile for "Roleta"
- `apps/native/.expo/types/router.d.ts` — add new routes (Expo Router regenerates, but we update manually so typecheck passes pre-start)

**Docs (modified):**
- `docs/integration-map.md` — mark Phase 6.1 ✅, promote 6.2 to ← NEXT

---

## Task 1: Drizzle schema changes

**Files:**
- Modify: `packages/db/src/schema/auth.ts`
- Modify: `packages/db/src/schema/review-log.ts`

- [ ] **Step 1: Add `roletaSubjects` column to user schema**

Open `packages/db/src/schema/auth.ts` and add the column right below `dailyStudyTime`:

```ts
export const user = pgTable("user", {
  // ... existing columns
  selectedExam: text("selected_exam"),
  prepTimeline: text("prep_timeline"),
  difficulties: jsonb("difficulties").$type<string[]>(),
  dailyStudyTime: text("daily_study_time"),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  // NEW:
  roletaSubjects: jsonb("roleta_subjects").$type<string[]>(),
  // ... rest of columns
});
```

- [ ] **Step 2: Update review_log schema — add source, relax nextReviewAt**

Open `packages/db/src/schema/review-log.ts`. Change `nextReviewAt` from required to nullable, and append `source`:

```ts
export const reviewLog = pgTable(
  "review_log",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => question.id),
    quality: integer("quality").notNull(),
    easinessFactor: decimal("easiness_factor", {
      precision: 4,
      scale: 2,
    }).notNull(),
    interval: integer("interval").notNull(),
    repetitions: integer("repetitions").notNull(),
    // CHANGED: notNull() removed. Daily rows set a date; roleta rows set null.
    nextReviewAt: timestamp("next_review_at"),
    reviewedAt: timestamp("reviewed_at").defaultNow().notNull(),
    // NEW: null=daily, 'roleta'=roleta.
    source: text("source"),
  },
  // ... indexes unchanged
);
```

- [ ] **Step 3: Run typecheck to confirm the types ripple cleanly**

Run: `cd /Users/cesarcamillo/dev/pruvi && bun run check-types`
Expected: PASS. Drizzle emits new `$inferSelect` / `$inferInsert` types automatically.

- [ ] **Step 4: Commit**

```bash
cd /Users/cesarcamillo/dev/pruvi
git add packages/db/src/schema/auth.ts packages/db/src/schema/review-log.ts
git commit -m "feat(db): add roleta_subjects + review_log.source; relax nextReviewAt"
```

---

## Task 2: Generate and apply DB migration

**Files:**
- Create (auto): `packages/db/src/migrations/0001_<name>.sql`
- Create (auto): `packages/db/src/migrations/meta/0001_snapshot.json`
- Modify (auto): `packages/db/src/migrations/meta/_journal.json`

- [ ] **Step 1: Generate migration**

Run: `cd /Users/cesarcamillo/dev/pruvi/packages/db && pnpm exec drizzle-kit generate --name roleta`
Expected: output shows "[✓] Your SQL migration file ➜ src/migrations/0001_...sql 🚀" with three ALTER TABLE statements.

- [ ] **Step 2: Review the generated SQL**

Run: `ls /Users/cesarcamillo/dev/pruvi/packages/db/src/migrations/ && cat /Users/cesarcamillo/dev/pruvi/packages/db/src/migrations/0001_*.sql`
Expected content (columns may be in any order):

```sql
ALTER TABLE "user" ADD COLUMN "roleta_subjects" jsonb;
ALTER TABLE "review_log" ADD COLUMN "source" text;
ALTER TABLE "review_log" ALTER COLUMN "next_review_at" DROP NOT NULL;
```

If drizzle-kit prompts interactively (e.g., "is this a create or rename?"), answer "create column" for every ambiguity. If it produces unrelated alters, investigate before applying — likely means schema drift vs DB; see CLAUDE-in-repo docs.

- [ ] **Step 3: Apply migration to local Postgres**

Run: `docker exec -i pruvi-postgres psql -U postgres -d pruvi < /Users/cesarcamillo/dev/pruvi/packages/db/src/migrations/0001_*.sql`
Expected: three "ALTER TABLE" confirmations.

- [ ] **Step 4: Verify columns exist**

Run: `docker exec pruvi-postgres psql -U postgres -d pruvi -c "\d \"user\"" | grep roleta && docker exec pruvi-postgres psql -U postgres -d pruvi -c "\d review_log" | grep -E "source|next_review_at"`
Expected: a line showing `roleta_subjects | jsonb`, a line showing `source | text`, and a line for `next_review_at | timestamp without time zone` (no `not null`).

- [ ] **Step 5: Commit**

```bash
cd /Users/cesarcamillo/dev/pruvi
git add packages/db/src/migrations/
git commit -m "chore(db): migration 0001 — roleta columns + nullable nextReviewAt"
```

---

## Task 3: Shared Zod schemas

**Files:**
- Create: `packages/shared/src/roleta.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create `packages/shared/src/roleta.ts`**

```ts
import { z } from "zod";
import { subjectSchema } from "./subjects";
import { clientQuestionSchema } from "./questions";

/** PUT /roleta/config body. Max 5 because we only seed 5 subjects. */
export const roletaConfigSchema = z.object({
  subjects: z.array(z.string().min(1)).min(1).max(5),
});
export type RoletaConfig = z.infer<typeof roletaConfigSchema>;

/**
 * GET /roleta/config response. `subjects` is always resolved — if the
 * user hasn't configured it yet, the server fills in all 5 subject slugs.
 */
export const roletaConfigResponseSchema = z.object({
  subjects: z.array(z.string()),
});
export type RoletaConfigResponse = z.infer<typeof roletaConfigResponseSchema>;

/**
 * POST /roleta/spin response. `spinId` is a correlation ID the client
 * passes back on each answer; the server does NOT persist it.
 */
export const roletaStartResponseSchema = z.object({
  spinId: z.string().uuid(),
  subject: subjectSchema,
  questions: z.array(clientQuestionSchema).length(3),
});
export type RoletaStartResponse = z.infer<typeof roletaStartResponseSchema>;

/** POST /roleta/answer body. */
export const roletaAnswerBodySchema = z.object({
  spinId: z.string().uuid(),
  questionId: z.number().int(),
  selectedOptionIndex: z.number().int().min(0).max(3),
});
export type RoletaAnswerBody = z.infer<typeof roletaAnswerBodySchema>;

/** POST /roleta/answer response. */
export const roletaAnswerResponseSchema = z.object({
  correct: z.boolean(),
  correctOptionIndex: z.number().int(),
  xpAwarded: z.number().int().min(0),
});
export type RoletaAnswerResponse = z.infer<typeof roletaAnswerResponseSchema>;
```

- [ ] **Step 2: Re-export from barrel**

Edit `packages/shared/src/index.ts` — add the export line at the end:

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
export * from "./onboarding";
export * from "./roleta";
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/cesarcamillo/dev/pruvi && bun run check-types`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/cesarcamillo/dev/pruvi
git add packages/shared/src/roleta.ts packages/shared/src/index.ts
git commit -m "feat(shared): roleta zod schemas"
```

---

## Task 4: Roleta repository (TDD — integration tests drive the shape)

**Files:**
- Create: `apps/server/src/features/roleta/roleta.repository.ts`
- Create: `apps/server/src/features/roleta/roleta.repository.integration.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `apps/server/src/features/roleta/roleta.repository.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq, isNull } from "drizzle-orm";
import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../test/db-helpers";
import { RoletaRepository } from "./roleta.repository";
import { user } from "@pruvi/db/schema/auth";
import { subject } from "@pruvi/db/schema/subjects";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";

describe("RoletaRepository (integration)", () => {
  const db = getTestDb();
  const repo = new RoletaRepository(db);

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function seedUser(id = "u1") {
    await db.insert(user).values({
      id,
      name: "Test",
      email: `${id}@test.com`,
      emailVerified: false,
      updatedAt: new Date(),
    });
  }

  async function seedSubjectWithQuestions(slug: string, name: string, count: number) {
    const [subj] = await db.insert(subject).values({ slug, name }).returning();
    const values = Array.from({ length: count }, (_, i) => ({
      subjectId: subj!.id,
      body: `${slug}-Q${i + 1}`,
      options: ["a", "b", "c", "d"],
      correctOptionIndex: 0,
      difficulty: 1,
      requiresCalculation: false,
    }));
    await db.insert(question).values(values);
    return subj!;
  }

  describe("getConfig", () => {
    it("returns null when the user has not configured roleta", async () => {
      await seedUser();
      const row = await repo.getConfig("u1");
      expect(row).toBeNull();
    });

    it("returns the stored subjects array when set", async () => {
      await seedUser();
      await repo.saveConfig("u1", ["mat", "bio"]);
      const row = await repo.getConfig("u1");
      expect(row).toEqual(["mat", "bio"]);
    });
  });

  describe("saveConfig", () => {
    it("overwrites prior config", async () => {
      await seedUser();
      await repo.saveConfig("u1", ["mat"]);
      await repo.saveConfig("u1", ["bio", "fis"]);
      expect(await repo.getConfig("u1")).toEqual(["bio", "fis"]);
    });
  });

  describe("listSubjectSlugs", () => {
    it("returns every subject slug in the DB", async () => {
      await seedSubjectWithQuestions("mat", "Matemática", 1);
      await seedSubjectWithQuestions("bio", "Biologia", 1);
      const slugs = await repo.listSubjectSlugs();
      expect(slugs.sort()).toEqual(["bio", "mat"]);
    });
  });

  describe("findSubjectBySlug", () => {
    it("returns the subject row for a known slug", async () => {
      const s = await seedSubjectWithQuestions("mat", "Matemática", 1);
      const row = await repo.findSubjectBySlug("mat");
      expect(row).not.toBeNull();
      expect(row!.id).toBe(s.id);
      expect(row!.slug).toBe("mat");
    });

    it("returns null for an unknown slug", async () => {
      expect(await repo.findSubjectBySlug("ghost")).toBeNull();
    });
  });

  describe("selectRandomQuestions", () => {
    it("returns exactly N questions from the given subject", async () => {
      const s = await seedSubjectWithQuestions("mat", "Matemática", 10);
      const qs = await repo.selectRandomQuestions(s.id, 3);
      expect(qs).toHaveLength(3);
      expect(qs.every((q) => q.subjectId === s.id)).toBe(true);
    });

    it("returns fewer than N when the subject has fewer questions", async () => {
      const s = await seedSubjectWithQuestions("mat", "Matemática", 2);
      const qs = await repo.selectRandomQuestions(s.id, 3);
      expect(qs).toHaveLength(2);
    });
  });

  describe("insertRoletaReview", () => {
    it("writes a row with source='roleta' and null nextReviewAt", async () => {
      await seedUser();
      const s = await seedSubjectWithQuestions("mat", "Matemática", 1);
      const [q] = await db
        .select()
        .from(question)
        .where(eq(question.subjectId, s.id))
        .limit(1);

      await repo.insertRoletaReview({
        userId: "u1",
        questionId: q!.id,
        quality: 4,
      });

      const rows = await db
        .select()
        .from(reviewLog)
        .where(eq(reviewLog.userId, "u1"));
      expect(rows).toHaveLength(1);
      expect(rows[0]!.source).toBe("roleta");
      expect(rows[0]!.nextReviewAt).toBeNull();
      expect(rows[0]!.quality).toBe(4);
    });
  });

  describe("awardXp", () => {
    it("increments totalXp on the user row", async () => {
      await seedUser();
      await repo.awardXp("u1", 7);
      await repo.awardXp("u1", 3);
      const rows = await db
        .select({ totalXp: user.totalXp })
        .from(user)
        .where(eq(user.id, "u1"));
      expect(rows[0]!.totalXp).toBe(10);
    });
  });

  describe("findQuestionById", () => {
    it("returns the question with its correct index for grading", async () => {
      const s = await seedSubjectWithQuestions("mat", "Matemática", 1);
      const [q] = await db
        .select()
        .from(question)
        .where(eq(question.subjectId, s.id))
        .limit(1);
      const found = await repo.findQuestionById(q!.id);
      expect(found).not.toBeNull();
      expect(found!.correctOptionIndex).toBe(0);
      expect(found!.difficulty).toBe(1);
    });

    it("returns null for unknown id", async () => {
      expect(await repo.findQuestionById(9999999)).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails (no repository yet)**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/server && bun run test:integration -- roleta.repository`
Expected: fails with "Cannot find module './roleta.repository'" or equivalent.

- [ ] **Step 3: Implement the repository**

Create `apps/server/src/features/roleta/roleta.repository.ts`:

```ts
import { eq, sql } from "drizzle-orm";
import { user } from "@pruvi/db/schema/auth";
import { subject } from "@pruvi/db/schema/subjects";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export class RoletaRepository {
  constructor(private db: DbClient) {}

  /** Read the user's configured eligible subject slugs, or null if never set. */
  async getConfig(userId: string): Promise<string[] | null> {
    const rows = await this.db
      .select({ roletaSubjects: user.roletaSubjects })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const row = rows[0];
    return row?.roletaSubjects ?? null;
  }

  /** Overwrite the user's eligible subjects. */
  async saveConfig(userId: string, slugs: string[]): Promise<void> {
    await this.db
      .update(user)
      .set({ roletaSubjects: slugs })
      .where(eq(user.id, userId));
  }

  /** Every subject slug in the DB — used for the default pool. */
  async listSubjectSlugs(): Promise<string[]> {
    const rows = await this.db
      .select({ slug: subject.slug })
      .from(subject);
    return rows.map((r) => r.slug);
  }

  /** Look up a subject by slug. */
  async findSubjectBySlug(slug: string) {
    const rows = await this.db
      .select()
      .from(subject)
      .where(eq(subject.slug, slug))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Random sample of N questions from the given subject. Uses ORDER BY
   * RANDOM() — fine at our current scale (~110 questions across 5 subjects).
   * Returns fewer than N rows if the subject has fewer.
   */
  async selectRandomQuestions(subjectId: number, limit: number) {
    return this.db
      .select()
      .from(question)
      .where(eq(question.subjectId, subjectId))
      .orderBy(sql`RANDOM()`)
      .limit(limit);
  }

  /** Look up a question by ID — needed for answer grading. */
  async findQuestionById(questionId: number) {
    const rows = await this.db
      .select()
      .from(question)
      .where(eq(question.id, questionId))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Append a review_log row for a Roleta answer. SM-2 fields are set to
   * neutral values (interval=0, repetitions=0, ease=2.50) and nextReviewAt
   * is null — the null is the marker that scheduling does not apply.
   */
  async insertRoletaReview(data: {
    userId: string;
    questionId: number;
    quality: number;
  }): Promise<void> {
    await this.db.insert(reviewLog).values({
      userId: data.userId,
      questionId: data.questionId,
      quality: data.quality,
      easinessFactor: "2.50",
      interval: 0,
      repetitions: 0,
      nextReviewAt: null,
      source: "roleta",
    });
  }

  /** Increment user's totalXp. */
  async awardXp(userId: string, amount: number): Promise<void> {
    if (amount <= 0) return;
    await this.db
      .update(user)
      .set({ totalXp: sql`${user.totalXp} + ${amount}` })
      .where(eq(user.id, userId));
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/server && bun run test:integration -- roleta.repository`
Expected: all 10 cases PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/cesarcamillo/dev/pruvi
git add apps/server/src/features/roleta/roleta.repository.ts apps/server/src/features/roleta/roleta.repository.integration.test.ts
git commit -m "feat(server): RoletaRepository + integration tests"
```

---

## Task 5: Roleta service (TDD — unit tests against mocked repo)

**Files:**
- Create: `apps/server/src/features/roleta/roleta.service.ts`
- Create: `apps/server/src/features/roleta/roleta.service.test.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `apps/server/src/features/roleta/roleta.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoletaService } from "./roleta.service";
import { NotFoundError, ValidationError } from "../../utils/errors";

function createMocks() {
  const repo = {
    getConfig: vi.fn(),
    saveConfig: vi.fn(),
    listSubjectSlugs: vi.fn(),
    findSubjectBySlug: vi.fn(),
    selectRandomQuestions: vi.fn(),
    findQuestionById: vi.fn(),
    insertRoletaReview: vi.fn(),
    awardXp: vi.fn(),
  };
  const service = new RoletaService(repo as any);
  return { repo, service };
}

const allSlugs = ["matematica", "biologia", "fisica", "quimica", "portugues"];

function mockSubject(overrides: Partial<{ id: number; slug: string; name: string }> = {}) {
  return { id: 1, slug: "matematica", name: "Matemática", ...overrides };
}

function mockQuestion(id: number, difficulty = 1) {
  return {
    id,
    subjectId: 1,
    body: `Q${id}`,
    options: ["a", "b", "c", "d"],
    correctOptionIndex: 0,
    difficulty,
    requiresCalculation: false,
    source: null,
    createdAt: new Date(),
  };
}

describe("RoletaService", () => {
  let repo: ReturnType<typeof createMocks>["repo"];
  let service: RoletaService;

  beforeEach(() => {
    ({ repo, service } = createMocks());
  });

  describe("getConfig", () => {
    it("returns all subject slugs when user has no config", async () => {
      repo.getConfig.mockResolvedValue(null);
      repo.listSubjectSlugs.mockResolvedValue(allSlugs);

      const result = await service.getConfig("u1");

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().subjects).toEqual(allSlugs);
    });

    it("returns the user's stored subjects when set", async () => {
      repo.getConfig.mockResolvedValue(["matematica", "biologia"]);

      const result = await service.getConfig("u1");

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().subjects).toEqual(["matematica", "biologia"]);
      expect(repo.listSubjectSlugs).not.toHaveBeenCalled();
    });
  });

  describe("saveConfig", () => {
    it("rejects when a slug does not exist", async () => {
      repo.listSubjectSlugs.mockResolvedValue(allSlugs);

      const result = await service.saveConfig("u1", { subjects: ["ghost"] });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
      expect(repo.saveConfig).not.toHaveBeenCalled();
    });

    it("persists and echoes a valid array", async () => {
      repo.listSubjectSlugs.mockResolvedValue(allSlugs);

      const result = await service.saveConfig("u1", {
        subjects: ["matematica", "biologia"],
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().subjects).toEqual([
        "matematica",
        "biologia",
      ]);
      expect(repo.saveConfig).toHaveBeenCalledWith("u1", [
        "matematica",
        "biologia",
      ]);
    });
  });

  describe("spin", () => {
    it("returns a spinId, one subject drawn from the pool, and 3 questions", async () => {
      repo.getConfig.mockResolvedValue(["matematica"]);
      repo.findSubjectBySlug.mockResolvedValue(mockSubject());
      repo.selectRandomQuestions.mockResolvedValue([
        mockQuestion(1),
        mockQuestion(2),
        mockQuestion(3),
      ]);

      const result = await service.spin("u1");

      expect(result.isOk()).toBe(true);
      const value = result._unsafeUnwrap();
      expect(value.spinId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(value.subject.slug).toBe("matematica");
      expect(value.questions).toHaveLength(3);
      // Client-safe: no correctOptionIndex leaked
      expect(value.questions[0]).not.toHaveProperty("correctOptionIndex");
    });

    it("falls back to all slugs when user has no config", async () => {
      repo.getConfig.mockResolvedValue(null);
      repo.listSubjectSlugs.mockResolvedValue(allSlugs);
      repo.findSubjectBySlug.mockResolvedValue(mockSubject());
      repo.selectRandomQuestions.mockResolvedValue([
        mockQuestion(1),
        mockQuestion(2),
        mockQuestion(3),
      ]);

      const result = await service.spin("u1");

      expect(result.isOk()).toBe(true);
      expect(repo.findSubjectBySlug).toHaveBeenCalledWith(
        expect.stringMatching(
          /^(matematica|biologia|fisica|quimica|portugues)$/,
        ),
      );
    });

    it("returns ValidationError when the picked subject has no questions", async () => {
      repo.getConfig.mockResolvedValue(["matematica"]);
      repo.findSubjectBySlug.mockResolvedValue(mockSubject());
      repo.selectRandomQuestions.mockResolvedValue([]);

      const result = await service.spin("u1");

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
    });

    it("returns NotFoundError if configured slug is no longer in the DB", async () => {
      repo.getConfig.mockResolvedValue(["deleted-subject"]);
      repo.findSubjectBySlug.mockResolvedValue(null);

      const result = await service.spin("u1");

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(NotFoundError);
    });
  });

  describe("answer", () => {
    it("awards floor(baseXp/2) on correct", async () => {
      // easy base = 10 → floor(10/2) = 5
      repo.findQuestionById.mockResolvedValue(mockQuestion(7, 1));

      const result = await service.answer("u1", {
        spinId: "11111111-1111-1111-1111-111111111111",
        questionId: 7,
        selectedOptionIndex: 0,
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({
        correct: true,
        correctOptionIndex: 0,
        xpAwarded: 5,
      });
      expect(repo.awardXp).toHaveBeenCalledWith("u1", 5);
      expect(repo.insertRoletaReview).toHaveBeenCalledWith({
        userId: "u1",
        questionId: 7,
        quality: 4,
      });
    });

    it("awards 0 on wrong and writes quality=1", async () => {
      repo.findQuestionById.mockResolvedValue(mockQuestion(7, 3)); // medium

      const result = await service.answer("u1", {
        spinId: "11111111-1111-1111-1111-111111111111",
        questionId: 7,
        selectedOptionIndex: 2, // wrong
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({
        correct: false,
        correctOptionIndex: 0,
        xpAwarded: 0,
      });
      expect(repo.awardXp).not.toHaveBeenCalled();
      expect(repo.insertRoletaReview).toHaveBeenCalledWith({
        userId: "u1",
        questionId: 7,
        quality: 1,
      });
    });

    it("returns NotFoundError for unknown question", async () => {
      repo.findQuestionById.mockResolvedValue(null);

      const result = await service.answer("u1", {
        spinId: "11111111-1111-1111-1111-111111111111",
        questionId: 999,
        selectedOptionIndex: 0,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(NotFoundError);
    });

    it("halves medium and hard XP correctly (floor)", async () => {
      // hard base = 35 → floor(35/2) = 17
      repo.findQuestionById.mockResolvedValue(mockQuestion(1, 5));

      const result = await service.answer("u1", {
        spinId: "11111111-1111-1111-1111-111111111111",
        questionId: 1,
        selectedOptionIndex: 0,
      });

      expect(result._unsafeUnwrap().xpAwarded).toBe(17);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/server && bun run test -- roleta.service`
Expected: fails with "Cannot find module './roleta.service'".

- [ ] **Step 3: Implement the service**

Create `apps/server/src/features/roleta/roleta.service.ts`:

```ts
import { err, ok, type Result } from "neverthrow";
import { randomUUID } from "node:crypto";
import {
  calculateXpForAnswer,
  difficultyFromNumber,
  type QualityScore,
  type RoletaAnswerBody,
  type RoletaAnswerResponse,
  type RoletaConfig,
  type RoletaConfigResponse,
  type RoletaStartResponse,
  type Subject,
} from "@pruvi/shared";
import type { AppError } from "../../utils/errors";
import { NotFoundError, ValidationError } from "../../utils/errors";
import type { RoletaRepository } from "./roleta.repository";

const QUESTIONS_PER_SPIN = 3;

export class RoletaService {
  constructor(private repo: RoletaRepository) {}

  /** Read the user's eligible subjects, falling back to all if unset. */
  async getConfig(
    userId: string
  ): Promise<Result<RoletaConfigResponse, AppError>> {
    const configured = await this.repo.getConfig(userId);
    if (configured && configured.length > 0) {
      return ok({ subjects: configured });
    }
    const all = await this.repo.listSubjectSlugs();
    return ok({ subjects: all });
  }

  /** Persist the user's eligible-subject list after validating every slug. */
  async saveConfig(
    userId: string,
    payload: RoletaConfig
  ): Promise<Result<RoletaConfigResponse, AppError>> {
    const validSlugs = new Set(await this.repo.listSubjectSlugs());
    const unknown = payload.subjects.filter((s) => !validSlugs.has(s));
    if (unknown.length > 0) {
      return err(
        new ValidationError(`Unknown subject: ${unknown.join(", ")}`)
      );
    }
    await this.repo.saveConfig(userId, payload.subjects);
    return ok({ subjects: payload.subjects });
  }

  /**
   * Pick one random subject from the user's pool and return 3 questions
   * from it. The spinId is a correlation ID; the server does NOT persist
   * it — it only travels with the response so clients can group answers.
   */
  async spin(userId: string): Promise<Result<RoletaStartResponse, AppError>> {
    const configured = await this.repo.getConfig(userId);
    const pool =
      configured && configured.length > 0
        ? configured
        : await this.repo.listSubjectSlugs();

    if (pool.length === 0) {
      return err(new ValidationError("No subjects available"));
    }

    const pickedSlug = pool[Math.floor(Math.random() * pool.length)]!;
    const subjectRow = await this.repo.findSubjectBySlug(pickedSlug);
    if (!subjectRow) {
      return err(new NotFoundError(`Subject '${pickedSlug}' not found`));
    }

    const questions = await this.repo.selectRandomQuestions(
      subjectRow.id,
      QUESTIONS_PER_SPIN
    );
    if (questions.length === 0) {
      return err(
        new ValidationError(
          `Subject '${pickedSlug}' has no questions available`
        )
      );
    }

    // Strip correctOptionIndex before returning to the client.
    const clientQuestions = questions.map(
      ({ correctOptionIndex: _correct, ...rest }) => rest
    );

    const subject: Subject = {
      id: subjectRow.id,
      slug: subjectRow.slug,
      name: subjectRow.name,
    };

    return ok({
      spinId: randomUUID(),
      subject,
      questions: clientQuestions,
    });
  }

  /**
   * Grade a single Roleta answer. Writes a review_log row with source='roleta'
   * and null nextReviewAt; awards floor(baseXp / 2) on correct; awards 0 on
   * wrong. Does NOT touch lives (Roleta is free-play).
   */
  async answer(
    userId: string,
    body: RoletaAnswerBody
  ): Promise<Result<RoletaAnswerResponse, AppError>> {
    const q = await this.repo.findQuestionById(body.questionId);
    if (!q) {
      return err(new NotFoundError("Question not found"));
    }

    const correct = q.correctOptionIndex === body.selectedOptionIndex;
    const quality: QualityScore = correct ? 4 : 1;

    const baseXp = calculateXpForAnswer(
      correct,
      difficultyFromNumber(q.difficulty)
    );
    const xpAwarded = Math.floor(baseXp / 2);

    await this.repo.insertRoletaReview({
      userId,
      questionId: body.questionId,
      quality,
    });

    if (xpAwarded > 0) {
      await this.repo.awardXp(userId, xpAwarded);
    }

    return ok({
      correct,
      correctOptionIndex: q.correctOptionIndex,
      xpAwarded,
    });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/server && bun run test -- roleta.service`
Expected: all cases PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/cesarcamillo/dev/pruvi
git add apps/server/src/features/roleta/roleta.service.ts apps/server/src/features/roleta/roleta.service.test.ts
git commit -m "feat(server): RoletaService + unit tests"
```

---

## Task 6: Route handlers + barrel + registration

**Files:**
- Create: `apps/server/src/features/roleta/roleta.route.ts`
- Create: `apps/server/src/features/roleta/index.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Create the route module**

Create `apps/server/src/features/roleta/roleta.route.ts`:

```ts
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  roletaAnswerBodySchema,
  roletaConfigSchema,
} from "@pruvi/shared";
import { db } from "@pruvi/db";
import { unwrapResult } from "../../types";
import { RoletaRepository } from "./roleta.repository";
import { RoletaService } from "./roleta.service";

const repo = new RoletaRepository(db);
const service = new RoletaService(repo);

const CONFIG_TTL = 5 * 60; // 5 minutes

export const roletaRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /roleta/config — cached, with resolved defaults.
  fastify.get(
    "/roleta/config",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const cacheKey = `roleta-config:${request.userId}`;
      const cached = await fastify.cache.get<{ subjects: string[] }>(cacheKey);
      if (cached) {
        return { success: true as const, data: cached };
      }
      const result = await service.getConfig(request.userId);
      const response = unwrapResult(result);
      await fastify.cache.set(cacheKey, response.data, CONFIG_TTL);
      return response;
    }
  );

  // PUT /roleta/config — partial/full replacement.
  fastify.put(
    "/roleta/config",
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: roletaConfigSchema,
      },
    },
    async (request) => {
      // Invalidate BEFORE unwrap — if the service throws via unwrap, we
      // don't want a stale cache. Same pattern as reviews.route.ts.
      await fastify.cache.del(`roleta-config:${request.userId}`);
      const result = await service.saveConfig(request.userId, request.body);
      return unwrapResult(result);
    }
  );

  // POST /roleta/spin — one subject random from pool, 3 questions random from it.
  fastify.post(
    "/roleta/spin",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const result = await service.spin(request.userId);
      return unwrapResult(result);
    }
  );

  // POST /roleta/answer — grade + half XP + review_log row.
  fastify.post(
    "/roleta/answer",
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: roletaAnswerBodySchema,
      },
    },
    async (request) => {
      // XP / progress caches go stale after every answer.
      await Promise.allSettled([
        fastify.cache.del(`xp:${request.userId}`),
        fastify.cache.del(`progress:${request.userId}`),
      ]);
      const result = await service.answer(request.userId, request.body);
      return unwrapResult(result);
    }
  );
};
```

- [ ] **Step 2: Barrel export**

Create `apps/server/src/features/roleta/index.ts`:

```ts
export { roletaRoutes } from "./roleta.route";
```

- [ ] **Step 3: Register routes in server/index.ts**

Edit `apps/server/src/index.ts`. Add the import near the other feature imports:

```ts
import { gamificationRoutes } from "./features/gamification";
import { livesRoutes } from "./features/lives";
import { onboardingRoutes } from "./features/onboarding";
import { progressRoutes } from "./features/progress";
import { reviewsRoutes } from "./features/reviews";
import { roletaRoutes } from "./features/roleta";
import { sessionsRoutes } from "./features/sessions";
import { streaksRoutes } from "./features/streaks";
```

And add the `await app.register(...)` line next to the other feature registrations (after `progressRoutes` and before or near `onboardingRoutes`):

```ts
  await app.register(gamificationRoutes);
  await app.register(progressRoutes);
  await app.register(onboardingRoutes);
  await app.register(roletaRoutes);
```

- [ ] **Step 4: Typecheck + existing tests still green**

Run: `cd /Users/cesarcamillo/dev/pruvi && bun run check-types && cd apps/server && bun run test`
Expected: typecheck PASS, all 68+ existing tests PASS, plus 10 new Roleta cases.

- [ ] **Step 5: Commit**

```bash
cd /Users/cesarcamillo/dev/pruvi
git add apps/server/src/features/roleta/index.ts apps/server/src/features/roleta/roleta.route.ts apps/server/src/index.ts
git commit -m "feat(server): roleta routes + cache invalidation + app wiring"
```

---

## Task 7: End-to-end route integration test

**Files:**
- Create: `apps/server/src/features/roleta/roleta.route.integration.test.ts`

- [ ] **Step 1: Write the integration test**

Create `apps/server/src/features/roleta/roleta.route.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../test/db-helpers";
import { buildApp } from "../../index";
import { user } from "@pruvi/db/schema/auth";
import { subject } from "@pruvi/db/schema/subjects";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import { dailySession } from "@pruvi/db/schema/daily-sessions";

describe("roleta routes (integration)", () => {
  const db = getTestDb();
  let app: FastifyInstance;

  beforeAll(async () => {
    await setupTestDb();
    app = await buildApp();
    // Stub authentication: any request gets userId=u1.
    app.decorateRequest("userId", "");
    app.addHook("preHandler", (request, _reply, done) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (request as any).userId = "u1";
      done();
    });
    await app.ready();
  });

  beforeEach(async () => {
    await cleanupTestDb();
    await db.insert(user).values({
      id: "u1",
      name: "Test",
      email: "u1@test.com",
      emailVerified: false,
      updatedAt: new Date(),
    });
    const [subj] = await db
      .insert(subject)
      .values({ slug: "matematica", name: "Matemática" })
      .returning();
    const values = Array.from({ length: 5 }, (_, i) => ({
      subjectId: subj!.id,
      body: `Q${i + 1}`,
      options: ["a", "b", "c", "d"],
      correctOptionIndex: 0,
      difficulty: 1,
      requiresCalculation: false,
    }));
    await db.insert(question).values(values);
  });

  afterAll(async () => {
    await app.close();
    await teardownTestDb();
  });

  it("spin then answer ×3 — xp grows, no lives change, no daily_session, 3 review_log rows", async () => {
    const spinRes = await app.inject({ method: "POST", url: "/roleta/spin" });
    expect(spinRes.statusCode).toBe(200);
    const { data: spin } = spinRes.json();
    expect(spin.questions).toHaveLength(3);

    // Answer all 3 correctly.
    let totalXp = 0;
    for (const q of spin.questions) {
      const res = await app.inject({
        method: "POST",
        url: "/roleta/answer",
        payload: {
          spinId: spin.spinId,
          questionId: q.id,
          selectedOptionIndex: 0,
        },
      });
      expect(res.statusCode).toBe(200);
      const { data: answer } = res.json();
      expect(answer.correct).toBe(true);
      totalXp += answer.xpAwarded;
    }

    // All answers were easy correct → floor(10/2) = 5 each.
    expect(totalXp).toBe(15);

    const userRows = await db
      .select({ totalXp: user.totalXp, lives: user.lives })
      .from(user)
      .where(eq(user.id, "u1"));
    expect(userRows[0]!.totalXp).toBe(15);
    expect(userRows[0]!.lives).toBe(5); // unchanged

    const dailyRows = await db.select().from(dailySession);
    expect(dailyRows).toHaveLength(0);

    const reviewRows = await db
      .select()
      .from(reviewLog)
      .where(eq(reviewLog.userId, "u1"));
    expect(reviewRows).toHaveLength(3);
    for (const r of reviewRows) {
      expect(r.source).toBe("roleta");
      expect(r.nextReviewAt).toBeNull();
    }
  });

  it("GET /roleta/config falls back to all slugs when user has none", async () => {
    const res = await app.inject({ method: "GET", url: "/roleta/config" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.subjects).toEqual(["matematica"]);
  });

  it("PUT /roleta/config rejects unknown slug with 400", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/roleta/config",
      payload: { subjects: ["ghost"] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("PUT /roleta/config persists and subsequent GET reflects it", async () => {
    // Seed a second subject so there's something to store.
    await db.insert(subject).values({ slug: "biologia", name: "Biologia" });

    const put = await app.inject({
      method: "PUT",
      url: "/roleta/config",
      payload: { subjects: ["biologia"] },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().data.subjects).toEqual(["biologia"]);

    const get = await app.inject({ method: "GET", url: "/roleta/config" });
    expect(get.statusCode).toBe(200);
    expect(get.json().data.subjects).toEqual(["biologia"]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/server && bun run test:integration -- roleta.route`
Expected: all 4 cases PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/cesarcamillo/dev/pruvi
git add apps/server/src/features/roleta/roleta.route.integration.test.ts
git commit -m "test(server): roleta end-to-end route integration"
```

---

## Task 8: Extract the shared OptionCard component

**Files:**
- Create: `apps/native/components/session/OptionCard.tsx`
- Modify: `apps/native/app/(app)/session/[id].tsx`

- [ ] **Step 1: Create the shared component**

Create `apps/native/components/session/OptionCard.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from "react-native";

export type OptionCardState = "idle" | "selected" | "correct" | "wrong";

type Props = {
  letter: string;
  text: string;
  state: OptionCardState;
  onPress: () => void;
  disabled?: boolean;
};

export function OptionCard({ letter, text, state, onPress, disabled = false }: Props) {
  const cardStyle =
    state === "correct"
      ? [styles.card, styles.cardCorrect]
      : state === "wrong"
        ? [styles.card, styles.cardWrong]
        : state === "selected"
          ? [styles.card, styles.cardSelected]
          : styles.card;

  const letterStyle =
    state === "correct"
      ? [styles.letter, styles.letterCorrect]
      : state === "wrong"
        ? [styles.letter, styles.letterWrong]
        : state === "selected"
          ? [styles.letter, styles.letterSelected]
          : styles.letter;

  const letterTextStyle =
    state === "idle" ? styles.letterText : [styles.letterText, styles.letterTextSelected];
  const textStyle =
    state === "idle" ? styles.text : [styles.text, styles.textSelected];

  return (
    <Pressable style={cardStyle} onPress={onPress} disabled={disabled}>
      <View style={letterStyle}>
        <Text style={letterTextStyle}>{letter}</Text>
      </View>
      <Text style={textStyle}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.4)",
    paddingHorizontal: 20,
    minHeight: 68,
    paddingVertical: 14,
    gap: 16,
  },
  cardSelected: {
    backgroundColor: "rgba(88, 205, 4, 0.05)",
    borderColor: "#58CD04",
  },
  cardCorrect: {
    backgroundColor: "rgba(88, 205, 4, 0.15)",
    borderColor: "#58CD04",
  },
  cardWrong: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "#EF4444",
  },
  letter: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  letterSelected: { backgroundColor: "#58CD04" },
  letterCorrect: { backgroundColor: "#58CD04" },
  letterWrong: { backgroundColor: "#EF4444" },
  letterText: {
    fontWeight: "900",
    fontSize: 13,
    color: "#6B6B6B",
  },
  letterTextSelected: { color: "#FFFFFF" },
  text: {
    flex: 1,
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 22,
    color: "#2B2B2B",
  },
  textSelected: { fontWeight: "900" },
});
```

- [ ] **Step 2: Refactor session/[id].tsx to use OptionCard**

Open `apps/native/app/(app)/session/[id].tsx`. In the options rendering (currently a big inline map with inline style construction), replace the entire `currentQuestion.options.map(...)` block inside `styles.optionsList` with:

```tsx
<View style={styles.optionsList}>
  {currentQuestion.options.map((optionText, index) => {
    const letter = OPTION_LETTERS[index] ?? String(index + 1);
    const isSelected = selectedOptionIndex === index;
    const isCorrect = answerState !== "idle" && correctIndex === index;
    const isWrongSelection =
      answerState === "wrong" && isSelected && correctIndex !== index;

    const state: OptionCardState = isCorrect
      ? "correct"
      : isWrongSelection
        ? "wrong"
        : isSelected
          ? "selected"
          : "idle";

    return (
      <OptionCard
        key={index}
        letter={letter}
        text={optionText}
        state={state}
        onPress={() => {
          if (answerState === "idle") {
            sessionActions.selectOption(index);
          }
        }}
        disabled={answerState !== "idle"}
      />
    );
  })}
</View>
```

Add the import at the top:

```tsx
import { OptionCard, type OptionCardState } from "@/components/session/OptionCard";
```

Remove the now-unused inline styles from the StyleSheet block at the bottom of the file: `optionCard`, `optionCardSelected`, `optionCardCorrect`, `optionCardWrong`, `optionLetter`, `optionLetterSelected`, `optionLetterCorrect`, `optionLetterWrong`, `optionLetterText`, `optionLetterTextSelected`, `optionText`, `optionTextSelected`. Keep `optionsList`.

- [ ] **Step 3: Typecheck**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit`
Expected: PASS with no new errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/cesarcamillo/dev/pruvi
git add apps/native/components/session/OptionCard.tsx apps/native/app/\(app\)/session/\[id\].tsx
git commit -m "refactor(native): extract OptionCard for reuse across session + roleta"
```

---

## Task 9: Native service + hook + store

**Files:**
- Create: `apps/native/services/roleta.service.ts`
- Create: `apps/native/hooks/useRoleta.ts`
- Create: `apps/native/stores/roletaStore.ts`

- [ ] **Step 1: Create the service**

Create `apps/native/services/roleta.service.ts`:

```ts
import {
  roletaAnswerBodySchema,
  roletaAnswerResponseSchema,
  roletaConfigResponseSchema,
  roletaConfigSchema,
  roletaStartResponseSchema,
  type RoletaAnswerBody,
  type RoletaConfig,
} from "@pruvi/shared";

import { apiRequest } from "@/lib/api-client";

export const roletaService = {
  getConfig: () =>
    apiRequest(
      "/roleta/config",
      { method: "GET" },
      roletaConfigResponseSchema,
    ),

  saveConfig: (payload: RoletaConfig) =>
    apiRequest(
      "/roleta/config",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roletaConfigSchema.parse(payload)),
      },
      roletaConfigResponseSchema,
    ),

  spin: () =>
    apiRequest(
      "/roleta/spin",
      { method: "POST" },
      roletaStartResponseSchema,
    ),

  answer: (payload: RoletaAnswerBody) =>
    apiRequest(
      "/roleta/answer",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roletaAnswerBodySchema.parse(payload)),
      },
      roletaAnswerResponseSchema,
    ),
};
```

- [ ] **Step 2: Create the hooks**

Create `apps/native/hooks/useRoleta.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RoletaAnswerBody, RoletaConfig } from "@pruvi/shared";

import { roletaService } from "@/services/roleta.service";

const CONFIG_KEY = ["roleta", "config"] as const;

export function useRoletaConfig(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: CONFIG_KEY,
    queryFn: roletaService.getConfig,
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useSaveRoletaConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RoletaConfig) => roletaService.saveConfig(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(CONFIG_KEY, data);
    },
  });
}

export function useSpinRoleta() {
  return useMutation({
    mutationFn: () => roletaService.spin(),
  });
}

export function useAnswerRoleta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RoletaAnswerBody) => roletaService.answer(payload),
    onSuccess: () => {
      // XP + progress displays on other screens go stale after each answer.
      queryClient.invalidateQueries({ queryKey: ["xp"] });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
    },
  });
}
```

- [ ] **Step 3: Create the store**

Create `apps/native/stores/roletaStore.ts`:

```ts
import { create } from "zustand";

type AnswerState = "idle" | "correct" | "wrong";

interface RoletaStore {
  currentIndex: number;
  selectedOptionIndex: number | null;
  answerState: AnswerState;
  correctCount: number;
  xpEarned: number;
  actions: {
    selectOption: (i: number) => void;
    setAnswerState: (s: AnswerState) => void;
    recordAnswer: (correct: boolean, xp: number) => void;
    nextQuestion: () => void;
    reset: () => void;
  };
}

const INITIAL = {
  currentIndex: 0,
  selectedOptionIndex: null as number | null,
  answerState: "idle" as AnswerState,
  correctCount: 0,
  xpEarned: 0,
};

export const useRoletaStore = create<RoletaStore>((set) => ({
  ...INITIAL,
  actions: {
    selectOption: (i) =>
      set({ selectedOptionIndex: i, answerState: "idle" }),
    setAnswerState: (s) => set({ answerState: s }),
    recordAnswer: (correct, xp) =>
      set((state) => ({
        correctCount: state.correctCount + (correct ? 1 : 0),
        xpEarned: state.xpEarned + xp,
      })),
    nextQuestion: () =>
      set((state) => ({
        currentIndex: state.currentIndex + 1,
        selectedOptionIndex: null,
        answerState: "idle",
      })),
    reset: () => set(INITIAL),
  },
}));

export const useRoletaActions = () => useRoletaStore((s) => s.actions);
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/cesarcamillo/dev/pruvi
git add apps/native/services/roleta.service.ts apps/native/hooks/useRoleta.ts apps/native/stores/roletaStore.ts
git commit -m "feat(native): roleta service, hooks, store"
```

---

## Task 10: Roleta route group — layout + landing (index)

**Files:**
- Create: `apps/native/app/(app)/roleta/_layout.tsx`
- Create: `apps/native/app/(app)/roleta/index.tsx`
- Modify: `apps/native/.expo/types/router.d.ts` (add new routes so typecheck passes before Expo regenerates)

- [ ] **Step 1: Stack layout**

Create `apps/native/app/(app)/roleta/_layout.tsx`:

```tsx
import { Stack } from "expo-router";

export default function RoletaLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
```

- [ ] **Step 2: Landing screen**

Create `apps/native/app/(app)/roleta/index.tsx`:

```tsx
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle as SvgCircle, Path } from "react-native-svg";

import { useSpinRoleta } from "@/hooks/useRoleta";
import { useRoletaActions } from "@/stores/roletaStore";

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke="#2B2B2B"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function WheelIcon({ size = 200 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <SvgCircle cx={100} cy={100} r={92} fill="#58CD04" fillOpacity={0.1} />
      <SvgCircle cx={100} cy={100} r={80} stroke="#58CD04" strokeWidth={4} />
      {/* Eight pie slices */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * Math.PI) / 4;
        const x2 = 100 + Math.cos(angle) * 80;
        const y2 = 100 + Math.sin(angle) * 80;
        return (
          <Path
            key={i}
            d={`M100 100 L${x2} ${y2}`}
            stroke="#58CD04"
            strokeWidth={2}
            strokeOpacity={0.3}
          />
        );
      })}
      <SvgCircle cx={100} cy={100} r={12} fill="#58CD04" />
      {/* Pointer */}
      <Path
        d="M100 4 L108 20 L92 20 Z"
        fill="#FF9600"
      />
    </Svg>
  );
}

export default function RoletaLanding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const spin = useSpinRoleta();
  const { reset } = useRoletaActions();

  const rotation = useSharedValue(0);

  useEffect(() => {
    if (spin.isPending) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1200, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      cancelAnimation(rotation);
      rotation.value = 0;
    }
    return () => {
      cancelAnimation(rotation);
    };
  }, [spin.isPending, rotation]);

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handleSpin = async () => {
    try {
      const data = await spin.mutateAsync();
      queryClient.setQueryData(["roleta", "active-spin", data.spinId], data);
      reset();
      router.replace(`/roleta/play?spinId=${encodeURIComponent(data.spinId)}`);
    } catch {
      Alert.alert(
        "Não foi possível girar",
        "Verifique sua conexão e tente novamente.",
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <View style={styles.topBarContent}>
          <Pressable
            onPress={() => router.replace("/(app)/(tabs)")}
            style={styles.backBtn}
            hitSlop={8}
          >
            <BackIcon />
          </Pressable>
          <Text style={styles.topBarTitle}>Roleta</Text>
          <Pressable
            onPress={() => router.push("/roleta/configurar")}
            style={styles.configBtn}
            hitSlop={8}
          >
            <Text style={styles.configBtnText}>CONFIGURAR</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>PRÁTICA EXPRESSA</Text>
        <Text style={styles.title}>3 questões aleatórias</Text>
        <Text style={styles.subtitle}>
          Gire para descobrir qual matéria cai.{"\n"}
          Sem vidas, metade do XP.
        </Text>

        <Animated.View style={[styles.wheel, wheelStyle]}>
          <WheelIcon size={220} />
        </Animated.View>

        <Pressable
          style={({ pressed }) => [
            styles.spinBtn,
            spin.isPending && styles.spinBtnDisabled,
            pressed && !spin.isPending && { opacity: 0.9 },
          ]}
          onPress={handleSpin}
          disabled={spin.isPending}
        >
          <Text style={styles.spinBtnText}>
            {spin.isPending ? "GIRANDO..." : "GIRAR"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  topBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(239, 236, 236, 0.5)",
  },
  topBarContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(240, 240, 240, 0.5)",
  },
  topBarTitle: {
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: -0.45,
    color: "#2B2B2B",
  },
  configBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  configBtnText: {
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#58CD04",
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  eyebrow: {
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  title: {
    fontWeight: "900",
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.7,
    color: "#2B2B2B",
    marginTop: 4,
  },
  subtitle: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    color: "#6B6B6B",
    textAlign: "center",
    marginTop: 8,
  },
  wheel: {
    marginTop: 40,
    marginBottom: 40,
  },
  spinBtn: {
    alignSelf: "stretch",
    height: 64,
    backgroundColor: "#58CD04",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
    marginBottom: 32,
    shadowColor: "rgba(88, 205, 4, 0.3)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 25,
    elevation: 8,
  },
  spinBtnDisabled: {
    backgroundColor: "#B8E890",
    shadowOpacity: 0,
    elevation: 0,
  },
  spinBtnText: {
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
});
```

- [ ] **Step 3: Manually extend Expo Router's route types**

Open `apps/native/.expo/types/router.d.ts`. Add these route variants to every `hrefInputParams`, `hrefOutputParams`, and `href` block (search for the `(onboarding)` entries already present and insert the roleta variants alongside them):

```
| { pathname: `${'/(app)'}/roleta` | `/roleta`; params?: Router.UnknownInputParams; }
| { pathname: `${'/(app)'}/roleta/configurar` | `/roleta/configurar`; params?: Router.UnknownInputParams; }
| { pathname: `${'/(app)'}/roleta/play` | `/roleta/play`; params?: Router.UnknownInputParams; }
| { pathname: `${'/(app)'}/roleta/result` | `/roleta/result`; params?: Router.UnknownInputParams; }
```

(Same style used for `(onboarding)` in commit `5e7a22d`. Expo will regenerate this file properly on the next `expo start`, but we keep typecheck green in the meantime.)

- [ ] **Step 4: Typecheck**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/cesarcamillo/dev/pruvi
git add apps/native/app/\(app\)/roleta/_layout.tsx apps/native/app/\(app\)/roleta/index.tsx apps/native/.expo/types/router.d.ts
git commit -m "feat(native): roleta landing screen with spin animation"
```

---

## Task 11: Configurar screen

**Files:**
- Create: `apps/native/app/(app)/roleta/configurar.tsx`

- [ ] **Step 1: Implement the config screen**

Create `apps/native/app/(app)/roleta/configurar.tsx`:

```tsx
import { useRouter } from "expo-router";
import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { useProgress } from "@/hooks/useProgress";
import {
  useRoletaConfig,
  useSaveRoletaConfig,
} from "@/hooks/useRoleta";

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke="#2B2B2B"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path
        d="M3 7l2.5 2.5L11 4"
        stroke="white"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function ConfigurarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const config = useRoletaConfig();
  const progress = useProgress(); // already exposes the subject list
  const save = useSaveRoletaConfig();

  const eligibleSet = useMemo(
    () => new Set(config.data?.subjects ?? []),
    [config.data?.subjects],
  );

  const allSubjects = progress.data?.subjects ?? [];

  const toggle = (slug: string) => {
    const next = new Set(eligibleSet);
    if (next.has(slug)) {
      if (next.size === 1) return; // must keep at least one
      next.delete(slug);
    } else {
      next.add(slug);
    }
    save.mutate({ subjects: Array.from(next) });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <View style={styles.topBarContent}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <BackIcon />
          </Pressable>
          <Text style={styles.topBarTitle}>Configurar</Text>
          <View style={{ width: 36 }} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>MATÉRIAS ELEGÍVEIS</Text>
        <Text style={styles.description}>
          Cada giro sorteia uma dessas matérias. Mantenha ao menos uma marcada.
        </Text>

        <View style={styles.list}>
          {allSubjects.map((subj) => {
            const checked = eligibleSet.has(subj.slug);
            const disableUncheck = checked && eligibleSet.size === 1;
            return (
              <Pressable
                key={subj.slug}
                style={({ pressed }) => [
                  styles.row,
                  checked && styles.rowChecked,
                  pressed && { opacity: 0.9 },
                ]}
                onPress={() => toggle(subj.slug)}
                disabled={save.isPending}
              >
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{subj.name}</Text>
                  <Text style={styles.rowAccuracy}>
                    {subj.totalQuestions > 0
                      ? `${subj.accuracy}% de acerto`
                      : "sem respostas ainda"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    checked && styles.checkboxChecked,
                    disableUncheck && styles.checkboxLocked,
                  ]}
                >
                  {checked && <CheckIcon />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFBFC" },
  topBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(239, 236, 236, 0.5)",
  },
  topBarContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(240, 240, 240, 0.5)",
  },
  topBarTitle: {
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: -0.45,
    color: "#2B2B2B",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },
  eyebrow: {
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  description: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    color: "#6B6B6B",
    marginTop: 4,
    marginBottom: 20,
  },
  list: { gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.5)",
    padding: 18,
  },
  rowChecked: {
    borderColor: "#58CD04",
    backgroundColor: "rgba(88, 205, 4, 0.05)",
  },
  rowInfo: { flex: 1, gap: 4 },
  rowName: {
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: -0.4,
    color: "#2B2B2B",
  },
  rowAccuracy: {
    fontWeight: "700",
    fontSize: 11,
    color: "#6B6B6B",
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "rgba(107, 107, 107, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    borderColor: "#58CD04",
    backgroundColor: "#58CD04",
  },
  checkboxLocked: {
    opacity: 0.6,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/cesarcamillo/dev/pruvi
git add apps/native/app/\(app\)/roleta/configurar.tsx
git commit -m "feat(native): roleta configurar screen"
```

---

## Task 12: Play screen — 3-question flow

**Files:**
- Create: `apps/native/app/(app)/roleta/play.tsx`

- [ ] **Step 1: Implement play.tsx**

Create `apps/native/app/(app)/roleta/play.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path } from "react-native-svg";

import type { RoletaStartResponse } from "@pruvi/shared";
import { difficultyFromNumber } from "@pruvi/shared";

import { OptionCard, type OptionCardState } from "@/components/session/OptionCard";
import { useAnswerRoleta } from "@/hooks/useRoleta";
import { useRoletaActions, useRoletaStore } from "@/stores/roletaStore";

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;
const ANSWER_ANIMATION_MS = 1200;

function CloseIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M12 4L4 12M4 4l8 8"
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function CheckBadgeIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <SvgCircle cx={11} cy={11} r={9} fill="rgba(255,255,255,0.3)" />
      <Path
        d="M7 11l2.5 2.5 5.5-5.5"
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function RoletaPlayScreen() {
  const { spinId } = useLocalSearchParams<{ spinId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const answerQuestion = useAnswerRoleta();

  const { data: spin } = useQuery<RoletaStartResponse>({
    queryKey: ["roleta", "active-spin", spinId],
    queryFn: () => {
      throw new Error("Spin not loaded — return to roleta");
    },
    staleTime: Infinity,
    retry: false,
  });

  const currentIndex = useRoletaStore((s) => s.currentIndex);
  const selectedOptionIndex = useRoletaStore((s) => s.selectedOptionIndex);
  const answerState = useRoletaStore((s) => s.answerState);
  const actions = useRoletaActions();

  const correctIndexRef = useRef<number | null>(null);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current);
        advanceTimeoutRef.current = null;
      }
    };
  }, []);

  if (!spin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Giro não encontrado.</Text>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => router.replace("/roleta")}
        >
          <Text style={styles.primaryBtnText}>VOLTAR</Text>
        </Pressable>
      </View>
    );
  }

  const currentQuestion = spin.questions[currentIndex];
  const total = spin.questions.length;

  if (!currentQuestion) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Carregando…</Text>
      </View>
    );
  }

  const progressPct = ((currentIndex + 1) / total) * 100;

  const handleConfirm = () => {
    if (selectedOptionIndex === null) return;
    answerQuestion.mutate(
      {
        spinId: spin.spinId,
        questionId: currentQuestion.id,
        selectedOptionIndex,
      },
      {
        onSuccess: (res) => {
          correctIndexRef.current = res.correctOptionIndex;
          actions.setAnswerState(res.correct ? "correct" : "wrong");
          actions.recordAnswer(res.correct, res.xpAwarded);
          const store = useRoletaStore.getState();
          const nextCorrect = store.correctCount;
          const nextXp = store.xpEarned;

          advanceTimeoutRef.current = setTimeout(() => {
            advanceTimeoutRef.current = null;
            const isLast = currentIndex === total - 1;
            if (isLast) {
              router.replace(
                `/roleta/result?correct=${nextCorrect}&total=${total}&subject=${encodeURIComponent(
                  spin.subject.name,
                )}&xp=${nextXp}`,
              );
            } else {
              correctIndexRef.current = null;
              actions.nextQuestion();
            }
          }, ANSWER_ANIMATION_MS);
        },
      },
    );
  };

  const confirmDisabled =
    selectedOptionIndex === null ||
    answerState !== "idle" ||
    answerQuestion.isPending;

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <View style={styles.topBarContent}>
          <Pressable
            style={styles.closeBtn}
            onPress={() => router.replace("/(app)/(tabs)")}
          >
            <CloseIcon />
          </Pressable>
          <View style={styles.topBarCenter}>
            <View style={styles.topBarTitles}>
              <Text style={styles.topBarSubject}>{spin.subject.name}</Text>
              <Text style={styles.topBarQuestion}>
                {String(currentIndex + 1).padStart(2, "0")} / {total}
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[styles.progressBarFill, { width: `${progressPct}%` }]}
              />
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tagsRow}>
          <View style={[styles.tag, { backgroundColor: "#DBEAFE" }]}>
            <Text style={styles.tagText}>
              {difficultyFromNumber(currentQuestion.difficulty)}
            </Text>
          </View>
        </View>

        <Text style={styles.questionBody}>{currentQuestion.body}</Text>

        <View style={styles.optionsList}>
          {currentQuestion.options.map((optionText, index) => {
            const letter = OPTION_LETTERS[index] ?? String(index + 1);
            const isSelected = selectedOptionIndex === index;
            const isCorrect =
              answerState !== "idle" && correctIndexRef.current === index;
            const isWrongSelection =
              answerState === "wrong" &&
              isSelected &&
              correctIndexRef.current !== index;

            const state: OptionCardState = isCorrect
              ? "correct"
              : isWrongSelection
                ? "wrong"
                : isSelected
                  ? "selected"
                  : "idle";

            return (
              <OptionCard
                key={index}
                letter={letter}
                text={optionText}
                state={state}
                onPress={() => {
                  if (answerState === "idle") {
                    actions.selectOption(index);
                  }
                }}
                disabled={answerState !== "idle"}
              />
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.confirmBtn,
            confirmDisabled && styles.confirmBtnDisabled,
            pressed && !confirmDisabled && { opacity: 0.9 },
          ]}
          onPress={handleConfirm}
          disabled={confirmDisabled}
        >
          <Text style={styles.confirmBtnText}>
            {answerQuestion.isPending ? "ENVIANDO..." : "CONFIRMAR"}
          </Text>
          {!answerQuestion.isPending && <CheckBadgeIcon />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 24 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
    backgroundColor: "#FFFFFF",
  },
  errorTitle: {
    fontSize: 16,
    color: "#2B2B2B",
    fontWeight: "700",
  },
  primaryBtn: {
    backgroundColor: "#58CD04",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  primaryBtnText: {
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
  topBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(239, 236, 236, 0.5)",
  },
  topBarContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 16,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: "#2B2B2B",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarCenter: { flex: 1, gap: 6 },
  topBarTitles: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topBarSubject: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.35,
    color: "#58CD04",
  },
  topBarQuestion: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.35,
    color: "#6B6B6B",
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F0F0F0",
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#58CD04",
  },
  tagsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 24,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  tag: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tagText: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },
  questionBody: {
    fontWeight: "500",
    fontSize: 16,
    lineHeight: 26,
    color: "#2B2B2B",
    marginBottom: 24,
  },
  optionsList: { gap: 12 },
  bottomBar: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderTopWidth: 1,
    borderTopColor: "#EFECEC",
  },
  confirmBtn: {
    flex: 1,
    height: 64,
    backgroundColor: "#58CD04",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginHorizontal: 24,
    marginTop: 16,
    shadowColor: "rgba(88, 205, 4, 0.2)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 25,
    elevation: 8,
  },
  confirmBtnDisabled: {
    backgroundColor: "#B8E890",
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmBtnText: {
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/cesarcamillo/dev/pruvi
git add apps/native/app/\(app\)/roleta/play.tsx
git commit -m "feat(native): roleta play screen — 3-question flow"
```

---

## Task 13: Result screen

**Files:**
- Create: `apps/native/app/(app)/roleta/result.tsx`

- [ ] **Step 1: Implement result.tsx**

Create `apps/native/app/(app)/roleta/result.tsx`:

```tsx
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

function SparkleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 1l2 5 5 1.5-5 1.5-2 5-2-5-5-1.5 5-1.5 2-5z"
        fill="#FF9600"
      />
    </Svg>
  );
}

export default function RoletaResultScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    correct: string;
    total: string;
    subject: string;
    xp: string;
  }>();

  const correct = Number(params.correct ?? 0);
  const total = Number(params.total ?? 3);
  const xp = Number(params.xp ?? 0);
  const subject = params.subject ?? "";

  const headline =
    correct === total ? "Perfeito!" : correct >= total - 1 ? "Mandou bem!" : "Bora de novo!";

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#58CD04", "#3FAE0A"]}
        style={[styles.hero, { paddingTop: insets.top + 32 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <Text style={styles.heroEyebrow}>ROLETA — {subject.toUpperCase()}</Text>
        <Text style={styles.heroTitle}>{headline}</Text>
        <Text style={styles.heroSubtitle}>
          {correct} de {total} acertos
        </Text>

        <View style={styles.xpBadge}>
          <SparkleIcon />
          <Text style={styles.xpBadgeText}>+{xp} XP</Text>
        </View>
      </LinearGradient>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => router.replace("/roleta")}
        >
          <Text style={styles.primaryBtnText}>GIRAR DE NOVO</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryBtn,
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => router.replace("/(app)/(tabs)")}
        >
          <Text style={styles.secondaryBtnText}>FECHAR</Text>
        </Pressable>
      </View>

      <View style={{ paddingBottom: insets.bottom }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: "center",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  heroEyebrow: {
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1.4,
    color: "rgba(255, 255, 255, 0.8)",
    textTransform: "uppercase",
  },
  heroTitle: {
    fontWeight: "900",
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.9,
    color: "#FFFFFF",
    marginTop: 8,
    textAlign: "center",
  },
  heroSubtitle: {
    fontWeight: "700",
    fontSize: 16,
    lineHeight: 22,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 8,
  },
  xpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 24,
  },
  xpBadgeText: {
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
  actions: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  primaryBtn: {
    height: 60,
    backgroundColor: "#58CD04",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(88, 205, 4, 0.3)",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 6,
  },
  primaryBtnText: {
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
  secondaryBtn: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/cesarcamillo/dev/pruvi
git add apps/native/app/\(app\)/roleta/result.tsx
git commit -m "feat(native): roleta result screen"
```

---

## Task 14: Home tile swap (Desafios → Roleta)

**Files:**
- Modify: `apps/native/app/(app)/(tabs)/index.tsx`

- [ ] **Step 1: Update the Prática Expressa tiles**

Open `apps/native/app/(app)/(tabs)/index.tsx`. Find the `PracticaCard` pair (currently "Flashcards" + "Desafios") inside `<View style={styles.practicaRow}>` and:

1. Replace the `<SwordIcon />` import usage with a wheel icon (add a local `WheelSmallIcon` near the top, or reuse `DiceIcon` logic).
2. Wrap each tile in a Pressable that navigates.

Add this helper near the other icon components:

```tsx
function WheelSmallIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <SvgCircle cx={14} cy={14} r={10} stroke="#58CD04" strokeWidth={2} />
      <Path
        d="M14 4v20M4 14h20M6 6l16 16M22 6L6 22"
        stroke="#58CD04"
        strokeWidth={1}
        strokeOpacity={0.4}
      />
      <SvgCircle cx={14} cy={14} r={3} fill="#58CD04" />
    </Svg>
  );
}
```

Extract the existing `PracticaCard` usage so tiles accept an `onPress`. Update the component signature:

```tsx
function PracticaCard({
  title,
  subtitle,
  bgColor,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  bgColor: string;
  icon: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.practicaCard,
        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
      ]}
      onPress={onPress}
    >
      <View style={[styles.practicaIconContainer, { backgroundColor: bgColor }]}>
        {icon}
      </View>
      <View style={styles.practicaTextArea}>
        <Text style={styles.practicaTitle}>{title}</Text>
        <Text style={styles.practicaSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}
```

Replace the existing tile row JSX with:

```tsx
<View style={styles.practicaRow}>
  <PracticaCard
    title="Flashcards"
    subtitle="Em breve"
    bgColor="#FEF9C2"
    icon={<FlashcardIcon />}
  />
  <PracticaCard
    title="Roleta"
    subtitle="3 questões aleatórias"
    bgColor="rgba(88, 205, 4, 0.1)"
    icon={<WheelSmallIcon />}
    onPress={() => router.push("/roleta")}
  />
</View>
```

The Flashcards tile has no `onPress` — it's a placeholder until Phase 6.2. Subtitle changes to "Em breve" to set expectation.

- [ ] **Step 2: Typecheck**

Run: `cd /Users/cesarcamillo/dev/pruvi/apps/native && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/cesarcamillo/dev/pruvi
git add apps/native/app/\(app\)/\(tabs\)/index.tsx
git commit -m "feat(native): swap Desafios tile for Roleta entry"
```

---

## Task 15: Manual smoke test + integration-map update

**Files:**
- Modify: `docs/integration-map.md`

- [ ] **Step 1: Smoke test in iOS simulator**

Ensure Docker + server + Expo are running (`docker ps` shows `pruvi-postgres` + `pruvi-redis` healthy; server logs show 200s on `/health`). Then in the simulator:

1. Log in with `phase5@test.com` / `test1234` (or sign up fresh).
2. From Home → tap the Roleta tile in "Prática Expressa" → should land on `/roleta`.
3. Tap "CONFIGURAR" → verify all subjects are pre-checked (backend resolved default). Uncheck all but one → verify the last one can't be unchecked. Navigate back.
4. Tap "GIRAR" → wheel spins 1.2s → lands on `/roleta/play` with one subject shown in top bar and 3 questions.
5. Answer all 3 → see correct/wrong states → auto-advance → `/roleta/result` shows "N de 3 acertos" with XP total.
6. Tap "GIRAR DE NOVO" → returns to `/roleta` landing, Girar button re-enabled.
7. Tap "FECHAR" on result → returns to Home.
8. On Home, verify leaf badge XP total has increased by the sum of half-XP awards.
9. Verify Profile → Activity calendar is UNCHANGED (no streak bump).
10. Verify Progress → accuracy on the picked subject reflects the new answers.

- [ ] **Step 2: Update integration-map.md**

Open `docs/integration-map.md` and:

1. Change the header `Current status` line to mention Phase 6.1 shipped.
2. Find `### Phase 6: Content Features ← NEXT` and change to `### Phase 6: Content Features`.
3. Within Phase 6, find row 6.1 — append ` ✅` after "Roleta configuration".
4. Mark row 6.2 as `← NEXT`.

For example the table row change:

```markdown
| 6.1 | **Roleta configuration** (subject-filtered free-play) ✅ | ... |
| 6.2 | **Flashcards** ← NEXT | ... |
```

- [ ] **Step 3: Commit docs**

```bash
cd /Users/cesarcamillo/dev/pruvi
git add docs/integration-map.md
git commit -m "docs: mark Phase 6.1 complete, Phase 6.2 next"
```

- [ ] **Step 4: Final repo-wide sanity**

Run:

```bash
cd /Users/cesarcamillo/dev/pruvi && bun run check-types && cd apps/server && bun run test
```

Expected: typecheck PASS, all tests PASS (original 68+ plus 14 new unit + integration Roleta cases).

---

## Self-review results

Ran spec coverage against the spec document section-by-section:

- **Data model** (spec §Data model) → Task 1 (schema) + Task 2 (migration). ✅
- **Shared schemas** (spec §Shared schemas) → Task 3. ✅
- **Backend endpoints** (spec §Backend endpoints) → Task 4 (repo) + Task 5 (service) + Task 6 (routes). ✅
- **XP computation detail** (spec §XP) → Task 5 step 3 uses `calculateXpForAnswer` + floor/2; tests in step 1 assert the math. ✅
- **Review log write detail** (spec §Review log) → Task 4 integration tests + Task 5 service test verify `source='roleta'`, `nextReviewAt=null`, quality=4/1. ✅
- **Cache invalidation** (spec §Cache) → Task 6 route invalidates `roleta-config` on PUT, `xp`+`progress` on answer. ✅
- **Native services/hooks/store** (spec §Native) → Task 9. ✅
- **Routes `index / play / result / configurar`** (spec §Routes) → Tasks 10, 11, 12, 13. ✅
- **Home entry point** (spec §Home entry) → Task 14. ✅
- **Refactor: shared OptionCard** (spec §Refactor) → Task 8. ✅
- **Testing: server unit + integration** (spec §Testing) → Tasks 4, 5, 7. ✅
- **Testing: native manual smoke** (spec §Native) → Task 15. ✅
- **Build order** (spec §Build order) — my task order matches the spec's suggested commit order 1→9 with the two minor refinements (route group layout split into its own task; OptionCard extraction pulled in as Task 8 after routes so the session screen changes land before native roleta screens).

Placeholder scan: no "TBD"/"TODO"/"add error handling" strings in any step. Every code step contains runnable code.

Type consistency check: `RoletaRepository` method names used in Task 5 mocks match Task 4 implementation (`getConfig`, `saveConfig`, `listSubjectSlugs`, `findSubjectBySlug`, `selectRandomQuestions`, `findQuestionById`, `insertRoletaReview`, `awardXp` — 8 methods, all present in both). `OptionCardState` enum has 4 values in Task 8 and is referenced identically in Tasks 8 and 12. `RoletaStartResponse`, `RoletaAnswerBody`, `RoletaAnswerResponse`, `RoletaConfig`, `RoletaConfigResponse` exported in Task 3 are imported by name in Tasks 5, 9, 12. No drift.
