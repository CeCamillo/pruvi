# Phase 2A — Topic System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a hierarchical topic model (subject → topic → subtopic), SM-2-EF-based mastery states per (user, subtopic), end-of-session mastery transitions, and a trilha API powering the gamification progression screen.

**Architecture:** Two new tables (`topic`, `subtopic`), one new column on `question` (`subtopic_id`, backfilled via a "Geral" topic+subtopic per existing subject), one new jsonb column on `daily_session` (`mastery_snapshot`). Pure `computeMastery` function in `@pruvi/shared`. New `topics` feature module with 3 endpoints. Existing `sessions` module extended to accept `topicId`, snapshot mastery at start, and surface upward transitions at complete. Live mastery computation (no materialization), Redis-cached, invalidated on each answer.

**Tech Stack:** Drizzle ORM + drizzle-kit · Fastify 5 + `fastify-type-provider-zod` · neverthrow `Result<T, AppError>` · Zod v4 in `@pruvi/shared` · Vitest unit + PGlite integration tests.

**Spec:** `docs/superpowers/specs/2026-05-10-phase-2a-topic-system-design.md`

---

## File Map

**Create:**
- `packages/shared/src/mastery.ts` — `MasteryState`, `MASTERY_THRESHOLDS`, `computeMastery`, `masteryStateRank`
- `packages/shared/src/mastery.test.ts` — unit tests for `computeMastery` + rank
- `packages/shared/src/topics.ts` — Zod schemas for trilha, topic detail, mastery list, transition
- `packages/db/src/schema/topics.ts` — `topic` + `subtopic` tables + relations
- `packages/db/src/migrations/0003_<name>.sql` — generated + hand-edited
- `apps/server/src/features/topics/topics.repository.ts`
- `apps/server/src/features/topics/topics.service.ts`
- `apps/server/src/features/topics/topics.route.ts`
- `apps/server/src/features/topics/index.ts`
- `apps/server/src/features/topics/topics.service.test.ts`
- `apps/server/src/features/topics/topics.repository.integration.test.ts`
- `apps/server/scripts/seed-demo-topics.ts`

**Modify:**
- `packages/shared/src/index.ts` — re-export mastery, topics
- `packages/shared/src/sessions.ts` — add `topicId` to `StartSessionBodySchema`
- `packages/shared/src/answers.ts` — no change (the answer endpoint cache invalidation is server-side only)
- `packages/db/src/schema/index.ts` — re-export topics
- `packages/db/src/schema/questions.ts` — add `subtopicId` FK + replace index
- `packages/db/src/schema/daily-sessions.ts` — add `masterySnapshot` jsonb
- `packages/db/src/test-client.ts` — mirror DDL for new tables/columns
- `apps/server/src/features/sessions/sessions.repository.ts` — add `selectQuestionsBySubtopic`, `writeMasterySnapshot`, `readMasterySnapshot`
- `apps/server/src/features/sessions/sessions.service.ts` — accept `topicId`, snapshot at start, compute transitions at complete
- `apps/server/src/features/sessions/sessions.route.ts` — extend Zod body & response
- `apps/server/src/features/reviews/reviews.repository.ts` — extend `findQuestionById` to surface subjectId/topicId/subtopicId for cache invalidation
- `apps/server/src/features/reviews/reviews.route.ts` — invalidate mastery/trilha/topic caches
- `apps/server/src/index.ts` — register `topicsRoutes`

---

## Task 1: Mastery pure function in `@pruvi/shared`

**Files:**
- Create: `packages/shared/src/mastery.ts`
- Create: `packages/shared/src/mastery.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/shared/src/mastery.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { computeMastery, masteryStateRank, MASTERY_THRESHOLDS } from "./mastery";

describe("computeMastery", () => {
  it("returns aprendendo when efAvg is null", () => {
    expect(computeMastery(null, 0)).toBe("aprendendo");
    expect(computeMastery(null, 50)).toBe("aprendendo");
  });

  it("returns aprendendo when reviewCount < 5 regardless of efAvg", () => {
    expect(computeMastery(3.0, 4)).toBe("aprendendo");
    expect(computeMastery(2.5, 0)).toBe("aprendendo");
  });

  it("returns aprendendo when efAvg < 2.0", () => {
    expect(computeMastery(1.99, 100)).toBe("aprendendo");
    expect(computeMastery(1.3, 50)).toBe("aprendendo");
  });

  it("returns entendendo for EF in [2.0, 2.4) with >=5 reviews", () => {
    expect(computeMastery(2.0, 5)).toBe("entendendo");
    expect(computeMastery(2.39, 10)).toBe("entendendo");
  });

  it("returns aprendendo when EF would qualify for entendendo but reviews < 5", () => {
    expect(computeMastery(2.3, 4)).toBe("aprendendo");
  });

  it("returns afiado for EF in [2.4, 2.8) with >=8 reviews", () => {
    expect(computeMastery(2.4, 8)).toBe("afiado");
    expect(computeMastery(2.79, 20)).toBe("afiado");
  });

  it("downgrades to entendendo when EF qualifies for afiado but reviews < 8", () => {
    expect(computeMastery(2.5, 7)).toBe("entendendo");
  });

  it("returns quase_mestre for EF >= 2.8 with >=12 reviews", () => {
    expect(computeMastery(2.8, 12)).toBe("quase_mestre");
    expect(computeMastery(3.0, 50)).toBe("quase_mestre");
  });

  it("downgrades to afiado when EF qualifies for quase_mestre but reviews < 12", () => {
    expect(computeMastery(2.9, 11)).toBe("afiado");
  });
});

describe("masteryStateRank", () => {
  it("orders states from aprendendo (0) to quase_mestre (3)", () => {
    expect(masteryStateRank("aprendendo")).toBe(0);
    expect(masteryStateRank("entendendo")).toBe(1);
    expect(masteryStateRank("afiado")).toBe(2);
    expect(masteryStateRank("quase_mestre")).toBe(3);
  });
});

describe("MASTERY_THRESHOLDS", () => {
  it("exposes the thresholds as a frozen-shape constant", () => {
    expect(MASTERY_THRESHOLDS.entendendo.minReviews).toBe(5);
    expect(MASTERY_THRESHOLDS.afiado.minReviews).toBe(8);
    expect(MASTERY_THRESHOLDS.quase_mestre.minReviews).toBe(12);
  });
});
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `pnpm --filter @pruvi/shared test mastery`
Expected: FAIL — `Cannot find module './mastery'`.

- [ ] **Step 3: Implement `mastery.ts`**

Create `packages/shared/src/mastery.ts`:

```typescript
export type MasteryState =
  | "aprendendo"
  | "entendendo"
  | "afiado"
  | "quase_mestre";

export const MASTERY_THRESHOLDS = {
  entendendo: { minEf: 2.0, minReviews: 5 },
  afiado: { minEf: 2.4, minReviews: 8 },
  quase_mestre: { minEf: 2.8, minReviews: 12 },
} as const;

export function computeMastery(
  efAvg: number | null,
  reviewCount: number,
): MasteryState {
  if (efAvg === null || reviewCount < MASTERY_THRESHOLDS.entendendo.minReviews) {
    return "aprendendo";
  }
  if (
    efAvg >= MASTERY_THRESHOLDS.quase_mestre.minEf &&
    reviewCount >= MASTERY_THRESHOLDS.quase_mestre.minReviews
  ) {
    return "quase_mestre";
  }
  if (
    efAvg >= MASTERY_THRESHOLDS.afiado.minEf &&
    reviewCount >= MASTERY_THRESHOLDS.afiado.minReviews
  ) {
    return "afiado";
  }
  if (efAvg >= MASTERY_THRESHOLDS.entendendo.minEf) {
    return "entendendo";
  }
  return "aprendendo";
}

const RANK: Record<MasteryState, number> = {
  aprendendo: 0,
  entendendo: 1,
  afiado: 2,
  quase_mestre: 3,
};

export function masteryStateRank(state: MasteryState): number {
  return RANK[state];
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `pnpm --filter @pruvi/shared test mastery`
Expected: PASS — all `computeMastery` boundary cases + rank tests green.

- [ ] **Step 5: Re-export from shared index**

Edit `packages/shared/src/index.ts` — append `export * from "./mastery";` (alphabetical placement is fine but match the existing ordering after `./lives`).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/mastery.ts packages/shared/src/mastery.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): mastery state + computeMastery"
```

---

## Task 2: Topics Zod schemas in `@pruvi/shared`

**Files:**
- Create: `packages/shared/src/topics.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create `topics.ts`**

```typescript
import { z } from "zod";

export const MasteryStateSchema = z.enum([
  "aprendendo",
  "entendendo",
  "afiado",
  "quase_mestre",
]);

export const SubtopicMasterySchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  slug: z.string(),
  displayOrder: z.number().int(),
  state: MasteryStateSchema,
  efAvg: z.number().nullable(),
  reviewCount: z.number().int().min(0),
});

export const TopicSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  slug: z.string(),
  displayOrder: z.number().int(),
  subtopics: z.array(SubtopicMasterySchema),
});

export const TrilhaResponseSchema = z.object({
  subject: z.object({
    id: z.number().int().positive(),
    name: z.string(),
    slug: z.string(),
  }),
  topics: z.array(TopicSchema),
});

export const TopicDetailResponseSchema = z.object({
  topic: z.object({
    id: z.number().int().positive(),
    name: z.string(),
    slug: z.string(),
    subjectId: z.number().int().positive(),
    displayOrder: z.number().int(),
  }),
  subtopics: z.array(SubtopicMasterySchema),
});

export const MasteryListItemSchema = z.object({
  subtopicId: z.number().int().positive(),
  subtopicName: z.string(),
  topicId: z.number().int().positive(),
  topicName: z.string(),
  subjectId: z.number().int().positive(),
  subjectName: z.string(),
  state: MasteryStateSchema,
  efAvg: z.number().nullable(),
  reviewCount: z.number().int().min(0),
});

export const MasteryListResponseSchema = z.object({
  items: z.array(MasteryListItemSchema),
});

export const MasteryTransitionSchema = z.object({
  subtopicId: z.number().int().positive(),
  name: z.string(),
  from: MasteryStateSchema,
  to: MasteryStateSchema,
});

export type MasteryListItem = z.infer<typeof MasteryListItemSchema>;
export type SubtopicMastery = z.infer<typeof SubtopicMasterySchema>;
export type TrilhaResponse = z.infer<typeof TrilhaResponseSchema>;
export type TopicDetailResponse = z.infer<typeof TopicDetailResponseSchema>;
export type MasteryTransition = z.infer<typeof MasteryTransitionSchema>;
```

- [ ] **Step 2: Re-export from index**

Edit `packages/shared/src/index.ts` — append `export * from "./topics";`.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @pruvi/shared check-types`
Expected: PASS — no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/topics.ts packages/shared/src/index.ts
git commit -m "feat(shared): topics zod schemas"
```

---

## Task 3: Add `topicId` to `StartSessionBodySchema`

**Files:**
- Modify: `packages/shared/src/sessions.ts`

- [ ] **Step 1: Edit schema**

Replace the file with:

```typescript
import { z } from "zod";

/** POST /sessions/start — request body */
export const StartSessionBodySchema = z.object({
  mode: z.enum(["all", "theoretical"]).default("all"),
  topicId: z.number().int().positive().optional(),
});

export type StartSessionBody = z.infer<typeof StartSessionBodySchema>;
```

Note: `topicId` is the public API name; it carries a `subtopic.id` value. The trilha treats subtopics as leaf "topic" nodes for the user; the server maps it to `subtopic_id` internally.

- [ ] **Step 2: Typecheck shared**

Run: `pnpm --filter @pruvi/shared check-types`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/sessions.ts
git commit -m "feat(shared): start session accepts topicId"
```

---

## Task 4: DB schema — `topic` + `subtopic` tables

**Files:**
- Create: `packages/db/src/schema/topics.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create the tables**

`packages/db/src/schema/topics.ts`:

```typescript
import { relations } from "drizzle-orm";
import { index, integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

import { subject } from "./subjects";

export const topic = pgTable(
  "topic",
  {
    id: serial("id").primaryKey(),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subject.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("topic_subject_slug_uniq").on(table.subjectId, table.slug),
    index("topic_subject_order_idx").on(table.subjectId, table.displayOrder),
  ],
);

export const subtopic = pgTable(
  "subtopic",
  {
    id: serial("id").primaryKey(),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topic.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("subtopic_topic_slug_uniq").on(table.topicId, table.slug),
    index("subtopic_topic_order_idx").on(table.topicId, table.displayOrder),
  ],
);

export const topicRelations = relations(topic, ({ one, many }) => ({
  subject: one(subject, {
    fields: [topic.subjectId],
    references: [subject.id],
  }),
  subtopics: many(subtopic),
}));

export const subtopicRelations = relations(subtopic, ({ one }) => ({
  topic: one(topic, {
    fields: [subtopic.topicId],
    references: [topic.id],
  }),
}));
```

- [ ] **Step 2: Re-export**

Edit `packages/db/src/schema/index.ts` — append `export * from "./topics";` (after `./subjects` to keep the import-order intuitive).

- [ ] **Step 3: Commit (pre-migration checkpoint)**

```bash
git add packages/db/src/schema/topics.ts packages/db/src/schema/index.ts
git commit -m "feat(db): topic + subtopic tables"
```

---

## Task 5: DB schema — `question.subtopicId` + `daily_session.masterySnapshot`

**Files:**
- Modify: `packages/db/src/schema/questions.ts`
- Modify: `packages/db/src/schema/daily-sessions.ts`

- [ ] **Step 1: Add `subtopicId` to `question`**

Replace `packages/db/src/schema/questions.ts`:

```typescript
import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

import { subject } from "./subjects";
import { subtopic } from "./topics";

export const question = pgTable(
  "question",
  {
    id: serial("id").primaryKey(),
    content: text("content").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    correctOptionIndex: integer("correct_option_index").notNull(),
    difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] }).notNull(),
    requiresCalculation: boolean("requires_calculation").notNull().default(false),
    explanation: text("explanation"),
    source: text("source"),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subject.id),
    subtopicId: integer("subtopic_id")
      .notNull()
      .references(() => subtopic.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("question_subject_difficulty_idx").on(table.subjectId, table.difficulty),
    index("question_subtopic_difficulty_idx").on(table.subtopicId, table.difficulty),
  ],
);

export const questionRelations = relations(question, ({ one }) => ({
  subject: one(subject, {
    fields: [question.subjectId],
    references: [subject.id],
  }),
  subtopic: one(subtopic, {
    fields: [question.subtopicId],
    references: [subtopic.id],
  }),
}));
```

- [ ] **Step 2: Add `masterySnapshot` to `daily_session`**

Replace `packages/db/src/schema/daily-sessions.ts`:

```typescript
import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";
import type { MasteryState } from "@pruvi/shared";

export const dailySession = pgTable(
  "daily_session",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["active", "completed"] }).notNull().default("active"),
    questionsAnswered: integer("questions_answered").notNull().default(0),
    questionsCorrect: integer("questions_correct").notNull().default(0),
    masterySnapshot: jsonb("mastery_snapshot").$type<Record<string, MasteryState>>(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("daily_session_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const dailySessionRelations = relations(dailySession, ({ one }) => ({
  user: one(user, {
    fields: [dailySession.userId],
    references: [user.id],
  }),
}));
```

The jsonb shape `Record<string, MasteryState>` uses stringified subtopicId keys (JSON object keys must be strings).

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @pruvi/db check-types`
Expected: PASS — schema files type-clean.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/questions.ts packages/db/src/schema/daily-sessions.ts
git commit -m "feat(db): question.subtopic_id + daily_session.mastery_snapshot"
```

---

## Task 6: Generate + hand-edit migration

**Files:**
- Create: `packages/db/src/migrations/0003_<adjective>_<noun>.sql` (drizzle-kit names it)

- [ ] **Step 1: Run drizzle-kit generate**

```bash
pnpm --filter @pruvi/db db:generate
```

Expected output: a new `.sql` file under `packages/db/src/migrations/` (file 0003) and a snapshot json under `meta/`.

- [ ] **Step 2: Inspect generated migration**

Read the generated file. drizzle-kit will produce:
- `CREATE TABLE topic` + `CREATE TABLE subtopic`
- `ALTER TABLE question ADD COLUMN subtopic_id integer NOT NULL ...`  ← this fails on a non-empty table
- `ALTER TABLE daily_session ADD COLUMN mastery_snapshot jsonb`

We need to replace the single NOT NULL ADD with a 3-step backfill.

- [ ] **Step 3: Hand-edit the migration**

Open the generated SQL file. Replace the `ALTER TABLE question ADD COLUMN subtopic_id ...` block with the following (keep the `--> statement-breakpoint` separators between statements — the runner splits on them):

```sql
ALTER TABLE "question" ADD COLUMN "subtopic_id" integer;--> statement-breakpoint

-- Seed Geral topic + subtopic per existing subject
INSERT INTO "topic" (subject_id, name, slug, display_order)
SELECT id, 'Geral', 'geral', 0 FROM "subject"
ON CONFLICT (subject_id, slug) DO NOTHING;--> statement-breakpoint

INSERT INTO "subtopic" (topic_id, name, slug, display_order)
SELECT t.id, 'Geral', 'geral', 0
FROM "topic" t
WHERE t.slug = 'geral'
ON CONFLICT (topic_id, slug) DO NOTHING;--> statement-breakpoint

-- Backfill existing questions to the Geral subtopic of their subject
UPDATE "question" q
SET subtopic_id = s.id
FROM "topic" t
JOIN "subtopic" s ON s.topic_id = t.id AND s.slug = 'geral'
WHERE t.subject_id = q.subject_id
  AND t.slug = 'geral'
  AND q.subtopic_id IS NULL;--> statement-breakpoint

ALTER TABLE "question" ALTER COLUMN "subtopic_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "question" ADD CONSTRAINT "question_subtopic_id_subtopic_id_fk"
  FOREIGN KEY ("subtopic_id") REFERENCES "subtopic"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "question_subtopic_difficulty_idx" ON "question" ("subtopic_id", "difficulty");
```

Confirm `CREATE TABLE topic` and `CREATE TABLE subtopic` appear **before** these question alterations. If drizzle-kit ordered them after, reorder so the create-tables come first.

- [ ] **Step 4: Apply migration locally**

```bash
docker compose -f packages/db/docker-compose.yml up -d   # ensure pg is up
pnpm --filter @pruvi/db db:migrate
```

Expected: migration applies cleanly, no errors. `psql ... -c "\d question"` shows `subtopic_id` NOT NULL with FK.

- [ ] **Step 5: Smoke check**

```bash
pnpm verify:migration
```

Expected: PASS — all tables queryable.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/migrations/
git commit -m "feat(db): migration 0003 — topics + subtopics + question.subtopic_id"
```

---

## Task 7: Mirror DDL in PGlite test client

**Files:**
- Modify: `packages/db/src/test-client.ts`

- [ ] **Step 1: Add tables + columns to the DDL string**

In `packages/db/src/test-client.ts`, append the following before the closing `` ` `` of the SQL template (after `daily_session` block):

```sql
    CREATE TABLE IF NOT EXISTS "topic" (
      id SERIAL PRIMARY KEY,
      subject_id INTEGER NOT NULL REFERENCES "subject"(id),
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (subject_id, slug)
    );

    CREATE TABLE IF NOT EXISTS "subtopic" (
      id SERIAL PRIMARY KEY,
      topic_id INTEGER NOT NULL REFERENCES "topic"(id),
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (topic_id, slug)
    );
```

Replace the existing `CREATE TABLE IF NOT EXISTS "question"` block with one that includes `subtopic_id`:

```sql
    CREATE TABLE IF NOT EXISTS "question" (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      options JSONB NOT NULL,
      correct_option_index INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      requires_calculation BOOLEAN NOT NULL DEFAULT FALSE,
      explanation TEXT,
      source TEXT,
      subject_id INTEGER NOT NULL REFERENCES "subject"(id),
      subtopic_id INTEGER NOT NULL REFERENCES "subtopic"(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
```

Add `mastery_snapshot` to the `daily_session` block:

```sql
    CREATE TABLE IF NOT EXISTS "daily_session" (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'active',
      questions_answered INTEGER NOT NULL DEFAULT 0,
      questions_correct INTEGER NOT NULL DEFAULT 0,
      mastery_snapshot JSONB,
      completed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
```

Order matters: `topic` must precede `subtopic`, both must precede `question`.

- [ ] **Step 2: Run existing PGlite-backed unit tests to confirm nothing breaks**

```bash
pnpm --filter server test sessions
```

Expected: existing sessions service tests still pass.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/test-client.ts
git commit -m "chore(db): mirror topics ddl in pglite test client"
```

---

## Task 8: Topics repository

**Files:**
- Create: `apps/server/src/features/topics/topics.repository.ts`
- Create: `apps/server/src/features/topics/topics.repository.integration.test.ts`

- [ ] **Step 1: Write the failing integration tests**

`apps/server/src/features/topics/topics.repository.integration.test.ts`:

```typescript
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { setupTestDb, getTestDb, getTestPool } from "../../test/db-helpers";
import { subject } from "@pruvi/db/schema/subjects";
import { topic, subtopic } from "@pruvi/db/schema/topics";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import { user } from "@pruvi/db/schema/auth";
import { TopicsRepository } from "./topics.repository";

const db = getTestDb();
const repo = new TopicsRepository(db);

const USER_ID = "user_topics_repo_test";

async function seed() {
  // Subject
  const [sub] = await db.insert(subject).values({ name: "Biologia", slug: "biologia" }).returning();
  // Topic + subtopics
  const [t] = await db.insert(topic).values({ subjectId: sub.id, name: "Citologia", slug: "citologia", displayOrder: 0 }).returning();
  const [stA] = await db.insert(subtopic).values({ topicId: t.id, name: "Membrana", slug: "membrana", displayOrder: 0 }).returning();
  const [stB] = await db.insert(subtopic).values({ topicId: t.id, name: "Citoplasma", slug: "citoplasma", displayOrder: 1 }).returning();
  // Question in subtopic A
  const [q] = await db.insert(question).values({
    content: "Q?",
    options: ["a","b","c","d"],
    correctOptionIndex: 0,
    difficulty: "medium",
    subjectId: sub.id,
    subtopicId: stA.id,
  }).returning();
  // User
  await db.insert(user).values({ id: USER_ID, name: "T", email: `${USER_ID}@x.com` });
  return { sub, t, stA, stB, q };
}

async function clearAll() {
  await db.delete(reviewLog);
  await db.delete(question);
  await db.delete(subtopic);
  await db.delete(topic);
  await db.delete(subject);
  await db.delete(user).where(eq(user.id, USER_ID));
}

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await getTestPool().end();
});

beforeEach(async () => {
  await clearAll();
});

describe("TopicsRepository.getTrilha", () => {
  it("returns nested subject → topics → subtopics shape", async () => {
    const { sub } = await seed();
    const result = await repo.getTrilha(USER_ID, sub.id);
    expect(result).not.toBeNull();
    expect(result!.subject.slug).toBe("biologia");
    expect(result!.topics).toHaveLength(1);
    expect(result!.topics[0].subtopics).toHaveLength(2);
    // Subtopics in displayOrder
    expect(result!.topics[0].subtopics[0].slug).toBe("membrana");
    expect(result!.topics[0].subtopics[1].slug).toBe("citoplasma");
    // No reviews yet → all aprendendo, efAvg null, reviewCount 0
    expect(result!.topics[0].subtopics[0].state).toBe("aprendendo");
    expect(result!.topics[0].subtopics[0].efAvg).toBeNull();
    expect(result!.topics[0].subtopics[0].reviewCount).toBe(0);
  });

  it("rolls up review_log entries into ef_avg and reviewCount per subtopic", async () => {
    const { stA, q } = await seed();
    // Insert 5 reviews with avg EF 2.5
    const efs = ["2.3","2.4","2.5","2.6","2.7"];
    for (const ef of efs) {
      await db.insert(reviewLog).values({
        userId: USER_ID,
        questionId: q.id,
        quality: 4,
        easinessFactor: ef,
        interval: 1,
        repetitions: 1,
        nextReviewAt: new Date(),
      });
    }
    const map = await repo.getMasteryBySubtopics(USER_ID, [stA.id]);
    expect(map.get(stA.id)?.reviewCount).toBe(5);
    expect(map.get(stA.id)?.efAvg).toBeCloseTo(2.5, 1);
  });

  it("getAllSubtopicMasteryForUser returns a flat list across all subjects", async () => {
    await seed();
    const items = await repo.getAllSubtopicMasteryForUser(USER_ID, null);
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]).toHaveProperty("subtopicId");
    expect(items[0]).toHaveProperty("topicId");
    expect(items[0]).toHaveProperty("subjectId");
  });

  it("getAllSubtopicMasteryForUser filters by subjectId", async () => {
    const { sub } = await seed();
    const items = await repo.getAllSubtopicMasteryForUser(USER_ID, sub.id);
    expect(items.every((i) => i.subjectId === sub.id)).toBe(true);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm --filter server test:integration topics`
Expected: FAIL — `Cannot find module './topics.repository'`.

- [ ] **Step 3: Implement repository**

`apps/server/src/features/topics/topics.repository.ts`:

```typescript
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { subject } from "@pruvi/db/schema/subjects";
import { topic, subtopic } from "@pruvi/db/schema/topics";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export type MasteryRow = { efAvg: number | null; reviewCount: number };

export type TrilhaRow = {
  subject: { id: number; name: string; slug: string };
  topics: Array<{
    id: number;
    name: string;
    slug: string;
    displayOrder: number;
    subtopics: Array<{
      id: number;
      name: string;
      slug: string;
      displayOrder: number;
      efAvg: number | null;
      reviewCount: number;
    }>;
  }>;
};

export class TopicsRepository {
  constructor(private db: DbClient) {}

  /** Return one subject with its topics + subtopics, merged with mastery rollup for `userId`. */
  async getTrilha(userId: string, subjectId: number): Promise<TrilhaRow | null> {
    const [sub] = await this.db
      .select({ id: subject.id, name: subject.name, slug: subject.slug })
      .from(subject)
      .where(eq(subject.id, subjectId))
      .limit(1);
    if (!sub) return null;

    const topics = await this.db
      .select({
        id: topic.id,
        name: topic.name,
        slug: topic.slug,
        displayOrder: topic.displayOrder,
      })
      .from(topic)
      .where(eq(topic.subjectId, subjectId))
      .orderBy(asc(topic.displayOrder), asc(topic.id));

    if (topics.length === 0) {
      return { subject: sub, topics: [] };
    }

    const topicIds = topics.map((t) => t.id);
    const subtopics = await this.db
      .select({
        id: subtopic.id,
        topicId: subtopic.topicId,
        name: subtopic.name,
        slug: subtopic.slug,
        displayOrder: subtopic.displayOrder,
      })
      .from(subtopic)
      .where(inArray(subtopic.topicId, topicIds))
      .orderBy(asc(subtopic.displayOrder), asc(subtopic.id));

    const subtopicIds = subtopics.map((s) => s.id);
    const masteryMap = subtopicIds.length
      ? await this.getMasteryBySubtopics(userId, subtopicIds)
      : new Map<number, MasteryRow>();

    return {
      subject: sub,
      topics: topics.map((t) => ({
        ...t,
        subtopics: subtopics
          .filter((s) => s.topicId === t.id)
          .map((s) => {
            const m = masteryMap.get(s.id);
            return {
              id: s.id,
              name: s.name,
              slug: s.slug,
              displayOrder: s.displayOrder,
              efAvg: m?.efAvg ?? null,
              reviewCount: m?.reviewCount ?? 0,
            };
          }),
      })),
    };
  }

  /** Topic detail with its subtopics + mastery for `userId`. */
  async getTopicDetail(userId: string, topicId: number) {
    const [t] = await this.db
      .select({
        id: topic.id,
        name: topic.name,
        slug: topic.slug,
        subjectId: topic.subjectId,
        displayOrder: topic.displayOrder,
      })
      .from(topic)
      .where(eq(topic.id, topicId))
      .limit(1);
    if (!t) return null;

    const subtopics = await this.db
      .select({
        id: subtopic.id,
        name: subtopic.name,
        slug: subtopic.slug,
        displayOrder: subtopic.displayOrder,
      })
      .from(subtopic)
      .where(eq(subtopic.topicId, topicId))
      .orderBy(asc(subtopic.displayOrder), asc(subtopic.id));

    const ids = subtopics.map((s) => s.id);
    const masteryMap = ids.length
      ? await this.getMasteryBySubtopics(userId, ids)
      : new Map<number, MasteryRow>();

    return {
      topic: t,
      subtopics: subtopics.map((s) => {
        const m = masteryMap.get(s.id);
        return {
          ...s,
          efAvg: m?.efAvg ?? null,
          reviewCount: m?.reviewCount ?? 0,
        };
      }),
    };
  }

  /** SM-2 ef-avg + review_count rollup per subtopic, scoped to `userId`. */
  async getMasteryBySubtopics(
    userId: string,
    subtopicIds: number[],
  ): Promise<Map<number, MasteryRow>> {
    if (subtopicIds.length === 0) return new Map();
    const rows = await this.db
      .select({
        subtopicId: question.subtopicId,
        efAvg: sql<string | null>`avg(${reviewLog.easinessFactor})`,
        reviewCount: sql<string>`count(*)`,
      })
      .from(reviewLog)
      .innerJoin(question, eq(question.id, reviewLog.questionId))
      .where(
        and(
          eq(reviewLog.userId, userId),
          inArray(question.subtopicId, subtopicIds),
        ),
      )
      .groupBy(question.subtopicId);

    const map = new Map<number, MasteryRow>();
    for (const row of rows) {
      map.set(row.subtopicId, {
        efAvg: row.efAvg === null ? null : Number(row.efAvg),
        reviewCount: Number(row.reviewCount),
      });
    }
    return map;
  }

  /** Flat list of all subtopic mastery for the user, optionally filtered by subjectId. */
  async getAllSubtopicMasteryForUser(
    userId: string,
    subjectIdFilter: number | null,
  ) {
    const baseSelect = this.db
      .select({
        subtopicId: subtopic.id,
        subtopicName: subtopic.name,
        topicId: topic.id,
        topicName: topic.name,
        subjectId: subject.id,
        subjectName: subject.name,
      })
      .from(subtopic)
      .innerJoin(topic, eq(topic.id, subtopic.topicId))
      .innerJoin(subject, eq(subject.id, topic.subjectId));

    const rows = subjectIdFilter
      ? await baseSelect.where(eq(subject.id, subjectIdFilter)).orderBy(asc(subject.id), asc(topic.displayOrder), asc(subtopic.displayOrder))
      : await baseSelect.orderBy(asc(subject.id), asc(topic.displayOrder), asc(subtopic.displayOrder));

    if (rows.length === 0) return [];

    const masteryMap = await this.getMasteryBySubtopics(userId, rows.map((r) => r.subtopicId));
    return rows.map((r) => {
      const m = masteryMap.get(r.subtopicId);
      return {
        ...r,
        efAvg: m?.efAvg ?? null,
        reviewCount: m?.reviewCount ?? 0,
      };
    });
  }

  /** Return subtopic ids for a topic (used by sessions when filtering questions by topicId). */
  async findSubtopicById(subtopicId: number) {
    const [row] = await this.db
      .select({ id: subtopic.id, topicId: subtopic.topicId, name: subtopic.name })
      .from(subtopic)
      .where(eq(subtopic.id, subtopicId))
      .limit(1);
    return row ?? null;
  }
}
```

- [ ] **Step 4: Run integration tests, confirm pass**

Run: `pnpm --filter server test:integration topics`
Expected: PASS — all 4 cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/features/topics/topics.repository.ts apps/server/src/features/topics/topics.repository.integration.test.ts
git commit -m "feat(topics): repository with tree + mastery rollup"
```

---

## Task 9: Topics service (transitions + orchestration)

**Files:**
- Create: `apps/server/src/features/topics/topics.service.ts`
- Create: `apps/server/src/features/topics/topics.service.test.ts`

- [ ] **Step 1: Write failing unit tests**

`apps/server/src/features/topics/topics.service.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { TopicsService } from "./topics.service";
import type { TopicsRepository } from "./topics.repository";
import { type MasteryState } from "@pruvi/shared";

function makeRepoStub(overrides: Partial<TopicsRepository> = {}) {
  return overrides as unknown as TopicsRepository;
}

describe("TopicsService.computeTransitions", () => {
  const service = new TopicsService(makeRepoStub());

  it("returns empty when snapshot is null", () => {
    const result = service.computeTransitions(null, new Map(), new Map());
    expect(result).toEqual([]);
  });

  it("emits one entry per upward transition with name lookup", () => {
    const snapshot: Record<string, MasteryState> = { "1": "aprendendo", "2": "entendendo" };
    const current = new Map<number, MasteryState>([[1, "entendendo"], [2, "afiado"]]);
    const names = new Map<number, string>([[1, "Membrana"], [2, "Citoplasma"]]);
    const result = service.computeTransitions(snapshot, current, names);
    expect(result).toEqual([
      { subtopicId: 1, name: "Membrana", from: "aprendendo", to: "entendendo" },
      { subtopicId: 2, name: "Citoplasma", from: "entendendo", to: "afiado" },
    ]);
  });

  it("skips unchanged states", () => {
    const snapshot: Record<string, MasteryState> = { "1": "afiado" };
    const current = new Map<number, MasteryState>([[1, "afiado"]]);
    const names = new Map<number, string>([[1, "X"]]);
    expect(service.computeTransitions(snapshot, current, names)).toEqual([]);
  });

  it("skips downward transitions", () => {
    const snapshot: Record<string, MasteryState> = { "1": "afiado" };
    const current = new Map<number, MasteryState>([[1, "entendendo"]]);
    const names = new Map<number, string>([[1, "X"]]);
    expect(service.computeTransitions(snapshot, current, names)).toEqual([]);
  });

  it("emits a transition with name fallback when the names map lacks the id", () => {
    const snapshot: Record<string, MasteryState> = { "1": "aprendendo" };
    const current = new Map<number, MasteryState>([[1, "entendendo"]]);
    expect(service.computeTransitions(snapshot, current, new Map())).toEqual([
      { subtopicId: 1, name: "", from: "aprendendo", to: "entendendo" },
    ]);
  });
});

describe("TopicsService.snapshotMastery", () => {
  it("returns a record keyed by stringified subtopic id with computed state", async () => {
    const repo = makeRepoStub({
      getMasteryBySubtopics: vi.fn().mockResolvedValue(
        new Map([
          [1, { efAvg: 2.5, reviewCount: 8 }],
          [2, { efAvg: null, reviewCount: 0 }],
        ]),
      ),
    });
    const service = new TopicsService(repo);
    const snapshot = await service.snapshotMastery("user_1", [1, 2]);
    expect(snapshot).toEqual({ "1": "afiado", "2": "aprendendo" });
  });

  it("returns empty record for empty input", async () => {
    const service = new TopicsService(makeRepoStub());
    const snapshot = await service.snapshotMastery("user_1", []);
    expect(snapshot).toEqual({});
  });
});

describe("TopicsService.getTrilha", () => {
  it("merges repo mastery rows into states via computeMastery", async () => {
    const repo = makeRepoStub({
      getTrilha: vi.fn().mockResolvedValue({
        subject: { id: 1, name: "Biologia", slug: "biologia" },
        topics: [
          {
            id: 5,
            name: "Citologia",
            slug: "citologia",
            displayOrder: 0,
            subtopics: [
              { id: 10, name: "Membrana", slug: "membrana", displayOrder: 0, efAvg: 2.5, reviewCount: 8 },
              { id: 11, name: "Núcleo", slug: "nucleo", displayOrder: 1, efAvg: null, reviewCount: 0 },
            ],
          },
        ],
      }),
    });
    const service = new TopicsService(repo);
    const result = await service.getTrilha("user_1", 1);
    expect(result.isOk()).toBe(true);
    const trilha = result._unsafeUnwrap();
    expect(trilha.topics[0].subtopics[0].state).toBe("afiado");
    expect(trilha.topics[0].subtopics[1].state).toBe("aprendendo");
  });

  it("returns NotFoundError when subject doesn't exist", async () => {
    const repo = makeRepoStub({ getTrilha: vi.fn().mockResolvedValue(null) });
    const service = new TopicsService(repo);
    const result = await service.getTrilha("user_1", 999);
    expect(result.isErr()).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `pnpm --filter server test topics.service`
Expected: FAIL — `Cannot find module './topics.service'`.

- [ ] **Step 3: Implement service**

`apps/server/src/features/topics/topics.service.ts`:

```typescript
import { err, ok, type Result } from "neverthrow";
import {
  computeMastery,
  masteryStateRank,
  type MasteryState,
  type MasteryTransition,
} from "@pruvi/shared";
import { NotFoundError, type AppError } from "../../utils/errors";
import type { TopicsRepository } from "./topics.repository";

export class TopicsService {
  constructor(private repo: TopicsRepository) {}

  async getTrilha(
    userId: string,
    subjectId: number,
  ): Promise<Result<{
    subject: { id: number; name: string; slug: string };
    topics: Array<{
      id: number;
      name: string;
      slug: string;
      displayOrder: number;
      subtopics: Array<{
        id: number;
        name: string;
        slug: string;
        displayOrder: number;
        state: MasteryState;
        efAvg: number | null;
        reviewCount: number;
      }>;
    }>;
  }, AppError>> {
    const row = await this.repo.getTrilha(userId, subjectId);
    if (!row) {
      return err(new NotFoundError("Subject not found"));
    }
    return ok({
      subject: row.subject,
      topics: row.topics.map((t) => ({
        ...t,
        subtopics: t.subtopics.map((s) => ({
          ...s,
          state: computeMastery(s.efAvg, s.reviewCount),
        })),
      })),
    });
  }

  async getTopicDetail(userId: string, topicId: number) {
    const row = await this.repo.getTopicDetail(userId, topicId);
    if (!row) {
      return err(new NotFoundError("Topic not found"));
    }
    return ok({
      topic: row.topic,
      subtopics: row.subtopics.map((s) => ({
        ...s,
        state: computeMastery(s.efAvg, s.reviewCount),
      })),
    });
  }

  async getUserMastery(userId: string, subjectId: number | null) {
    const rows = await this.repo.getAllSubtopicMasteryForUser(userId, subjectId);
    return ok({
      items: rows.map((r) => ({
        ...r,
        state: computeMastery(r.efAvg, r.reviewCount),
      })),
    });
  }

  /** Compute mastery state per subtopicId and return a snapshot record (string keys for jsonb). */
  async snapshotMastery(
    userId: string,
    subtopicIds: number[],
  ): Promise<Record<string, MasteryState>> {
    if (subtopicIds.length === 0) return {};
    const masteryMap = await this.repo.getMasteryBySubtopics(userId, subtopicIds);
    const out: Record<string, MasteryState> = {};
    for (const id of subtopicIds) {
      const m = masteryMap.get(id);
      out[String(id)] = computeMastery(m?.efAvg ?? null, m?.reviewCount ?? 0);
    }
    return out;
  }

  /** Diff a snapshot vs. current state map. Returns only upward transitions. */
  computeTransitions(
    snapshot: Record<string, MasteryState> | null,
    current: Map<number, MasteryState>,
    names: Map<number, string>,
  ): MasteryTransition[] {
    if (!snapshot) return [];
    const out: MasteryTransition[] = [];
    for (const [idStr, from] of Object.entries(snapshot)) {
      const id = Number(idStr);
      const to = current.get(id);
      if (!to) continue;
      if (masteryStateRank(to) > masteryStateRank(from)) {
        out.push({
          subtopicId: id,
          name: names.get(id) ?? "",
          from,
          to,
        });
      }
    }
    return out;
  }
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `pnpm --filter server test topics.service`
Expected: PASS — all transition + snapshot tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/features/topics/topics.service.ts apps/server/src/features/topics/topics.service.test.ts
git commit -m "feat(topics): service with mastery merge + transitions"
```

---

## Task 10: Topics routes + module index

**Files:**
- Create: `apps/server/src/features/topics/topics.route.ts`
- Create: `apps/server/src/features/topics/index.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Create routes**

`apps/server/src/features/topics/topics.route.ts`:

```typescript
import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";
import { TopicsRepository } from "./topics.repository";
import { TopicsService } from "./topics.service";

const repo = new TopicsRepository(db);
const service = new TopicsService(repo);

const TRILHA_TTL = 300;     // 5 min
const TOPIC_TTL = 300;
const MASTERY_TTL = 300;

export const topicsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/subjects/:subjectId/trilha",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ subjectId: z.coerce.number().int().positive() }),
      },
    },
    async (request) => {
      const { subjectId } = request.params;
      const cacheKey = `trilha:${request.userId}:${subjectId}`;
      const cached = await fastify.cache.get<unknown>(cacheKey);
      if (cached) return successResponse(cached);

      const result = await service.getTrilha(request.userId, subjectId);
      const response = unwrapResult(result);
      await fastify.cache.set(cacheKey, response.data, TRILHA_TTL);
      return response;
    },
  );

  fastify.get(
    "/topics/:topicId",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ topicId: z.coerce.number().int().positive() }),
      },
    },
    async (request) => {
      const { topicId } = request.params;
      const cacheKey = `topic:${request.userId}:${topicId}`;
      const cached = await fastify.cache.get<unknown>(cacheKey);
      if (cached) return successResponse(cached);

      const result = await service.getTopicDetail(request.userId, topicId);
      const response = unwrapResult(result);
      await fastify.cache.set(cacheKey, response.data, TOPIC_TTL);
      return response;
    },
  );

  fastify.get(
    "/users/me/mastery",
    {
      preHandler: [fastify.authenticate],
      schema: {
        querystring: z.object({
          subjectId: z.coerce.number().int().positive().optional(),
        }),
      },
    },
    async (request) => {
      const subjectId = request.query.subjectId ?? null;
      const cacheKey = `mastery:${request.userId}:${subjectId ?? "all"}`;
      const cached = await fastify.cache.get<unknown>(cacheKey);
      if (cached) return successResponse(cached);

      const result = await service.getUserMastery(request.userId, subjectId);
      const response = unwrapResult(result);
      await fastify.cache.set(cacheKey, response.data, MASTERY_TTL);
      return response;
    },
  );
};
```

- [ ] **Step 2: Create module index**

`apps/server/src/features/topics/index.ts`:

```typescript
export { topicsRoutes } from "./topics.route";
```

- [ ] **Step 3: Register routes in server**

Edit `apps/server/src/index.ts` — add the import alongside the others (alphabetical placement after `./features/subjects`):

```typescript
import { topicsRoutes } from "./features/topics";
```

Find the block where routes are registered (search for `sessionsRoutes` registration) and add `await app.register(topicsRoutes);` adjacent to the other feature registrations.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter server check-types`
Expected: PASS.

- [ ] **Step 5: Boot smoke test**

Run: `pnpm dev:server` for a few seconds, confirm no startup errors, then kill it.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/features/topics/topics.route.ts apps/server/src/features/topics/index.ts apps/server/src/index.ts
git commit -m "feat(topics): 3 endpoints (trilha, topic detail, mastery list)"
```

---

## Task 11: Sessions repository — subtopic-filtered question selection + snapshot helpers

**Files:**
- Modify: `apps/server/src/features/sessions/sessions.repository.ts`

- [ ] **Step 1: Read current repository**

Open `apps/server/src/features/sessions/sessions.repository.ts`. It currently exports `findTodaySession`, `createSession`, `completeSession`, `findSessionById`. We're extending it.

- [ ] **Step 2: Add helpers**

Append the following methods inside the `SessionsRepository` class (before the closing `}`):

```typescript
  /** Snapshot mastery state for the session (called at start). */
  async writeMasterySnapshot(
    sessionId: number,
    snapshot: Record<string, "aprendendo" | "entendendo" | "afiado" | "quase_mestre">,
  ) {
    await this.db
      .update(dailySession)
      .set({ masterySnapshot: snapshot })
      .where(eq(dailySession.id, sessionId));
  }

  /** Read the snapshot (used at complete to compute transitions). */
  async readMasterySnapshot(sessionId: number) {
    const [row] = await this.db
      .select({ snapshot: dailySession.masterySnapshot })
      .from(dailySession)
      .where(eq(dailySession.id, sessionId))
      .limit(1);
    return row?.snapshot ?? null;
  }
```

- [ ] **Step 3: Add question selector by subtopic in questions feature**

Open `apps/server/src/features/questions/questions.repository.ts`. Add a method `selectQuestionsBySubtopic`. The existing `selectQuestions` is mode-based and returns questions excluding `correctOptionIndex` for safe transport.

Append to the `QuestionsRepository` class:

```typescript
  /** Select questions filtered by subtopic. Returns the same projection as selectQuestions. */
  async selectQuestionsBySubtopic(subtopicId: number, limit: number) {
    return this.db
      .select({
        id: question.id,
        content: question.content,
        options: question.options,
        difficulty: question.difficulty,
        requiresCalculation: question.requiresCalculation,
        source: question.source,
        subjectId: question.subjectId,
        subtopicId: question.subtopicId,
      })
      .from(question)
      .where(eq(question.subtopicId, subtopicId))
      .limit(limit);
  }
```

Make sure `question` is imported in this file (check the existing imports — `subtopicId` projection only requires that the column exists in the schema, which Task 5 added).

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter server check-types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/features/sessions/sessions.repository.ts apps/server/src/features/questions/questions.repository.ts
git commit -m "feat(sessions): subtopic question selector + snapshot helpers"
```

---

## Task 12: Sessions service — accept `topicId` and snapshot at start

**Files:**
- Modify: `apps/server/src/features/sessions/sessions.service.ts`
- Modify: `apps/server/src/features/sessions/sessions.service.test.ts`

- [ ] **Step 1: Write/extend failing tests**

Open the existing test file. Add this describe block at the end (do not remove existing tests):

```typescript
import { TopicsService } from "../topics/topics.service";

describe("SessionsService.startSession with topicId", () => {
  it("filters questions by subtopic and snapshots mastery for the touched subtopics", async () => {
    const sessionRepo = {
      findTodaySession: vi.fn().mockResolvedValue(null),
      createSession: vi.fn().mockResolvedValue({ id: 42, userId: "u1", status: "active", questionsAnswered: 0, questionsCorrect: 0, completedAt: null, createdAt: new Date(), masterySnapshot: null }),
      writeMasterySnapshot: vi.fn().mockResolvedValue(undefined),
    } as any;

    const questionsService = {
      selectForSession: vi.fn(),
      selectForSubtopic: vi.fn().mockResolvedValue({
        isErr: () => false,
        isOk: () => true,
        value: [{ id: 1, subtopicId: 7 }, { id: 2, subtopicId: 7 }],
        error: undefined,
      }),
    } as any;

    const topicsService = {
      snapshotMastery: vi.fn().mockResolvedValue({ "7": "aprendendo" }),
    } as any;

    const service = new SessionsService(sessionRepo, questionsService, topicsService);
    const result = await service.startSession("u1", "all", false, 7);

    expect(result.isOk()).toBe(true);
    expect(questionsService.selectForSubtopic).toHaveBeenCalledWith("u1", 7);
    expect(topicsService.snapshotMastery).toHaveBeenCalledWith("u1", [7]);
    expect(sessionRepo.writeMasterySnapshot).toHaveBeenCalledWith(42, { "7": "aprendendo" });
  });
});
```

(Add `import { vi } from "vitest"` at the top if not present.)

- [ ] **Step 2: Run tests, confirm failure**

Run: `pnpm --filter server test sessions.service`
Expected: FAIL — constructor signature mismatch / `selectForSubtopic` doesn't exist.

- [ ] **Step 3: Add `selectForSubtopic` to the questions service**

Open `apps/server/src/features/questions/questions.service.ts`. Add:

```typescript
  /** Select questions for a focused (subtopic) session. */
  async selectForSubtopic(userId: string, subtopicId: number) {
    // Same volume as selectForSession default; reuses repository's subtopic-scoped query.
    const QUESTIONS_PER_SESSION = 10;
    const questions = await this.repo.selectQuestionsBySubtopic(subtopicId, QUESTIONS_PER_SESSION);
    return ok(questions);
  }
```

Adjust imports if `ok` isn't already imported.

- [ ] **Step 4: Update `SessionsService`**

Replace the constructor + `startSession` method:

```typescript
import { TopicsService } from "../topics/topics.service";

export class SessionsService {
  constructor(
    private repo: SessionsRepository,
    private questionsService: QuestionsService,
    private topicsService: TopicsService,
  ) {}

  async startSession(
    userId: string,
    mode: "all" | "theoretical",
    skipQuestions = false,
    topicId?: number,
  ): Promise<
    Result<
      {
        session: Awaited<ReturnType<SessionsRepository["createSession"]>>;
        questions: Array<{ id: number; subtopicId: number; [key: string]: unknown }>;
      },
      AppError
    >
  > {
    const existing = await this.repo.findTodaySession(userId);
    if (existing && existing.status === "active") {
      const qResult = topicId
        ? await this.questionsService.selectForSubtopic(userId, topicId)
        : await this.questionsService.selectForSession(userId, mode);
      if (qResult.isErr()) return err(qResult.error);
      return ok({ session: existing, questions: qResult.value });
    }
    if (existing && existing.status === "completed") {
      return err(new ValidationError("You already completed today's session"));
    }

    const session = await this.repo.createSession(userId);

    if (skipQuestions) {
      return ok({ session, questions: [] });
    }

    const qResult = topicId
      ? await this.questionsService.selectForSubtopic(userId, topicId)
      : await this.questionsService.selectForSession(userId, mode);
    if (qResult.isErr()) return err(qResult.error);

    // Snapshot mastery for all subtopics touched by this question batch
    const subtopicIds = Array.from(new Set(qResult.value.map((q: { subtopicId: number }) => q.subtopicId)));
    if (subtopicIds.length > 0) {
      const snapshot = await this.topicsService.snapshotMastery(userId, subtopicIds);
      await this.repo.writeMasterySnapshot(session.id, snapshot);
    }

    return ok({ session, questions: qResult.value });
  }
```

Keep `getTodaySession` unchanged. `completeSession` will be extended in the next task.

- [ ] **Step 5: Update the route wiring**

Open `apps/server/src/features/sessions/sessions.route.ts`. Update the service instantiation:

```typescript
import { TopicsRepository } from "../topics/topics.repository";
import { TopicsService } from "../topics/topics.service";

const sessionsRepo = new SessionsRepository(db);
const questionsRepo = new QuestionsRepository(db);
const questionsService = new QuestionsService(questionsRepo);
const topicsRepo = new TopicsRepository(db);
const topicsService = new TopicsService(topicsRepo);
const service = new SessionsService(sessionsRepo, questionsService, topicsService);
```

In the `POST /sessions/start` handler, pull `topicId` out of the body and pass it to the service:

```typescript
async (request) => {
  const { mode, topicId } = request.body;
  // ... existing prefetch logic ...
  const result = await service.startSession(request.userId, mode, !!cachedQuestions, topicId);
  // ... rest unchanged ...
}
```

- [ ] **Step 6: Run tests, confirm pass**

Run: `pnpm --filter server test sessions.service`
Expected: PASS — new topicId case green; existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/features/sessions/sessions.service.ts apps/server/src/features/sessions/sessions.service.test.ts apps/server/src/features/sessions/sessions.route.ts apps/server/src/features/questions/questions.service.ts
git commit -m "feat(sessions): topicId-scoped sessions + mastery snapshot at start"
```

---

## Task 13: Sessions complete returns transitions

**Files:**
- Modify: `apps/server/src/features/sessions/sessions.service.ts`
- Modify: `apps/server/src/features/sessions/sessions.route.ts`
- Modify: `apps/server/src/features/sessions/sessions.service.test.ts`

- [ ] **Step 1: Write failing test**

Append to `sessions.service.test.ts`:

```typescript
describe("SessionsService.completeSession returns mastery transitions", () => {
  it("computes upward transitions from snapshot to current state", async () => {
    const completedRow = { id: 9, status: "completed", questionsAnswered: 5, questionsCorrect: 4, completedAt: new Date(), userId: "u1" };
    const sessionRepo = {
      findSessionById: vi.fn().mockResolvedValue({ id: 9, userId: "u1", status: "active", masterySnapshot: { "7": "aprendendo" } }),
      completeSession: vi.fn().mockResolvedValue(completedRow),
      readMasterySnapshot: vi.fn().mockResolvedValue({ "7": "aprendendo" }),
    } as any;
    const questionsService = {} as any;
    const topicsService = {
      repo: {
        getMasteryBySubtopics: vi.fn().mockResolvedValue(new Map([[7, { efAvg: 2.5, reviewCount: 8 }]])),
        findSubtopicById: vi.fn().mockResolvedValue({ id: 7, topicId: 1, name: "Membrana" }),
      },
      computeTransitions: vi.fn().mockReturnValue([
        { subtopicId: 7, name: "Membrana", from: "aprendendo", to: "afiado" },
      ]),
      snapshotMastery: vi.fn(),
    } as any;
    const service = new SessionsService(sessionRepo, questionsService, topicsService);
    const result = await service.completeSession("u1", 9, 5, 4);
    expect(result.isOk()).toBe(true);
    const { session, transitions } = result._unsafeUnwrap();
    expect(session.status).toBe("completed");
    expect(transitions).toEqual([
      { subtopicId: 7, name: "Membrana", from: "aprendendo", to: "afiado" },
    ]);
  });

  it("returns empty transitions when snapshot is null", async () => {
    const sessionRepo = {
      findSessionById: vi.fn().mockResolvedValue({ id: 9, userId: "u1", status: "active", masterySnapshot: null }),
      completeSession: vi.fn().mockResolvedValue({ id: 9, status: "completed" }),
      readMasterySnapshot: vi.fn().mockResolvedValue(null),
    } as any;
    const service = new SessionsService(
      sessionRepo,
      {} as any,
      { computeTransitions: vi.fn().mockReturnValue([]), repo: {} } as any,
    );
    const result = await service.completeSession("u1", 9, 0, 0);
    const { transitions } = result._unsafeUnwrap();
    expect(transitions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm --filter server test sessions.service`
Expected: FAIL — `completeSession` doesn't return `transitions`.

- [ ] **Step 3: Implement**

Replace `completeSession` in `sessions.service.ts`:

```typescript
  async completeSession(
    userId: string,
    sessionId: number,
    questionsAnswered: number,
    questionsCorrect: number,
  ): Promise<
    Result<
      {
        session: Awaited<ReturnType<SessionsRepository["completeSession"]>>;
        transitions: import("@pruvi/shared").MasteryTransition[];
      },
      AppError
    >
  > {
    if (
      !Number.isInteger(questionsAnswered) ||
      !Number.isInteger(questionsCorrect) ||
      questionsAnswered < 0 ||
      questionsCorrect < 0 ||
      questionsCorrect > questionsAnswered
    ) {
      return err(new ValidationError("Invalid session completion metrics"));
    }

    const session = await this.repo.findSessionById(sessionId);
    if (!session) {
      return err(new NotFoundError("Session not found"));
    }
    if (session.userId !== userId) {
      return err(new NotFoundError("Session not found"));
    }
    if (session.status === "completed") {
      return err(new ValidationError("Session already completed"));
    }

    const snapshot = await this.repo.readMasterySnapshot(sessionId);
    let transitions: import("@pruvi/shared").MasteryTransition[] = [];
    if (snapshot) {
      const subtopicIds = Object.keys(snapshot).map(Number);
      const masteryMap = await this.topicsService["repo"].getMasteryBySubtopics(userId, subtopicIds);
      const currentMap = new Map<number, import("@pruvi/shared").MasteryState>();
      const namesMap = new Map<number, string>();
      const { computeMastery } = await import("@pruvi/shared");
      for (const id of subtopicIds) {
        const m = masteryMap.get(id);
        currentMap.set(id, computeMastery(m?.efAvg ?? null, m?.reviewCount ?? 0));
        const sub = await this.topicsService["repo"].findSubtopicById(id);
        if (sub) namesMap.set(id, sub.name);
      }
      transitions = this.topicsService.computeTransitions(snapshot, currentMap, namesMap);
    }

    const completed = await this.repo.completeSession(sessionId, questionsAnswered, questionsCorrect);
    return ok({ session: completed, transitions });
  }
```

Note: the access pattern `this.topicsService["repo"]` reaches into the service's private repo. To avoid that coupling, add a thin wrapper to `TopicsService`:

In `apps/server/src/features/topics/topics.service.ts`, add:

```typescript
  /** Used by sessions complete flow to look up names + current mastery rows. */
  async getCurrentMasteryAndNames(userId: string, subtopicIds: number[]) {
    const masteryMap = await this.repo.getMasteryBySubtopics(userId, subtopicIds);
    const currentMap = new Map<number, MasteryState>();
    const namesMap = new Map<number, string>();
    for (const id of subtopicIds) {
      const m = masteryMap.get(id);
      currentMap.set(id, computeMastery(m?.efAvg ?? null, m?.reviewCount ?? 0));
      const sub = await this.repo.findSubtopicById(id);
      if (sub) namesMap.set(id, sub.name);
    }
    return { currentMap, namesMap };
  }
```

Then replace the inline access in `completeSession` with:

```typescript
const { currentMap, namesMap } = await this.topicsService.getCurrentMasteryAndNames(userId, subtopicIds);
transitions = this.topicsService.computeTransitions(snapshot, currentMap, namesMap);
```

And drop the `computeMastery` dynamic import. (The test's stub should be updated to provide `getCurrentMasteryAndNames`.)

Update the first test in this task accordingly:

```typescript
const topicsService = {
  getCurrentMasteryAndNames: vi.fn().mockResolvedValue({
    currentMap: new Map([[7, "afiado"]]),
    namesMap: new Map([[7, "Membrana"]]),
  }),
  computeTransitions: vi.fn().mockReturnValue([
    { subtopicId: 7, name: "Membrana", from: "aprendendo", to: "afiado" },
  ]),
} as any;
```

- [ ] **Step 4: Extend the route**

In `sessions.route.ts`, update the `POST /sessions/:id/complete` handler to return `transitions`:

```typescript
async (request) => {
  const { id } = request.params;
  const { questionsAnswered, questionsCorrect } = request.body;
  const result = await service.completeSession(
    request.userId,
    id,
    questionsAnswered,
    questionsCorrect,
  );
  const { session, transitions } = unwrapResult(result).data;
  await fastify.cache.del(`session-today:${request.userId}`);
  return successResponse({ session, transitions });
}
```

- [ ] **Step 5: Run tests, confirm pass**

Run: `pnpm --filter server test sessions.service`
Expected: PASS — all complete + transitions cases green.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/features/sessions/ apps/server/src/features/topics/topics.service.ts
git commit -m "feat(sessions): complete returns upward mastery transitions"
```

---

## Task 14: Cache invalidation on answer

**Files:**
- Modify: `apps/server/src/features/reviews/reviews.repository.ts`
- Modify: `apps/server/src/features/reviews/reviews.service.ts`
- Modify: `apps/server/src/features/reviews/reviews.route.ts`

- [ ] **Step 1: Extend question lookup**

In `reviews.repository.ts`, replace `findQuestionById` to also expose `subjectId`, `subtopicId`, and the topic id:

```typescript
import { topic, subtopic } from "@pruvi/db/schema/topics";

  async findQuestionById(questionId: number) {
    const rows = await this.db
      .select({
        id: question.id,
        content: question.content,
        options: question.options,
        correctOptionIndex: question.correctOptionIndex,
        difficulty: question.difficulty,
        explanation: question.explanation,
        subjectId: question.subjectId,
        subtopicId: question.subtopicId,
        topicId: subtopic.topicId,
      })
      .from(question)
      .innerJoin(subtopic, eq(subtopic.id, question.subtopicId))
      .where(eq(question.id, questionId))
      .limit(1);
    return rows[0] ?? null;
  }
```

- [ ] **Step 2: Surface ids from the service**

In `reviews.service.ts`, change the `answerQuestion` return type to also include `subjectId` and `topicId` (or surface them as a non-data field). Cleanest: extend the result to include `_cacheKeys: { subjectId, topicId }` — but that leaks to clients. Instead, change the service to return a tuple-shape: keep the existing `data` object but also expose ids on the result via a new top-level field that the route consumes and strips.

Easier: have the service return the existing answer object plus a sibling `cacheTargets` object. Update the service signature:

```typescript
  async answerQuestion(
    userId: string,
    questionId: number,
    selectedOptionIndex: number,
  ): Promise<
    Result<
      {
        answer: {
          correct: boolean;
          correctOptionIndex: number;
          livesRemaining: number;
          xpAwarded: number;
          explanation: string | null;
        };
        cacheTargets: { subjectId: number; topicId: number };
      },
      AppError
    >
  >
```

In the body, after computing the answer, return:

```typescript
return ok({
  answer: {
    correct,
    correctOptionIndex: q.correctOptionIndex,
    livesRemaining,
    xpAwarded,
    explanation: q.explanation ?? null,
  },
  cacheTargets: { subjectId: q.subjectId, topicId: q.topicId },
});
```

- [ ] **Step 3: Update route to invalidate caches**

Replace the route handler in `reviews.route.ts`:

```typescript
async (request) => {
  const { questionId } = request.params;
  const { selectedOptionIndex } = request.body;
  const result = await service.answerQuestion(request.userId, questionId, selectedOptionIndex);
  const { answer, cacheTargets } = unwrapResult(result).data;

  await Promise.all([
    fastify.cache.del(`lives:${request.userId}`),
    fastify.cache.del(`xp:${request.userId}`),
    fastify.cache.del(`progress:${request.userId}`),
    fastify.cache.del(`mastery:${request.userId}:all`),
    fastify.cache.del(`mastery:${request.userId}:${cacheTargets.subjectId}`),
    fastify.cache.del(`trilha:${request.userId}:${cacheTargets.subjectId}`),
    fastify.cache.del(`topic:${request.userId}:${cacheTargets.topicId}`),
  ]);

  return successResponse(answer);
},
```

- [ ] **Step 4: Update any existing reviews tests that assert the old return shape**

Search for `answerQuestion` in test files; adjust assertions to read `.value.answer` instead of `.value.<field>`. Run the test suite to find breaks:

Run: `pnpm --filter server test reviews`
Iterate fixes until green.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter server check-types`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/features/reviews/
git commit -m "feat(reviews): invalidate mastery/trilha/topic caches on answer"
```

---

## Task 15: Demo seed script

**Files:**
- Create: `apps/server/scripts/seed-demo-topics.ts`
- Modify: `apps/server/package.json` (add script entry)

- [ ] **Step 1: Write the seed script**

`apps/server/scripts/seed-demo-topics.ts`:

```typescript
import { db } from "@pruvi/db";
import { subject } from "@pruvi/db/schema/subjects";
import { topic, subtopic } from "@pruvi/db/schema/topics";
import { question } from "@pruvi/db/schema/questions";
import { and, eq, ne, sql } from "drizzle-orm";

async function main() {
  // Find Biology subject (matches the seeded slug)
  const [bio] = await db.select().from(subject).where(eq(subject.slug, "biologia")).limit(1);
  if (!bio) {
    console.error("No 'biologia' subject found. Run base seed first.");
    process.exit(1);
  }

  // Idempotent: skip if Citologia topic already exists
  const existing = await db
    .select()
    .from(topic)
    .where(and(eq(topic.subjectId, bio.id), eq(topic.slug, "citologia")))
    .limit(1);
  if (existing.length > 0) {
    console.log("Citologia already seeded — exiting.");
    return;
  }

  const [citologia] = await db
    .insert(topic)
    .values({ subjectId: bio.id, name: "Citologia", slug: "citologia", displayOrder: 1 })
    .returning();

  const subs = [
    { name: "Membrana plasmática", slug: "membrana-plasmatica", order: 0 },
    { name: "Citoplasma", slug: "citoplasma", order: 1 },
    { name: "Núcleo", slug: "nucleo", order: 2 },
  ];
  const inserted = await db
    .insert(subtopic)
    .values(subs.map((s) => ({ topicId: citologia.id, name: s.name, slug: s.slug, displayOrder: s.order })))
    .returning();

  // Reassign 6 Biology questions from Geral to these subtopics (2 each)
  const [geralTopic] = await db
    .select()
    .from(topic)
    .where(and(eq(topic.subjectId, bio.id), eq(topic.slug, "geral")))
    .limit(1);
  if (!geralTopic) {
    console.log("No Geral topic for Biology — leaving subtopics empty.");
    return;
  }
  const [geralSub] = await db
    .select()
    .from(subtopic)
    .where(and(eq(subtopic.topicId, geralTopic.id), eq(subtopic.slug, "geral")))
    .limit(1);
  if (!geralSub) return;

  for (let i = 0; i < inserted.length; i++) {
    await db.execute(sql`
      WITH picked AS (
        SELECT id FROM "question"
        WHERE subject_id = ${bio.id} AND subtopic_id = ${geralSub.id}
        LIMIT 2
      )
      UPDATE "question" SET subtopic_id = ${inserted[i].id}
      WHERE id IN (SELECT id FROM picked)
    `);
  }

  console.log("Demo topics seeded.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
```

- [ ] **Step 2: Add script entry**

Edit `apps/server/package.json` — under `scripts`, add:

```json
"seed:demo-topics": "bun run scripts/seed-demo-topics.ts"
```

- [ ] **Step 3: Smoke run**

```bash
pnpm --filter server seed:demo-topics
```

Expected: "Demo topics seeded." on first run; "Citologia already seeded — exiting." on a second run.

- [ ] **Step 4: Commit**

```bash
git add apps/server/scripts/seed-demo-topics.ts apps/server/package.json
git commit -m "feat(topics): idempotent demo seed for citologia"
```

---

## Task 16: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Migration smoke**

Run: `pnpm verify:migration`
Expected: PASS — all tables queryable, including `topic`, `subtopic`.

- [ ] **Step 2: Full unit test suite**

Run: `pnpm --filter server test`
Expected: PASS — all existing 70+ tests plus the new ones green.

- [ ] **Step 3: Full integration test suite**

Run: `pnpm --filter server test:integration`
Expected: PASS — all existing 20+ tests plus the new topics ones green.

- [ ] **Step 4: Shared package tests**

Run: `pnpm --filter @pruvi/shared test`
Expected: PASS — including mastery tests.

- [ ] **Step 5: Workspace typecheck**

Run: `pnpm run check-types`
Expected: PASS — zero non-test typecheck errors.

- [ ] **Step 6: Manual smoke against running server**

```bash
pnpm seed:demo-topics
pnpm dev:server
```

In another shell, with a valid auth cookie/token for a seeded user:

```bash
curl -s http://localhost:3000/subjects/<biology_subject_id>/trilha -H "Cookie: <session>"
```

Expected: response includes `subject.slug = "biologia"`, `topics` array with both `geral` and `citologia`, `citologia.subtopics` of length 3.

- [ ] **Step 7: Final commit (if any incidental fixes)**

```bash
git status
# If anything is dirty from the smoke verification:
git add -A
git commit -m "chore: end-to-end verification fixes"
```

---

## Self-review notes (resolved while writing)

- Each spec section maps to at least one task: data model → Tasks 4, 5, 6, 7; mastery computation → Tasks 1, 8, 9; API surface → Tasks 10, 12, 13; cache invalidation → Task 14; migration & seed → Tasks 6, 15; testing strategy → unit/integration tests throughout.
- The `topicId` body param naming (passes a subtopic id) is explicit in Task 3 and Task 12 to avoid confusion.
- Migration uses the 2-step add-nullable → backfill → set NOT NULL pattern (Task 6) — production-safe on a non-empty `question` table.
- The PGlite test client mirror (Task 7) is required because the existing convention is hand-maintained, not migration-driven, for unit tests.
- Caching strategy uses direct key deletion (no SCAN/prefix dependency on the cache plugin) because each answer touches exactly one subject/topic — keys are deterministic.

---

*End of plan.*
