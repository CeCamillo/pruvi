# Phase 2E.2 — Streak Shield (Design Spec)

**Date:** 2026-05-12
**Phase:** 2E.2 (follow-up to 2E.1 Ultra entitlement)
**Source spec:** `pruvi-freatures.md` §5.3 *"Escudo de streak — protege o streak em 1 dia que o usuário não conseguiu treinar. Pode ser usado 1x. Comprável avulso ou incluso no Ultra."*

## Goal

Ship the streak-shield mechanic: Ultra users accumulate up to 3 shields, one per month (lazy refill on read). When a user completes a session after a 1-day gap and has shields available, one is auto-consumed to protect the missed day, preserving the current streak. Free users have 0 shields; purchase (§2E.4 billing) is out of scope here.

## Non-goals

- **Purchase a shield** (out of MVP — depends on 2E.4 billing webhooks).
- **Manual "use shield now" endpoint** — shields auto-protect on session-complete. Manual use is not required by spec.
- **Shield notification** ("Saved your streak with a shield!") — frontend can render based on `transitions` returned from `completeSession`. No new push channel.
- **Recover-streak-after-break flow** — once a streak is fully broken (≥ 2 missed days), no recovery. One shield = one missed day only.
- **Shield-balance UI for free users** — frontend will show "0 / get Ultra to unlock" but backend just returns 0.
- **Per-user `max_shields` override** — fixed at `MAX_STREAK_SHIELDS = 3` for Ultra.

## Mechanic

### Streak math with shields

Current streak today = consecutive completed-or-protected days ending today (or yesterday).

A user who:
- Completed Monday, Tuesday
- Missed Wednesday
- Completes Thursday with 1 shield available
→ Shield auto-protects Wednesday. Streak = 4 (Mon, Tue, Wed-protected, Thu).

A user who:
- Completed Monday
- Missed Tuesday, Wednesday
- Completes Thursday with 2 shields available
→ Spec says "Pode ser usado 1x" (one use, per missed day). MVP: only protect a single 1-day gap. If gap > 1 day, streak is broken regardless of shields available. Shields are NOT consumed in this case.

### Lazy monthly refill

When `getBalance` or `tryUseShield` is called:
1. Read `user.streak_shields_available` and `user.last_shield_grant_at`.
2. If user is Ultra-active AND `(last_shield_grant_at IS NULL OR now - last_shield_grant_at >= 30 days)` AND `streak_shields_available < MAX_STREAK_SHIELDS`:
   - Increment shields by 1, set `last_shield_grant_at = now`.
   - Repeat if multiple intervals have elapsed (cap at 3).

Compute-on-read means no cron required. Acceptable because shield balance is only read on session-complete and explicit balance queries.

### Auto-use trigger

`sessions.completeSession` hook (fire-and-forget after the session row is marked completed):

1. Find the user's previous completed session date (most recent before today).
2. If `today - prev = 2 days` (exactly one missed day yesterday):
   - Try `ShieldsService.tryUseShield(userId, yesterday)`.
   - On success: log the protection. Frontend will see the next `getStreaks` call return the preserved streak.
3. If `today - prev != 2 days`, do nothing.

The hook is fire-and-forget: a missing-shield UX glitch is preferable to a regression on session-complete.

## Data model

### `user` extensions

```sql
+ streak_shields_available  integer NOT NULL DEFAULT 0
+ last_shield_grant_at      timestamp
+ CHECK (streak_shields_available >= 0 AND streak_shields_available <= 3)
```

### New table: `streak_shield_usage`

```sql
CREATE TABLE streak_shield_usage (
  id              serial PRIMARY KEY,
  user_id         text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  protected_date  date NOT NULL,
  used_at         timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX streak_shield_usage_user_date_idx ON streak_shield_usage (user_id, protected_date);
CREATE INDEX streak_shield_usage_user_idx ON streak_shield_usage (user_id);
```

`UNIQUE(user_id, protected_date)` prevents double-protecting the same date (idempotency). The unique index also serves the streak-compute query: "all protected dates for user X".

## Architecture

### Shared constants

```typescript
// packages/shared/src/shields.ts
export const MAX_STREAK_SHIELDS = 3;
export const SHIELD_REFILL_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

export const ShieldBalanceResponseSchema = z.object({
  available: z.number().int().min(0).max(MAX_STREAK_SHIELDS),
  maxAvailable: z.literal(MAX_STREAK_SHIELDS),
  nextRefillAt: z.string().datetime().nullable(),
});
```

### Feature module

```
apps/server/src/features/shields/
  shields.repository.ts        # getUserShieldState, materializeRefill, tryUseShield (atomic), listProtectedDates
  shields.service.ts           # getBalance, tryUseShield (with refill side-effect)
  shields.route.ts             # GET /users/me/shields
  shields.service.test.ts
  shields.repository.integration.test.ts
```

### `ShieldsRepository.tryUseShield` atomicity

```sql
-- Atomic: only succeed if available > 0 AND no protection already exists for that date
WITH decrement AS (
  UPDATE "user"
  SET streak_shields_available = streak_shields_available - 1
  WHERE id = $userId AND streak_shields_available > 0
  RETURNING streak_shields_available
),
insertion AS (
  INSERT INTO streak_shield_usage (user_id, protected_date)
  VALUES ($userId, $protectedDate)
  ON CONFLICT (user_id, protected_date) DO NOTHING
  RETURNING id
)
SELECT
  (SELECT streak_shields_available FROM decrement) AS new_balance,
  (SELECT id FROM insertion) AS usage_id;
```

If `decrement` returns no row (no shields) OR `insertion` conflicts (already protected), the transaction rolls back. Service-layer treats either case as "shield not consumed".

**Race-free:** the entire CTE is one statement. Two concurrent calls cannot both decrement to a negative balance — the `WHERE … > 0` predicate runs inside the row lock.

### `ShieldsRepository.materializeRefill`

Read user shields + ultra columns + last_shield_grant_at + now. Compute how many refill ticks have elapsed (`Math.floor((now - last_grant) / 30days)`), capped at `MAX - current`. If `> 0` AND user is Ultra-active, issue a single UPDATE that increments shields and sets `last_shield_grant_at` forward by `ticks * 30 days`. Idempotent.

### Streak service integration

`StreaksService.getStreaks` adds a third data source: protected dates from `streak_shield_usage`. Algorithm:

```typescript
const [completedDates, protectedDates] = await Promise.all([
  repo.getCompletedSessionDates(userId),
  shieldsRepo.listProtectedDates(userId),
]);
const allDates = Array.from(new Set([...completedDates, ...protectedDates])).sort().reverse();
const { currentStreak, longestStreak } = computeStreaks(allDates);
```

Both date arrays are `YYYY-MM-DD` strings — Set dedup is correct.

### Auto-use hook in `sessions.completeSession`

Fire-and-forget after `repo.completeSession` succeeds:

```typescript
if (this.shieldsService) {
  void this.maybeProtectMissedDay(userId).catch((e) =>
    this.logger?.error({ err: e, userId }, "shield auto-use failed"),
  );
}
```

`maybeProtectMissedDay`:
1. Query `streaks.repository.getCompletedSessionDates(userId)` for the user's last 2 completed dates (today is first).
2. If `allDates[0] === today` and `allDates[1]` exists and `(today - allDates[1]).days === 2`:
   - `await shieldsService.tryUseShield(userId, yesterdayDateString)`.

Important: this hook only fires on session-complete; the streak-protect happens at *use* time, not at *break* time. A user who misses 2+ days never triggers the hook.

## API surface

### `GET /users/me/shields`

Auth-required.

Materializes refill (Ultra users) before returning. Response:

```json
{
  "available": 2,
  "maxAvailable": 3,
  "nextRefillAt": "2026-06-12T15:00:00.000Z"
}
```

`nextRefillAt` = `last_shield_grant_at + 30 days` if user is Ultra and not at cap. Null when `available === maxAvailable` OR user is not Ultra. Frontend renders countdown or "earn Ultra to start refilling".

Cached: `shields:{userId}` 60s. Invalidated on auto-use.

## Migration `0008_<name>.sql`

```sql
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "streak_shields_available" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "last_shield_grant_at" timestamp;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_streak_shields_chk') THEN
    ALTER TABLE "user" ADD CONSTRAINT "user_streak_shields_chk"
      CHECK ("streak_shields_available" >= 0 AND "streak_shields_available" <= 3);
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "streak_shield_usage" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "protected_date" date NOT NULL,
  "used_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "streak_shield_usage_user_date_idx" ON "streak_shield_usage" ("user_id", "protected_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "streak_shield_usage_user_idx" ON "streak_shield_usage" ("user_id");
```

PGlite mirror in `test-client.ts`.

## Shared schemas

`packages/shared/src/shields.ts`:
- `MAX_STREAK_SHIELDS = 3`
- `SHIELD_REFILL_INTERVAL_MS`
- `ShieldBalanceResponseSchema`

## Testing strategy

### Unit (Vitest)

- `shields.service.test.ts`:
  - `getBalance` for non-Ultra user → `available: 0, nextRefillAt: null`
  - `getBalance` for Ultra user with stale `last_shield_grant_at` → refill applied, balance increases
  - `getBalance` materializes max 3 ticks at once (months-of-stale)
  - `tryUseShield` happy path → returns `{ used: true, balanceAfter }`
  - `tryUseShield` no-shields → `{ used: false }`
  - `tryUseShield` already-protected → `{ used: false }`

- `streaks.service.test.ts`:
  - With protected dates merged into completed-dates, streak continues across a 1-day gap.
  - Without protected dates, gap breaks streak (regression check).

- `sessions.service.test.ts`:
  - Auto-use hook fires when previous-completed = 2 days ago AND shieldsService is injected.
  - Hook does NOT fire when prev = 1 day ago (no missed day) or prev = 3+ days ago (gap too large).
  - Fire-and-forget: if `tryUseShield` rejects, `completeSession` still returns `ok`.

### Integration (PGlite + real Postgres test DB)

- `shields.repository.integration.test.ts`:
  - `tryUseShield` atomicity: only succeeds when shields > 0; `streak_shields_available` decremented; usage row inserted.
  - Double-call with same `protectedDate`: second call returns no usage_id (UNIQUE conflict).
  - Cannot decrement below 0 (CHECK constraint).
  - `materializeRefill` applies N ticks at once.

- `streaks.repository.integration.test.ts` (extend):
  - `getCompletedSessionDates` unchanged; verify shields data is queried separately.

## Acceptance criteria

- Migration `0008` applies cleanly + `verify:migration` passes
- `user.streak_shields_available` + `user.last_shield_grant_at` columns + CHECK constraint
- `streak_shield_usage` table + UNIQUE(user_id, protected_date) index
- `ShieldsService.getBalance` lazy-refills for Ultra users
- `ShieldsService.tryUseShield` atomic decrement + insert in one SQL
- `StreaksService.getStreaks` reads protected dates as completed
- `sessions.completeSession` fire-and-forget hook auto-uses shield on 1-day gap
- `GET /users/me/shields` endpoint live
- All existing tests pass; new tests cover edge cases above
- `pnpm --filter server check-types` clean for production code
- Worker boots clean (no changes to worker layer)

## Deferred

- **Shield purchase via billing** → 2E.4 (Google Play / App Store webhooks).
- **Streak-break recovery for ≥2 missed days** → product decision, likely never (pure-protection model is simpler).
- **Push notification when shield is consumed** → optional polish.
- **Per-user max shields override** → not in spec.

---

*End of spec.*
