# Phase 2F.1 — Session-completion XP bonus + enriched complete response (design spec)

**Date:** 2026-05-12
**Branch:** `feature/phase-2f1-session-xp-bonus`
**Depends on:** Phase 2C (lives), Phase 2A (mastery transitions), Phase 2D (streak). Reuses `GamificationService`, `StreaksService`.

## 1. Problem

`pruvi-freatures.md` §3.1 mandates THREE XP mechanics:
1. Per-answer XP (already shipped — difficulty-based 10/20/35).
2. **50 XP flat for completing a session** — not implemented.
3. **+10% multiplier when streak > 7 days** — not implemented.

§2.5 also mandates the session-encerramento screen show `xpDelta` (XP gained THIS session) and `streakDelta` (did the streak advance today?). The current `POST /sessions/:id/complete` returns only `{ session, transitions }`. The client has to call `GET /gamification/xp` AND `GET /streaks` separately to assemble the encerramento — two extra round-trips on a critical UX path.

## 2. Goal

1. Add `GamificationService.awardXpForSessionCompletion(userId, questionsCorrect, currentStreak): Promise<Result<SessionXpAward>>` that grants:
   - **Base:** 50 XP flat for any completed session.
   - **Correct bonus:** +5 XP per correct answer (per §3.1 — additive on top of the per-answer XP already granted during answering).
   - **Streak multiplier:** if `currentStreak > 7`, multiply (base + correct bonus) by 1.10. Floor to integer XP.
2. Wire the call into `SessionsService.completeSession` AFTER `repo.completeSession` (so the daily session is recorded — which is what makes the streak advance today).
3. Compute `xpDelta = sessionBonus` and `streakDelta = streakAfter - streakBefore`.
4. Return `{ session, transitions, xpAward, streakDelta }` from the service; expose at the route.

## 3. Out of scope

- Changing the per-answer XP formula (10/20/35 per difficulty stays).
- A backfill of XP for sessions completed before this phase ships.
- Animating the encerramento (frontend phase).

## 4. Architecture

### 4.1 Module changes

- `packages/shared/src/xp.ts` — new pure helper `calculateSessionCompletionXp(questionsCorrect: number, currentStreak: number): { base: 50, correctBonus: number, streakMultiplier: 1 | 1.1, total: number }`. Unit-testable, no I/O.
- `packages/shared/src/topics.ts` — add `export const MasteryTransitionsSchema = z.array(MasteryTransitionSchema)` (current exports only the singular `MasteryTransitionSchema`).
- `packages/shared/src/sessions.ts` — new `SessionCompleteResponseSchema` Zod schema (the route's response shape becomes typed). Includes `xpAward: { xpAwarded, totalXp, currentLevel, base, correctBonus, streakMultiplier }` and `streakDelta: number`. **The `session` sub-schema must mirror the exact column names returned by `SessionsRepository.completeSession`** — verify by reading the repo before writing the schema. If the repo returns `questionsAnswered`/`questionsCorrect`, the schema must use those names (NOT `questionCount`/`correctCount`).
- `apps/server/src/features/gamification/gamification.service.ts` — new method `awardXpForSessionCompletion(userId, questionsCorrect, currentStreak)`. Reuses `repo.awardXp + getLevelForXp`.
- `apps/server/src/features/sessions/sessions.service.ts` — `completeSession` integrates the new flow:
  - Read streak BEFORE completion (so `streakDelta` is meaningful).
  - After `repo.completeSession`, read streak AFTER (this is where today's session counts toward the streak).
  - Call `gamificationService.awardXpForSessionCompletion`.
  - Return enriched payload.
  - `GamificationService` added to ctor as an **OPTIONAL** dependency (mirroring `dispatcher` and `shieldsService` patterns). When absent, return `xpAward: null` and `streakDelta: 0`. This preserves backward compat for the ~8 inline `new SessionsService(...)` test constructions that pass 3 args.
- `apps/server/src/features/sessions/sessions.route.ts` — wire `gamificationService` into the service construction; declare the response schema.

### 4.2 XP formula (pure, deterministic)

```ts
const BASE_SESSION_XP = 50;
const PER_CORRECT_XP = 5;
const STREAK_MULTIPLIER_THRESHOLD = 7;
const STREAK_MULTIPLIER = 1.10;

function calculateSessionCompletionXp(correct: number, streak: number) {
  const base = BASE_SESSION_XP;
  const correctBonus = correct * PER_CORRECT_XP;
  const multiplier = streak > STREAK_MULTIPLIER_THRESHOLD ? STREAK_MULTIPLIER : 1;
  const total = Math.floor((base + correctBonus) * multiplier);
  return { base, correctBonus, streakMultiplier: multiplier, total };
}
```

Examples:
- 8 correct, streak=3 → `floor((50 + 40) * 1.0) = 90`.
- 10 correct, streak=8 → `floor((50 + 50) * 1.1) = 110`.
- 6 correct, streak=30 → `floor((50 + 30) * 1.1) = 88`.

### 4.3 Streak read ordering

Streak is computed from `daily_session` rows. The session-complete TX (`repo.completeSession`) is what makes the row reach `status='completed'`, which in turn is what the streak query counts. So:

- `streakBefore = (await streaksService.getStreaks(userId)).currentStreak` (BEFORE `repo.completeSession`).
- `repo.completeSession(...)` runs.
- `streakAfter = (await streaksService.getStreaks(userId)).currentStreak` (AFTER).

**No new method needed.** `StreaksService.getStreaks` calls `repo.getCompletedSessionDates` directly — there is NO in-service cache. The `streaks:${userId}` Redis cache lives in the route handler, not in the service, so service-internal reads bypass it naturally. Both calls hit the DB and reflect the true state at their moment.

`streakDelta = streakAfter - streakBefore`. Expected values:
- `1` — first session of a new day, streak advanced.
- `0` — user already had a completed session today; second-of-day session does not move the streak.
- Anything else is anomalous; log WARN.

### 4.4 Response shape

```ts
SessionCompleteResponseSchema = z.object({
  session: z.object({ /* existing — id, status, questionCount, correctCount, completedAt */ }),
  transitions: MasteryTransitionsSchema,
  xpAward: z.object({
    xpAwarded: z.number().int().nonnegative(),    // total = base + correctBonus, multiplied
    totalXp: z.number().int().nonnegative(),       // user's totalXp AFTER this award
    currentLevel: z.number().int().min(1),
    base: z.literal(50),
    correctBonus: z.number().int().nonnegative(),
    streakMultiplier: z.union([z.literal(1), z.literal(1.10)]),
  }),
  streakDelta: z.number().int(),                   // 0 or 1 in normal flow
})
```

## 5. Public surface

- `POST /sessions/:id/complete` — same URL + body; **response shape extended** (additive — old clients ignore new fields).
- No new env vars, no migration.

## 6. Failure modes

| Cause | Response | Side effect |
|---|---|---|
| Existing failure paths (session not found / not owned / already completed) | Same as today | None |
| `streakBefore` read fails | Treat as 0; log WARN | Award proceeds with default multiplier (no streak bonus) |
| `awardXpForSessionCompletion` fails (e.g., user row gone — `repo.awardXp` returns `undefined`) | Return `xpAward: null` in the response (200) | Service explicitly null-guards the `awardXp` return: `const updated = await repo.awardXp(...); if (!updated) return { ...empty award }`. Log WARN with `{ userId, sessionId }`. |

## 7. Testing strategy

### 7.1 Pure unit — `calculateSessionCompletionXp`
- 8 correct + streak=3 → 90.
- 10 correct + streak=8 → 110.
- 10 correct + streak=7 → 100 (boundary — multiplier kicks in at streak > 7, NOT >=).
- 10 correct + streak=8 → 110.
- 0 correct + streak=0 → 50.
- 0 correct + streak=100 → 55.
- Integer floor: 7 correct + streak=10 → floor((50 + 35) * 1.1) = floor(93.5) = 93.

### 7.2 GamificationService unit
- `awardXpForSessionCompletion(uid, 8, 3)` calls `repo.awardXp(uid, 90, expectedLevel)` and returns the award shape.
- Streak above threshold path: `awardXpForSessionCompletion(uid, 10, 8)` calls `repo.awardXp(uid, 110, ...)`.

### 7.3 SessionsService unit (mocked repos)
- `completeSession` calls `streaksService.getStreaks` twice (before + after `repo.completeSession`), captures `streakDelta` correctly.
- The returned `xpAward.total` equals `calculateSessionCompletionXp(correct, streakAfter).total` — **use `streakAfter` for the multiplier** (the post-completion streak). This rewards a user crossing 7→8 on the day they cross. Document with a code comment referencing this spec §.
- `streakDelta` equals 1 when this completes the first session-of-day; 0 when it's the second-of-day.
- When `gamificationService` is absent (legacy 3-arg ctor), `xpAward` is `null` and `streakDelta` is `0`.

### 7.4 Route integration
- `POST /sessions/:id/complete` returns the new payload shape end-to-end with a fresh test user.

## 8. Acceptance criteria

- [ ] `calculateSessionCompletionXp` is a pure function exported from `@pruvi/shared`.
- [ ] `GamificationService.awardXpForSessionCompletion` reuses existing `repo.awardXp`.
- [ ] `SessionsService.completeSession` reads streak before and after `repo.completeSession`, computes `streakDelta`.
- [ ] Streak multiplier uses `streakAfter` (the post-completion streak) — comment documents this.
- [ ] `POST /sessions/:id/complete` response includes `xpAward` + `streakDelta`.
- [ ] Response shape locked by `SessionCompleteResponseSchema` declared on the Fastify route.
- [ ] Existing tests pass; new tests cover the formula + the orchestration.

## 9. Deferred

- Backfill XP for historical completed sessions.
- Variable per-difficulty multipliers (medium = 1.5x correct bonus etc.).
- Daily-cap on XP earned.
