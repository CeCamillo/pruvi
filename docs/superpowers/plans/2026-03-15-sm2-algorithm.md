# SM-2 Algorithm Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the SM-2 spaced repetition algorithm as a tested pure function in `@pruvi/shared`.

**Architecture:** A single pure function `calculateSM2(state, quality, now?)` in `packages/shared/src/sm2.ts` that takes previous review state and a quality score (0–5) and returns new state. No database, no side effects. Vitest tests live alongside the source file.

**Tech Stack:** TypeScript, Zod (already in package), Vitest (to be added), Bun (runtime/test runner)

**Spec:** `docs/superpowers/specs/2026-03-15-sm2-algorithm-design.md`

---

## Chunk 1: Vitest setup

### Task 1: Add Vitest to the shared package

**Files:**
- Modify: `pnpm-workspace.yaml` (add vitest to catalog)
- Modify: `packages/shared/package.json` (add vitest devDep + test script)
- Create: `packages/shared/vitest.config.ts`

- [ ] **Step 1: Add vitest to pnpm catalog**

Open `pnpm-workspace.yaml` and add one line to the existing `catalog:` block (do not replace other entries):

```yaml
  vitest: ^3.0.0
```

The catalog block should look like this when done:

```yaml
catalog:
  dotenv: ^17.2.2
  zod: ^4.1.13        # keep existing version exactly
  typescript: ^5
  "@types/bun": ^1.3.4
  better-auth: 1.5.2
  "@better-auth/expo": 1.5.2
  vitest: ^3.0.0      # new line added
```

- [ ] **Step 2: Add vitest to shared package devDependencies and add test script**

Open `packages/shared/package.json`. Add vitest to `devDependencies` and a `test` script:

```json
{
  "name": "@pruvi/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "default": "./src/index.ts"
    },
    "./*": {
      "default": "./src/*.ts"
    }
  },
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "catalog:"
  },
  "devDependencies": {
    "@pruvi/config": "workspace:*",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 3: Create vitest.config.ts**

Create `packages/shared/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Install dependencies**

From the repo root:

```bash
pnpm install
```

Expected: vitest appears in `packages/shared/node_modules/.bin/vitest`. No errors.

- [ ] **Step 5: Verify vitest runs (no tests yet)**

```bash
cd packages/shared && pnpm test
```

Expected output contains: `No test files found` or similar "0 tests passed". Must not error on the config itself.

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml packages/shared/package.json packages/shared/vitest.config.ts
git commit -m "chore(shared): add vitest for unit testing"
```

---

## Chunk 2: Types and Zod schema

### Task 2: Define SM2State types and Zod schema

**Files:**
- Modify: `packages/shared/src/sm2.ts` (currently `export {};`)

- [ ] **Step 1: Replace the placeholder with types and schema**

Open `packages/shared/src/sm2.ts` and replace its entire contents:

```ts
import { z } from "zod";

export type QualityScore = 0 | 1 | 2 | 3 | 4 | 5;

export interface SM2State {
  easinessFactor: number; // starts at 2.5, never < 1.3
  interval: number; // days until next review; 0 = not yet scheduled
  repetitions: number; // consecutive correct reviews
  nextReviewAt: Date; // absolute date of next review
}

export const SM2StateSchema = z.object({
  easinessFactor: z.number().min(1.3),
  interval: z.number().int().min(0),
  repetitions: z.number().int().min(0),
  nextReviewAt: z.coerce.date(),
});

export const INITIAL_SM2_STATE: SM2State = {
  easinessFactor: 2.5,
  interval: 0,
  repetitions: 0,
  nextReviewAt: new Date(), // overwritten on first review
};
```

- [ ] **Step 2: Write a failing test for the types**

Create `packages/shared/src/sm2.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SM2StateSchema, INITIAL_SM2_STATE } from "./sm2";

describe("SM2StateSchema", () => {
  it("accepts the initial state", () => {
    const result = SM2StateSchema.safeParse(INITIAL_SM2_STATE);
    expect(result.success).toBe(true);
  });

  it("rejects easinessFactor below 1.3", () => {
    const result = SM2StateSchema.safeParse({
      ...INITIAL_SM2_STATE,
      easinessFactor: 1.2,
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests — expect them to fail (function not yet exported)**

```bash
cd packages/shared && pnpm test
```

Expected: tests run and the `SM2StateSchema` tests PASS (types are already defined), or fail with a clear import error if you haven't saved the file yet. Fix any import errors before continuing.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/sm2.ts packages/shared/src/sm2.test.ts
git commit -m "feat(shared): define SM2State types and Zod schema"
```

---

## Chunk 3: Core algorithm

### Task 3: Implement calculateSM2

**Files:**
- Modify: `packages/shared/src/sm2.ts` (add the function)
- Modify: `packages/shared/src/sm2.test.ts` (add algorithm tests)

`★ Insight ─────────────────────────────────────`
The EF formula `EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))` is applied on EVERY review — including failures (quality < 3). The floor `max(1.3, EF')` prevents EF from going below 1.3. The interval update is separate from the EF update: compute new EF first, then use it for the interval calculation on the rep ≥ 2 branch.
`─────────────────────────────────────────────────`

- [ ] **Step 1: Write all algorithm tests first (TDD)**

Add these test cases to `packages/shared/src/sm2.test.ts` — append after the schema describe block:

```ts
import { calculateSM2, type SM2State } from "./sm2";

const BASE_STATE: SM2State = {
  easinessFactor: 2.5,
  interval: 1,
  repetitions: 0,
  nextReviewAt: new Date(),
};

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("calculateSM2 — failures (quality < 3)", () => {
  it("quality 0: resets reps/interval, EF=1.70", () => {
    const result = calculateSM2(BASE_STATE, 0, NOW);
    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
    expect(result.easinessFactor).toBeCloseTo(1.7, 10);
  });

  it("quality 1: resets reps/interval, EF=1.96", () => {
    const result = calculateSM2(BASE_STATE, 1, NOW);
    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
    expect(result.easinessFactor).toBeCloseTo(1.96, 10);
  });

  it("quality 2: resets reps/interval, EF=2.18", () => {
    const result = calculateSM2(BASE_STATE, 2, NOW);
    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
    expect(result.easinessFactor).toBeCloseTo(2.18, 10);
  });

  it("quality 2 from EF=1.6: EF hits floor at 1.3", () => {
    const state = { ...BASE_STATE, easinessFactor: 1.6 };
    const result = calculateSM2(state, 2, NOW);
    expect(result.easinessFactor).toBe(1.3);
  });
});

describe("calculateSM2 — successes (quality >= 3)", () => {
  it("quality 3, rep=0: rep=1, interval=1, EF=2.36", () => {
    const result = calculateSM2(BASE_STATE, 3, NOW);
    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
    expect(result.easinessFactor).toBeCloseTo(2.36, 10);
  });

  it("quality 4, rep=0: rep=1, interval=1, EF unchanged at 2.5", () => {
    const result = calculateSM2(BASE_STATE, 4, NOW);
    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
    expect(result.easinessFactor).toBeCloseTo(2.5, 10);
  });

  it("quality 5, rep=0: rep=1, interval=1, EF=2.6", () => {
    const result = calculateSM2(BASE_STATE, 5, NOW);
    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
    expect(result.easinessFactor).toBeCloseTo(2.6, 10);
  });

  it("second review (rep=1, q=5): rep=2, interval=6", () => {
    const state = { ...BASE_STATE, repetitions: 1, interval: 1 };
    const result = calculateSM2(state, 5, NOW);
    expect(result.repetitions).toBe(2);
    expect(result.interval).toBe(6);
  });

  it("third review (rep=2, interval=6, EF=2.5, q=5): interval=floor(6*2.6)=15", () => {
    const state = { ...BASE_STATE, repetitions: 2, interval: 6 };
    const result = calculateSM2(state, 5, NOW);
    expect(result.interval).toBe(15); // floor(6 * 2.6) = floor(15.6)
  });

  it("third review (rep=2, interval=6, EF=2.5, q=3): interval=floor(6*2.36)=14", () => {
    const state = { ...BASE_STATE, repetitions: 2, interval: 6 };
    const result = calculateSM2(state, 3, NOW);
    expect(result.interval).toBe(14); // floor(6 * 2.36) = floor(14.16)
  });
});

describe("calculateSM2 — nextReviewAt", () => {
  it("nextReviewAt is exactly now + interval * 86400000ms", () => {
    const result = calculateSM2(BASE_STATE, 5, NOW);
    expect(result.nextReviewAt.getTime()).toBe(
      NOW.getTime() + result.interval * 86_400_000
    );
  });
});

describe("calculateSM2 — reset-then-succeed sequence", () => {
  it("after a failure, interval restarts from 1, not previous high", () => {
    // First pass: rep 0 → 1, interval = 1
    const afterFirstPass = calculateSM2(BASE_STATE, 5, NOW);
    expect(afterFirstPass.repetitions).toBe(1);
    expect(afterFirstPass.interval).toBe(1);

    // Second pass: rep 1 → 2, interval = 6
    const afterSecondPass = calculateSM2(afterFirstPass, 5, NOW);
    expect(afterSecondPass.interval).toBe(6);

    // Failure: rep resets to 0, interval resets to 1
    const afterFailure = calculateSM2(afterSecondPass, 0, NOW);
    expect(afterFailure.repetitions).toBe(0);
    expect(afterFailure.interval).toBe(1);

    // Pass again: interval should be 1 (rep was 0), not 6
    const afterRecovery = calculateSM2(afterFailure, 5, NOW);
    expect(afterRecovery.repetitions).toBe(1);
    expect(afterRecovery.interval).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests — verify they all FAIL**

```bash
cd packages/shared && pnpm test
```

Expected: all tests in the `calculateSM2` describes fail with "calculateSM2 is not a function" (or similar). The schema tests from Task 2 should still pass.

- [ ] **Step 3: Implement calculateSM2**

Add the function to `packages/shared/src/sm2.ts` (append after `INITIAL_SM2_STATE`):

```ts
function updateEF(ef: number, quality: QualityScore): number {
  const newEF = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  return Math.max(1.3, newEF);
}

export function calculateSM2(
  state: SM2State,
  quality: QualityScore,
  now: Date = new Date()
): SM2State {
  const newEF = updateEF(state.easinessFactor, quality);

  let newRepetitions: number;
  let newInterval: number;

  if (quality < 3) {
    newRepetitions = 0;
    newInterval = 1;
  } else if (state.repetitions === 0) {
    newRepetitions = 1;
    newInterval = 1;
  } else if (state.repetitions === 1) {
    newRepetitions = 2;
    newInterval = 6;
  } else {
    newRepetitions = state.repetitions + 1;
    newInterval = Math.floor(state.interval * newEF);
  }

  return {
    easinessFactor: newEF,
    interval: newInterval,
    repetitions: newRepetitions,
    nextReviewAt: new Date(now.getTime() + newInterval * 86_400_000),
  };
}
```

- [ ] **Step 4: Run tests — all must pass**

```bash
cd packages/shared && pnpm test
```

Expected: all tests pass. If any fail, check:
- EF precision: `toBeCloseTo(value, 10)` allows tiny floating-point drift — if a test still fails, double-check the formula constants (0.08, 0.02, 0.1).
- interval: `Math.floor` vs `Math.round` — must be `Math.floor`.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/sm2.ts packages/shared/src/sm2.test.ts
git commit -m "feat(shared): implement SM-2 spaced repetition algorithm"
```

---

## Verification

After all tasks complete, run the full test suite from the package:

```bash
cd packages/shared && pnpm test
```

Expected: all tests pass with output similar to:
```
✓ SM2StateSchema > accepts the initial state
✓ SM2StateSchema > rejects easinessFactor below 1.3
✓ calculateSM2 — failures > quality 0 ...
... (all tests green)
Test Files  1 passed
Tests       13 passed
```

Manual spot-checks (verify mentally, not in code):
- `calculateSM2({...BASE_STATE, easinessFactor: 1.3}, 0, NOW).easinessFactor === 1.3` — floor holds at 1.3
- `calculateSM2({...BASE_STATE, repetitions: 2, interval: 6}, 5, NOW).interval === 15` — `floor(6 * 2.6) = 15`
- `calculateSM2({...BASE_STATE, repetitions: 2, interval: 6}, 3, NOW).interval === 14` — `floor(6 * 2.36) = 14` (not 15 — this confirms newEF, not oldEF, is used)
