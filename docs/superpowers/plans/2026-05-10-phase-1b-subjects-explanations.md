# Phase 1B (code) — Subjects + Explanations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /subjects` endpoint, add nullable `question.explanation` column, and surface it in `POST /questions/:id/answer` response.

**Architecture:** New `subjects/` feature module mirroring `users/`. Additive schema migration for `explanation`. Reviews service extends its return type with the explanation text. No content backfill — frontend renders fallback for nulls.

**Tech Stack:** Drizzle ORM, Fastify with `fastify-type-provider-zod`, Vitest + PGlite, Zod via `@pruvi/shared`, `neverthrow` Results.

**Reference spec:** `docs/superpowers/specs/2026-05-10-phase-1b-subjects-explanations-design.md`

---

## File Structure

### Created
- `apps/server/src/features/subjects/index.ts`
- `apps/server/src/features/subjects/subjects.repository.ts`
- `apps/server/src/features/subjects/subjects.service.ts`
- `apps/server/src/features/subjects/subjects.route.ts`
- `apps/server/src/features/subjects/subjects.service.test.ts`
- `apps/server/src/features/subjects/subjects.repository.integration.test.ts`
- `packages/db/src/migrations/0002_*.sql` — auto-generated

### Modified
- `packages/db/src/schema/questions.ts` — add `explanation` column
- `packages/db/src/test-client.ts` — add `explanation` to question DDL
- `packages/shared/src/subjects.ts` — add `SubjectsListResponseSchema`
- `packages/shared/src/answers.ts` — extend `AnswerQuestionResponseSchema` with `explanation`
- `apps/server/src/features/reviews/reviews.service.ts` — include `explanation` in answer result
- `apps/server/src/features/reviews/reviews.service.test.ts` — update mock fixtures + assertions
- `apps/server/src/index.ts` — register `subjectsRoutes`

---

## Task 0: Branch setup

**Files:** none (branching only)

- [ ] **Step 1: Confirm on `phase-1c-progress-calendar` and clean**

```bash
cd /Users/cesarcamillo/dev/pruvi
git status --short
git log --oneline -3
```

Expected: on `phase-1c-progress-calendar`; clean working tree (untracked docs are fine).

- [ ] **Step 2: Create Phase 1B branch off Phase 1C**

```bash
git checkout -b phase-1b-subjects-explanations
git log --oneline -3
```

Expected: HEAD matches `phase-1c-progress-calendar`.

- [ ] **Step 3: Verify baseline**

```bash
pnpm run check-types 2>&1 | grep "error TS" | grep -v "test\.ts\|integration\.test" | head -3
pnpm --filter server test 2>&1 | tail -5
```

Expected: zero non-test errors; 64/64 unit tests pass.

No commit for Task 0.

---

## Task 1: Add `question.explanation` column

**Files:**
- Modify: `packages/db/src/schema/questions.ts`
- Modify: `packages/db/src/test-client.ts`

- [ ] **Step 1: Edit `packages/db/src/schema/questions.ts`**

Add the `explanation` column between `requiresCalculation` and `source`. The full table block should read:

```typescript
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("question_subject_difficulty_idx").on(table.subjectId, table.difficulty),
  ],
);
```

Imports stay unchanged (already have `text`).

- [ ] **Step 2: Edit `packages/db/src/test-client.ts`**

Find the `CREATE TABLE IF NOT EXISTS "question"` block. Add `explanation TEXT,` between `requires_calculation` and `source`:

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
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/cesarcamillo/dev/pruvi
pnpm run check-types 2>&1 | grep "error TS" | grep -v "test\.ts\|integration\.test" | head -5
```

Expected: zero non-test errors. Reviews tests will fail later if their fixtures don't update — that's expected and fixed in Task 5.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/questions.ts packages/db/src/test-client.ts
git commit -m "feat(db): add nullable explanation column to question"
```

---

## Task 2: Generate + apply migration

**Files:**
- Create: `packages/db/src/migrations/0002_*.sql` (auto-generated)
- Modify: `packages/db/src/migrations/meta/_journal.json` (auto-generated)

- [ ] **Step 1: Generate migration**

```bash
cd /Users/cesarcamillo/dev/pruvi/packages/db
pnpm exec drizzle-kit generate
cd ../..
```

Expected: new `0002_<name>.sql` file appears; `_journal.json` gains a third entry.

- [ ] **Step 2: Inspect the SQL**

```bash
cat packages/db/src/migrations/0002_*.sql
```

Expected output:
```sql
ALTER TABLE "question" ADD COLUMN "explanation" text;
```

If the migration contains anything other than this single ALTER COLUMN, STOP and report DONE_WITH_CONCERNS.

- [ ] **Step 3: Apply migration**

```bash
cd packages/db
pnpm exec drizzle-kit migrate
cd ../..
```

Verify the column landed:
```bash
docker exec pruvi-postgres psql -U postgres -d pruvi -c "\d question" | grep explanation
```

Expected output shows `explanation` as text, nullable.

- [ ] **Step 4: Run smoke test**

```bash
cd /Users/cesarcamillo/dev/pruvi
pnpm verify:migration 2>&1 | tail -8
```

Expected: `✓ Migration smoke test passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/migrations/
git commit -m "feat(db): generate migration for question.explanation"
```

---

## Task 3: Extend shared schemas

**Files:**
- Modify: `packages/shared/src/subjects.ts`
- Modify: `packages/shared/src/answers.ts`

- [ ] **Step 1: Add `SubjectsListResponseSchema` to `packages/shared/src/subjects.ts`**

Read the current file first. After the existing `subjectSchema` and `Subject` type exports, append:

```typescript
export const SubjectsListResponseSchema = z.object({
  subjects: z.array(subjectSchema),
});

export type SubjectsListResponse = z.infer<typeof SubjectsListResponseSchema>;
```

Final file content:
```typescript
import { z } from "zod";

export const subjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
});

export type Subject = z.infer<typeof subjectSchema>;

export const SubjectsListResponseSchema = z.object({
  subjects: z.array(subjectSchema),
});

export type SubjectsListResponse = z.infer<typeof SubjectsListResponseSchema>;
```

- [ ] **Step 2: Extend `AnswerQuestionResponseSchema` in `packages/shared/src/answers.ts`**

Replace the schema definition. Final file content:

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
  explanation: z.string().nullable(),
});

export type AnswerQuestionResponse = z.infer<typeof AnswerQuestionResponseSchema>;
```

- [ ] **Step 3: Typecheck**

```bash
pnpm run check-types 2>&1 | grep "error TS" | grep -v "test\.ts\|integration\.test" | head -5
```

Expected: zero non-test errors at this point. The reviews service hasn't been updated yet but the response shape it returns is a structural type — adding a required `explanation` field to `AnswerQuestionResponseSchema` doesn't break compilation because the schema is consumed by the route, not by the service.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/subjects.ts packages/shared/src/answers.ts
git commit -m "feat(shared): add SubjectsListResponseSchema and extend answer response with explanation"
```

---

## Task 4: Create `subjects/` feature module

**Files:**
- Create: `apps/server/src/features/subjects/subjects.repository.ts`
- Create: `apps/server/src/features/subjects/subjects.service.ts`
- Create: `apps/server/src/features/subjects/subjects.route.ts`
- Create: `apps/server/src/features/subjects/index.ts`
- Create: `apps/server/src/features/subjects/subjects.service.test.ts`

- [ ] **Step 1: Create `subjects.repository.ts`**

```typescript
import { subject } from "@pruvi/db/schema/subjects";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export class SubjectsRepository {
  constructor(private db: DbClient) {}

  async listAll() {
    return this.db
      .select({
        id: subject.id,
        slug: subject.slug,
        name: subject.name,
      })
      .from(subject)
      .orderBy(subject.name);
  }
}
```

- [ ] **Step 2: Create `subjects.service.ts`**

```typescript
import { ok, type Result } from "neverthrow";
import type { AppError } from "../../utils/errors";
import type { SubjectsRepository } from "./subjects.repository";

type Subject = Awaited<ReturnType<SubjectsRepository["listAll"]>>[number];

export class SubjectsService {
  constructor(private repo: SubjectsRepository) {}

  async list(): Promise<Result<{ subjects: Subject[] }, AppError>> {
    const subjects = await this.repo.listAll();
    return ok({ subjects });
  }
}
```

- [ ] **Step 3: Create `subjects.route.ts`**

```typescript
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { db } from "@pruvi/db";
import { SubjectsRepository } from "./subjects.repository";
import { SubjectsService } from "./subjects.service";
import { successResponse, unwrapResult } from "../../types";

const repo = new SubjectsRepository(db);
const service = new SubjectsService(repo);

const SUBJECTS_CACHE_TTL = 300;
const CACHE_KEY = "subjects:list";

export const subjectsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/subjects",
    { preHandler: [fastify.authenticate] },
    async () => {
      const cached = await fastify.cache.get<unknown>(CACHE_KEY);
      if (cached) {
        return successResponse(cached);
      }
      const result = await service.list();
      const response = unwrapResult(result);
      await fastify.cache.set(CACHE_KEY, response.data, SUBJECTS_CACHE_TTL);
      return response;
    }
  );
};
```

- [ ] **Step 4: Create `index.ts`**

```typescript
export { subjectsRoutes } from "./subjects.route";
```

- [ ] **Step 5: Create `subjects.service.test.ts`**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SubjectsService } from "./subjects.service";
import type { SubjectsRepository } from "./subjects.repository";

function makeMockRepo() {
  return {
    listAll: vi.fn(),
  } as unknown as SubjectsRepository & {
    listAll: ReturnType<typeof vi.fn>;
  };
}

describe("SubjectsService", () => {
  let repo: ReturnType<typeof makeMockRepo>;
  let service: SubjectsService;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new SubjectsService(repo);
  });

  it("returns subjects from repo wrapped in { subjects } shape", async () => {
    const rows = [
      { id: 1, slug: "matematica", name: "Matemática" },
      { id: 2, slug: "biologia", name: "Biologia" },
    ];
    repo.listAll.mockResolvedValue(rows);

    const result = await service.list();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({ subjects: rows });
    }
  });

  it("returns empty list when repo returns empty", async () => {
    repo.listAll.mockResolvedValue([]);
    const result = await service.list();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.subjects).toEqual([]);
    }
  });
});
```

- [ ] **Step 6: Run unit tests**

```bash
cd /Users/cesarcamillo/dev/pruvi
pnpm --filter server exec vitest run src/features/subjects/subjects.service.test.ts 2>&1 | tail -10
```

Expected: 2 tests pass.

- [ ] **Step 7: Typecheck**

```bash
pnpm run check-types 2>&1 | grep "error TS" | grep -v "test\.ts\|integration\.test" | head -5
```

Expected: zero non-test errors.

- [ ] **Step 8: Commit**

```bash
git add apps/server/src/features/subjects/
git commit -m "feat(server): add subjects feature (GET /subjects, list + cache)"
```

---

## Task 5: Surface explanation in answer response

**Files:**
- Modify: `apps/server/src/features/reviews/reviews.service.ts`
- Modify: `apps/server/src/features/reviews/reviews.service.test.ts`

- [ ] **Step 1: Update `reviews.service.ts` return type and value**

The current `answerQuestion` returns:
```typescript
{
  correct: boolean;
  correctOptionIndex: number;
  livesRemaining: number;
  xpAwarded: number;
}
```

Extend it to:
```typescript
{
  correct: boolean;
  correctOptionIndex: number;
  livesRemaining: number;
  xpAwarded: number;
  explanation: string | null;
}
```

Read the file first. Find the `Promise<Result<{...}>>` signature (around line 21) and add `explanation: string | null` to the inner shape:

```typescript
  async answerQuestion(
    userId: string,
    questionId: number,
    selectedOptionIndex: number
  ): Promise<
    Result<
      {
        correct: boolean;
        correctOptionIndex: number;
        livesRemaining: number;
        xpAwarded: number;
        explanation: string | null;
      },
      AppError
    >
  > {
```

Then find the final `return ok({ ... })` at the bottom of the method. Add `explanation: q.explanation ?? null,` to the returned object:

```typescript
    return ok({
      correct,
      correctOptionIndex: q.correctOptionIndex,
      livesRemaining,
      xpAwarded,
      explanation: q.explanation ?? null,
    });
```

The `q` variable already holds the full question row (via `findQuestionById` which uses `.select()` without projection — it returns all columns including the new `explanation`).

- [ ] **Step 2: Update mock fixtures in `reviews.service.test.ts`**

Read the file. Find every place that constructs a mock question (search for `correctOptionIndex` literals or `findQuestionById.mockResolvedValue`). Each mock question object needs an `explanation` field. Pattern:

```typescript
// Before:
const mockQuestion = {
  id: 1,
  content: "...",
  correctOptionIndex: 0,
  // ...
};

// After:
const mockQuestion = {
  id: 1,
  content: "...",
  correctOptionIndex: 0,
  explanation: null,  // or "test explanation" where appropriate
  // ...
};
```

Add at least one test that asserts `explanation` flows through correctly. Find the existing "first review uses INITIAL_SM2_STATE" or "answer correctness" test and add:

```typescript
it("includes explanation from question in the answer result", async () => {
  // Use whatever mock setup the test file already has; just modify mockQuestion
  // to include explanation: "Test explanation text"
  // ... existing setup ...
  mockRepo.findQuestionById.mockResolvedValue({
    ...baseMockQuestion,  // (or whatever the file's pattern is)
    explanation: "Newton's second law: F=ma",
  });

  const result = await service.answerQuestion(USER_ID, QUESTION_ID, 1);

  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value.explanation).toBe("Newton's second law: F=ma");
  }
});

it("returns null explanation when question has no explanation", async () => {
  mockRepo.findQuestionById.mockResolvedValue({
    ...baseMockQuestion,
    explanation: null,
  });

  const result = await service.answerQuestion(USER_ID, QUESTION_ID, 1);

  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value.explanation).toBeNull();
  }
});
```

(Adapt to whatever existing fixture pattern the file uses — read it first.)

- [ ] **Step 3: Run tests**

```bash
cd /Users/cesarcamillo/dev/pruvi
pnpm --filter server exec vitest run src/features/reviews/reviews.service.test.ts 2>&1 | tail -15
```

Expected: all reviews service tests pass (existing + 2 new).

- [ ] **Step 4: Typecheck**

```bash
pnpm run check-types 2>&1 | grep "error TS" | grep -v "test\.ts\|integration\.test" | head -5
```

Expected: zero non-test errors.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/features/reviews/
git commit -m "feat(server): surface question explanation in answer response"
```

---

## Task 6: Subjects integration test

**Files:**
- Create: `apps/server/src/features/subjects/subjects.repository.integration.test.ts`

- [ ] **Step 1: Create the integration test**

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDb, teardownTestDb, cleanupTestDb, getTestDb } from "../../test/db-helpers";
import { subject } from "@pruvi/db/schema/subjects";
import { SubjectsRepository } from "./subjects.repository";

describe("SubjectsRepository integration", () => {
  let repo: SubjectsRepository;

  beforeAll(async () => {
    await setupTestDb();
    repo = new SubjectsRepository(getTestDb());
  });

  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("listAll returns subjects sorted by name ASC", async () => {
    const db = getTestDb();

    await db.insert(subject).values([
      { name: "Química", slug: "quimica" },
      { name: "Biologia", slug: "biologia" },
      { name: "Matemática", slug: "matematica" },
    ]);

    const rows = await repo.listAll();

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.name)).toEqual(["Biologia", "Matemática", "Química"]);
    expect(rows.every((r) => typeof r.id === "number")).toBe(true);
    expect(rows.every((r) => typeof r.slug === "string")).toBe(true);
  });

  it("listAll returns empty array when no subjects", async () => {
    const rows = await repo.listAll();
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the integration test**

```bash
pnpm --filter server test:integration -- src/features/subjects/subjects.repository.integration.test.ts 2>&1 | tail -10
```

Expected: 2 tests pass.

- [ ] **Step 3: Run full integration suite to confirm no regression**

```bash
pnpm --filter server test:integration 2>&1 | tail -8
```

Expected: all integration tests pass (20 total = 18 from Phase 1C + 2 new).

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/features/subjects/subjects.repository.integration.test.ts
git commit -m "test(server): integration test for SubjectsRepository.listAll"
```

---

## Task 7: Register `subjectsRoutes` in server

**Files:**
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Add import**

Open `apps/server/src/index.ts`. Find the feature-route import block:

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

Add `subjectsRoutes` in alphabetical order (between `sessionsRoutes` and `streaksRoutes`):

```typescript
import { gamificationRoutes } from "./features/gamification";
import { livesRoutes } from "./features/lives";
import { onboardingRoutes } from "./features/onboarding";
import { progressRoutes } from "./features/progress";
import { reviewsRoutes } from "./features/reviews";
import { sessionsRoutes } from "./features/sessions";
import { streaksRoutes } from "./features/streaks";
import { subjectsRoutes } from "./features/subjects";
import { usersRoutes } from "./features/users";
```

- [ ] **Step 2: Register the route**

Find the registration block. Add `subjectsRoutes` at the end:

```typescript
  await app.register(sessionsRoutes);
  await app.register(reviewsRoutes);
  await app.register(livesRoutes);
  await app.register(streaksRoutes);
  await app.register(gamificationRoutes);
  await app.register(onboardingRoutes);
  await app.register(usersRoutes);
  await app.register(progressRoutes);
  await app.register(subjectsRoutes);
```

- [ ] **Step 3: Typecheck + tests**

```bash
pnpm run check-types 2>&1 | grep "error TS" | grep -v "test\.ts\|integration\.test" | head -5
pnpm --filter server test 2>&1 | tail -5
```

Expected: zero non-test errors; all unit tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/index.ts
git commit -m "feat(server): register subjectsRoutes"
```

---

## Task 8: Final verification + PR

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

Expected: all tests pass (~68 = 64 + 4 new from subjects + reviews extension).

- [ ] **Step 3: Integration tests**

```bash
pnpm --filter server test:integration 2>&1 | tail -8
```

Expected: all integration tests pass (~20 = 18 + 2 new).

- [ ] **Step 4: Migration smoke test**

```bash
pnpm verify:migration 2>&1 | tail -8
```

Expected: `✓ Migration smoke test passed`.

- [ ] **Step 5: Push and open PR**

```bash
git push -u origin phase-1b-subjects-explanations
gh pr create --base phase-1c-progress-calendar --head phase-1b-subjects-explanations \
  --title "Phase 1B (code): subjects endpoint + question explanations" \
  --body "$(cat <<'EOF'
## Summary

Code-only portion of Phase 1B. Stacked on Phase 1C (#12).

- Adds `question.explanation` column (nullable text). Migration `0002_*.sql`.
- Surfaces explanation via `POST /questions/:id/answer` response.
- Adds `GET /subjects` endpoint returning `{ subjects: [{ id, slug, name }] }` sorted by name; cached 300s.

## Out of scope (content ops)

- Backfilling explanations for the 111 existing seeded questions
- Question bank expansion to 500+ with FUVEST/UNICAMP coverage

Frontend renders a brand-voice fallback when `explanation` is null.

## Test plan

- [x] 4 new unit tests (2 subjects, 2 reviews extension)
- [x] 2 new integration tests (subjects sorted, subjects empty)
- [x] All existing tests pass
- [x] Smoke test passes
- [x] Migration is purely additive

## References

- Design: `docs/superpowers/specs/2026-05-10-phase-1b-subjects-explanations-design.md`
- Plan: `docs/superpowers/plans/2026-05-10-phase-1b-subjects-explanations.md`
EOF
)" 2>&1 | tail -3
```

---

## Definition of Done (from spec)

- [ ] `question.explanation` column added; migration generated
- [ ] `test-client.ts` updated to mirror new DDL
- [ ] `subjects/` feature module created
- [ ] `GET /subjects` registered, returns sorted subjects, cached 300s
- [ ] `POST /questions/:id/answer` response includes `explanation` field
- [ ] Shared schemas updated (`SubjectsListResponseSchema`, extended `AnswerQuestionResponseSchema`)
- [ ] All existing unit + integration tests pass
- [ ] 4 new unit tests + 2 new integration tests pass
- [ ] `pnpm verify:migration` passes
- [ ] No regression in existing endpoints

---

## Notes for the implementing agent

- **`getTestDb()` pattern**: integration tests use the shared helper, not a freshly-constructed Drizzle client. See `apps/server/src/features/users/users.repository.integration.test.ts` for the canonical setup.
- **`cleanupTestDb()` in `beforeEach`**: truncates between tests. Without it, "empty list" assertions can fail because prior test data persists.
- **`fastify.cache`**: from `apps/server/src/plugins/redis.ts`. Same API used in `apps/server/src/features/lives/lives.route.ts`.
- **Mock question fixtures in `reviews.service.test.ts`**: read the file first to find the existing fixture pattern. Don't invent a new fixture style; extend the existing one with `explanation: null` (or test text).
- **Migration ordering**: this is the third migration (after Phase 0's `0000_*` and Phase 1A's `0001_*`). `db-helpers.ts` iterates all migrations in sorted order — no special handling needed.
- **The seed file**: leave `seed.ts` alone. It deliberately doesn't write `explanation`. Future content backfill happens via direct UPDATE or a separate script.
