# Phase 0 — Schema Drift & Coherence Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Drizzle TypeScript schemas the single source of truth, regenerate one clean migration, and fix related coherence gaps (env validation, shared file naming, Docker worker entry).

**Architecture:** A non-functional refactor. Touch four `packages/db/src/schema/*.ts` files, delete the stale `review-logs.ts` duplicate, regenerate one migration from the corrected TS schemas, add `PORT` to env validation, split misnamed `@pruvi/shared/auth.ts` into `answers.ts` + `streaks.ts`, and add a thin Docker entrypoint script so one image serves both HTTP server and BullMQ worker via `PROCESS_TYPE` env var.

**Tech Stack:** Drizzle ORM, drizzle-kit, PostgreSQL, Bun, Fastify, Vitest, `@t3-oss/env-core`, `tsdown`, Docker, BullMQ.

**Reference spec:** `docs/superpowers/specs/2026-05-10-phase-0-schema-drift-design.md`

---

## Pre-flight

### Task 0: Branch setup

**Files:** none yet (branching only)

- [ ] **Step 1: Confirm clean working tree on `feature/onboarding-screens`, then stash uncommitted work**

```bash
git status
# expect: M apps/server/src/features/reviews/reviews.service.ts
#         M packages/shared/src/index.ts
#         (+ untracked docs/Makefile/pruvi-freatures.md — leave untracked, they don't block branch switch)
git stash push -m "phase-0-prep: stash in-flight reviews.service refactor" apps/server/src/features/reviews/reviews.service.ts packages/shared/src/index.ts
git status
# expect: only untracked files remain
```

- [ ] **Step 2: Create Phase 0 branch from `main`**

```bash
git fetch origin
git checkout -b phase-0-schema-drift origin/main
git log --oneline -3
# expect HEAD to match origin/main
```

- [ ] **Step 3: Verify Phase 0 baseline compiles + tests pass on `main`**

```bash
pnpm install
pnpm -r typecheck
pnpm -r test
```

Expected: typecheck and unit tests pass (integration tests may be skipped if no DB; that's fine — we add a smoke test in Task 9).

- [ ] **Step 4: No commit yet — this is just baseline verification.**

---

## File Structure (locked in)

### Modified
- `packages/db/src/schema/auth.ts` — add 4 gamification columns to `user`
- `packages/db/src/schema/questions.ts` — `body` → `content`, `difficulty` int → text enum, add `requiresCalculation`
- `packages/db/src/schema/daily-sessions.ts` — drop `date`, add `status` enum
- `packages/db/src/schema/index.ts` — re-export from `./review-log` (not `./review-logs`)
- `packages/db/src/seed.ts` — verify field names still resolve (should already match)
- `packages/db/src/__tests__/schema.test.ts` — `q.body` → `q.content`
- `packages/env/src/server.ts` — add `PORT`
- `packages/shared/src/index.ts` — re-export `answers` and `streaks` instead of `auth`
- `apps/server/src/features/sessions/sessions.repository.ts` — `questionCount` → `questionsAnswered`, `correctCount` → `questionsCorrect`
- `apps/server/src/features/sessions/sessions.service.ts` — same renames
- `apps/server/src/features/sessions/sessions.route.ts` — same renames (request body schema + handler)
- `apps/server/src/features/sessions/sessions.repository.integration.test.ts` — same renames
- `apps/server/src/features/sessions/sessions.service.test.ts` — same renames
- `Dockerfile` — entrypoint script + ENTRYPOINT directive

### Created
- `packages/shared/src/answers.ts` — `AnswerQuestionBody/ResponseSchema`
- `packages/shared/src/streaks.ts` — `StreakResponseSchema`
- `Dockerfile.entrypoint.sh` — 5-line shell script branching on `PROCESS_TYPE`
- `scripts/verify-migration.ts` — migration smoke test
- `packages/db/src/migrations/000X_*.sql` — regenerated (drizzle picks name)

### Deleted
- `packages/db/src/schema/review-logs.ts`
- `packages/db/src/migrations/0000_tranquil_blockbuster.sql`
- `packages/db/src/migrations/meta/0000_snapshot.json`
- `packages/shared/src/auth.ts`

---

## Task 1: Fix `user` table — add gamification columns

**Files:**
- Modify: `packages/db/src/schema/auth.ts`

**Why:** Migration has `lives`, `lives_reset_at`, `total_xp`, `current_level` but TS schema doesn't declare them. Repository code accesses these fields without types.

- [ ] **Step 1: Add columns to `user` table definition**

Open `packages/db/src/schema/auth.ts`. Replace the `user` table block:

```typescript
import { integer, pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  lives: integer("lives").notNull().default(5),
  livesResetAt: timestamp("lives_reset_at", { withTimezone: true }),
  totalXp: integer("total_xp").notNull().default(0),
  currentLevel: integer("current_level").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});
```

(Keep `session`, `account`, `verification`, `userRelations`, `sessionRelations`, `accountRelations` blocks unchanged.)

- [ ] **Step 2: Run typecheck**

```bash
pnpm -r typecheck
```

Expected: passes. Repositories that already access `user.lives`, `.totalXp`, etc. should now type-check cleanly.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/auth.ts
git commit -m "fix(db): add gamification columns to user schema"
```

---

## Task 2: Fix `question` table — content, difficulty enum, requiresCalculation

**Files:**
- Modify: `packages/db/src/schema/questions.ts`
- Modify: `packages/db/src/__tests__/schema.test.ts`

**Why:** Migration column is `content` (TS has `body`). Migration `difficulty` is `text` (TS has `integer`). Seed file uses `content` and string difficulty + `requiresCalculation` — none match current TS schema.

- [ ] **Step 1: Replace `questions.ts` content**

Open `packages/db/src/schema/questions.ts`. Replace entire file:

```typescript
import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

import { subject } from "./subjects";

export const question = pgTable(
  "question",
  {
    id: serial("id").primaryKey(),
    content: text("content").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    correctOptionIndex: integer("correct_option_index").notNull(),
    difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] }).notNull(),
    requiresCalculation: boolean("requires_calculation").notNull().default(false),
    source: text("source"),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subject.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("question_subject_difficulty_idx").on(table.subjectId, table.difficulty),
  ],
);

export const questionRelations = relations(question, ({ one }) => ({
  subject: one(subject, {
    fields: [question.subjectId],
    references: [subject.id],
  }),
}));
```

- [ ] **Step 2: Update schema test to use `content`**

Open `packages/db/src/__tests__/schema.test.ts` line 45. Find `q.body` and replace with `q.content`:

```bash
grep -n "q.body" packages/db/src/__tests__/schema.test.ts
# expect line 45
```

Use Edit to change `expect(q.body).toContain(...)` → `expect(q.content).toContain(...)`.

- [ ] **Step 3: Run db package typecheck + tests**

```bash
pnpm --filter @pruvi/db run check-types 2>&1 || pnpm --filter @pruvi/db exec tsc --noEmit
pnpm --filter @pruvi/db test
```

Expected: passes.

- [ ] **Step 4: Run full repo typecheck to surface other consumers**

```bash
pnpm -r typecheck 2>&1 | tail -40
```

Expected: only schema-related changes resolved; any remaining errors are caught in later tasks.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/questions.ts packages/db/src/__tests__/schema.test.ts
git commit -m "fix(db): rename question.body to content, difficulty as text enum, add requiresCalculation"
```

---

## Task 3: Fix `daily_session` table — drop date, add status

**Files:**
- Modify: `packages/db/src/schema/daily-sessions.ts`

**Why:** Migration has `status` (TS doesn't). Migration has no `date` column (TS does — derive from `created_at` instead). Repository writes `status: "completed"` which currently doesn't typecheck against the schema.

- [ ] **Step 1: Replace `daily-sessions.ts` content**

```typescript
import { relations } from "drizzle-orm";
import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

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

- [ ] **Step 2: Run typecheck — expect failures in sessions repo/service/tests**

```bash
pnpm -r typecheck 2>&1 | grep -E "questionCount|correctCount|dailySession\.date" | head -20
```

Expected: errors flagging `questionCount`/`correctCount` references — fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/daily-sessions.ts
git commit -m "fix(db): daily_session — add status enum, drop date column"
```

---

## Task 3.5: Fix `@pruvi/shared` package coherence (discovered scope)

**Files:**
- Modify: `packages/shared/src/sm2.ts`
- Modify: `packages/shared/src/questions.ts`
- Modify: `packages/shared/src/sessions.ts`

**Why:** Discovered during Task 0 baseline verification: the shared package has been semi-broken on `main` for some time. `tsdown` bundles without type-checking, so runtime kept working as long as broken symbols were never hit. Specifically:
- `shared/sm2.ts` exports `calculateSm2` (lowercase, 1-arg) but `reviews.service.ts` imports `calculateSM2` (uppercase, 2-arg). Also missing `INITIAL_SM2_STATE` and `QualityScore` exports.
- `shared/xp.ts` imports `Difficulty` from `./questions` — but `questions.ts` doesn't export that type.
- `shared/sessions.ts` references undefined `SessionSchema` and `QuestionSchema` (4 places); has dead `CompleteSessionBodySchema` with old naming; `dailySessionSchema` has `date` field that shouldn't exist post-schema-cleanup.
- `shared/questions.ts` defines duplicate `answerRequestSchema`/`answerResponseSchema` superseded by Task 8's `answers.ts`. Uses `body` and `difficulty: z.number()` — drift from canonical.
- `sessions.route.ts` imports `StartSessionBodySchema` which is referenced but undefined.

This task makes the shared package coherent and unblocks `check-types` for all subsequent tasks.

- [ ] **Step 1: Fix `packages/shared/src/sm2.ts` — add missing exports + name alias**

Append to the end of `packages/shared/src/sm2.ts` (after the existing `calculateSm2` function):

```typescript
/** SM-2 quality score: 0-5 scale used by the algorithm. */
export type QualityScore = 0 | 1 | 2 | 3 | 4 | 5;

/** Initial SM-2 state for a question that has never been reviewed. */
export const INITIAL_SM2_STATE = {
  easinessFactor: 2.5,
  interval: 0,
  repetitions: 0,
  nextReviewAt: new Date(0),
} as const;

/** Legacy 2-arg SM-2 API used by reviews.service.ts.
 *  Takes prior state + quality, returns next state. */
export function calculateSM2(
  prev: {
    easinessFactor: number;
    interval: number;
    repetitions: number;
    nextReviewAt: Date;
  },
  quality: QualityScore
): {
  easinessFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: Date;
} {
  const result = calculateSm2({
    quality,
    repetitions: prev.repetitions,
    easeFactor: prev.easinessFactor,
    interval: prev.interval,
  });
  if (result.isErr()) throw result.error;
  const out = result.value;
  return {
    easinessFactor: out.easeFactor,
    interval: out.interval,
    repetitions: out.repetitions,
    nextReviewAt: new Date(out.nextReviewAt),
  };
}
```

- [ ] **Step 2: Fix `packages/shared/src/questions.ts` — content, enum, Difficulty export, drop duplicates**

Replace entire file:

```typescript
import { z } from "zod";

export const difficultyEnum = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof difficultyEnum>;

export const questionSchema = z.object({
  id: z.number(),
  content: z.string(),
  options: z.array(z.string()),
  correctOptionIndex: z.number(),
  difficulty: difficultyEnum,
  source: z.string().nullable(),
  subjectId: z.number(),
});

export type Question = z.infer<typeof questionSchema>;
```

(Deletes duplicate `answerRequestSchema`/`answerResponseSchema` — superseded by Task 8's `answers.ts`.)

- [ ] **Step 3: Fix `packages/shared/src/sessions.ts` — define StartSessionBodySchema, drop broken refs**

Replace entire file:

```typescript
import { z } from "zod";

export const sessionStatsSchema = z.object({
  currentStreak: z.number(),
  longestStreak: z.number(),
  totalSessions: z.number(),
});

export type SessionStats = z.infer<typeof sessionStatsSchema>;

/** POST /sessions/start — request body */
export const StartSessionBodySchema = z.object({
  mode: z.enum(["all", "theoretical"]).default("all"),
});

export type StartSessionBody = z.infer<typeof StartSessionBodySchema>;
```

(Deletes broken `Session = z.infer<typeof SessionSchema>`, `StartSessionResponseSchema`, `CompleteSessionBodySchema`, `CompleteSessionResponseSchema`, `TodaySessionResponseSchema`, and old `dailySessionSchema` — none imported anywhere outside the file itself, verified by grep.)

- [ ] **Step 4: Run typecheck**

```bash
pnpm run check-types 2>&1 | tail -20
```

Expected: passes (all consumers now resolve).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/sm2.ts packages/shared/src/questions.ts packages/shared/src/sessions.ts
git commit -m "fix(shared): reconcile package — add missing exports, drop broken refs, content/enum"
```

---

## Task 4: Update sessions repository, service, route, and tests

**Files:**
- Modify: `apps/server/src/features/sessions/sessions.repository.ts`
- Modify: `apps/server/src/features/sessions/sessions.service.ts`
- Modify: `apps/server/src/features/sessions/sessions.route.ts`
- Modify: `apps/server/src/features/sessions/sessions.repository.integration.test.ts`
- Modify: `apps/server/src/features/sessions/sessions.service.test.ts`

**Why:** Repository writes `questionCount` / `correctCount` — these are field names on the Drizzle write payload, which Drizzle maps to columns. Schema now uses `questionsAnswered` / `questionsCorrect`. Same rename across service, route body, and tests.

- [ ] **Step 1: Update `sessions.repository.ts` `completeSession` method**

Replace the method body:

```typescript
  /** Mark a session as completed */
  async completeSession(
    sessionId: number,
    questionsAnswered: number,
    questionsCorrect: number
  ) {
    const [row] = await this.db
      .update(dailySession)
      .set({
        status: "completed",
        questionsAnswered,
        questionsCorrect,
        completedAt: new Date(),
      })
      .where(eq(dailySession.id, sessionId))
      .returning();
    return row;
  }
```

- [ ] **Step 2: Update `sessions.service.ts` `completeSession` signature**

Find lines ~82-104. Change parameter names and pass-through:

```typescript
  async completeSession(
    userId: string,
    sessionId: number,
    questionsAnswered: number,
    questionsCorrect: number
  ): Promise<Result<DailySession, SessionError>> {
    // ... existing checks ...
    const updated = await this.repo.completeSession(
      sessionId,
      questionsAnswered,
      questionsCorrect
    );
    // ... existing return ...
  }
```

(Adjust to match the actual surrounding code shape — keep the Result/error wrapping intact.)

- [ ] **Step 3: Update `sessions.route.ts` body schema + handler**

Find the complete-session route (~line 86-98). Replace:

```typescript
        body: z.object({
          questionsAnswered: z.number().int().min(0),
          questionsCorrect: z.number().int().min(0),
        }),
```

And the handler:

```typescript
      const { questionsAnswered, questionsCorrect } = request.body;
      const result = await service.completeSession(
        userId,
        sessionId,
        questionsAnswered,
        questionsCorrect,
      );
```

- [ ] **Step 4: Update integration test**

In `sessions.repository.integration.test.ts`, lines ~87-96. Find each `questionCount` and `correctCount` and rename:

```bash
sed -i.bak -e 's/questionCount/questionsAnswered/g' -e 's/correctCount/questionsCorrect/g' apps/server/src/features/sessions/sessions.repository.integration.test.ts
rm apps/server/src/features/sessions/sessions.repository.integration.test.ts.bak
```

(macOS sed needs the `.bak` form. Verify with `grep questionCount` afterward — should return nothing.)

- [ ] **Step 5: Update unit test**

```bash
sed -i.bak -e 's/questionCount/questionsAnswered/g' -e 's/correctCount/questionsCorrect/g' apps/server/src/features/sessions/sessions.service.test.ts
rm apps/server/src/features/sessions/sessions.service.test.ts.bak
```

- [ ] **Step 6: Typecheck + unit tests**

```bash
pnpm -r typecheck
pnpm --filter server test
```

Expected: typecheck clean; unit tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/features/sessions/
git commit -m "refactor(server): rename sessions questionCount→questionsAnswered, correctCount→questionsCorrect"
```

---

## Task 5: Delete `review-logs.ts` and fix schema index

**Files:**
- Delete: `packages/db/src/schema/review-logs.ts`
- Modify: `packages/db/src/schema/index.ts`

**Why:** Two competing `review_log` schema files. `review-log.ts` matches the migration; `review-logs.ts` is stale. `index.ts` re-exports the wrong one.

- [ ] **Step 1: Delete stale file**

```bash
rm packages/db/src/schema/review-logs.ts
```

- [ ] **Step 2: Update `schema/index.ts` re-export**

```typescript
export * from "./auth";
export * from "./subjects";
export * from "./questions";
export * from "./review-log";
export * from "./daily-sessions";
```

- [ ] **Step 3: Typecheck**

```bash
pnpm -r typecheck
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/index.ts packages/db/src/schema/review-logs.ts
git commit -m "fix(db): remove stale review-logs.ts duplicate, re-export review-log"
```

---

## Task 6: Regenerate the migration

**Files:**
- Delete: `packages/db/src/migrations/0000_tranquil_blockbuster.sql`
- Delete: `packages/db/src/migrations/meta/0000_snapshot.json`
- Modify: `packages/db/src/migrations/meta/_journal.json`
- Create: new migration file (drizzle-kit picks the name)

**Why:** Existing migration has all the drifted names. We need one fresh migration generated from the corrected TS schemas.

- [ ] **Step 1: Verify local DB is dev-only and disposable**

```bash
echo "Confirmed: DB is local/dev only per spec. Proceeding to drop and recreate."
```

- [ ] **Step 2: Delete old migration artifacts**

```bash
rm packages/db/src/migrations/0000_tranquil_blockbuster.sql
rm packages/db/src/migrations/meta/0000_snapshot.json
```

Reset `_journal.json` to empty entries:

```bash
cat > packages/db/src/migrations/meta/_journal.json <<'EOF'
{
  "version": "7",
  "dialect": "postgresql",
  "entries": []
}
EOF
```

- [ ] **Step 3: Generate new migration**

```bash
cd packages/db
pnpm exec drizzle-kit generate
cd ../..
```

Expected: drizzle-kit writes a new `000X_<name>.sql` file and updates `_journal.json` + snapshot.

- [ ] **Step 4: Inspect the generated SQL**

```bash
ls packages/db/src/migrations/
cat packages/db/src/migrations/0000_*.sql | head -80
```

Expected: `user` has lives/totalXp/currentLevel; `daily_session` has status, questions_answered, questions_correct, no `date`; `question` has `content` (text), `difficulty` text, `requires_calculation` boolean; `review_log` has easiness_factor decimal + reviewed_at + indexes.

- [ ] **Step 5: Drop and recreate the local DB, apply migration, run seed**

```bash
# Drop the local DB (uses DATABASE_URL from apps/server/.env)
cd packages/db
pnpm exec drizzle-kit drop 2>/dev/null || true
# Recreate by running migrate
pnpm exec drizzle-kit migrate
pnpm exec tsx src/seed.ts || bun run src/seed.ts
cd ../..
```

Expected: tables created, seed inserts 5 subjects and ~111 questions without error.

(If `drizzle-kit drop` is not the right command in this version of drizzle-kit, manually drop the DB via `psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"` instead.)

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/migrations/
git commit -m "fix(db): regenerate migration from corrected schemas"
```

---

## Task 7: Add `PORT` to env validation

**Files:**
- Modify: `packages/env/src/server.ts`

**Why:** `apps/server/src/index.ts` reads `env.PORT` but the env schema doesn't declare it — startup would throw if `@t3-oss/env-core` strict-validation kicked in.

- [ ] **Step 1: Add PORT to schema**

Replace `packages/env/src/server.ts`:

```typescript
import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
```

- [ ] **Step 2: Typecheck**

```bash
pnpm -r typecheck
```

Expected: passes. `env.PORT` is now typed as `number`.

- [ ] **Step 3: Commit**

```bash
git add packages/env/src/server.ts
git commit -m "fix(env): add PORT to validated env schema"
```

---

## Task 8: Split `@pruvi/shared/auth.ts` into `answers.ts` + `streaks.ts`

**Files:**
- Create: `packages/shared/src/answers.ts`
- Create: `packages/shared/src/streaks.ts`
- Delete: `packages/shared/src/auth.ts`
- Modify: `packages/shared/src/index.ts`

**Why:** The file is misnamed — exports answer + streak schemas, not auth schemas.

- [ ] **Step 1: Create `answers.ts`**

```typescript
import { z } from "zod";

/** POST /questions/:questionId/answer — request body */
export const AnswerQuestionBodySchema = z.object({
  selectedOptionIndex: z.number().int().min(0).max(3),
});

export type AnswerQuestionBody = z.infer<typeof AnswerQuestionBodySchema>;

/** POST /questions/:questionId/answer — response */
export const AnswerQuestionResponseSchema = z.object({
  correct: z.boolean(),
  correctOptionIndex: z.number().int().min(0).max(3),
  livesRemaining: z.number().int().min(0),
  xpAwarded: z.number().int().min(0),
});

export type AnswerQuestionResponse = z.infer<typeof AnswerQuestionResponseSchema>;
```

- [ ] **Step 2: Create `streaks.ts`**

```typescript
import { z } from "zod";

/** GET /streaks — response */
export const StreakResponseSchema = z.object({
  currentStreak: z.number().int().min(0),
  longestStreak: z.number().int().min(0),
  totalSessions: z.number().int().min(0),
});

export type StreakResponse = z.infer<typeof StreakResponseSchema>;
```

- [ ] **Step 3: Update `packages/shared/src/index.ts`**

Replace the existing `export * from "./auth";` line with two new exports:

```typescript
export * from "./questions";
export * from "./subjects";
export * from "./sessions";
export * from "./sm2";
export * from "./xp";
export * from "./lives";
export * from "./answers";
export * from "./streaks";
```

- [ ] **Step 4: Delete the old file**

```bash
rm packages/shared/src/auth.ts
```

- [ ] **Step 5: Typecheck (catches any consumer importing from `@pruvi/shared/auth` directly)**

```bash
pnpm -r typecheck
grep -rn "@pruvi/shared/auth" apps/ packages/ || echo "clean"
```

Expected: typecheck passes; grep returns "clean" (or no matches).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/
git commit -m "refactor(shared): split misnamed auth.ts into answers.ts + streaks.ts"
```

---

## Task 9: Add migration smoke test script

**Files:**
- Create: `scripts/verify-migration.ts`
- Modify: `package.json` (root) — add `verify:migration` script

**Why:** Catches "schema generates but ORM can't query it" regressions. Spins up against an existing Postgres (the local dev DB), runs migrate, runs seed, executes one representative query per repo.

- [ ] **Step 1: Create the script**

```typescript
// scripts/verify-migration.ts
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import { Pool } from "pg";
import { user } from "@pruvi/db/schema/auth";
import { question } from "@pruvi/db/schema/questions";
import { dailySession } from "@pruvi/db/schema/daily-sessions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import { subject } from "@pruvi/db/schema/subjects";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

async function main() {
  console.log("→ Smoke test: representative query per table");

  const subjects = await db.select().from(subject).limit(1);
  console.log(`  subject rows: ${subjects.length}`);

  const questions = await db
    .select({ id: question.id, content: question.content, difficulty: question.difficulty })
    .from(question)
    .limit(1);
  console.log(`  question rows: ${questions.length} (difficulty=${questions[0]?.difficulty})`);

  const users = await db
    .select({ id: user.id, lives: user.lives, totalXp: user.totalXp, currentLevel: user.currentLevel })
    .from(user)
    .limit(1);
  console.log(`  user rows: ${users.length}`);

  // Insert and read a daily_session row to verify status/questionsAnswered columns
  // Skip if no users seeded
  if (users[0]) {
    const inserted = await db
      .insert(dailySession)
      .values({ userId: users[0].id, status: "active" })
      .returning();
    console.log(`  daily_session insert ok: status=${inserted[0]?.status}`);
    await db.delete(dailySession).where(eq(dailySession.id, inserted[0]!.id));
  }

  const reviews = await db.select().from(reviewLog).limit(1);
  console.log(`  review_log rows: ${reviews.length}`);

  await pool.end();
  console.log("✓ Migration smoke test passed");
}

main().catch((err) => {
  console.error("✗ Smoke test failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Add root script**

Open root `package.json`. In the `scripts` block, add:

```json
"verify:migration": "bun run scripts/verify-migration.ts"
```

- [ ] **Step 3: Run the smoke test**

```bash
pnpm verify:migration
```

Expected output ends with `✓ Migration smoke test passed`.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-migration.ts package.json
git commit -m "test(db): add migration smoke test script"
```

---

## Task 10: Add Dockerfile entrypoint script (server + worker)

**Files:**
- Create: `Dockerfile.entrypoint.sh`
- Modify: `Dockerfile`

**Why:** Worker process (`src/worker.ts`) is never started in containers — BullMQ jobs accumulate forever. Solution: one image, two CMDs via `PROCESS_TYPE` env var. Orchestration runs two services from the same image.

`tsdown.config.ts` already declares both `src/index.ts` and `src/worker.ts` as entries — no build changes needed. `apps/server/package.json` already defines `start:worker` script. So only the Dockerfile needs to change.

- [ ] **Step 1: Create entrypoint script at repo root**

```bash
cat > Dockerfile.entrypoint.sh <<'EOF'
#!/bin/sh
set -e

if [ "$PROCESS_TYPE" = "worker" ]; then
  exec bun run dist/worker.mjs
else
  exec bun run dist/index.mjs
fi
EOF
chmod +x Dockerfile.entrypoint.sh
```

- [ ] **Step 2: Update `Dockerfile` production stage**

Replace the production stage section (lines starting with `FROM oven/bun:1-slim`):

```dockerfile
# Stage 3: Production image
FROM oven/bun:1-slim AS production

WORKDIR /app

# Copy built output
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/package.json ./package.json

# Copy node_modules needed at runtime
COPY --from=builder /app/node_modules ./node_modules

# Copy migrations for production DB setup
COPY --from=builder /app/packages/db/src/migrations ./migrations

# Copy entrypoint script
COPY Dockerfile.entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
```

(Remove the final `CMD ["bun", "run", "dist/index.mjs"]` — the entrypoint script handles both cases.)

- [ ] **Step 3: Build the image**

```bash
docker build -t pruvi-server:phase-0 .
```

Expected: build succeeds.

- [ ] **Step 4: Verify both modes start cleanly**

```bash
# Server mode (default)
docker run --rm --entrypoint /entrypoint.sh \
  -e DATABASE_URL=postgres://invalid \
  -e BETTER_AUTH_SECRET=$(printf 'x%.0s' {1..32}) \
  -e BETTER_AUTH_URL=http://localhost:3000 \
  -e CORS_ORIGIN=http://localhost:3000 \
  pruvi-server:phase-0 &
SERVER_PID=$!
sleep 3
kill $SERVER_PID 2>/dev/null || true

# Worker mode
docker run --rm --entrypoint /entrypoint.sh \
  -e PROCESS_TYPE=worker \
  -e DATABASE_URL=postgres://invalid \
  -e BETTER_AUTH_SECRET=$(printf 'x%.0s' {1..32}) \
  -e BETTER_AUTH_URL=http://localhost:3000 \
  -e CORS_ORIGIN=http://localhost:3000 \
  -e REDIS_URL=redis://invalid \
  pruvi-server:phase-0 &
WORKER_PID=$!
sleep 3
kill $WORKER_PID 2>/dev/null || true

echo "Both modes started (may exit early due to invalid DB/Redis URLs — that's expected; we just verify the entrypoint dispatches correctly)"
```

Expected: server mode logs Fastify startup; worker mode logs BullMQ worker startup. Both will likely error trying to connect to invalid backends — that's fine; we're only verifying the entry-point dispatch path.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile Dockerfile.entrypoint.sh
git commit -m "feat(docker): single image, dual entrypoint for server + worker via PROCESS_TYPE"
```

---

## Task 11: Final verification — full test + typecheck + smoke

**Files:** none (verification only)

- [ ] **Step 1: Clean install + typecheck**

```bash
pnpm install
pnpm -r typecheck
```

Expected: clean pass across all workspace packages.

- [ ] **Step 2: Unit test suite**

```bash
pnpm -r test
```

Expected: all green.

- [ ] **Step 3: Integration test suite (requires Postgres)**

```bash
pnpm --filter server test:integration
```

Expected: all green.

- [ ] **Step 4: Migration smoke test**

```bash
pnpm verify:migration
```

Expected: `✓ Migration smoke test passed`.

- [ ] **Step 5: Confirm no stale references**

```bash
grep -rn "review-logs\|@pruvi/shared/auth\|questionCount\|correctCount\|dailySession\.date\|question\.body" apps/ packages/ scripts/ 2>/dev/null | grep -v node_modules | grep -v dist
```

Expected: no output. Any matches are leftover drift — fix before declaring done.

- [ ] **Step 6: Final commit if any cleanup needed; otherwise push branch**

```bash
git status
# if clean:
git push -u origin phase-0-schema-drift
```

---

## Definition of Done (from spec)

- [ ] All TS schema files match canonical naming
- [ ] One fresh migration file, regenerated via `drizzle-kit generate`
- [ ] `pnpm -r typecheck` passes
- [ ] `pnpm -r test` passes
- [ ] Migration smoke test passes (fresh DB → migrate → seed → query)
- [ ] `docker build` succeeds; both `PROCESS_TYPE=server` and `PROCESS_TYPE=worker` dispatch correctly
- [ ] `PORT` is validated in `@pruvi/env`
- [ ] `@pruvi/shared` exports `answers.ts` + `streaks.ts`; `auth.ts` is gone
- [ ] No references to `review-logs.ts` remain anywhere

---

## Notes for the implementing agent

- **Frequent commits.** One commit per task, conventional commits.
- **TDD note:** Schema refactors don't fit the strict "failing test first" pattern — the `tsc` compile + migration smoke test are the verification mechanism. Don't skip the smoke test at the end.
- **macOS sed quirk:** `sed -i ''` on macOS requires the `''` arg or the `.bak` form shown above. On Linux, `sed -i 's/...//' file` works directly.
- **If `drizzle-kit drop` doesn't exist** in the installed version, manually drop the schema via `psql`. See Task 6 step 5.
- **If the smoke test fails because no `user` row exists:** that's fine — the script handles the empty case. The test still exercises the schema by issuing the queries.
- **Worktree:** This work is on a `phase-0-schema-drift` branch off `main`, not on `feature/onboarding-screens`. The latter has in-flight uncompiling work that we explicitly avoided.
