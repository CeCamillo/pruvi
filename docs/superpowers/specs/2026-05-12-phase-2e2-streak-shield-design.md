# Phase 2E.2 — Streak Shield (Design Spec, v2)

**Date:** 2026-05-12
**Phase:** 2E.2 (follow-up to 2E.1 Ultra entitlement)
**Source spec:** `pruvi-freatures.md` §5.3 *"Escudo de streak — protege o streak em 1 dia que o usuário não conseguiu treinar. Pode ser usado 1x. Comprável avulso ou incluso no Ultra."*

**Revision note:** v1 of this spec set `MAX_STREAK_SHIELDS = 3` with tick-based monthly accumulation. Self-review caught that this contradicts `pruvi-freatures.md` §5.3 line 307: *"Máximo de 1 escudo ativo por vez — não acumula."* Corrected here to MAX = 1 (binary stock). Self-review also flagged broken atomicity in the original CTE-based `tryUseShield`; this v2 mandates an explicit transaction with `SELECT … FOR UPDATE` for the user row.

## Goal

Ultra users have at most 1 streak shield in stock. The shield refills monthly (on lazy read, 30 days since last grant). When a user completes a session after a 1-day gap and has the shield available, it's auto-consumed to protect the missed day, preserving the streak. Free users have 0 shields by default (the referral-reward path that grants a shield is defined in §4.2 but its implementation is deferred — see Non-goals).

## Non-goals

- **Purchase a shield** (depends on 2E.4 billing webhooks).
- **Referral-reward shield grant** — §4.2 says invite acceptance rewards "+100 XP **ou** 1 escudo de streak." Current invitation flow (Phase 2D) only awards +100 XP. Adding the shield-grant alternative is deferred to a small follow-up; the schema here supports it (just write to `streak_shields_available`).
- **Manual "use shield now" endpoint** — shields auto-protect on session-complete. Spec §5.3 says "Escudo ativado automaticamente."
- **Recover-from-2+-day-break** — once the streak is fully broken (≥ 2 missed days), no recovery. One shield = one missed day only (matches "Pode ser usado 1x").
- **Billing-cycle alignment** — refill is time-based (rolling 30 days from last grant). The product doc says "na renovação" (on renewal); aligning refill timing with the billing renewal date is deferred to 2E.4 when real billing webhooks land.
- **Push notification on shield consumption** — "Notificação no dia seguinte: *'Seu escudo protegeu seu streak de X dias!'*" is in §5.3. Implementing this requires a per-day cron or hooking the next-day session — deferred to a small follow-up. For MVP, the streak just stays intact and the frontend infers from the next `getStreaks` result.

## Mechanic

### Streak math with shields

Current streak today = consecutive completed-or-protected days ending today (or yesterday).

A user who:
- Completed Mon, Tue
- Missed Wed
- Completes Thu with shield available
→ Shield auto-protects Wed. Streak = 4 (Mon, Tue, Wed-protected, Thu).

A user who:
- Completed Mon
- Missed Tue, Wed
- Completes Thu with shield available
→ Gap of 2 days. Shield is NOT consumed. Streak = 1 (just Thu).

### Lazy monthly refill (single-grant model)

When `getBalance` or `tryUseShield` is called:
1. Read user's shield + Ultra columns.
2. Compute Ultra-active = `is_ultra && (ultra_expires_at IS NULL OR ultra_expires_at > now)` (same predicate as `LivesRepository`).
3. If Ultra-active AND `streak_shields_available = 0` AND `(last_shield_grant_at IS NULL OR now - last_shield_grant_at >= 30 days)`:
   - Grant 1 shield. Set `last_shield_grant_at = now`.
4. Return the materialized state.

No tick loop — a stale Ultra user gets exactly 1 shield on first read, not multiple. The next eligible refill is 30 days after the new `last_shield_grant_at`.

**Race:** two concurrent calls could both pass the `streak_shields_available = 0` check and both grant. Mitigated by using a single conditional UPDATE: `UPDATE user SET streak_shields_available = 1, last_shield_grant_at = $now WHERE id = $userId AND streak_shields_available = 0 AND ($lastGrant condition)`. The predicate runs inside the row-update lock; only the first concurrent UPDATE matches and modifies, the second observes `streak_shields_available = 1` and matches zero rows.

### Auto-use trigger

`sessions.completeSession` hook (fire-and-forget after the session row is marked completed):

1. Read the user's 2 most recent completed-session dates (newest first; today is allDates[0]).
2. If `allDates[0] === today` and `allDates[1]` exists and `(today - allDates[1]).days === 2`:
   - `await shieldsService.tryUseShield(userId, yesterdayDateString)`.
3. Otherwise, no-op.

The hook fires after the streaks-service / dispatcher hooks already in `completeSession`.

**Timezone:** "today" is computed in `America/Sao_Paulo` (BRT, UTC-3, no DST). This matches Phase 2D's `startOfWeekBrt` helper. New helper `todayInBrt(now): string` returns `YYYY-MM-DD`. The streaks repo's `getCompletedSessionDates` MUST return BRT-local dates (using `created_at AT TIME ZONE … ::date`) AND MUST return distinct dates (one row per calendar day, not per session) — confirm with `DISTINCT` or `GROUP BY` on the date expression. Without distinctness, two same-day sessions would yield `allDates = ['today', 'today']`, breaking the gap-detection math. Verify before wiring the hook; if missing, fix the query in the same task.

## Data model

### `user` extensions

```sql
+ streak_shields_available  integer NOT NULL DEFAULT 0
+ last_shield_grant_at      timestamp
+ CHECK (streak_shields_available >= 0 AND streak_shields_available <= 1)
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

The UNIQUE index prevents double-protecting the same date (idempotency).

## Architecture

### Shared constants + schemas

```typescript
// packages/shared/src/shields.ts
export const MAX_STREAK_SHIELDS = 1;
export const SHIELD_REFILL_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

export const ShieldBalanceResponseSchema = z.object({
  available: z.number().int().min(0).max(MAX_STREAK_SHIELDS),
  maxAvailable: z.literal(MAX_STREAK_SHIELDS),
  nextRefillAt: z.string().datetime().nullable(),
});
export type ShieldBalanceResponse = z.infer<typeof ShieldBalanceResponseSchema>;

export const ShieldUseResultSchema = z.object({
  used: z.boolean(),
  balanceAfter: z.number().int().nullable(),
});
export type ShieldUseResult = z.infer<typeof ShieldUseResultSchema>;

// BRT day helper — moved here from streaks (or added if missing)
export function todayInBrt(now: Date): string {
  const brtMs = now.getTime() - 3 * 60 * 60 * 1000;
  return new Date(brtMs).toISOString().slice(0, 10);
}
```

### Feature module

```
apps/server/src/features/shields/
  shields.repository.ts        # getUserShieldState, materializeRefill, tryUseShield, listProtectedDates
  shields.service.ts           # getBalance, tryUseShield (after materializeRefill side-effect)
  shields.route.ts             # GET /users/me/shields
  shields.service.test.ts
  shields.repository.integration.test.ts
```

### `ShieldsRepository.materializeRefill` (race-safe)

```typescript
async materializeRefill(userId: string, now: Date): Promise<{ available: number; lastGrantAt: Date | null; isUltraActive: boolean }> {
  const current = await this.getUserShieldState(userId);
  if (!current) return { available: 0, lastGrantAt: null, isUltraActive: false };
  const ultraActive = current.isUltra && (!current.ultraExpiresAt || current.ultraExpiresAt > now);
  if (!ultraActive) {
    return { available: current.streakShieldsAvailable, lastGrantAt: current.lastShieldGrantAt, isUltraActive: false };
  }
  if (current.streakShieldsAvailable >= MAX_STREAK_SHIELDS) {
    return { available: current.streakShieldsAvailable, lastGrantAt: current.lastShieldGrantAt, isUltraActive: true };
  }
  const eligible = current.lastShieldGrantAt === null
    || now.getTime() - current.lastShieldGrantAt.getTime() >= SHIELD_REFILL_INTERVAL_MS;
  if (!eligible) {
    return { available: current.streakShieldsAvailable, lastGrantAt: current.lastShieldGrantAt, isUltraActive: true };
  }
  // Conditional UPDATE — race-safe via predicate-in-update.
  const updated = await this.db
    .update(user)
    .set({ streakShieldsAvailable: 1, lastShieldGrantAt: now })
    .where(
      and(
        eq(user.id, userId),
        eq(user.streakShieldsAvailable, 0),
        // Re-check eligibility predicate
        current.lastShieldGrantAt === null
          ? isNull(user.lastShieldGrantAt)
          : lt(user.lastShieldGrantAt, new Date(now.getTime() - SHIELD_REFILL_INTERVAL_MS)),
      )
    )
    .returning({ available: user.streakShieldsAvailable, lastGrantAt: user.lastShieldGrantAt });
  if (updated.length === 0) {
    // Concurrent grant won. Re-read to return current state.
    const fresh = await this.getUserShieldState(userId);
    return { available: fresh?.streakShieldsAvailable ?? 0, lastGrantAt: fresh?.lastShieldGrantAt ?? null, isUltraActive: true };
  }
  return { available: updated[0]!.available, lastGrantAt: updated[0]!.lastGrantAt, isUltraActive: true };
}
```

### `ShieldsRepository.tryUseShield` (transaction-wrapped)

```typescript
async tryUseShield(userId: string, protectedDate: string): Promise<{ used: boolean; balanceAfter: number | null }> {
  try {
    return await this.db.transaction(async (tx) => {
      // 1. Decrement only if shields > 0.
      const dec = await tx
        .update(user)
        .set({ streakShieldsAvailable: sql`${user.streakShieldsAvailable} - 1` })
        .where(and(eq(user.id, userId), gt(user.streakShieldsAvailable, 0)))
        .returning({ available: user.streakShieldsAvailable });
      if (dec.length === 0) return { used: false, balanceAfter: null };

      // 2. Insert protection row. UNIQUE conflict → throw so the transaction rolls back the decrement.
      try {
        await tx.insert(streakShieldUsage).values({ userId, protectedDate });
      } catch (e) {
        throw new Error("ALREADY_PROTECTED");
      }
      return { used: true, balanceAfter: dec[0]!.available };
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_PROTECTED") {
      return { used: false, balanceAfter: null };
    }
    throw e;
  }
}
```

The transaction guarantees: either both the decrement and the insert commit, OR neither does. The UNIQUE constraint catches double-protection deterministically.

### Streak service integration

`StreaksService.getStreaks` merges protected dates into completed-dates set:

```typescript
const [completedDates, protectedDates] = await Promise.all([
  this.repo.getCompletedSessionDates(userId),
  this.shieldsRepo?.listProtectedDates(userId) ?? Promise.resolve([] as string[]),
]);
const allDates = Array.from(new Set([...completedDates, ...protectedDates])).sort().reverse();
```

`totalSessions` still uses `countCompletedSessions` — protected dates do NOT count as sessions.

### Auto-use hook in `sessions.completeSession`

Fire-and-forget after the session row commits. Uses `todayInBrt(now)` for date comparison. See "Auto-use trigger" above.

## API surface

### `GET /users/me/shields`

Auth-required. Materializes refill before returning.

```json
{ "available": 1, "maxAvailable": 1, "nextRefillAt": null }
```

`nextRefillAt` semantics:
- `null` when `available === maxAvailable` (already at cap)
- `null` when user is not Ultra-active AND `available === 0` (no refill source)
- `last_shield_grant_at + 30 days` when Ultra-active AND `available === 0` AND `last_shield_grant_at` is set
- `now` when Ultra-active AND `available === 0` AND `last_shield_grant_at` is null (eligible immediately, but materializeRefill should have just granted — this branch only reachable if non-Ultra-aware race)

Cached: `shields:{userId}` 60s. Invalidated on auto-use.

**Free-user note:** if a free user receives a shield via the (deferred) referral path, the endpoint reads the raw `streak_shields_available` column. The endpoint does NOT hard-code 0 for non-Ultra users — it reflects DB state. `nextRefillAt` is null for non-Ultra users regardless of available count.

## Migration `0008_<name>.sql`

```sql
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "streak_shields_available" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "last_shield_grant_at" timestamp;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_streak_shields_chk') THEN
    ALTER TABLE "user" ADD CONSTRAINT "user_streak_shields_chk"
      CHECK ("streak_shields_available" >= 0 AND "streak_shields_available" <= 1);
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

## Testing strategy

### Unit (Vitest)

- `shields.service.test.ts`:
  - `getBalance` non-Ultra user → `{ available: 0, nextRefillAt: null }`.
  - `getBalance` Ultra user, no prior grant → 1 shield granted, `nextRefillAt = now + 30d`.
  - `getBalance` Ultra user, 31 days since grant, 0 shields → 1 shield granted, `nextRefillAt` set.
  - `getBalance` Ultra user, 5 days since grant, 0 shields → no refill, `nextRefillAt` is `old + 30d`.
  - `getBalance` Ultra user with 1 shield → `nextRefillAt: null` (at cap).
  - `tryUseShield` happy path → `{ used: true, balanceAfter: 0 }`.
  - `tryUseShield` no shields → `{ used: false, balanceAfter: null }`.
  - `tryUseShield` already-protected → `{ used: false, balanceAfter: null }` and (verified at integration layer) balance unchanged.

- `streaks.service.test.ts`:
  - Protected dates merge into completed-dates set → 1-day gap preserved.
  - Without protected dates, same scenario gives shorter streak (regression check).

- `sessions.service.test.ts`:
  - Hook fires when prev-completed = 2 days ago (BRT-relative) AND shieldsService injected.
  - Hook does NOT fire for gap = 1 day or gap = 3+ days.
  - No-`shieldsService` constructor: no error.
  - Fire-and-forget: dispatcher rejection doesn't fail `completeSession`.

### Integration (real Postgres test DB)

- `shields.repository.integration.test.ts`:
  - `tryUseShield` happy path: balance = 1 → 0, usage row inserted.
  - `tryUseShield` already-protected: returns `{ used: false }`. Balance is UNCHANGED post-rollback (verify via follow-up SELECT).
  - `tryUseShield` no shields: returns `{ used: false }`. No usage row inserted.
  - CHECK constraint: direct UPDATE setting `streak_shields_available = -1` or `= 2` is rejected.
  - `materializeRefill` for Ultra user with NULL last_grant: grants 1 shield, sets last_grant_at = now.
  - `materializeRefill` for Ultra user already at 1 shield: no-op.
  - `materializeRefill` for non-Ultra user: no-op.
  - `listProtectedDates` returns ISO date strings sorted.
  - `materializeRefill` race: two concurrent calls — only one grants (verified by post-state). PGlite is single-process; the test runs them sequentially and asserts the second call observes the freshly-granted state.

## Acceptance criteria

- Migration `0008` applies cleanly + `verify:migration` passes.
- `user.streak_shields_available` (0..1) + `user.last_shield_grant_at` + CHECK.
- `streak_shield_usage` table + UNIQUE(user_id, protected_date).
- `ShieldsService.getBalance` lazy-grants for eligible Ultra users.
- `ShieldsService.tryUseShield` transaction-wrapped, atomic, idempotent on already-protected.
- `StreaksService.getStreaks` reads protected dates as completed.
- `sessions.completeSession` fire-and-forget hook auto-uses shield on 1-day BRT gap.
- `GET /users/me/shields` returns balance + nextRefillAt per the rules above.
- All existing tests pass; new tests cover edge cases.
- `pnpm --filter server check-types` clean for production code.
- Worker boots clean (regression check).

## Deferred (explicit follow-ups)

- **Shield purchase via billing** → 2E.4.
- **Referral-reward shield grant alternative (§4.2)** → small follow-up.
- **"Shield protected your streak" push notification (§5.3)** → small follow-up.
- **Billing-cycle-aligned refill timing** → 2E.4.

---

*End of spec v2.*
