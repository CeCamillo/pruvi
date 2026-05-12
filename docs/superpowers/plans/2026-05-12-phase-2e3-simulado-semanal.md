# Phase 2E.3 — Simulado Semanal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Steps use checkbox (`- [ ]`) syntax. Per the user-enforced workflow, EVERY task gets Gate C (Opus 4.7 per-task review) before moving to the next.

**Goal:** Backend-only delivery of a weekly mock exam for Ultra users (35 questions, BRT Sunday-Sunday window, per-subject results, 4-week prior history), strictly per the v2 spec at `docs/superpowers/specs/2026-05-12-phase-2e3-simulado-semanal-design.md`.

**Architecture:** New `simulados` feature module (route + service + repository) under `apps/server/src/features/`, two new tables (`weekly_simulado`, `weekly_simulado_question`), one new shared time helper, one new Sunday-anchored week helper, Zod schemas in `@pruvi/shared`. Ultra entitlement gating via the existing `UltraService.isUltra` method. Race safety via INSERT-ON-CONFLICT for `/start` and `SELECT ... FOR UPDATE` for `/answer`. 60s response cache on `/current` with explicit invalidation.

**Tech Stack:** Drizzle ORM + drizzle-kit, Fastify 5 + fastify-type-provider-zod, neverthrow Result, PGlite/Postgres for tests, Zod validation, BullMQ unused for this phase.

---

## Task 1 — Shared time constant, simulado week helper, Zod schemas

**Files:**
- Create: `packages/shared/src/time.ts`
- Modify: `packages/shared/src/weekly.ts`
- Create: `packages/shared/src/simulado.ts`
- Create: `packages/shared/src/simulado.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1.1: Create the shared BRT time constant**

Create `packages/shared/src/time.ts`:

```ts
/** Brazil time offset: UTC-3, no DST (Brazil suspended DST in 2019). */
export const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
```

- [ ] **Step 1.2: Make `weekly.ts` import the shared constant**

Replace the top of `packages/shared/src/weekly.ts`:

```ts
import { BRT_OFFSET_MS } from "./time";

export function startOfWeekBrt(now: Date): Date {
  const brtMs = now.getTime() - BRT_OFFSET_MS;
  const brt = new Date(brtMs);
  const dow = brt.getUTCDay();
  const daysBack = (dow + 6) % 7;
  brt.setUTCDate(brt.getUTCDate() - daysBack);
  brt.setUTCHours(0, 0, 0, 0);
  return new Date(brt.getTime() + BRT_OFFSET_MS);
}
```

- [ ] **Step 1.3: Create `simulado.ts` with constants, helper, and Zod schemas**

Create `packages/shared/src/simulado.ts`:

```ts
import { z } from "zod";
import { BRT_OFFSET_MS } from "./time";

export const SIMULADO_QUESTION_COUNT = 35;

/** Sunday-anchored BRT week bounds. Returns BRT calendar dates as YYYY-MM-DD.
 *  Subtraction is applied before truncation so the returned string is the BRT
 *  calendar date, not the UTC calendar date. */
export function weekBoundsForSimulado(now: Date): { weekStart: string; weekEnd: string } {
  const brtMs = now.getTime() - BRT_OFFSET_MS;
  const brt = new Date(brtMs);
  const dow = brt.getUTCDay(); // 0=Sun..6=Sat
  brt.setUTCDate(brt.getUTCDate() - dow);
  brt.setUTCHours(0, 0, 0, 0);
  const start = new Date(brt);
  const end = new Date(brt);
  end.setUTCDate(end.getUTCDate() + 7);
  return {
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10),
  };
}

const PerSubjectSchema = z.object({
  subjectId: z.number().int(),
  correct: z.number().int(),
  total: z.number().int(),
});

const HistoryEntrySchema = z.object({
  weekStart: z.string(),
  correct: z.number().int(),
  total: z.number().int(),
  perSubject: z.array(PerSubjectSchema),
});

export const SimuladoCurrentResponseSchema = z.object({
  weekStart: z.string(),
  weekEnd: z.string(),
  status: z.enum(["not_started", "in_progress", "completed"]),
  simulado: z
    .object({
      id: z.number().int(),
      startedAt: z.string(),
      completedAt: z.string().nullable(),
      questionsCount: z.number().int(),
      answeredCount: z.number().int(),
      correctCount: z.number().int(),
    })
    .nullable(),
  history: z.array(HistoryEntrySchema),
});
export type SimuladoCurrentResponse = z.infer<typeof SimuladoCurrentResponseSchema>;

export const SimuladoQuestionSchema = z.object({
  position: z.number().int(),
  questionId: z.number().int(),
  content: z.string(),
  options: z.array(z.string()),
  subjectId: z.number().int(),
  subtopicId: z.number().int(),
  requiresCalculation: z.boolean(),
});
export type SimuladoQuestion = z.infer<typeof SimuladoQuestionSchema>;

export const SimuladoStartResponseSchema = z.object({
  simulado: z.object({
    id: z.number().int(),
    startedAt: z.string(),
    questionsCount: z.number().int(),
  }),
  questions: z.array(SimuladoQuestionSchema),
});
export type SimuladoStartResponse = z.infer<typeof SimuladoStartResponseSchema>;

export const SimuladoAnsweredQuestionSchema = SimuladoQuestionSchema.extend({
  selectedOptionIndex: z.number().int().nullable(),
  isCorrect: z.boolean().nullable(),
  correctOptionIndex: z.number().int().nullable(),
  explanation: z.string().nullable(),
});
export type SimuladoAnsweredQuestion = z.infer<typeof SimuladoAnsweredQuestionSchema>;

export const SimuladoDetailResponseSchema = z.object({
  simulado: z.object({
    id: z.number().int(),
    weekStart: z.string(),
    startedAt: z.string(),
    completedAt: z.string().nullable(),
    questionsCount: z.number().int(),
    answeredCount: z.number().int(),
    correctCount: z.number().int(),
    status: z.enum(["in_progress", "completed"]),
  }),
  questions: z.array(SimuladoAnsweredQuestionSchema),
});
export type SimuladoDetailResponse = z.infer<typeof SimuladoDetailResponseSchema>;

export const SimuladoAnswerBodySchema = z.object({
  questionId: z.number().int(),
  selectedOptionIndex: z.number().int().min(0).max(3),
});
export type SimuladoAnswerBody = z.infer<typeof SimuladoAnswerBodySchema>;

export const SimuladoAnswerResponseSchema = z.object({
  isCorrect: z.boolean(),
  correctOptionIndex: z.number().int(),
  explanation: z.string().nullable(),
  answeredCount: z.number().int(),
  completed: z.boolean(),
});
export type SimuladoAnswerResponse = z.infer<typeof SimuladoAnswerResponseSchema>;

export const SimuladoResultsResponseSchema = z.object({
  weekStart: z.string(),
  correct: z.number().int(),
  total: z.number().int(),
  perSubject: z.array(PerSubjectSchema),
  history: z.array(HistoryEntrySchema),
});
export type SimuladoResultsResponse = z.infer<typeof SimuladoResultsResponseSchema>;
```

- [ ] **Step 1.4: Write the failing tests**

Create `packages/shared/src/simulado.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { weekBoundsForSimulado, SIMULADO_QUESTION_COUNT } from "./simulado";

describe("SIMULADO_QUESTION_COUNT", () => {
  it("is 35 (mid-range of product spec 30-40)", () => {
    expect(SIMULADO_QUESTION_COUNT).toBe(35);
  });
});

describe("weekBoundsForSimulado", () => {
  it("for Sunday 12:00 BRT (15:00 UTC), weekStart is that same Sunday's BRT date", () => {
    // 2026-05-10 (Sunday) 15:00 UTC == 12:00 BRT
    const now = new Date("2026-05-10T15:00:00Z");
    const { weekStart, weekEnd } = weekBoundsForSimulado(now);
    expect(weekStart).toBe("2026-05-10");
    expect(weekEnd).toBe("2026-05-17");
  });

  it("for Saturday 23:00 BRT (2026-05-09 23:00 BRT == 2026-05-10 02:00 UTC), weekStart is the PREVIOUS Sunday", () => {
    const now = new Date("2026-05-10T02:00:00Z");
    const { weekStart, weekEnd } = weekBoundsForSimulado(now);
    expect(weekStart).toBe("2026-05-03");
    expect(weekEnd).toBe("2026-05-10");
  });

  it("for Sunday 02:00 BRT (Sun 05:00 UTC), weekStart is THAT Sunday's BRT date", () => {
    const now = new Date("2026-05-10T05:00:00Z");
    const { weekStart, weekEnd } = weekBoundsForSimulado(now);
    expect(weekStart).toBe("2026-05-10");
    expect(weekEnd).toBe("2026-05-17");
  });

  it("for Sunday 01:00 UTC (Saturday 22:00 BRT), weekStart is the PREVIOUS Sunday", () => {
    const now = new Date("2026-05-10T01:00:00Z");
    const { weekStart, weekEnd } = weekBoundsForSimulado(now);
    expect(weekStart).toBe("2026-05-03");
    expect(weekEnd).toBe("2026-05-10");
  });
});
```

- [ ] **Step 1.5: Export from `packages/shared/src/index.ts`**

Add at the end of the existing exports list:

```ts
export * from "./time";
export * from "./simulado";
```

(The existing `export * from "./shields"` line stays.)

- [ ] **Step 1.6: Run the tests and commit**

```bash
cd packages/shared && bun test src/simulado.test.ts
```
Expected: all pass.

Then from repo root:
```bash
git add packages/shared/src/time.ts packages/shared/src/weekly.ts packages/shared/src/simulado.ts packages/shared/src/simulado.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): simulado week helper, schemas, shared brt constant"
```

---

## Task 2 — DB schema + drizzle migration

**Files:**
- Create: `packages/db/src/schema/weekly-simulado.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/migrations/0009_<generated-name>.sql` (auto-generated by drizzle-kit)
- Create: `packages/db/src/migrations/meta/0009_snapshot.json`
- Modify: `packages/db/src/migrations/meta/_journal.json`

- [ ] **Step 2.1: Define the schema**

Create `packages/db/src/schema/weekly-simulado.ts`:

```ts
import { relations } from "drizzle-orm";
import { boolean, date, foreignKey, index, integer, pgTable, primaryKey, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { question } from "./questions";

export const weeklySimulado = pgTable(
  "weekly_simulado",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    weekStartDate: date("week_start_date").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    questionsCount: integer("questions_count").notNull(),
    correctCount: integer("correct_count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("weekly_simulado_user_week_uq").on(t.userId, t.weekStartDate),
    index("weekly_simulado_user_week_idx").on(t.userId, t.weekStartDate),
  ],
);

export const weeklySimuladoQuestion = pgTable(
  "weekly_simulado_question",
  {
    simuladoId: integer("simulado_id").notNull().references(() => weeklySimulado.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    questionId: integer("question_id").notNull().references(() => question.id, { onDelete: "restrict" }),
    selectedOptionIndex: integer("selected_option_index"),
    isCorrect: boolean("is_correct"),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.simuladoId, t.position] }),
    uniqueIndex("weekly_simulado_question_simulado_question_uq").on(t.simuladoId, t.questionId),
    index("weekly_simulado_question_simulado_idx").on(t.simuladoId),
  ],
);

export const weeklySimuladoRelations = relations(weeklySimulado, ({ many, one }) => ({
  user: one(user, { fields: [weeklySimulado.userId], references: [user.id] }),
  questions: many(weeklySimuladoQuestion),
}));

export const weeklySimuladoQuestionRelations = relations(weeklySimuladoQuestion, ({ one }) => ({
  simulado: one(weeklySimulado, { fields: [weeklySimuladoQuestion.simuladoId], references: [weeklySimulado.id] }),
  question: one(question, { fields: [weeklySimuladoQuestion.questionId], references: [question.id] }),
}));
```

- [ ] **Step 2.2: Register in schema index**

Modify `packages/db/src/schema/index.ts` — add:

```ts
export * from "./weekly-simulado";
```

- [ ] **Step 2.3: Generate the migration**

Run from `packages/db`:

```bash
bun run db:generate
```

(Use whichever script the package defines for `drizzle-kit generate`.)

Verify the generated SQL contains:
- `CREATE TABLE "weekly_simulado"` with all columns
- `CREATE TABLE "weekly_simulado_question"` with composite PK
- The two UNIQUE indexes
- ON DELETE CASCADE for `user_id` and `simulado_id` references
- ON DELETE RESTRICT for `question_id` reference

If the generator names the new file `0009_<word>.sql`, that's fine; note the filename. If the generator pulled in unrelated diffs (e.g., stale snapshot), STOP and ask — do not commit unrelated migration changes.

- [ ] **Step 2.4: Commit**

```bash
git add packages/db/src/schema/weekly-simulado.ts packages/db/src/schema/index.ts packages/db/src/migrations/
git commit -m "feat(db): weekly_simulado + weekly_simulado_question tables"
```

---

## Task 3 — Repository: `selectQuestionsForSimulado` + `startSimulado` (INSERT ... ON CONFLICT)

**Files:**
- Create: `apps/server/src/features/simulados/simulados.repository.ts`
- Create: `apps/server/src/features/simulados/simulados.repository.integration.test.ts`

- [ ] **Step 3.1: Skeleton repository**

Create `apps/server/src/features/simulados/simulados.repository.ts`:

```ts
import { and, asc, count, desc, eq, isNull, lt, sql } from "drizzle-orm";
import type { db as DbClient } from "@pruvi/db";
import { user } from "@pruvi/db/schema/auth";
import { question } from "@pruvi/db/schema/questions";
import { weeklySimulado, weeklySimuladoQuestion } from "@pruvi/db/schema/weekly-simulado";

type Db = typeof DbClient;

export type SimuladoRow = {
  id: number;
  userId: string;
  weekStartDate: string;
  startedAt: Date;
  completedAt: Date | null;
  questionsCount: number;
  correctCount: number;
};

export type SimuladoQuestionRow = {
  position: number;
  questionId: number;
  content: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string | null;
  subjectId: number;
  subtopicId: number;
  requiresCalculation: boolean;
  selectedOptionIndex: number | null;
  isCorrect: boolean | null;
};

export class SimuladosRepository {
  constructor(private db: Db) {}
}
```

- [ ] **Step 3.2: Failing integration tests for selectQuestionsForSimulado + startSimulado**

Create `apps/server/src/features/simulados/simulados.repository.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { setupTestDb, cleanupTestDb, teardownTestDb, getTestDb } from "../../test/db-helpers";
import { user } from "@pruvi/db/schema/auth";
import { question } from "@pruvi/db/schema/questions";
import { SimuladosRepository } from "./simulados.repository";

describe("SimuladosRepository (integration)", () => {
  const db = getTestDb();
  const repo = new SimuladosRepository(db);

  beforeAll(async () => setupTestDb());
  beforeEach(async () => cleanupTestDb());
  afterAll(async () => teardownTestDb());

  async function insertUser(id: string) {
    await db.insert(user).values({
      id,
      name: `U ${id}`,
      email: `${id}@e.com`,
      emailVerified: false,
      inviteCode: `c${id.replace(/-/g, "").slice(0, 8)}`,
      username: null,
      updatedAt: new Date(),
    });
  }

  async function seedQuestions(n: number, subjectId = 1) {
    for (let i = 1; i <= n; i++) {
      await db.insert(question).values({
        subjectId,
        subtopicId: 1,
        content: `Q${i}`,
        options: ["a", "b", "c", "d"],
        correctOptionIndex: i % 4,
        difficulty: 1,
        requiresCalculation: false,
      });
    }
  }

  describe("selectQuestionsForSimulado", () => {
    it("returns deterministic ordering for same (userId, weekStart)", async () => {
      await insertUser("u1");
      await seedQuestions(50);
      const a = await repo.selectQuestionsForSimulado("u1", "2026-05-10", 35);
      const b = await repo.selectQuestionsForSimulado("u1", "2026-05-10", 35);
      expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
      expect(a.length).toBe(35);
      expect(new Set(a.map((q) => q.id)).size).toBe(35);
    });

    it("returns all available when bank is smaller than requested count", async () => {
      await insertUser("u2");
      await seedQuestions(10);
      const a = await repo.selectQuestionsForSimulado("u2", "2026-05-10", 35);
      expect(a.length).toBe(10);
      expect(new Set(a.map((q) => q.id)).size).toBe(10);
    });

    it("returns different ordering for different (userId, weekStart)", async () => {
      await insertUser("u3");
      await seedQuestions(50);
      const a = await repo.selectQuestionsForSimulado("u3", "2026-05-10", 10);
      const b = await repo.selectQuestionsForSimulado("u3", "2026-05-17", 10);
      // Same seed inputs produce different orderings (probabilistic; with 50 questions and 10 picks, collision risk is negligible)
      expect(a.map((q) => q.id)).not.toEqual(b.map((q) => q.id));
    });
  });

  describe("startOrGetSimulado", () => {
    it("creates a new simulado with questions when none exists for (user, week)", async () => {
      await insertUser("u4");
      await seedQuestions(40);
      const { simulado, questions, created } = await repo.startOrGetSimulado("u4", "2026-05-10", 35);
      expect(created).toBe(true);
      expect(simulado.questionsCount).toBe(35);
      expect(simulado.correctCount).toBe(0);
      expect(simulado.completedAt).toBeNull();
      expect(questions.length).toBe(35);
      expect(questions[0]!.position).toBe(0);
      expect(questions[34]!.position).toBe(34);
    });

    it("is idempotent: second call returns the same simulado.id", async () => {
      await insertUser("u5");
      await seedQuestions(40);
      const a = await repo.startOrGetSimulado("u5", "2026-05-10", 35);
      const b = await repo.startOrGetSimulado("u5", "2026-05-10", 35);
      expect(a.simulado.id).toBe(b.simulado.id);
      expect(a.questions.map((q) => q.questionId)).toEqual(b.questions.map((q) => q.questionId));
      expect(b.created).toBe(false);
    });
  });
});
```

Run: `cd apps/server && bun test src/features/simulados/simulados.repository.integration.test.ts`
Expected: FAIL — methods not implemented.

- [ ] **Step 3.3: Implement `selectQuestionsForSimulado`**

Append to `simulados.repository.ts` inside the class:

```ts
  /**
   * Deterministic pseudo-random sample of `count` questions for a given
   * (userId, weekStart). Repeatable as long as the bank doesn't change.
   * If bank size < count, returns all available (graceful degradation).
   */
  async selectQuestionsForSimulado(userId: string, weekStart: string, count: number) {
    const seed = `${userId}|${weekStart}`;
    const rows = await this.db
      .select({
        id: question.id,
        subjectId: question.subjectId,
        subtopicId: question.subtopicId,
        content: question.content,
        options: question.options,
        correctOptionIndex: question.correctOptionIndex,
        explanation: question.explanation,
        requiresCalculation: question.requiresCalculation,
      })
      .from(question)
      .orderBy(sql`md5(${question.id}::text || ${seed})`)
      .limit(count);
    return rows;
  }
```

- [ ] **Step 3.4: Implement `startOrGetSimulado` (INSERT ... ON CONFLICT)**

Append:

```ts
  /**
   * Idempotent under concurrency: uses INSERT ... ON CONFLICT DO NOTHING
   * RETURNING. If conflict path is taken, re-reads the existing row.
   * Question selection + bulk insert happen inside the same transaction so
   * a simulado is never visible without its question set.
   */
  async startOrGetSimulado(userId: string, weekStart: string, requestedCount: number) {
    return await this.db.transaction(async (tx) => {
      // Attempt insert; ON CONFLICT (user_id, week_start_date) DO NOTHING.
      const selection = await tx
        .select({
          id: question.id,
          subjectId: question.subjectId,
          subtopicId: question.subtopicId,
          content: question.content,
          options: question.options,
          correctOptionIndex: question.correctOptionIndex,
          explanation: question.explanation,
          requiresCalculation: question.requiresCalculation,
        })
        .from(question)
        .orderBy(sql`md5(${question.id}::text || ${`${userId}|${weekStart}`})`)
        .limit(requestedCount);
      const effectiveCount = selection.length;

      const inserted = await tx
        .insert(weeklySimulado)
        .values({ userId, weekStartDate: weekStart, questionsCount: effectiveCount })
        .onConflictDoNothing({ target: [weeklySimulado.userId, weeklySimulado.weekStartDate] })
        .returning();

      if (inserted.length > 0) {
        const simulado = inserted[0]!;
        // Bulk insert question rows.
        if (effectiveCount > 0) {
          await tx.insert(weeklySimuladoQuestion).values(
            selection.map((q, idx) => ({
              simuladoId: simulado.id,
              position: idx,
              questionId: q.id,
            })),
          );
        }
        const questions = selection.map((q, idx) => ({
          position: idx,
          questionId: q.id,
          content: q.content,
          options: q.options as string[],
          correctOptionIndex: q.correctOptionIndex,
          explanation: q.explanation,
          subjectId: q.subjectId,
          subtopicId: q.subtopicId,
          requiresCalculation: q.requiresCalculation,
          selectedOptionIndex: null as number | null,
          isCorrect: null as boolean | null,
        }));
        return { simulado: this.toSimuladoRow(simulado), questions, created: true };
      }

      // Conflict path — re-read existing row + question set.
      const existing = await tx
        .select()
        .from(weeklySimulado)
        .where(and(eq(weeklySimulado.userId, userId), eq(weeklySimulado.weekStartDate, weekStart)))
        .limit(1);
      const simulado = existing[0];
      if (!simulado) throw new Error("startOrGetSimulado: conflict but no existing row");
      const existingQs = await this.fetchQuestionsForSimulado(tx, simulado.id);
      return { simulado: this.toSimuladoRow(simulado), questions: existingQs, created: false };
    });
  }

  private toSimuladoRow(row: typeof weeklySimulado.$inferSelect): SimuladoRow {
    return {
      id: row.id,
      userId: row.userId,
      weekStartDate: typeof row.weekStartDate === "string" ? row.weekStartDate : new Date(row.weekStartDate).toISOString().slice(0, 10),
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      questionsCount: row.questionsCount,
      correctCount: row.correctCount,
    };
  }

  private async fetchQuestionsForSimulado(tx: Db | Parameters<Db["transaction"]>[0] extends (tx: infer T) => unknown ? T : never, simuladoId: number): Promise<SimuladoQuestionRow[]> {
    const rows = await (tx as Db)
      .select({
        position: weeklySimuladoQuestion.position,
        questionId: weeklySimuladoQuestion.questionId,
        selectedOptionIndex: weeklySimuladoQuestion.selectedOptionIndex,
        isCorrect: weeklySimuladoQuestion.isCorrect,
        content: question.content,
        options: question.options,
        correctOptionIndex: question.correctOptionIndex,
        explanation: question.explanation,
        subjectId: question.subjectId,
        subtopicId: question.subtopicId,
        requiresCalculation: question.requiresCalculation,
      })
      .from(weeklySimuladoQuestion)
      .innerJoin(question, eq(weeklySimuladoQuestion.questionId, question.id))
      .where(eq(weeklySimuladoQuestion.simuladoId, simuladoId))
      .orderBy(asc(weeklySimuladoQuestion.position));
    return rows.map((r) => ({
      position: r.position,
      questionId: r.questionId,
      content: r.content,
      options: r.options as string[],
      correctOptionIndex: r.correctOptionIndex,
      explanation: r.explanation,
      subjectId: r.subjectId,
      subtopicId: r.subtopicId,
      requiresCalculation: r.requiresCalculation,
      selectedOptionIndex: r.selectedOptionIndex,
      isCorrect: r.isCorrect,
    }));
  }
```

- [ ] **Step 3.5: Run tests, verify pass, commit**

```bash
cd apps/server && bun test src/features/simulados/simulados.repository.integration.test.ts
```
Expected: all pass.

```bash
git add apps/server/src/features/simulados/simulados.repository.ts apps/server/src/features/simulados/simulados.repository.integration.test.ts
git commit -m "feat(simulados): repository — deterministic question selection and start-or-get"
```

---

## Task 4 — Repository: race-safe `recordAnswer`, `forceComplete`, `getOneForUser`

**Files:**
- Modify: `apps/server/src/features/simulados/simulados.repository.ts`
- Modify: `apps/server/src/features/simulados/simulados.repository.integration.test.ts`

- [ ] **Step 4.1: Failing tests**

Append to `simulados.repository.integration.test.ts`:

```ts
  describe("recordAnswer", () => {
    it("records first answer, increments correct_count on correct, returns correct outcome", async () => {
      await insertUser("u-ans-1");
      await seedQuestions(35);
      const { simulado, questions } = await repo.startOrGetSimulado("u-ans-1", "2026-05-10", 35);
      const q = questions[0]!;
      const correctOpt = q.correctOptionIndex;
      const result = await repo.recordAnswer(simulado.id, "u-ans-1", q.questionId, correctOpt);
      expect(result.kind).toBe("recorded");
      if (result.kind === "recorded") {
        expect(result.isCorrect).toBe(true);
        expect(result.completed).toBe(false);
        expect(result.answeredCount).toBe(1);
      }
    });

    it("first-answer-wins idempotency: second answer with different option returns original outcome", async () => {
      await insertUser("u-ans-2");
      await seedQuestions(35);
      const { simulado, questions } = await repo.startOrGetSimulado("u-ans-2", "2026-05-10", 35);
      const q = questions[0]!;
      const correctOpt = q.correctOptionIndex;
      const wrongOpt = (correctOpt + 1) % 4;
      await repo.recordAnswer(simulado.id, "u-ans-2", q.questionId, correctOpt);
      const second = await repo.recordAnswer(simulado.id, "u-ans-2", q.questionId, wrongOpt);
      expect(second.kind).toBe("already_answered");
      if (second.kind === "already_answered") {
        expect(second.isCorrect).toBe(true);
        expect(second.selectedOptionIndex).toBe(correctOpt);
      }
    });

    it("auto-completes when the last unanswered question is answered", async () => {
      await insertUser("u-ans-3");
      await seedQuestions(5);
      const { simulado, questions } = await repo.startOrGetSimulado("u-ans-3", "2026-05-10", 5);
      for (let i = 0; i < 4; i++) {
        const q = questions[i]!;
        await repo.recordAnswer(simulado.id, "u-ans-3", q.questionId, q.correctOptionIndex);
      }
      const final = await repo.recordAnswer(simulado.id, "u-ans-3", questions[4]!.questionId, questions[4]!.correctOptionIndex);
      expect(final.kind).toBe("recorded");
      if (final.kind === "recorded") {
        expect(final.completed).toBe(true);
        expect(final.answeredCount).toBe(5);
      }
    });

    it("returns kind='not_found' when simulado doesn't exist or isn't owned by user", async () => {
      await insertUser("u-ans-4a");
      await insertUser("u-ans-4b");
      await seedQuestions(35);
      const { simulado, questions } = await repo.startOrGetSimulado("u-ans-4a", "2026-05-10", 35);
      const result = await repo.recordAnswer(simulado.id, "u-ans-4b", questions[0]!.questionId, 0);
      expect(result.kind).toBe("not_found");
    });

    it("returns kind='bad_question' when questionId doesn't belong to this simulado", async () => {
      await insertUser("u-ans-5");
      await seedQuestions(40);
      const { simulado, questions } = await repo.startOrGetSimulado("u-ans-5", "2026-05-10", 35);
      const includedIds = new Set(questions.map((q) => q.questionId));
      // Find a question NOT in the simulado
      const allQuestions = await db.select({ id: question.id }).from(question);
      const outsider = allQuestions.find((q) => !includedIds.has(q.id))!;
      const result = await repo.recordAnswer(simulado.id, "u-ans-5", outsider.id, 0);
      expect(result.kind).toBe("bad_question");
    });

    it("returns kind='already_completed' when simulado is already finalized", async () => {
      await insertUser("u-ans-6");
      await seedQuestions(35);
      const { simulado, questions } = await repo.startOrGetSimulado("u-ans-6", "2026-05-10", 35);
      await repo.forceComplete(simulado.id, "u-ans-6");
      const result = await repo.recordAnswer(simulado.id, "u-ans-6", questions[0]!.questionId, 0);
      expect(result.kind).toBe("already_completed");
    });
  });

  describe("forceComplete", () => {
    it("sets completed_at when not yet completed", async () => {
      await insertUser("u-fc-1");
      await seedQuestions(35);
      const { simulado } = await repo.startOrGetSimulado("u-fc-1", "2026-05-10", 35);
      const res = await repo.forceComplete(simulado.id, "u-fc-1");
      expect(res.kind).toBe("completed");
      if (res.kind === "completed") expect(res.completedAt).toBeInstanceOf(Date);
    });

    it("is idempotent on already-completed simulado", async () => {
      await insertUser("u-fc-2");
      await seedQuestions(35);
      const { simulado } = await repo.startOrGetSimulado("u-fc-2", "2026-05-10", 35);
      await repo.forceComplete(simulado.id, "u-fc-2");
      const res = await repo.forceComplete(simulado.id, "u-fc-2");
      expect(res.kind).toBe("completed");
    });

    it("returns not_found for unowned simulado", async () => {
      await insertUser("u-fc-3a");
      await insertUser("u-fc-3b");
      await seedQuestions(35);
      const { simulado } = await repo.startOrGetSimulado("u-fc-3a", "2026-05-10", 35);
      const res = await repo.forceComplete(simulado.id, "u-fc-3b");
      expect(res.kind).toBe("not_found");
    });
  });
```

Run: expect FAIL.

- [ ] **Step 4.2: Implement `recordAnswer`**

Add the result type at the top of `simulados.repository.ts` (after existing types):

```ts
export type RecordAnswerResult =
  | { kind: "recorded"; isCorrect: boolean; correctOptionIndex: number; explanation: string | null; answeredCount: number; completed: boolean }
  | { kind: "already_answered"; isCorrect: boolean; selectedOptionIndex: number; correctOptionIndex: number; explanation: string | null; answeredCount: number; completed: boolean }
  | { kind: "not_found" }
  | { kind: "bad_question" }
  | { kind: "already_completed" };

export type ForceCompleteResult =
  | { kind: "completed"; completedAt: Date }
  | { kind: "not_found" };
```

Inside the class, add:

```ts
  /**
   * Race-safe under Read Committed via `SELECT ... FOR UPDATE` on the parent
   * simulado row. Serializes concurrent answers on the same simulado to
   * eliminate auto-completion races. First-answer-wins idempotency on the
   * question row via WHERE selected_option_index IS NULL predicate.
   */
  async recordAnswer(simuladoId: number, userId: string, questionId: number, selectedOptionIndex: number): Promise<RecordAnswerResult> {
    return await this.db.transaction(async (tx) => {
      // 1. Lock parent row; check ownership and completion.
      const locked = await tx.execute(sql`
        SELECT id, user_id, completed_at, correct_count, questions_count
        FROM weekly_simulado WHERE id = ${simuladoId} FOR UPDATE
      `);
      const parent = (locked.rows ?? locked)[0] as { id: number; user_id: string; completed_at: Date | null; correct_count: number; questions_count: number } | undefined;
      if (!parent || parent.user_id !== userId) return { kind: "not_found" };
      if (parent.completed_at !== null) return { kind: "already_completed" };

      // 2. Look up the question within this simulado.
      const qRow = await tx
        .select({
          selectedOptionIndex: weeklySimuladoQuestion.selectedOptionIndex,
          isCorrect: weeklySimuladoQuestion.isCorrect,
          correctOptionIndex: question.correctOptionIndex,
          explanation: question.explanation,
        })
        .from(weeklySimuladoQuestion)
        .innerJoin(question, eq(weeklySimuladoQuestion.questionId, question.id))
        .where(and(eq(weeklySimuladoQuestion.simuladoId, simuladoId), eq(weeklySimuladoQuestion.questionId, questionId)))
        .limit(1);
      const qr = qRow[0];
      if (!qr) return { kind: "bad_question" };

      const correctOpt = qr.correctOptionIndex;
      const explanation = qr.explanation;

      // 3. If already answered, return the recorded outcome (first answer wins).
      if (qr.selectedOptionIndex !== null) {
        const answered = await tx
          .select({ value: count() })
          .from(weeklySimuladoQuestion)
          .where(and(eq(weeklySimuladoQuestion.simuladoId, simuladoId), sql`${weeklySimuladoQuestion.selectedOptionIndex} IS NOT NULL`));
        return {
          kind: "already_answered",
          isCorrect: qr.isCorrect ?? false,
          selectedOptionIndex: qr.selectedOptionIndex,
          correctOptionIndex: correctOpt,
          explanation,
          answeredCount: Number(answered[0]!.value),
          completed: false,
        };
      }

      // 4. Record the new answer.
      const isCorrect = selectedOptionIndex === correctOpt;
      await tx
        .update(weeklySimuladoQuestion)
        .set({ selectedOptionIndex, isCorrect, answeredAt: new Date() })
        .where(and(
          eq(weeklySimuladoQuestion.simuladoId, simuladoId),
          eq(weeklySimuladoQuestion.questionId, questionId),
          isNull(weeklySimuladoQuestion.selectedOptionIndex),
        ));

      // 5. Increment correct_count if correct.
      if (isCorrect) {
        await tx
          .update(weeklySimulado)
          .set({ correctCount: sql`${weeklySimulado.correctCount} + 1` })
          .where(eq(weeklySimulado.id, simuladoId));
      }

      // 6. Count remaining unanswered. Because parent is FOR UPDATE-locked, no
      //    other answer transaction can have committed since step 1.
      const unanswered = await tx
        .select({ value: count() })
        .from(weeklySimuladoQuestion)
        .where(and(eq(weeklySimuladoQuestion.simuladoId, simuladoId), isNull(weeklySimuladoQuestion.selectedOptionIndex)));
      const remaining = Number(unanswered[0]!.value);
      let completed = false;
      if (remaining === 0) {
        await tx
          .update(weeklySimulado)
          .set({ completedAt: new Date() })
          .where(and(eq(weeklySimulado.id, simuladoId), isNull(weeklySimulado.completedAt)));
        completed = true;
      }
      const answeredCount = parent.questions_count - remaining;
      return { kind: "recorded", isCorrect, correctOptionIndex: correctOpt, explanation, answeredCount, completed };
    });
  }

  async forceComplete(simuladoId: number, userId: string): Promise<ForceCompleteResult> {
    const result = await this.db
      .update(weeklySimulado)
      .set({ completedAt: sql`COALESCE(${weeklySimulado.completedAt}, now())` })
      .where(and(eq(weeklySimulado.id, simuladoId), eq(weeklySimulado.userId, userId)))
      .returning({ completedAt: weeklySimulado.completedAt });
    const row = result[0];
    if (!row) return { kind: "not_found" };
    return { kind: "completed", completedAt: row.completedAt! };
  }

  async getOneForUser(simuladoId: number, userId: string): Promise<{ simulado: SimuladoRow; questions: SimuladoQuestionRow[] } | null> {
    const rows = await this.db
      .select()
      .from(weeklySimulado)
      .where(and(eq(weeklySimulado.id, simuladoId), eq(weeklySimulado.userId, userId)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const questions = await this.fetchQuestionsForSimulado(this.db, row.id);
    return { simulado: this.toSimuladoRow(row), questions };
  }
```

**Note on `tx.execute(sql\`... FOR UPDATE\`)`:** drizzle-orm's `.for("update")` is supported on `.select()`; prefer:

```ts
const lockedRows = await tx
  .select({ id: weeklySimulado.id, userId: weeklySimulado.userId, completedAt: weeklySimulado.completedAt, correctCount: weeklySimulado.correctCount, questionsCount: weeklySimulado.questionsCount })
  .from(weeklySimulado)
  .where(eq(weeklySimulado.id, simuladoId))
  .for("update")
  .limit(1);
const parent = lockedRows[0];
```

Use the typed `.for("update")` form rather than raw `sql\`SELECT ... FOR UPDATE\``. Adjust the implementation accordingly (the field names map to `parent.userId`, `parent.completedAt`, `parent.questionsCount`).

- [ ] **Step 4.3: Run tests, fix, commit**

```bash
cd apps/server && bun test src/features/simulados/simulados.repository.integration.test.ts
```
Expected: all pass.

```bash
git add apps/server/src/features/simulados/simulados.repository.ts apps/server/src/features/simulados/simulados.repository.integration.test.ts
git commit -m "feat(simulados): repository — race-safe recordAnswer, forceComplete, getOneForUser"
```

---

## Task 5 — Repository: history queries

**Files:**
- Modify: `apps/server/src/features/simulados/simulados.repository.ts`
- Modify: `apps/server/src/features/simulados/simulados.repository.integration.test.ts`

- [ ] **Step 5.1: Failing tests**

Append to the integration test file:

```ts
  describe("listPriorCompletedSimulados", () => {
    it("returns up to N most recent COMPLETED prior simulados, oldest first, with per-subject breakdown", async () => {
      await insertUser("u-hist-1");
      // Seed enough questions across 2 subjects
      for (let i = 1; i <= 20; i++) {
        await db.insert(question).values({
          subjectId: i <= 10 ? 1 : 2,
          subtopicId: 1,
          content: `Q${i}`,
          options: ["a","b","c","d"],
          correctOptionIndex: 0,
          difficulty: 1,
          requiresCalculation: false,
        });
      }
      const weeks = ["2026-04-05", "2026-04-12", "2026-04-19", "2026-04-26", "2026-05-03", "2026-05-10"];
      for (const w of weeks) {
        const { simulado, questions } = await repo.startOrGetSimulado("u-hist-1", w, 10);
        // Answer all correctly so each is completed
        for (const q of questions) {
          await repo.recordAnswer(simulado.id, "u-hist-1", q.questionId, q.correctOptionIndex);
        }
      }
      // current week is 2026-05-10 → prior = 5 most recent before it; we ask for 4
      const history = await repo.listPriorCompletedSimulados("u-hist-1", "2026-05-10", 4);
      expect(history.map((h) => h.weekStart)).toEqual(["2026-04-12", "2026-04-19", "2026-04-26", "2026-05-03"]);
      // Per-subject breakdown sums to total
      for (const h of history) {
        const sum = h.perSubject.reduce((s, p) => s + p.total, 0);
        expect(sum).toBe(h.total);
      }
    });

    it("excludes IN-PROGRESS simulados", async () => {
      await insertUser("u-hist-2");
      for (let i = 1; i <= 5; i++) {
        await db.insert(question).values({ subjectId: 1, subtopicId: 1, content: `Q${i}`, options: ["a","b","c","d"], correctOptionIndex: 0, difficulty: 1, requiresCalculation: false });
      }
      const { simulado: prior, questions: pq } = await repo.startOrGetSimulado("u-hist-2", "2026-05-03", 5);
      for (const q of pq) await repo.recordAnswer(prior.id, "u-hist-2", q.questionId, q.correctOptionIndex);
      // Current week — started but not completed
      await repo.startOrGetSimulado("u-hist-2", "2026-05-10", 5);
      const history = await repo.listPriorCompletedSimulados("u-hist-2", "2026-05-10", 4);
      expect(history.length).toBe(1);
      expect(history[0]!.weekStart).toBe("2026-05-03");
    });

    it("getResultsAggregate returns per-subject breakdown for one simulado", async () => {
      await insertUser("u-agg-1");
      for (let i = 1; i <= 6; i++) {
        await db.insert(question).values({ subjectId: i <= 3 ? 1 : 2, subtopicId: 1, content: `Q${i}`, options: ["a","b","c","d"], correctOptionIndex: 0, difficulty: 1, requiresCalculation: false });
      }
      const { simulado, questions } = await repo.startOrGetSimulado("u-agg-1", "2026-05-10", 6);
      // Answer first 4 correctly, last 2 wrong
      for (let i = 0; i < 4; i++) await repo.recordAnswer(simulado.id, "u-agg-1", questions[i]!.questionId, questions[i]!.correctOptionIndex);
      for (let i = 4; i < 6; i++) await repo.recordAnswer(simulado.id, "u-agg-1", questions[i]!.questionId, (questions[i]!.correctOptionIndex + 1) % 4);
      const agg = await repo.getResultsAggregate(simulado.id);
      expect(agg.correct).toBe(4);
      expect(agg.total).toBe(6);
      const ps = agg.perSubject.sort((a, b) => a.subjectId - b.subjectId);
      expect(ps).toHaveLength(2);
      expect(ps.reduce((s, p) => s + p.total, 0)).toBe(6);
    });
  });
```

Run: expect FAIL.

- [ ] **Step 5.2: Implement the history queries**

Append to `simulados.repository.ts`:

```ts
  /**
   * Returns up to `limit` most recent COMPLETED simulados strictly BEFORE
   * `currentWeekStart`, ordered oldest first, with per-subject breakdown.
   */
  async listPriorCompletedSimulados(userId: string, currentWeekStart: string, limit: number): Promise<Array<{ weekStart: string; correct: number; total: number; perSubject: Array<{ subjectId: number; correct: number; total: number }> }>> {
    const recent = await this.db
      .select({ id: weeklySimulado.id, weekStartDate: weeklySimulado.weekStartDate, correctCount: weeklySimulado.correctCount, questionsCount: weeklySimulado.questionsCount })
      .from(weeklySimulado)
      .where(and(
        eq(weeklySimulado.userId, userId),
        sql`${weeklySimulado.completedAt} IS NOT NULL`,
        lt(weeklySimulado.weekStartDate, currentWeekStart),
      ))
      .orderBy(desc(weeklySimulado.weekStartDate))
      .limit(limit);
    if (recent.length === 0) return [];

    const ids = recent.map((r) => r.id);
    const perSubjectRows = await this.db
      .select({
        simuladoId: weeklySimuladoQuestion.simuladoId,
        subjectId: question.subjectId,
        correct: sql<number>`SUM(CASE WHEN ${weeklySimuladoQuestion.isCorrect} = true THEN 1 ELSE 0 END)`,
        total: count(),
      })
      .from(weeklySimuladoQuestion)
      .innerJoin(question, eq(weeklySimuladoQuestion.questionId, question.id))
      .where(sql`${weeklySimuladoQuestion.simuladoId} IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`)
      .groupBy(weeklySimuladoQuestion.simuladoId, question.subjectId);

    const bySimulado = new Map<number, Array<{ subjectId: number; correct: number; total: number }>>();
    for (const r of perSubjectRows) {
      const list = bySimulado.get(r.simuladoId) ?? [];
      list.push({ subjectId: r.subjectId, correct: Number(r.correct), total: Number(r.total) });
      bySimulado.set(r.simuladoId, list);
    }

    return recent
      .map((r) => ({
        weekStart: typeof r.weekStartDate === "string" ? r.weekStartDate : new Date(r.weekStartDate).toISOString().slice(0, 10),
        correct: r.correctCount,
        total: r.questionsCount,
        perSubject: bySimulado.get(r.id) ?? [],
      }))
      .reverse(); // oldest first
  }

  /** Per-subject aggregate for a single simulado. */
  async getResultsAggregate(simuladoId: number): Promise<{ correct: number; total: number; perSubject: Array<{ subjectId: number; correct: number; total: number }> }> {
    const head = await this.db
      .select({ correctCount: weeklySimulado.correctCount, questionsCount: weeklySimulado.questionsCount })
      .from(weeklySimulado)
      .where(eq(weeklySimulado.id, simuladoId))
      .limit(1);
    const h = head[0];
    if (!h) return { correct: 0, total: 0, perSubject: [] };

    const perSubject = await this.db
      .select({
        subjectId: question.subjectId,
        correct: sql<number>`SUM(CASE WHEN ${weeklySimuladoQuestion.isCorrect} = true THEN 1 ELSE 0 END)`,
        total: count(),
      })
      .from(weeklySimuladoQuestion)
      .innerJoin(question, eq(weeklySimuladoQuestion.questionId, question.id))
      .where(eq(weeklySimuladoQuestion.simuladoId, simuladoId))
      .groupBy(question.subjectId);

    return {
      correct: h.correctCount,
      total: h.questionsCount,
      perSubject: perSubject.map((p) => ({ subjectId: p.subjectId, correct: Number(p.correct), total: Number(p.total) })),
    };
  }
```

- [ ] **Step 5.3: Run, commit**

```bash
cd apps/server && bun test src/features/simulados/simulados.repository.integration.test.ts
git add apps/server/src/features/simulados/simulados.repository.ts apps/server/src/features/simulados/simulados.repository.integration.test.ts
git commit -m "feat(simulados): repository — prior completed history and per-subject aggregate"
```

---

## Task 6 — Service: entitlement gating, lifecycle orchestration

**Files:**
- Create: `apps/server/src/features/simulados/simulados.service.ts`
- Create: `apps/server/src/features/simulados/simulados.service.test.ts`

- [ ] **Step 6.1: Failing tests**

Create `simulados.service.test.ts`. Mirror the style of `shields.service.test.ts` — mock the repo and the ultra service.

Required test cases (skeleton; fill in full code following the project's mocking pattern):
- `getCurrent`: non-Ultra → `err(ULTRA_REQUIRED)`; Ultra + no simulado → status `not_started`, simulado null, history populated; Ultra + in-progress simulado → status `in_progress`; Ultra + completed → status `completed`.
- `start`: non-Ultra → 403; Ultra → calls repo.startOrGetSimulado with `(userId, weekStart, SIMULADO_QUESTION_COUNT)` and returns `{ simulado, questions }` stripped of `correctOptionIndex` and `explanation` for unanswered questions.
- `getDetail(id, userId)`: non-Ultra → 403; not owned → NotFoundError; owned → returns sanitized question list (correct answer + explanation only on answered or completed questions).
- `recordAnswer`: non-Ultra → 403; not_found → NotFoundError; bad_question → 400; already_completed → 409; recorded → returns response shape; already_answered → returns recorded outcome.
- `forceComplete`: non-Ultra → 403; not_found → 404; otherwise ok.
- `getResults`: non-Ultra → 403; not owned → 404; in-progress → 400 (results not available until completed); completed → returns aggregate + history.

For Ultra-lapse-after-start (acceptance A9): the service should NOT block `recordAnswer` / `forceComplete` / `getDetail` / `getResults` when `isUltra` is currently false but the simulado exists and is owned. **This means**: in `recordAnswer`, `forceComplete`, `getDetail`, `getResults`, we do NOT call `ultra.isUltra` — we only check Ultra at `getCurrent` and `start`. Document this in a comment on the methods that intentionally skip the Ultra check.

- [ ] **Step 6.2: Implement the service**

Create `simulados.service.ts`:

```ts
import { ok, err, type Result } from "neverthrow";
import { AppError, NotFoundError, ValidationError, ForbiddenError, ConflictError } from "../../utils/errors";
import {
  SIMULADO_QUESTION_COUNT,
  weekBoundsForSimulado,
  type SimuladoCurrentResponse,
  type SimuladoStartResponse,
  type SimuladoDetailResponse,
  type SimuladoAnswerResponse,
  type SimuladoResultsResponse,
} from "@pruvi/shared";
import type { SimuladosRepository, SimuladoQuestionRow, SimuladoRow } from "./simulados.repository";
import type { UltraService } from "../ultra/ultra.service";
import type { FastifyBaseLogger } from "fastify";

const HISTORY_LIMIT = 4;

export class SimuladosService {
  constructor(
    private repo: SimuladosRepository,
    private ultra: UltraService,
    private logger?: FastifyBaseLogger,
  ) {}

  /** Strips correctOptionIndex + explanation from questions that haven't been answered
   *  (and the simulado is not completed). Once the simulado is completed, all
   *  questions reveal both fields. */
  private sanitizeQuestions(questions: SimuladoQuestionRow[], simuladoCompleted: boolean) {
    return questions.map((q) => {
      const reveal = simuladoCompleted || q.selectedOptionIndex !== null;
      return {
        position: q.position,
        questionId: q.questionId,
        content: q.content,
        options: q.options,
        subjectId: q.subjectId,
        subtopicId: q.subtopicId,
        requiresCalculation: q.requiresCalculation,
        selectedOptionIndex: q.selectedOptionIndex,
        isCorrect: q.isCorrect,
        correctOptionIndex: reveal ? q.correctOptionIndex : null,
        explanation: reveal ? q.explanation : null,
      };
    });
  }

  async getCurrent(userId: string, now = new Date()): Promise<Result<SimuladoCurrentResponse, AppError>> {
    if (!(await this.ultra.isUltra(userId))) return err(new ForbiddenError("ULTRA_REQUIRED"));
    const { weekStart, weekEnd } = weekBoundsForSimulado(now);
    const existing = await this.repo.findByUserAndWeek(userId, weekStart);
    const history = await this.repo.listPriorCompletedSimulados(userId, weekStart, HISTORY_LIMIT);
    if (!existing) {
      return ok({ weekStart, weekEnd, status: "not_started", simulado: null, history });
    }
    const status: SimuladoCurrentResponse["status"] = existing.completedAt ? "completed" : "in_progress";
    const answeredCount = await this.repo.countAnswered(existing.id);
    return ok({
      weekStart,
      weekEnd,
      status,
      simulado: {
        id: existing.id,
        startedAt: existing.startedAt.toISOString(),
        completedAt: existing.completedAt?.toISOString() ?? null,
        questionsCount: existing.questionsCount,
        answeredCount,
        correctCount: existing.correctCount,
      },
      history,
    });
  }

  async start(userId: string, now = new Date()): Promise<Result<SimuladoStartResponse, AppError>> {
    if (!(await this.ultra.isUltra(userId))) return err(new ForbiddenError("ULTRA_REQUIRED"));
    const { weekStart } = weekBoundsForSimulado(now);
    const { simulado, questions } = await this.repo.startOrGetSimulado(userId, weekStart, SIMULADO_QUESTION_COUNT);
    return ok({
      simulado: { id: simulado.id, startedAt: simulado.startedAt.toISOString(), questionsCount: simulado.questionsCount },
      questions: questions.map((q) => ({
        position: q.position,
        questionId: q.questionId,
        content: q.content,
        options: q.options,
        subjectId: q.subjectId,
        subtopicId: q.subtopicId,
        requiresCalculation: q.requiresCalculation,
      })),
    });
  }

  // Intentionally NOT gated by ultra.isUltra — see spec §4 A9 (Ultra-lapse mid-simulado).
  async getDetail(simuladoId: number, userId: string): Promise<Result<SimuladoDetailResponse, AppError>> {
    const found = await this.repo.getOneForUser(simuladoId, userId);
    if (!found) return err(new NotFoundError("Simulado not found"));
    const completed = found.simulado.completedAt !== null;
    return ok({
      simulado: {
        id: found.simulado.id,
        weekStart: found.simulado.weekStartDate,
        startedAt: found.simulado.startedAt.toISOString(),
        completedAt: found.simulado.completedAt?.toISOString() ?? null,
        questionsCount: found.simulado.questionsCount,
        answeredCount: found.questions.filter((q) => q.selectedOptionIndex !== null).length,
        correctCount: found.simulado.correctCount,
        status: completed ? "completed" : "in_progress",
      },
      questions: this.sanitizeQuestions(found.questions, completed),
    });
  }

  // Intentionally NOT gated by ultra.isUltra — see spec §4 A9.
  async recordAnswer(simuladoId: number, userId: string, questionId: number, selectedOptionIndex: number): Promise<Result<SimuladoAnswerResponse, AppError>> {
    const r = await this.repo.recordAnswer(simuladoId, userId, questionId, selectedOptionIndex);
    switch (r.kind) {
      case "not_found":
        return err(new NotFoundError("Simulado not found"));
      case "bad_question":
        return err(new ValidationError("Question does not belong to this simulado"));
      case "already_completed":
        return err(new ConflictError("Simulado already completed"));
      case "recorded":
        return ok({
          isCorrect: r.isCorrect,
          correctOptionIndex: r.correctOptionIndex,
          explanation: r.explanation,
          answeredCount: r.answeredCount,
          completed: r.completed,
        });
      case "already_answered":
        return ok({
          isCorrect: r.isCorrect,
          correctOptionIndex: r.correctOptionIndex,
          explanation: r.explanation,
          answeredCount: r.answeredCount,
          completed: r.completed,
        });
    }
  }

  // Intentionally NOT gated by ultra.isUltra — see spec §4 A9.
  async forceComplete(simuladoId: number, userId: string): Promise<Result<{ id: number; completedAt: string }, AppError>> {
    const r = await this.repo.forceComplete(simuladoId, userId);
    if (r.kind === "not_found") return err(new NotFoundError("Simulado not found"));
    return ok({ id: simuladoId, completedAt: r.completedAt.toISOString() });
  }

  // Intentionally NOT gated by ultra.isUltra — see spec §4 A9.
  async getResults(simuladoId: number, userId: string, now = new Date()): Promise<Result<SimuladoResultsResponse, AppError>> {
    const found = await this.repo.getOneForUser(simuladoId, userId);
    if (!found) return err(new NotFoundError("Simulado not found"));
    if (!found.simulado.completedAt) return err(new ValidationError("Simulado not yet completed"));
    const agg = await this.repo.getResultsAggregate(simuladoId);
    const history = await this.repo.listPriorCompletedSimulados(userId, found.simulado.weekStartDate, HISTORY_LIMIT);
    return ok({
      weekStart: found.simulado.weekStartDate,
      correct: agg.correct,
      total: agg.total,
      perSubject: agg.perSubject,
      history,
    });
  }
}
```

Note: this uses `findByUserAndWeek` and `countAnswered` on the repo, which are not yet implemented. Add them to the repository:

```ts
  async findByUserAndWeek(userId: string, weekStart: string): Promise<SimuladoRow | null> {
    const rows = await this.db
      .select()
      .from(weeklySimulado)
      .where(and(eq(weeklySimulado.userId, userId), eq(weeklySimulado.weekStartDate, weekStart)))
      .limit(1);
    const r = rows[0];
    return r ? this.toSimuladoRow(r) : null;
  }

  async countAnswered(simuladoId: number): Promise<number> {
    const res = await this.db
      .select({ value: count() })
      .from(weeklySimuladoQuestion)
      .where(and(eq(weeklySimuladoQuestion.simuladoId, simuladoId), sql`${weeklySimuladoQuestion.selectedOptionIndex} IS NOT NULL`));
    return Number(res[0]!.value);
  }
```

If `ConflictError` and `ForbiddenError` don't already exist in `utils/errors`, add them following the existing class pattern (extend `AppError` with statusCode 409 and 403 respectively).

- [ ] **Step 6.3: Run, fix, commit**

```bash
cd apps/server && bun test src/features/simulados/
git add apps/server/src/features/simulados/simulados.service.ts apps/server/src/features/simulados/simulados.service.test.ts apps/server/src/features/simulados/simulados.repository.ts
git commit -m "feat(simulados): service — entitlement gating, lifecycle orchestration, ultra-lapse exemption per spec a9"
```

If `errors.ts` was modified, include it in the commit.

---

## Task 7 — Route: endpoints, schemas, cache, registration

**Files:**
- Create: `apps/server/src/features/simulados/simulados.route.ts`
- Create: `apps/server/src/features/simulados/index.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 7.1: Implement the route module**

Create `simulados.route.ts`:

```ts
import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  SimuladoAnswerBodySchema,
  SimuladoAnswerResponseSchema,
  SimuladoCurrentResponseSchema,
  SimuladoDetailResponseSchema,
  SimuladoResultsResponseSchema,
  SimuladoStartResponseSchema,
  type SimuladoCurrentResponse,
} from "@pruvi/shared";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";
import { SimuladosRepository } from "./simulados.repository";
import { SimuladosService } from "./simulados.service";
import { UltraRepository } from "../ultra/ultra.repository";
import { UltraService } from "../ultra/ultra.service";

const CURRENT_CACHE_TTL = 60;

export const simuladosRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const repo = new SimuladosRepository(db);
  const ultra = new UltraService(new UltraRepository(db));
  const service = new SimuladosService(repo, ultra, fastify.log);

  fastify.get(
    "/simulados/current",
    {
      preHandler: [fastify.authenticate],
      schema: { response: { 200: z.object({ success: z.literal(true), data: SimuladoCurrentResponseSchema }) } },
    },
    async (request) => {
      const cacheKey = `simulado:current:${request.userId}`;
      const cached = await fastify.cache.get<SimuladoCurrentResponse>(cacheKey);
      if (cached) return successResponse(cached);
      const data = unwrapResult(await service.getCurrent(request.userId)).data;
      await fastify.cache.set(cacheKey, data, CURRENT_CACHE_TTL);
      return successResponse(data);
    },
  );

  fastify.post(
    "/simulados/start",
    {
      preHandler: [fastify.authenticate],
      schema: { response: { 200: z.object({ success: z.literal(true), data: SimuladoStartResponseSchema }) } },
    },
    async (request) => {
      const data = unwrapResult(await service.start(request.userId)).data;
      await fastify.cache.del(`simulado:current:${request.userId}`);
      return successResponse(data);
    },
  );

  fastify.get(
    "/simulados/:id",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.coerce.number().int() }),
        response: { 200: z.object({ success: z.literal(true), data: SimuladoDetailResponseSchema }) },
      },
    },
    async (request) => {
      const { id } = request.params;
      const data = unwrapResult(await service.getDetail(id, request.userId)).data;
      return successResponse(data);
    },
  );

  fastify.post(
    "/simulados/:id/answer",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.coerce.number().int() }),
        body: SimuladoAnswerBodySchema,
        response: { 200: z.object({ success: z.literal(true), data: SimuladoAnswerResponseSchema }) },
      },
    },
    async (request) => {
      const { id } = request.params;
      const { questionId, selectedOptionIndex } = request.body;
      const data = unwrapResult(await service.recordAnswer(id, request.userId, questionId, selectedOptionIndex)).data;
      await fastify.cache.del(`simulado:current:${request.userId}`);
      return successResponse(data);
    },
  );

  fastify.post(
    "/simulados/:id/complete",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.coerce.number().int() }),
        response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.number().int(), completedAt: z.string() }) }) },
      },
    },
    async (request) => {
      const { id } = request.params;
      const data = unwrapResult(await service.forceComplete(id, request.userId)).data;
      await fastify.cache.del(`simulado:current:${request.userId}`);
      return successResponse(data);
    },
  );

  fastify.get(
    "/simulados/:id/results",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.coerce.number().int() }),
        response: { 200: z.object({ success: z.literal(true), data: SimuladoResultsResponseSchema }) },
      },
    },
    async (request) => {
      const { id } = request.params;
      const data = unwrapResult(await service.getResults(id, request.userId)).data;
      return successResponse(data);
    },
  );
};
```

Create `apps/server/src/features/simulados/index.ts`:

```ts
export { simuladosRoutes } from "./simulados.route";
```

- [ ] **Step 7.2: Register in the app**

Modify `apps/server/src/index.ts`:

- Add import: `import { simuladosRoutes } from "./features/simulados";`
- Add registration after `shieldsRoutes`: `await app.register(simuladosRoutes);`

- [ ] **Step 7.3: Run typecheck and full test suite**

```bash
cd apps/server && bun run typecheck && bun test
```

Expected: all green.

- [ ] **Step 7.4: Commit**

```bash
git add apps/server/src/features/simulados/simulados.route.ts apps/server/src/features/simulados/index.ts apps/server/src/index.ts
git commit -m "feat(simulados): routes — /simulados/{current,start,:id,:id/answer,:id/complete,:id/results} with 60s cache on /current"
```

---

## Task 8 — Final cleanup, full typecheck, push, open PR

- [ ] **Step 8.1: Run full project quality gates**

```bash
cd /Users/cesarcamillo/dev/pruvi
bun run typecheck   # or whatever the root script is
bun test
```

Fix anything red. If the lint/typecheck scripts have a different name (e.g., `pnpm`, `turbo`), use what's defined in the root `package.json`.

- [ ] **Step 8.2: Verify all 13 acceptance criteria from spec §10**

Walk through A1–A13. Note any that cannot be verified from the implementation alone (e.g., A12 cache TTL requires inspecting `simulados.route.ts` — confirm `CURRENT_CACHE_TTL = 60` and `cache.del` on each mutating endpoint).

- [ ] **Step 8.3: Push and open PR**

```bash
git push -u origin feature/phase-2e3-simulado-semanal
gh pr create --title "feat: phase 2e.3 — simulado semanal (ultra perk, race-safe lifecycle)" --body "$(cat <<'EOF'
## Summary
- Weekly mock exam for Ultra users: 35 questions, BRT Sunday-Sunday window
- Per-subject results + up to 4 prior weeks of history
- INSERT...ON CONFLICT for idempotent /start, SELECT FOR UPDATE for race-safe /answer
- 60s cache on /current with explicit invalidation
- Ultra entitlement enforced at /current and /start only (per spec A9: Ultra-lapse mid-simulado can still finish)
- Spec: docs/superpowers/specs/2026-05-12-phase-2e3-simulado-semanal-design.md (v2 after Gate A)

## Workflow gates
- ✅ Gate A: spec self-review (6 blockers caught, fixed in v2)
- ✅ Gate B: plan self-review
- ✅ Gate C: per-task review (Opus 4.7) after every commit
- ✅ Gate D: final spec-coverage review vs full diff

## Test plan
- [ ] Repository integration tests pass (PGlite): deterministic selection, start-or-get idempotency, race-safe recordAnswer, history queries
- [ ] Service unit tests pass: entitlement gating, ultra-lapse exemption, error mapping
- [ ] Manual: GET /simulados/current returns not_started for fresh Ultra user; POST /simulados/start returns 35 questions; answering all 35 auto-completes
EOF
)"
```

---

## Self-review checklist (run before dispatch)

1. **Spec coverage:** every acceptance A1–A13 maps to at least one task. ✅ (A1 → T3/T6; A2 → T3/T4; A3 → T6/T7; A4 → T4/T6; A5 → T4; A6 → T4; A7 → T5/T6; A8 → T6; A9 → T6; A10 → T2; A11 → T2; A12 → T7; A13 → T6/T7.)
2. **Placeholder scan:** no TBDs, no "similar to Task N". ✅
3. **Type consistency:** `SimuladoRow.weekStartDate` is `string` everywhere. `SimuladoQuestionRow` has `correctOptionIndex` always set (read from join). Service strips it before returning to client. ✅
4. **Migration safety:** `0009_*` is generated by drizzle-kit; manual SQL edits not required. ✅
