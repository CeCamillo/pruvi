# SM-2 Spaced Repetition Algorithm — Design Spec

**Date:** 2026-03-15
**Status:** Approved
**Unblocks:** review service, smart question selection, session pre-generation

---

## Context

Pruvi needs a spaced repetition algorithm to schedule when a student should next review a question. The SM-2 algorithm (the same one Anki uses) is the foundation: well-understood, well-tested, and sufficient until enough user data exists to build a custom model.

This is implemented as a **pure function** in `@pruvi/shared` with no database access or side effects. Shared placement lets both the server-side review service and any future client-side optimistic UI use identical logic.

---

## Types

```ts
// packages/shared/src/sm2.ts

export type QualityScore = 0 | 1 | 2 | 3 | 4 | 5;

export interface SM2State {
  easinessFactor: number;  // starts at 2.5, never < 1.3
  interval: number;        // days until next review
  repetitions: number;     // consecutive correct reviews
  nextReviewAt: Date;      // absolute date of next review
}

export const SM2StateSchema = z.object({
  easinessFactor: z.number().min(1.3),
  interval: z.number().int().min(0), // 0 = not yet scheduled (initial state)
  repetitions: z.number().int().min(0),
  nextReviewAt: z.coerce.date(),
});
```

---

## Function Signature

```ts
export function calculateSM2(
  state: SM2State,
  quality: QualityScore,
  now?: Date  // defaults to new Date(); injectable for deterministic tests
): SM2State
```

---

## Algorithm Logic

### Easiness Factor (EF) update — always applied

```
EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
EF' = max(1.3, EF')
```

### Interval and repetition update

| Condition | repetitions | interval |
|---|---|---|
| `quality < 3` (wrong) | reset to 0 | reset to 1 day |
| `quality >= 3`, was rep 0 | 1 | 1 day |
| `quality >= 3`, was rep 1 | 2 | 6 days |
| `quality >= 3`, was rep ≥ 2 | rep + 1 | `floor(prevInterval * newEF)` — uses updated EF |

### nextReviewAt

`nextReviewAt = now + interval * 86400000 ms` — add exactly N days in milliseconds, no rounding or time-zeroing. This ensures the test assertion `nextReviewAt.getTime() === now.getTime() + interval * 86400000` is exact regardless of timezone.

---

## Initial State (new card)

```ts
export const INITIAL_SM2_STATE: SM2State = {
  easinessFactor: 2.5,
  interval: 0,
  repetitions: 0,
  nextReviewAt: new Date(), // will be overwritten on first review
};
```

---

## Test Coverage (Vitest)

File: `packages/shared/src/sm2.test.ts`

| Test case | Expected value |
|---|---|
| Quality 0 from EF=2.5 | repetitions=0, interval=1, EF=1.70 (2.5 − 0.80) |
| Quality 1 from EF=2.5 | repetitions=0, interval=1, EF=1.96 (2.5 − 0.54) |
| Quality 2 from EF=2.5 | repetitions=0, interval=1, EF=2.18 (2.5 − 0.32) |
| Quality 2 from EF=1.6 | repetitions=0, interval=1, EF=1.3 (floor hit: 1.6 − 0.32 = 1.28 → clamped) |
| Quality 3 from EF=2.5, rep=0 | repetitions=1, interval=1, EF=2.36 (exact: 2.5-0.14) |
| Quality 4 from EF=2.5, rep=0 | repetitions=1, interval=1, EF=2.5 (no change at q=4) |
| Quality 5 from EF=2.5, rep=0 | repetitions=1, interval=1, EF=2.6 |
| First→second review (rep=1, q≥3) | interval=6 |
| Third review (rep=2, q≥3, interval=6, EF=2.5) | interval=floor(6*newEF) — e.g. q=5: newEF=2.6, interval=15 |
| nextReviewAt | `now.getTime() + interval * 86400000` exactly (injected `now`) |
| Reset then succeed sequence | pass (rep=1) → fail (rep=0, interval=1) → pass (rep=1, interval=1) — confirms interval climbs from 1 after reset, not from previous high |

---

## Vitest Setup

New files required:

- `packages/shared/vitest.config.ts` — minimal config pointing at `src/**/*.test.ts`
- `packages/shared/package.json` — add `"test": "vitest run"` script

One new devDependency: `vitest` (added to the pnpm catalog and `packages/shared/package.json`). Vitest is separate from Bun's native test runner and must be added explicitly.

---

## Files Touched

| File | Action |
|---|---|
| `packages/shared/src/sm2.ts` | Implement (currently empty placeholder) |
| `packages/shared/src/sm2.test.ts` | Create |
| `packages/shared/vitest.config.ts` | Create |
| `packages/shared/package.json` | Add test script |

---

## Verification

1. `cd packages/shared && bun run test` — all tests pass
2. Manually verify: quality 0 on EF=1.3 card still returns EF=1.3 (floor holds)
3. Manually verify: rep=2, interval=6, EF=2.5, quality=5 → newEF=2.6, interval=`floor(6*2.6)`=15
4. Manually verify: rep=2, interval=6, EF=2.5, quality=3 → newEF=2.36, interval=`floor(6*2.36)`=14 (distinct from old-EF result of 15)
