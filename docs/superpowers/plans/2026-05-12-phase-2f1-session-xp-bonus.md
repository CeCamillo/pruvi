# Phase 2F.1 — Session-completion XP bonus + enriched response — Plan

> **For agentic workers:** Use `superpowers:subagent-driven-development` (Sonnet 4.6 implementers, Opus 4.7 reviewers). Branch: `feature/phase-2f1-session-xp-bonus`.

**Goal:** Add 50-XP session-completion bonus + 10% streak-multiplier (when streakAfter>7). Surface `xpAward` + `streakDelta` from `POST /sessions/:id/complete`.

**Spec:** `docs/superpowers/specs/2026-05-12-phase-2f1-session-xp-bonus-design.md`

---

## File map

**Create:** none.

**Modify:**
- `packages/shared/src/xp.ts` — add `calculateSessionCompletionXp` pure helper + constants.
- `packages/shared/src/xp.test.ts` — unit tests for the helper.
- `packages/shared/src/topics.ts` — export `MasteryTransitionsSchema = z.array(MasteryTransitionSchema)`.
- `packages/shared/src/sessions.ts` — add `SessionCompleteResponseSchema`.
- `apps/server/src/features/gamification/gamification.service.ts` — add `awardXpForSessionCompletion`.
- `apps/server/src/features/gamification/gamification.service.test.ts` — cover new method.
- `apps/server/src/features/sessions/sessions.service.ts` — extend ctor (optional `gamificationService`), update `completeSession` return shape.
- `apps/server/src/features/sessions/sessions.service.test.ts` — update test buildSut + add 2 new cases.
- `apps/server/src/features/sessions/sessions.route.ts` — wire `gamificationService` + declare response schema.

---

### Task 1: Pure XP helper + MasteryTransitionsSchema

- [ ] **Step 1: Add the helper + tests in `packages/shared/src/xp.ts`** and `xp.test.ts`. Constants at module scope.

```ts
// packages/shared/src/xp.ts (append)
export const SESSION_COMPLETION_BASE_XP = 50;
export const SESSION_PER_CORRECT_XP = 5;
export const SESSION_STREAK_MULTIPLIER_THRESHOLD = 7;
export const SESSION_STREAK_MULTIPLIER = 1.10;

export function calculateSessionCompletionXp(
  questionsCorrect: number,
  streakAfter: number,
): { base: number; correctBonus: number; streakMultiplier: number; total: number } {
  const base = SESSION_COMPLETION_BASE_XP;
  const correctBonus = Math.max(0, questionsCorrect) * SESSION_PER_CORRECT_XP;
  const streakMultiplier =
    streakAfter > SESSION_STREAK_MULTIPLIER_THRESHOLD ? SESSION_STREAK_MULTIPLIER : 1;
  const total = Math.floor((base + correctBonus) * streakMultiplier);
  return { base, correctBonus, streakMultiplier, total };
}
```

Test cases (use `describe("calculateSessionCompletionXp")`):
- 0 correct, streak=0 → `{ base: 50, correctBonus: 0, streakMultiplier: 1, total: 50 }`.
- 8 correct, streak=3 → total 90.
- 10 correct, streak=7 → total 100 (boundary: multiplier kicks in at `>7`, NOT `>=7`).
- 10 correct, streak=8 → total 110.
- 7 correct, streak=10 → total floor((50+35)*1.1) = 93 (integer floor verified).
- Negative `questionsCorrect` (defensive) → treated as 0 → total 50.

- [ ] **Step 2: `MasteryTransitionsSchema`** — add to `packages/shared/src/topics.ts`:

```ts
export const MasteryTransitionsSchema = z.array(MasteryTransitionSchema);
```

- [ ] **Step 3: Run tests + typecheck.**

```bash
bun test packages/shared/src/xp.test.ts
bun --cwd apps/server check-types
```

- [ ] **Step 4: Commit.**

```bash
git add packages/shared/src/xp.ts packages/shared/src/xp.test.ts packages/shared/src/topics.ts
git commit -m "feat(shared): session-completion XP helper + MasteryTransitionsSchema"
```

---

### Task 2: GamificationService.awardXpForSessionCompletion

- [ ] **Step 1: Implement the method** in `gamification.service.ts`:

```ts
import { calculateSessionCompletionXp, ... existing imports } from "@pruvi/shared";

async awardXpForSessionCompletion(
  userId: string,
  questionsCorrect: number,
  streakAfter: number,
): Promise<Result<
  {
    xpAwarded: number;
    totalXp: number;
    currentLevel: number;
    base: number;
    correctBonus: number;
    streakMultiplier: number;
  },
  AppError
>> {
  const xp = calculateSessionCompletionXp(questionsCorrect, streakAfter);
  const current = await this.repo.getUserXp(userId);
  const currentXp = current?.totalXp ?? 0;
  const newLevel = getLevelForXp(currentXp + xp.total);
  const updated = await this.repo.awardXp(userId, xp.total, newLevel);

  // Null-guard: repo.awardXp returns undefined when user row not matched (deleted mid-flow).
  // Fall back to computed values so the response shape stays consistent.
  return ok({
    xpAwarded: xp.total,
    totalXp: updated?.totalXp ?? currentXp + xp.total,
    currentLevel: updated?.currentLevel ?? newLevel,
    base: xp.base,
    correctBonus: xp.correctBonus,
    streakMultiplier: xp.streakMultiplier,
  });
}
```

- [ ] **Step 2: Unit tests** — append to `gamification.service.test.ts`:

Cases:
- Happy path: `awardXpForSessionCompletion("u", 8, 3)` calls `repo.awardXp("u", 90, expectedLevel)` and returns `xpAwarded: 90`.
- Streak above threshold: `(uid, 10, 8)` → `repo.awardXp` called with `110`.
- Streak at boundary 7: `(uid, 10, 7)` → `100` (no multiplier).
- `repo.awardXp` returns `undefined` (user deleted) → service still returns ok with `totalXp = currentXp + xp.total` fallback; no throw.

- [ ] **Step 3: Run gamification tests + typecheck + commit.**

```bash
bun test apps/server/src/features/gamification/
bun --cwd apps/server check-types
git add apps/server/src/features/gamification/gamification.service.ts apps/server/src/features/gamification/gamification.service.test.ts
git commit -m "feat(gamification): awardXpForSessionCompletion with streak multiplier"
```

---

### Task 3: SessionsService — integrate streak reads + XP award

- [ ] **Step 1: Update the ctor** to accept an optional `gamificationService`. Mirror the existing pattern used for `dispatcher` and `shieldsService`:

```ts
constructor(
  private repo: SessionsRepository,
  private questionsService: QuestionsService,
  private topicsService: TopicsService,
  private streaksService: StreaksService | null = null,
  private dispatcher: Dispatcher | null = null,
  private shieldsService?: ShieldsService,
  private logger?: FastifyBaseLogger,
  private gamificationService?: GamificationService,   // NEW — optional, 8th arg
) {}
```

Update return type of `completeSession`:

```ts
Promise<Result<{
  session: ...;
  transitions: MasteryTransition[];
  xpAward: {
    xpAwarded: number; totalXp: number; currentLevel: number;
    base: number; correctBonus: number; streakMultiplier: number;
  } | null;
  streakDelta: number;
}, AppError>>
```

- [ ] **Step 2: Modify the `completeSession` body** to read streaks before/after and call the new XP method. Place after existing validation, BEFORE the `repo.completeSession` line:

```ts
const streakBefore = this.streaksService
  ? (await this.streaksService.getStreaks(userId)).map((r) => r.currentStreak).unwrapOr(0)
  : 0;
```

After `const completed = await this.repo.completeSession(...)`:

```ts
const streakAfter = this.streaksService
  ? (await this.streaksService.getStreaks(userId)).map((r) => r.currentStreak).unwrapOr(streakBefore)
  : streakBefore;
const streakDelta = streakAfter - streakBefore;

// Multiplier uses streakAfter — see spec §4.3 / §7.3. Rewards crossing 7→8 on the crossing day.
let xpAward: ReturnType<typeof toXpAwardOk> | null = null;
if (this.gamificationService) {
  const awardResult = await this.gamificationService.awardXpForSessionCompletion(
    userId, questionsCorrect, streakAfter,
  );
  if (awardResult.isOk()) {
    xpAward = awardResult.value;
  } else {
    this.logger?.warn?.({ userId, sessionId, err: awardResult.error.message }, "session xp award failed");
  }
}

return ok({ session: completed, transitions, xpAward, streakDelta });
```

Helper type `toXpAwardOk` is just the awardResult.value shape; inline it if cleaner.

Verify (use the neverthrow Result API correctly — `getStreaks` already returns `Result<Streaks, AppError>`; trace existing usages and copy the pattern).

- [ ] **Step 3: Update test setup.** In `sessions.service.test.ts`, every `new SessionsService(repo, questionsService, topicsService, ...)` call works unchanged because the new arg is optional. Add 2 NEW cases:

  - `completeSession returns xpAward when gamificationService is provided`: mock the gamification service to return `{ xpAwarded: 90, totalXp: 90, currentLevel: 2, base: 50, correctBonus: 40, streakMultiplier: 1 }`; assert the response shape includes that exact `xpAward`.
  - `completeSession returns xpAward=null and streakDelta=0 when gamificationService is absent`: legacy 3-arg ctor; assert the legacy callers still work.

- [ ] **Step 4: Run sessions tests + typecheck + commit.**

```bash
bun test apps/server/src/features/sessions/
bun --cwd apps/server check-types
git add apps/server/src/features/sessions/sessions.service.ts apps/server/src/features/sessions/sessions.service.test.ts
git commit -m "feat(sessions): xp award + streak delta on session complete"
```

---

### Task 4: Route wiring + response schema

- [ ] **Step 1: `SessionCompleteResponseSchema`** in `packages/shared/src/sessions.ts`:

```ts
import { MasteryTransitionsSchema } from "./topics";

export const SessionCompleteResponseSchema = z.object({
  session: z.object({
    id: z.number().int(),
    userId: z.string(),
    status: z.enum(["active", "completed"]),
    questionsAnswered: z.number().int().nonnegative(),
    questionsCorrect: z.number().int().nonnegative(),
    masterySnapshot: z.record(z.string(), z.string()).nullable(),
    // Fastify serializes Date → ISO string before response-schema validation runs,
    // so the schema MUST be `z.string()` not `z.date()` (see simulados route pattern).
    completedAt: z.string().nullable(),
    createdAt: z.string(),
  }),
  transitions: MasteryTransitionsSchema,
  xpAward: z.object({
    xpAwarded: z.number().int().nonnegative(),
    totalXp: z.number().int().nonnegative(),
    currentLevel: z.number().int().min(1),
    base: z.literal(50),
    correctBonus: z.number().int().nonnegative(),
    streakMultiplier: z.union([z.literal(1), z.literal(1.10)]),
  }).nullable(),
  streakDelta: z.number().int(),
});
```

NOTE: confirm column names against `apps/server/src/features/sessions/sessions.repository.ts:36-52` — they are `questionsAnswered/questionsCorrect/masterySnapshot/completedAt/createdAt`. Do NOT use `questionCount`/`correctCount`.

- [ ] **Step 2: Wire `GamificationService` into the route.** In `sessions.route.ts`, alongside the existing service construction:

```ts
import { GamificationRepository } from "../gamification/gamification.repository";
import { GamificationService } from "../gamification/gamification.service";

const gamificationRepo = new GamificationRepository(db);
const gamificationService = new GamificationService(gamificationRepo);
// existing: const service = new SessionsService(...)
// Add gamificationService as the 8th arg.
```

Add the response schema to the `POST /sessions/:id/complete` schema block:

```ts
schema: {
  params: ...,
  body: ...,
  response: { 200: z.object({ success: z.literal(true), data: SessionCompleteResponseSchema }) },
},
```

- [ ] **Step 2b: Update the route handler body** to destructure and re-return the new fields. Replace:

```ts
const { session, transitions } = unwrapResult(result).data;
// ...existing cache + queue + return...
return successResponse({ session, transitions });
```

with:

```ts
const { session, transitions, xpAward, streakDelta } = unwrapResult(result).data;
// ...existing cache + queue logic unchanged...
return successResponse({ session, transitions, xpAward, streakDelta });
```

Without this update, the new fields will be silently dropped from the HTTP response even though the schema declares them.

- [ ] **Step 3: Run full server tests + typecheck.**

```bash
bun --cwd apps/server check-types
bun test apps/server/src/features/
```

- [ ] **Step 4: Commit.**

```bash
git add packages/shared/src/sessions.ts apps/server/src/features/sessions/sessions.route.ts
git commit -m "feat(sessions): expose xpAward + streakDelta on /complete; lock response schema"
```

---

## Gate D

After Task 4, dispatch a final Opus spec-coverage review against the branch diff:
- §8 acceptance criteria all covered.
- Multiplier triggers on `streakAfter > 7`.
- Response schema column names match the repo's actual return.
- `xpAward: null` path works when gamification service is absent (legacy ctor).
