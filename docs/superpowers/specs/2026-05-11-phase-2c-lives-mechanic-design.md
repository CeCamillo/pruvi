# Phase 2C — Lives Mechanic Redesign + DB CHECK Constraints (Design Spec)

**Date:** 2026-05-11
**Phase:** 2C
**Source spec:** `pruvi-freatures.md` §3.5 (Sistema de vidas — 5 vidas, regen 1 a cada 4h), and deferred items from backend audit / CodeRabbit (atomic decrement, missing CHECK constraints).

## Goal

Replace today's "lose all → wait 24h → refill all 5" mechanic with the product spec's regen model: **1 life regenerates every 4 hours**, capped at 5. Eliminate the TOCTOU race in the decrement path. Add DB-level CHECK constraints on `user.lives`, `user.total_xp`, and `user.current_level` so the database refuses invalid states regardless of application bugs.

## Non-goals

- Ultra-tier "unlimited lives" path (no Ultra-tier flag exists yet — when it ships, decrement codepath gates on it; CHECK constraint stays at 0–5).
- Lives purchase / streak-shield mechanics.
- A user-facing endpoint that returns time-until-next-life beyond the existing `resetsAt` field shape.
- Frontend UI rework (frontend rebuild owns this).
- Backfill of `lives_reset_at` semantics for existing users — current value is acceptable as a one-time soft reset (see migration section).

## Current state (baseline)

**Schema (`packages/db/src/schema/auth.ts`):**
- `lives` integer NOT NULL DEFAULT 5 — no CHECK
- `lives_reset_at` timestamp NULL — set to `now() + 24h` on first decrement; cleared on full refill
- `total_xp` integer NOT NULL DEFAULT 0 — no CHECK
- `current_level` integer NOT NULL DEFAULT 1 — no CHECK

**Behavior (`reviews.service.ts:82-110`):**
1. SELECT lives + reset_at
2. If reset_at < now → UPDATE lives = 5, reset_at = NULL
3. If lives <= 0 → reject
4. UPDATE lives = currentLives - 1 (+ set reset_at = now+24h on first decrement)

**Problems:**
- **TOCTOU race:** two concurrent wrong answers both pass the `lives > 0` check, both decrement, can go negative or both set `reset_at` to slightly different timestamps.
- **Wrong refill model:** spec says 1-per-4h regen, not 5-at-once-after-24h. Today's mechanic is much harsher.
- **No DB guarantees:** any service bug or direct UPDATE could leave `lives = -3` or `total_xp = -1`.

## Data Model

### Column rename + semantic shift

Rename `lives_reset_at` → `lives_last_regen_at` and change its meaning:

- **Old:** "timestamp at which all 5 lives refill" (only set when below 5; NULL when full)
- **New:** "timestamp the lives counter was last evaluated for regen" (only set when below 5; NULL when full). Each `4h` elapsed since this timestamp grants +1 life, capped at 5.

When `lives = 5`, `lives_last_regen_at` is NULL (no regen needed).
When `lives < 5`, `lives_last_regen_at` is non-NULL.

### New CHECK constraints (single migration)

```sql
ALTER TABLE "user" ADD CONSTRAINT user_lives_chk        CHECK (lives BETWEEN 0 AND 5);
ALTER TABLE "user" ADD CONSTRAINT user_total_xp_chk     CHECK (total_xp >= 0);
ALTER TABLE "user" ADD CONSTRAINT user_current_level_chk CHECK (current_level >= 1);
```

These are defense-in-depth — application logic still enforces these invariants, but DB refuses to persist violations.

## Architecture

### Regen constant

Add to `packages/shared/src/lives.ts`:

```typescript
export const LIVES_REGEN_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
```

`MAX_LIVES = 5` already exists.

### Pure helpers in `packages/shared/src/lives.ts`

Two pure functions, fully unit-tested:

```typescript
export function computeRegenSnapshot(
  lives: number,
  lastRegenAt: Date | null,
  now: Date
): { lives: number; lastRegenAt: Date | null; regenerated: number }

export function nextRegenAt(
  lives: number,
  lastRegenAt: Date | null
): Date | null  // null when lives === MAX_LIVES
```

`computeRegenSnapshot` is the single source of truth for "given stored values, what are the effective values now?":
- If `lives >= MAX_LIVES` → return as-is (regen anchor NULL).
- If `lastRegenAt` is NULL but `lives < MAX_LIVES` → defensive, treat as `now` (no regen this tick).
- Else compute `elapsed = now - lastRegenAt`; `ticks = floor(elapsed / 4h)`; `regenerated = min(ticks, MAX_LIVES - lives)`; new `lives = lives + regenerated`; advance `lastRegenAt += regenerated * 4h` (or set to NULL if reached MAX).

Both `GET /lives` and the answer-path materialization use this.

### Repository layer

Two new repository methods on `LivesRepository` (move shared queries out of `reviews.repository.ts`):

**`materializeRegen(userId, now)` → `{ lives, lastRegenAt }`**

Read current row, compute snapshot, if `regenerated > 0` issue a single UPDATE setting the new values. Returns the post-materialization state. Idempotent: if nothing to regen, no UPDATE issued.

**`tryDecrement(userId, now)` → `{ ok: true, livesAfter, lastRegenAt } | { ok: false }`**

Atomic decrement (the fix for the race). Single SQL statement:

```sql
UPDATE "user"
SET lives = lives - 1,
    lives_last_regen_at = COALESCE(lives_last_regen_at, $now)
WHERE id = $userId AND lives > 0
RETURNING lives, lives_last_regen_at;
```

If 0 rows returned, decrement is rejected. The `WHERE lives > 0` predicate is evaluated inside the row's update lock — no two concurrent decrements can both proceed when lives is 1. The `COALESCE` is the "first decrement starts the regen clock" behavior, race-free.

The CHECK constraint provides a belt-and-suspenders guarantee: even if a future bug bypassed the `WHERE`, the CHECK would error.

### Service layer flow on wrong answer

In `reviews.service.ts` (replacing lines 82-110):

```typescript
// Materialize regen up to "now" so decrement starts from current value
const materialized = await this.repo.materializeRegen(userId, now);
let livesRemaining = materialized.lives;

if (!correct) {
  const decrement = await this.repo.tryDecrement(userId, now);
  if (!decrement.ok) {
    return err(new ValidationError("No lives remaining. Wait for refill."));
  }
  livesRemaining = decrement.livesAfter;
}
```

### `LivesService.getLives` flow

Materialize regen, then return:

```typescript
return ok({
  lives: state.lives,
  maxLives: MAX_LIVES,
  resetsAt: nextRegenAt(state.lives, state.lastRegenAt),
});
```

`resetsAt` semantics shift from "when all 5 refill" to "when next +1 happens". The field name stays for API stability; the response shape is unchanged.

## API surface

**Unchanged.** `GET /lives` response shape:

```json
{ "lives": 3, "maxLives": 5, "resetsAt": "2026-05-11T18:30:00Z" }
```

`resetsAt` now means "next single-life regen", not "full refill". Frontend rebuild interprets it the same way (countdown to next life). No new endpoints.

## Migration `0005_<name>.sql`

```sql
ALTER TABLE "user" RENAME COLUMN "lives_reset_at" TO "lives_last_regen_at";

ALTER TABLE "user" ADD CONSTRAINT user_lives_chk         CHECK (lives BETWEEN 0 AND 5);
ALTER TABLE "user" ADD CONSTRAINT user_total_xp_chk      CHECK (total_xp >= 0);
ALTER TABLE "user" ADD CONSTRAINT user_current_level_chk CHECK (current_level >= 1);
```

**Backfill consideration:** existing rows with `lives < 5` have a `lives_reset_at` set to `(old first-decrement) + 24h`. Under the new model, treating that timestamp as `lives_last_regen_at` would over-credit users (they'd appear to regen from a future timestamp). The cleanest one-time treatment: clamp future values to `now()` in the migration:

```sql
UPDATE "user"
SET lives_last_regen_at = LEAST(lives_last_regen_at, now())
WHERE lives_last_regen_at IS NOT NULL;
```

This is included in the migration. Effect: any user whose old "refill at" was in the future starts regenning from `now()` under the new model. Worst-case impact is a single-life delay; acceptable for the one-time cut-over.

Mirror the DDL in `packages/db/src/test-client.ts` in lockstep.

## Shared schemas

`packages/shared/src/lives.ts` already has `LivesResponseSchema`. No shape changes. Add the `LIVES_REGEN_INTERVAL_MS` constant export and the two pure helpers (`computeRegenSnapshot`, `nextRegenAt`).

## Testing strategy

### Unit tests (Vitest)

`packages/shared/src/lives.test.ts` (new):
- `computeRegenSnapshot` — 0 ticks elapsed, 1 tick, multi-tick, cap at MAX, NULL anchor when full, defensive case (NULL anchor + lives<MAX).
- `nextRegenAt` — returns NULL when at MAX, returns anchor + 4h when below MAX, advances correctly after partial regen.

`apps/server/src/features/lives/lives.service.test.ts` (extend):
- Materializes regen before returning.
- Returns `resetsAt` from `nextRegenAt`.

`apps/server/src/features/reviews/reviews.service.test.ts` (extend):
- Wrong answer with lives=1 → decrement succeeds, livesAfter=0.
- Wrong answer with lives=0 → returns ValidationError (mocked `tryDecrement` returns `{ok: false}`).
- Correct answer → no decrement attempted.

### Integration tests (PGlite)

`apps/server/src/features/lives/lives.repository.integration.test.ts` (new):
- `tryDecrement` with `lives=0` returns 0 rows → `ok: false`.
- `tryDecrement` with `lives=3` → returns `{ok: true, livesAfter: 2}`, sets `lives_last_regen_at = $now` on first decrement.
- `tryDecrement` with already-set `lives_last_regen_at` → `COALESCE` preserves original anchor.
- `materializeRegen` after 8h elapsed with `lives=2` → returns `lives=4`, advances anchor by 8h.
- `materializeRegen` after 24h elapsed with `lives=2` → caps at 5, sets anchor to NULL.

**Race test (PGlite-compatible):** PGlite is single-process so we can't truly race two transactions, but we can assert the SQL shape is atomic by verifying `tryDecrement` with `lives=1` returns success and a follow-up immediate call returns `{ok: false}` (no race window because both run sequentially against the same in-process pool — the test asserts the *predicate-in-update* contract, not the lock semantics).

### CHECK-constraint tests

`packages/db/src/schema/auth.integration.test.ts` (new, small):
- Direct UPDATE setting `lives = -1` → throws (assert error message contains constraint name).
- `lives = 6` → throws.
- `total_xp = -1` → throws.
- `current_level = 0` → throws.

These prove the DB-level invariants are wired, not just the application layer.

## Acceptance criteria

- Migration `0005` applies cleanly + `verify:migration` passes
- Column renamed; all 3 CHECK constraints active
- `computeRegenSnapshot` + `nextRegenAt` exported from `@pruvi/shared`, fully unit-tested
- `LivesRepository.tryDecrement` is a single atomic UPDATE; replaces the read-then-write pattern in `reviews.service`
- `reviews.service` no longer reads-then-writes; uses `materializeRegen` + `tryDecrement`
- `lives.service.getLives` returns `resetsAt` as next single-life regen time (not full-refill time)
- All existing unit + integration tests still pass; new tests cover regen edge cases + CHECK constraints
- Zero non-test typecheck errors
- Worker boots clean (no schema changes affect worker, but verify)

## Open questions (resolved at design time)

- **Ultra tier behavior?** Out of scope. When Ultra ships, the decrement path checks `user.isUltra` (column added in that phase) and skips the call. CHECK constraint stays — Ultra simply never decrements.
- **Should `lives_last_regen_at` migrate to a tighter timestamp type?** No. `timestamp` (no timezone) is consistent with the rest of the schema; converting is out of scope.
- **What happens if a user's clock drifts and `now < lives_last_regen_at`?** Server-side `now()` is always source of truth; the helper computes `elapsed = max(0, now - lastRegenAt)` defensively. Not a real-world concern but the helper handles it.

---

*End of spec.*
