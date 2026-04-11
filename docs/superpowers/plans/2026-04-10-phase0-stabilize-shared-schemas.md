# Phase 0: Stabilize Shared Schemas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all broken imports between `@pruvi/shared` and `apps/server` so both compile and tests pass.

**Architecture:** Bottom-up — fix `@pruvi/shared` first (Tasks 1-4), then update `apps/server` to match (Tasks 5-6), then verify everything (Task 7). The shared package has no build step (raw TS via `exports` field), so changes are immediately available to consumers.

**Tech Stack:** TypeScript, Zod, neverthrow, Vitest

---

### Task 1: Add `Difficulty` type and client question schema to `questions.ts`

**Files:**
- Modify: `packages/shared/src/questions.ts`

- [ ] **Step 1: Add `Difficulty` type, mapper, `QualityScore` type, and `clientQuestionSchema`**

Open `packages/shared/src/questions.ts`. Add the following **after** the existing `questionSchema` and `Question` type (line 13), and **before** `answerRequestSchema` (line 15):

```typescript
// --- Difficulty ---

export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof difficultySchema>;

/** Map DB integer (1-5) to Difficulty label. 1-2 → easy, 3 → medium, 4-5 → hard. */
export function difficultyFromNumber(n: number): Difficulty {
  if (n <= 2) return "easy";
  if (n === 3) return "medium";
  return "hard";
}

/** SM-2 quality score: 0-5 scale used by the review service. */
export type QualityScore = 0 | 1 | 2 | 3 | 4 | 5;

// --- Client-safe question (no correctOptionIndex) ---

export const clientQuestionSchema = z.object({
  id: z.number(),
  body: z.string(),
  options: z.array(z.string()),
  difficulty: z.number(),
  source: z.string().nullable(),
  subjectId: z.number(),
});

export type ClientQuestion = z.infer<typeof clientQuestionSchema>;
```

- [ ] **Step 2: Remove stale `answerRequestSchema` and `answerResponseSchema`**

Delete lines 15-32 from `questions.ts` — the `answerRequestSchema`, `AnswerRequest`, `answerResponseSchema`, and `AnswerResponse` exports. These are duplicated with correct values in `auth.ts` (as `AnswerQuestionBodySchema` and `AnswerQuestionResponseSchema`).

The final file should contain: `questionSchema`, `Question`, `difficultySchema`, `Difficulty`, `difficultyFromNumber`, `QualityScore`, `clientQuestionSchema`, `ClientQuestion`. Nothing else.

- [ ] **Step 3: Verify `xp.ts` type resolution**

`xp.ts` imports `type { Difficulty } from "./questions"` — this now resolves. No changes needed in `xp.ts`. Run a quick type check:

Run: `cd packages/shared && npx tsc --noEmit src/xp.ts --skipLibCheck 2>&1 | head -20`
Expected: No errors (or only errors from other files — sessions.ts will still be broken until Task 3)

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/questions.ts
git commit -m "feat(shared): add Difficulty type, mapper, client question schema, remove stale answer schemas"
```

---

### Task 2: Add `INITIAL_SM2_STATE` to `sm2.ts` and delete stale test

**Files:**
- Modify: `packages/shared/src/sm2.ts`
- Delete: `packages/shared/src/sm2.test.ts`

- [ ] **Step 1: Add `INITIAL_SM2_STATE` constant**

Open `packages/shared/src/sm2.ts`. Add after the `Sm2Input` type definition (after line 11):

```typescript
/** Default SM-2 starting state for first-time reviews. */
export const INITIAL_SM2_STATE: Sm2Input = {
  quality: 0,
  repetitions: 0,
  easeFactor: 2.5,
  interval: 0,
};
```

- [ ] **Step 2: Delete the stale root-level SM-2 test**

Delete `packages/shared/src/sm2.test.ts`. This file tests a nonexistent API (`calculateSM2` with 3 args, `SM2StateSchema`, `SM2State` type) — it's from a prior refactor.

The real tests live in `packages/shared/src/__tests__/sm2.test.ts` and test the current `calculateSm2(input)` API.

- [ ] **Step 3: Run the real SM-2 tests**

Run: `cd packages/shared && npx vitest run src/__tests__/sm2.test.ts 2>&1 | tail -20`
Expected: All tests pass (the `calculateSm2` function is unchanged)

- [ ] **Step 4: Run the XP tests**

Run: `cd packages/shared && npx vitest run src/xp.test.ts 2>&1 | tail -20`
Expected: All tests pass (the `Difficulty` type now resolves from Task 1)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/sm2.ts
git rm packages/shared/src/sm2.test.ts
git commit -m "feat(shared): add INITIAL_SM2_STATE, delete stale sm2 test"
```

---

### Task 3: Rewrite `sessions.ts` with all session schemas

**Files:**
- Modify: `packages/shared/src/sessions.ts`

- [ ] **Step 1: Rewrite sessions.ts**

Replace the entire contents of `packages/shared/src/sessions.ts` with:

```typescript
import { z } from "zod";
import { clientQuestionSchema } from "./questions";

// --- Session object as returned by API ---

export const sessionSchema = z.object({
  id: z.number(),
  userId: z.string(),
  date: z.string(),
  questionsAnswered: z.number(),
  questionsCorrect: z.number(),
  completedAt: z.string().nullable(),
});

export type Session = z.infer<typeof sessionSchema>;

// --- POST /sessions/start ---

export const startSessionBodySchema = z.object({
  mode: z.enum(["all", "theoretical"]),
});

export type StartSessionBody = z.infer<typeof startSessionBodySchema>;

export const startSessionResponseSchema = z.object({
  session: sessionSchema,
  questions: z.array(clientQuestionSchema),
});

export type StartSessionResponse = z.infer<typeof startSessionResponseSchema>;

// --- POST /sessions/:id/complete ---

export const completeSessionBodySchema = z.object({
  questionCount: z.number().int().min(0),
  correctCount: z.number().int().min(0),
});

export type CompleteSessionBody = z.infer<typeof completeSessionBodySchema>;

export const completeSessionResponseSchema = z.object({
  session: sessionSchema,
});

export type CompleteSessionResponse = z.infer<typeof completeSessionResponseSchema>;

// --- GET /sessions/today ---

export const todaySessionResponseSchema = z.object({
  session: sessionSchema.nullable(),
});

export type TodaySessionResponse = z.infer<typeof todaySessionResponseSchema>;

// --- GET /streaks (kept for backward compat, duplicates StreakResponseSchema in auth.ts) ---

export const sessionStatsSchema = z.object({
  currentStreak: z.number(),
  longestStreak: z.number(),
  totalSessions: z.number(),
});

export type SessionStats = z.infer<typeof sessionStatsSchema>;
```

- [ ] **Step 2: Verify sessions.ts types resolve**

Run: `cd packages/shared && npx tsc --noEmit src/sessions.ts --skipLibCheck 2>&1 | head -20`
Expected: No type errors (all references are now defined)

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/sessions.ts
git commit -m "feat(shared): rewrite sessions.ts with all session schemas"
```

---

### Task 4: Fix `index.ts` re-exports

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add missing re-exports**

Replace `packages/shared/src/index.ts` with:

```typescript
export * from "./questions";
export * from "./subjects";
export * from "./sessions";
export * from "./sm2";
export * from "./xp";
export * from "./lives";
export * from "./auth";
```

This makes `MAX_LIVES`, `calculateXpForAnswer`, `getLevelForXp`, `xpForNextLevel`, `AnswerQuestionBodySchema`, `AnswerQuestionResponseSchema`, `StreakResponseSchema`, `XpResponseSchema`, `LivesResponseSchema`, and all other exports available via `import { ... } from "@pruvi/shared"`.

- [ ] **Step 2: Verify shared package types**

Run: `cd packages/shared && npx tsc --noEmit --skipLibCheck 2>&1 | head -20`
Expected: No errors — all files compile, all cross-file imports resolve.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): re-export xp, lives, and auth modules from index"
```

---

### Task 5: Update server `reviews` feature imports and SM-2 call

**Files:**
- Modify: `apps/server/src/features/reviews/reviews.service.ts`
- Modify: `apps/server/src/features/reviews/reviews.route.ts`

- [ ] **Step 1: Update `reviews.service.ts`**

Replace the import block and update the SM-2 call site and difficulty mapping. The key changes:

1. Import names: `calculateSM2` → `calculateSm2`, add `difficultyFromNumber`
2. SM-2 call: `calculateSM2(previousState, quality)` → `calculateSm2({ quality, repetitions, easeFactor, interval })._unsafeUnwrap()`
3. The previous state uses `easinessFactor` (DB column) but SM-2 expects `easeFactor` — map at the call site
4. SM-2 output uses `easeFactor` but repo `insertReview` expects `easinessFactor` — map back
5. Difficulty: `q.difficulty as Difficulty` → `difficultyFromNumber(q.difficulty)`

Replace lines 1-8 of `reviews.service.ts` with:

```typescript
import { err, ok, type Result } from "neverthrow";
import {
  calculateSm2,
  INITIAL_SM2_STATE,
  calculateXpForAnswer,
  difficultyFromNumber,
  type QualityScore,
} from "@pruvi/shared";
import type { AppError } from "../../utils/errors";
import { NotFoundError, ValidationError } from "../../utils/errors";
import type { ReviewsRepository } from "./reviews.repository";
```

Replace lines 42-67 (the SM-2 block from quality assignment through insertReview) with:

```typescript
    // 3. Map to SM-2 quality score (correct=4, wrong=1)
    const quality: QualityScore = correct ? 4 : 1;

    // 4. Get latest review state (or use initial state)
    const latestReview = await this.repo.findLatestReview(userId, questionId);
    const previousState = latestReview
      ? {
          quality,
          repetitions: latestReview.repetitions,
          easeFactor: Number(latestReview.easinessFactor),
          interval: latestReview.interval,
        }
      : { ...INITIAL_SM2_STATE, quality };

    // 5. Calculate new SM-2 state
    const newState = calculateSm2(previousState)._unsafeUnwrap();

    // 6. Insert new review_log row
    await this.repo.insertReview({
      userId,
      questionId,
      quality,
      easinessFactor: newState.easeFactor.toFixed(2),
      interval: newState.interval,
      repetitions: newState.repetitions,
      nextReviewAt: new Date(newState.nextReviewAt),
    });

    // 6b. Award XP
    const xpAwarded = calculateXpForAnswer(
      correct,
      difficultyFromNumber(q.difficulty)
    );
```

Key mapping points:
- DB → SM-2: `latestReview.easinessFactor` (string) → `easeFactor` (number) via `Number()`
- SM-2 → DB: `newState.easeFactor` (number) → `easinessFactor` (string) via `.toFixed(2)`
- SM-2 → DB: `newState.nextReviewAt` (ISO string) → `nextReviewAt` (Date) via `new Date()`

- [ ] **Step 2: Update `reviews.route.ts` (no changes needed)**

The route imports `AnswerQuestionBodySchema` from `@pruvi/shared`. This schema lives in `auth.ts` and is now re-exported via `index.ts` (Task 4). The import resolves. No code changes needed.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/features/reviews/reviews.service.ts
git commit -m "fix(server): align reviews service with shared SM-2 API and difficulty mapper"
```

---

### Task 6: Update server `sessions` route imports

**Files:**
- Modify: `apps/server/src/features/sessions/sessions.route.ts`

- [ ] **Step 1: Update the import and schema references**

Replace line 3 of `sessions.route.ts`:

```typescript
// Before:
import { StartSessionBodySchema } from "@pruvi/shared";

// After:
import { startSessionBodySchema, completeSessionBodySchema } from "@pruvi/shared";
```

Replace line 25 (inside the `/sessions/start` route schema):

```typescript
// Before:
        body: StartSessionBodySchema,

// After:
        body: startSessionBodySchema,
```

Replace lines 83-89 (inside the `/sessions/:id/complete` route schema):

```typescript
// Before:
      schema: {
        params: z.object({
          id: z.coerce.number().int(),
        }),
        body: z.object({
          questionCount: z.number().int().min(0),
          correctCount: z.number().int().min(0),
        }),
      },

// After:
      schema: {
        params: z.object({
          id: z.coerce.number().int(),
        }),
        body: completeSessionBodySchema,
      },
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/features/sessions/sessions.route.ts
git commit -m "fix(server): use shared session schemas in sessions route"
```

---

### Task 7: Fix server tests and run full verification

**Files:**
- Modify: `apps/server/src/features/reviews/reviews.service.test.ts`

- [ ] **Step 1: Update mock question difficulty from string to number**

The `reviews.service.ts` now calls `difficultyFromNumber(q.difficulty)` which expects a number (matching the DB column type). The test mocks need to return numbers instead of strings.

In `reviews.service.test.ts`, update the `makeQuestion` helper (line 20-25):

```typescript
// Before:
const makeQuestion = (overrides?: Partial<{ difficulty: string; correctOptionIndex: number }>) => ({
  id: QUESTION_ID,
  correctOptionIndex: 2,
  difficulty: "medium",
  ...overrides,
});

// After:
const makeQuestion = (overrides?: Partial<{ difficulty: number; correctOptionIndex: number }>) => ({
  id: QUESTION_ID,
  correctOptionIndex: 2,
  difficulty: 3,
  ...overrides,
});
```

Update the test on line 42 that overrides difficulty to `"hard"`:

```typescript
// Before:
    mockRepo.findQuestionById.mockResolvedValue(makeQuestion({ difficulty: "hard" }));

// After:
    mockRepo.findQuestionById.mockResolvedValue(makeQuestion({ difficulty: 4 }));
```

XP expectations stay the same: `difficultyFromNumber(4)` returns `"hard"`, and `calculateXpForAnswer(true, "hard")` returns 35.

- [ ] **Step 2: Update SM-2 test assertion for `easinessFactor` field**

In the test "first review uses INITIAL_SM2_STATE..." (line 122-157), the insertReview call now passes `easeFactor` mapped to `easinessFactor` string. The test assertions on lines 130-131 need updating:

```typescript
// Before (lines 129-131):
    const firstCall = mockRepo.insertReview.mock.calls[0]![0];
    // INITIAL_SM2_STATE has EF=2.5, repetitions=0, interval=0
    // With quality=4 on initial state (rep=0): newInterval=1, newRepetitions=1
    expect(firstCall.repetitions).toBe(1);
    expect(firstCall.interval).toBe(1);

// After:
    const firstCall = mockRepo.insertReview.mock.calls[0]![0];
    // INITIAL_SM2_STATE has easeFactor=2.5, repetitions=0, interval=0
    // With quality=4 on initial state (rep=0): newInterval=1, newRepetitions=1
    expect(firstCall.repetitions).toBe(1);
    expect(firstCall.interval).toBe(1);
    expect(firstCall.easinessFactor).toBe("2.50");
```

The second review assertion on line 156 uses `Math.floor` but the current SM-2 uses `Math.round`. Update:

```typescript
// Before (line 156):
    expect(secondCall.interval).toBe(Math.floor(6 * 2.6)); // 15

// After:
    expect(secondCall.interval).toBe(Math.round(6 * 2.6)); // 16
```

Note: `Math.round(6 * 2.6)` = `Math.round(15.6)` = 16, not 15.

- [ ] **Step 3: Run server unit tests**

Run: `cd apps/server && npx vitest run 2>&1 | tail -30`
Expected: All unit tests pass.

- [ ] **Step 4: Run shared package tests**

Run: `cd packages/shared && npx vitest run 2>&1 | tail -20`
Expected: All tests pass (stale sm2.test.ts is deleted, xp.test.ts and __tests__/sm2.test.ts pass).

- [ ] **Step 5: Full type check**

Run: `cd apps/server && npx tsc --noEmit 2>&1 | head -30`
Expected: No type errors.

Run: `cd packages/shared && npx tsc --noEmit --skipLibCheck 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/features/reviews/reviews.service.test.ts
git commit -m "fix(server): update review test mocks for difficulty numbers and SM-2 alignment"
```

---

### Summary of all files changed

| Task | File | Change |
|------|------|--------|
| 1 | `packages/shared/src/questions.ts` | Add Difficulty, QualityScore, clientQuestionSchema; remove stale answer schemas |
| 2 | `packages/shared/src/sm2.ts` | Add INITIAL_SM2_STATE |
| 2 | `packages/shared/src/sm2.test.ts` | Delete (stale) |
| 3 | `packages/shared/src/sessions.ts` | Full rewrite with all session schemas |
| 4 | `packages/shared/src/index.ts` | Add 3 re-export lines |
| 5 | `apps/server/src/features/reviews/reviews.service.ts` | SM-2 call, difficulty mapper, field name mapping |
| 6 | `apps/server/src/features/sessions/sessions.route.ts` | Import name changes |
| 7 | `apps/server/src/features/reviews/reviews.service.test.ts` | Mock difficulty → number, SM-2 assertion fixes |
