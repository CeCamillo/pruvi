# Phase 0: Stabilize Backend + Shared Schemas

> Design spec for fixing `@pruvi/shared` exports and aligning server imports.

## Context

The server (`apps/server`) has 10 broken imports from `@pruvi/shared`. The shared package has missing re-exports, undefined schema references, an SM-2 naming mismatch, and no `Difficulty` type. This blocks all frontend integration work.

## Scope

- Fix `@pruvi/shared` to export every schema both server and native need
- Update server imports and call sites to match
- Delete stale tests, verify everything passes
- NOT touching: native app, DB schema, worker code, Dockerfile, new endpoints

## Design Decisions

1. **SM-2 function:** Keep existing single-object API `calculateSm2(input: Sm2Input)`. Server adapts by merging state + quality into one object. Already tested, follows Zod pattern.
2. **Answer response shape:** Align schema to server's actual response `{ correct, correctOptionIndex, livesRemaining, xpAwarded }`. Drop SM-2 internals (`reviewLog`) — frontend doesn't need them.
3. **Difficulty type:** Three-tier string enum `"easy" | "medium" | "hard"` with `difficultyFromNumber(n)` mapper. DB stores integer 1-5, mapping: 1-2 → easy, 3 → medium, 4-5 → hard. Server maps at DB boundary.
4. **Schema naming:** All Zod schemas use camelCase (`sessionSchema`, `startSessionBodySchema`) to match existing pattern (`questionSchema`, `subjectSchema`).

## Changes

### 1. `packages/shared/src/index.ts` — Add missing re-exports

Add 3 lines to export `xp.ts`, `lives.ts`, `auth.ts`. Fixes 6 broken server imports.

```typescript
export * from "./questions";
export * from "./subjects";
export * from "./sessions";
export * from "./sm2";
export * from "./xp";
export * from "./lives";
export * from "./auth";
```

### 2. `packages/shared/src/questions.ts` — Add types, client schema, fix answer response

Add:
- `difficultySchema` — `z.enum(["easy", "medium", "hard"])`
- `Difficulty` type — inferred from schema
- `difficultyFromNumber(n: number): Difficulty` — maps DB integer to string
- `QualityScore` type — `0 | 1 | 2 | 3 | 4 | 5`
- `clientQuestionSchema` — same as `questionSchema` but without `correctOptionIndex` (what frontend receives)
- `ClientQuestion` type

Fix `answerResponseSchema` to match server reality:
```typescript
export const answerResponseSchema = z.object({
  correct: z.boolean(),
  correctOptionIndex: z.number(),
  livesRemaining: z.number().int().min(0),
  xpAwarded: z.number().int().min(0),
});
```

Existing `questionSchema` and `answerRequestSchema` stay unchanged.

### 3. `packages/shared/src/sm2.ts` — Add INITIAL_SM2_STATE

```typescript
export const INITIAL_SM2_STATE: Sm2Input = {
  quality: 0,
  repetitions: 0,
  easeFactor: 2.5,
  interval: 0,
};
```

Delete stale `packages/shared/src/sm2.test.ts` (tests nonexistent API). Keep `packages/shared/src/__tests__/sm2.test.ts` (tests real implementation).

### 4. `packages/shared/src/sessions.ts` — Full rewrite

Define all session-related schemas from scratch:
- `sessionSchema` — `{ id, userId, date, questionsAnswered, questionsCorrect, completedAt }`
- `startSessionBodySchema` — `{ mode: "all" | "theoretical" }`
- `startSessionResponseSchema` — `{ session, questions: ClientQuestion[] }`
- `completeSessionBodySchema` — `{ questionCount, correctCount }` (exists, keep)
- `completeSessionResponseSchema` — `{ session }`
- `todaySessionResponseSchema` — `{ session | null }`
- `sessionStatsSchema` — `{ currentStreak, longestStreak, totalSessions }` (exists, keep)

Import `clientQuestionSchema` from `./questions`.

### 5. Server import updates

All changes are mechanical — update import names and adapt call sites:

**`features/reviews/reviews.service.ts`:**
- `calculateSM2(state, quality)` → `calculateSm2({ ...state, quality })._unsafeUnwrap()`
- `q.difficulty as Difficulty` → `difficultyFromNumber(q.difficulty)`
- Import `calculateSm2`, `INITIAL_SM2_STATE`, `difficultyFromNumber`, etc. from `@pruvi/shared`

**`features/reviews/reviews.route.ts`:**
- `AnswerQuestionBodySchema` → `answerRequestSchema`

**`features/sessions/sessions.route.ts`:**
- `StartSessionBodySchema` → `startSessionBodySchema`
- Replace inline complete body schema with `completeSessionBodySchema`

**`features/gamification/gamification.service.ts`:**
- Imports now resolve (index.ts re-exports xp.ts). No call site changes.

**Lives imports (repository, service):**
- `MAX_LIVES` now resolves (index.ts re-exports lives.ts). No call site changes.

### 6. Test reconciliation

- Delete `packages/shared/src/sm2.test.ts` (stale)
- Keep `packages/shared/src/__tests__/sm2.test.ts` (tests real API)
- `xp.test.ts` should pass after `Difficulty` type is defined
- Server tests use mocked repos — may need minor mock expectation updates for SM-2 call pattern

## Exit Criteria

| Check | Command | Expected |
|-------|---------|----------|
| Shared types resolve | `bunx tsc --noEmit` from `packages/shared` | No errors |
| Server compiles | `bunx tsc --noEmit` from `apps/server` | No errors |
| Shared tests pass | `vitest run` from `packages/shared` | Green |
| Server tests pass | `vitest run` from `apps/server` | Green |
| All schemas importable | Import any schema from `@pruvi/shared` | Resolves |

## Files Changed

| File | Change type |
|------|------------|
| `packages/shared/src/index.ts` | Edit (add 3 re-export lines) |
| `packages/shared/src/questions.ts` | Edit (add types, client schema, fix answer response) |
| `packages/shared/src/sm2.ts` | Edit (add INITIAL_SM2_STATE) |
| `packages/shared/src/sm2.test.ts` | Delete (stale) |
| `packages/shared/src/sessions.ts` | Rewrite (define all session schemas) |
| `apps/server/src/features/reviews/reviews.service.ts` | Edit (SM-2 call, difficulty mapper) |
| `apps/server/src/features/reviews/reviews.route.ts` | Edit (schema import name) |
| `apps/server/src/features/sessions/sessions.route.ts` | Edit (schema import names) |
| `apps/server/src/features/gamification/gamification.service.ts` | Edit (import resolves, maybe Difficulty param) |
