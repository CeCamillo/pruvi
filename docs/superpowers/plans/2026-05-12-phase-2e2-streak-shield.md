# Phase 2E.2 — Streak Shield Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship streak shields: Ultra users have at most 1 shield in stock (binary, no accumulation per spec v2 §5.3). Lazy single-grant refill 30 days after last grant. Auto-protect a 1-day gap on session-complete. New endpoint to view balance.

> **Status note:** Tasks 1-2 already shipped (commits `2a24dba`, `82191c7`, `66adaed`, `7f7486c`). Shared constants (MAX_STREAK_SHIELDS = 1, ShieldUseResultSchema, todayInBrt) + migration `0008_known_lockjaw.sql` (with CHECK `<= 1`) + PGlite mirror are all in place. Implement Tasks 3-5 below.

**Architecture:** New `shields/` feature module (repo + service + route). Atomic CTE in `tryUseShield` for race-free decrement + protection-row insert. Lazy refill computed in `materializeRefill`. `StreaksService` merges protected dates from `streak_shield_usage` into the completed-dates set. Fire-and-forget hook in `sessions.completeSession`.

**Source spec:** `docs/superpowers/specs/2026-05-12-phase-2e2-streak-shield-design.md`

---

## File Structure

**Create:**
- `packages/shared/src/shields.ts` — `MAX_STREAK_SHIELDS`, `SHIELD_REFILL_INTERVAL_MS`, `ShieldBalanceResponseSchema`
- `packages/shared/src/shields.test.ts`
- `packages/db/src/schema/streak-shield-usage.ts`
- `packages/db/src/migrations/0008_<generated>.sql`
- `apps/server/src/features/shields/shields.repository.ts`
- `apps/server/src/features/shields/shields.service.ts`
- `apps/server/src/features/shields/shields.route.ts`
- `apps/server/src/features/shields/shields.service.test.ts`
- `apps/server/src/features/shields/shields.repository.integration.test.ts`

**Modify:**
- `packages/db/src/schema/auth.ts` — `streakShieldsAvailable`, `lastShieldGrantAt`
- `packages/db/src/schema/index.ts` — re-export shield usage schema
- `packages/db/src/test-client.ts` — mirror DDL
- `packages/shared/src/index.ts` — re-export shields
- `apps/server/src/features/streaks/streaks.service.ts` — merge protected dates
- `apps/server/src/features/streaks/streaks.repository.ts` — add `getRecentCompletedSessionDates(userId, limit)` (helper used by sessions hook)
- `apps/server/src/features/streaks/streaks.service.test.ts` — extend
- `apps/server/src/features/sessions/sessions.service.ts` — inject `shieldsService`, fire-and-forget hook
- `apps/server/src/features/sessions/sessions.service.test.ts` — hook cases
- `apps/server/src/features/sessions/sessions.route.ts` — wire `shieldsService`
- `apps/server/src/index.ts` — register `shieldsRoutes`

---

## Tasks

### Task 1: Shared constants + schema

**Files:**
- Create: `packages/shared/src/shields.ts`, `packages/shared/src/shields.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: `packages/shared/src/shields.ts`**

```typescript
import { z } from "zod";

export const MAX_STREAK_SHIELDS = 3;
export const SHIELD_REFILL_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

export const ShieldBalanceResponseSchema = z.object({
  available: z.number().int().min(0).max(MAX_STREAK_SHIELDS),
  maxAvailable: z.literal(MAX_STREAK_SHIELDS),
  nextRefillAt: z.string().datetime().nullable(),
});
export type ShieldBalanceResponse = z.infer<typeof ShieldBalanceResponseSchema>;
```

- [ ] **Step 2: `packages/shared/src/shields.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { ShieldBalanceResponseSchema, MAX_STREAK_SHIELDS } from "./shields";

describe("ShieldBalanceResponseSchema", () => {
  it("accepts a valid balance", () => {
    expect(ShieldBalanceResponseSchema.safeParse({
      available: 2, maxAvailable: 3, nextRefillAt: "2026-06-12T00:00:00.000Z",
    }).success).toBe(true);
  });
  it("accepts null nextRefillAt", () => {
    expect(ShieldBalanceResponseSchema.safeParse({
      available: 0, maxAvailable: 3, nextRefillAt: null,
    }).success).toBe(true);
  });
  it("rejects available > MAX_STREAK_SHIELDS", () => {
    expect(ShieldBalanceResponseSchema.safeParse({
      available: 4, maxAvailable: 3, nextRefillAt: null,
    }).success).toBe(false);
  });
  it("rejects negative available", () => {
    expect(ShieldBalanceResponseSchema.safeParse({
      available: -1, maxAvailable: 3, nextRefillAt: null,
    }).success).toBe(false);
  });
  it("MAX_STREAK_SHIELDS = 3", () => {
    expect(MAX_STREAK_SHIELDS).toBe(3);
  });
});
```

- [ ] **Step 3: Re-export**

Append to `packages/shared/src/index.ts`:
```typescript
export * from "./shields";
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @pruvi/shared test shields
git add packages/shared/src/shields.ts packages/shared/src/shields.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): streak shield constants + response schema"
```

---

### Task 2: DB schema + migration

**Files:**
- Modify: `packages/db/src/schema/auth.ts`
- Create: `packages/db/src/schema/streak-shield-usage.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/migrations/0008_<generated>.sql`
- Modify: `packages/db/src/test-client.ts`

- [ ] **Step 1: Add columns to `auth.ts`**

```typescript
streakShieldsAvailable: integer("streak_shields_available").notNull().default(0),
lastShieldGrantAt: timestamp("last_shield_grant_at"),
```

- [ ] **Step 2: Create `streak-shield-usage.ts` schema**

```typescript
import { relations } from "drizzle-orm";
import { date, index, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const streakShieldUsage = pgTable(
  "streak_shield_usage",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    protectedDate: date("protected_date").notNull(),
    usedAt: timestamp("used_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("streak_shield_usage_user_date_idx").on(table.userId, table.protectedDate),
    index("streak_shield_usage_user_idx").on(table.userId),
  ],
);

export const streakShieldUsageRelations = relations(streakShieldUsage, ({ one }) => ({
  user: one(user, { fields: [streakShieldUsage.userId], references: [user.id] }),
}));
```

- [ ] **Step 3: Re-export schema**

Append to `packages/db/src/schema/index.ts`:
```typescript
export * from "./streak-shield-usage";
```

- [ ] **Step 4: Generate migration**

Run: `pnpm --filter @pruvi/db db:generate`. Note the generated filename.

- [ ] **Step 5: Replace migration SQL with idempotent version**

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

- [ ] **Step 6: Mirror in PGlite test-client**

In `packages/db/src/test-client.ts`:
- Add `streak_shields_available INTEGER NOT NULL DEFAULT 0` to user table.
- Add `last_shield_grant_at TIMESTAMP`.
- Add inline `CONSTRAINT user_streak_shields_chk CHECK (streak_shields_available >= 0 AND streak_shields_available <= 3)`.
- After the user CREATE TABLE block, add the `streak_shield_usage` CREATE TABLE + UNIQUE/INDEX statements.

- [ ] **Step 7: Run verify:migration + tests**

```bash
pnpm verify:migration
pnpm --filter server test && pnpm --filter server test:integration
```

All must pass.

- [ ] **Step 8: Commit**

```bash
git add packages/db
git commit -m "feat(db): streak_shields_available + streak_shield_usage (migration 0008)"
```

---

### Task 3: Shields repository + service + route

**Files:**
- Create: `apps/server/src/features/shields/shields.repository.ts`
- Create: `apps/server/src/features/shields/shields.service.ts`
- Create: `apps/server/src/features/shields/shields.route.ts`
- Create: `apps/server/src/features/shields/shields.service.test.ts`
- Create: `apps/server/src/features/shields/shields.repository.integration.test.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Repository**

```typescript
import { eq, sql } from "drizzle-orm";
import type { db as DbClient } from "@pruvi/db";
import { user } from "@pruvi/db/schema/auth";
import { streakShieldUsage } from "@pruvi/db/schema/streak-shield-usage";
import { MAX_STREAK_SHIELDS } from "@pruvi/shared";

type Db = typeof DbClient;

export class ShieldsRepository {
  constructor(private db: Db) {}

  async getUserShieldState(userId: string) {
    const rows = await this.db
      .select({
        streakShieldsAvailable: user.streakShieldsAvailable,
        lastShieldGrantAt: user.lastShieldGrantAt,
        isUltra: user.isUltra,
        ultraExpiresAt: user.ultraExpiresAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Apply lazy refill if eligible. Single-grant model (MAX=1, per spec v2): an
   * Ultra-active user with 0 shields and either a NULL anchor or anchor >= 30d
   * old gets exactly 1 shield. Race-safe via conditional UPDATE.
   */
  async materializeRefill(
    userId: string,
    now: Date,
  ): Promise<{ available: number; lastGrantAt: Date | null; isUltraActive: boolean }> {
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
    // Race-safe conditional UPDATE: WHERE predicate re-evaluates inside row-level lock.
    const whereConditions = current.lastShieldGrantAt === null
      ? and(eq(user.id, userId), eq(user.streakShieldsAvailable, 0), isNull(user.lastShieldGrantAt))
      : and(eq(user.id, userId), eq(user.streakShieldsAvailable, 0), lt(user.lastShieldGrantAt, new Date(now.getTime() - SHIELD_REFILL_INTERVAL_MS)));
    const updated = await this.db
      .update(user)
      .set({ streakShieldsAvailable: 1, lastShieldGrantAt: now })
      .where(whereConditions)
      .returning({ available: user.streakShieldsAvailable, lastGrantAt: user.lastShieldGrantAt });
    if (updated.length === 0) {
      // Concurrent grant won. Re-read.
      const fresh = await this.getUserShieldState(userId);
      return { available: fresh?.streakShieldsAvailable ?? 0, lastGrantAt: fresh?.lastShieldGrantAt ?? null, isUltraActive: true };
    }
    return { available: updated[0]!.available, lastGrantAt: updated[0]!.lastGrantAt, isUltraActive: true };
  }

  /**
   * Atomic decrement + protection insert. Returns `{ used: true }` only when
   * both succeed; UNIQUE conflict on (user_id, protected_date) rolls back
   * the decrement via thrown error.
   */
  async tryUseShield(userId: string, protectedDate: string): Promise<ShieldUseResult> {
    try {
      return await this.db.transaction(async (tx) => {
        // 1. Conditional decrement — only succeeds when shields > 0 (predicate inside row lock).
        const dec = await tx
          .update(user)
          .set({ streakShieldsAvailable: sql`${user.streakShieldsAvailable} - 1` })
          .where(and(eq(user.id, userId), gt(user.streakShieldsAvailable, 0)))
          .returning({ available: user.streakShieldsAvailable });
        if (dec.length === 0) return { used: false, balanceAfter: null };

        // 2. Insert protection row. UNIQUE conflict → throw to roll back the decrement.
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

  async listProtectedDates(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ protectedDate: streakShieldUsage.protectedDate })
      .from(streakShieldUsage)
      .where(eq(streakShieldUsage.userId, userId));
    return rows.map((r) => (typeof r.protectedDate === "string" ? r.protectedDate : new Date(r.protectedDate).toISOString().slice(0, 10)));
  }
}
```

Note: import `ShieldUseResult` from `@pruvi/shared`. Imports needed at the top: `eq, sql, and, gt, isNull, lt` from `drizzle-orm`.

- [ ] **Step 2: Service**

```typescript
import { ok, type Result } from "neverthrow";
import { AppError } from "../../utils/errors";
import { MAX_STREAK_SHIELDS, SHIELD_REFILL_INTERVAL_MS, type ShieldUseResult } from "@pruvi/shared";
import type { ShieldsRepository } from "./shields.repository";

export class ShieldsService {
  constructor(private repo: ShieldsRepository) {}

  async getBalance(userId: string): Promise<Result<{ available: number; maxAvailable: number; nextRefillAt: string | null }, AppError>> {
    const now = new Date();
    const state = await this.repo.materializeRefill(userId, now);
    let nextRefillAt: Date | null = null;
    if (state.isUltraActive && state.available < MAX_STREAK_SHIELDS && state.lastGrantAt) {
      nextRefillAt = new Date(state.lastGrantAt.getTime() + SHIELD_REFILL_INTERVAL_MS);
    } else if (state.isUltraActive && state.available < MAX_STREAK_SHIELDS && !state.lastGrantAt) {
      // Edge: Ultra user with NULL last_shield_grant_at but materializeRefill didn't grant
      // (concurrent grant lost the race). nextRefillAt = now is the truthful answer.
      nextRefillAt = now;
    }
    return ok({
      available: state.available,
      maxAvailable: MAX_STREAK_SHIELDS,
      nextRefillAt: nextRefillAt?.toISOString() ?? null,
    });
  }

  async tryUseShield(userId: string, protectedDate: string): Promise<ShieldUseResult> {
    // Materialize refill first so eligible Ultra users have access to a freshly-granted shield.
    await this.repo.materializeRefill(userId, new Date());
    return this.repo.tryUseShield(userId, protectedDate);
  }
}
```

- [ ] **Step 3: Route**

`shields.route.ts`:

```typescript
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ShieldBalanceResponseSchema } from "@pruvi/shared";
import { db } from "@pruvi/db";
import { unwrapResult } from "../../types";
import { ShieldsRepository } from "./shields.repository";
import { ShieldsService } from "./shields.service";

export const shieldsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const repo = new ShieldsRepository(db);
  const service = new ShieldsService(repo);

  fastify.get(
    "/users/me/shields",
    {
      preHandler: [fastify.authenticate],
      schema: { response: { 200: z.object({ success: z.literal(true), data: ShieldBalanceResponseSchema }) } },
    },
    async (request) => unwrapResult(await service.getBalance(request.userId)),
  );
};
```

- [ ] **Step 4: Wire in `apps/server/src/index.ts`**

Register `shieldsRoutes` alongside `ultraRoutes`/`rankingRoutes`/etc.

- [ ] **Step 5: Unit tests `shields.service.test.ts`**

Cover (MAX = 1, single-grant semantics):
- Non-Ultra user: balance returns `{ available: 0, nextRefillAt: null }`.
- Ultra user, NULL `lastShieldGrantAt`: refill grants 1; response has `available: 1`, `nextRefillAt: null` (at cap).
- Ultra user with 0 shields, last grant 31d ago: refill grants 1; `available: 1`, `nextRefillAt: null` (at cap).
- Ultra user with 0 shields, last grant 5d ago: NO refill; `available: 0`, `nextRefillAt = lastGrant + 30d`.
- Ultra user already at 1 shield (regardless of last grant age): no refill; `available: 1`, `nextRefillAt: null`.
- `tryUseShield` happy path: returns `{ used: true, balanceAfter: 0 }`.
- `tryUseShield` no shields: returns `{ used: false, balanceAfter: null }`.
- `tryUseShield` already-protected: returns `{ used: false, balanceAfter: null }`.

- [ ] **Step 6: Integration tests `shields.repository.integration.test.ts`**

Cover (MAX = 1, single-grant semantics):
- `tryUseShield` with shields=1: decrement to 0, insert usage row, return `{ used: true, balanceAfter: 0 }`.
- `tryUseShield` with shields=0: returns `{ used: false, balanceAfter: null }`. No usage row inserted.
- `tryUseShield` for already-protected date: returns `{ used: false, balanceAfter: null }`. Shields count NOT decremented (verify with follow-up SELECT — transaction rolled back).
- CHECK constraint: direct UPDATE attempting `streak_shields_available = -1` rejected. `streak_shields_available = 2` rejected.
- `materializeRefill` for Ultra user with NULL last_grant: grants 1 shield, sets last_grant_at = now.
- `materializeRefill` for Ultra user with stale (40 days ago) last_grant and 0 shields: grants 1 shield, sets last_grant_at = now.
- `materializeRefill` for Ultra user with 1 shield already (regardless of stale grant): NO-op.
- `materializeRefill` for non-Ultra user: NO-op.
- `materializeRefill` for Ultra user with 5d-old grant and 0 shields: NO-op (interval not elapsed).
- `listProtectedDates` returns ISO date strings.

- [ ] **Step 7: Run + commit**

```bash
pnpm --filter server test shields
pnpm --filter server test:integration shields
git add apps/server/src/features/shields apps/server/src/index.ts
git commit -m "feat(shields): repository + service + GET /users/me/shields"
```

---

### Task 4: Streaks integration

**Files:**
- Modify: `apps/server/src/features/streaks/streaks.service.ts`
- Modify: `apps/server/src/features/streaks/streaks.service.test.ts`

- [ ] **Step 1: Inject `ShieldsRepository`**

Constructor signature: `constructor(private repo: StreaksRepository, private shieldsRepo?: ShieldsRepository)`. Optional for backward compat with existing test instantiations.

- [ ] **Step 2: Merge protected dates in `getStreaks`**

```typescript
const [completedDates, protectedDates] = await Promise.all([
  this.repo.getCompletedSessionDates(userId),
  this.shieldsRepo?.listProtectedDates(userId) ?? Promise.resolve([] as string[]),
]);

// Both arrays contain `YYYY-MM-DD` BRT-local strings — Set dedup is safe.
const allDates = Array.from(new Set([...completedDates, ...protectedDates])).sort().reverse();
if (allDates.length === 0) {
  return ok({ currentStreak: 0, longestStreak: 0, totalSessions: 0 });
}
const { currentStreak, longestStreak } = computeStreaks(allDates);
return ok({ currentStreak, longestStreak, totalSessions });
```

Note: `totalSessions` still uses `countCompletedSessions` — protected dates do NOT count as sessions, only as streak preservers.

- [ ] **Step 3: Wire `shieldsRepo` in the route**

`apps/server/src/features/streaks/streaks.route.ts` (or wherever `new StreaksService(...)` is called) — pass `new ShieldsRepository(db)` as 2nd arg.

- [ ] **Step 4: Tests**

`streaks.service.test.ts`:
- Existing tests still pass (with `shieldsRepo` mocked to return empty array).
- New test: with completed dates `[today, day-before-yesterday]` and protected date `[yesterday]`, current streak = 3.
- New test: without protected date, the same scenario gives streak = 1 (only today, gap breaks it).

- [ ] **Step 5: Commit**

```bash
pnpm --filter server test streaks
git add apps/server/src/features/streaks
git commit -m "feat(streaks): merge protected dates from shield usage into streak compute"
```

---

### Task 5: Sessions auto-use hook

**Files:**
- Modify: `apps/server/src/features/sessions/sessions.service.ts`
- Modify: `apps/server/src/features/sessions/sessions.service.test.ts`
- Modify: `apps/server/src/features/sessions/sessions.route.ts`

- [ ] **Step 1: Inject `ShieldsService`**

`SessionsService` constructor adds optional `shieldsService?: ShieldsService`. Place after the existing optional deps.

- [ ] **Step 2: Hook in `completeSession`**

After `repo.completeSession(...)` returns the row:

```typescript
if (this.shieldsService) {
  void this.maybeProtectMissedDay(userId).catch((e) =>
    this.logger?.error?.({ err: e, userId }, "shield auto-use failed"),
  );
}
```

(Add `private logger?: FastifyBaseLogger` to constructor if it doesn't already exist — match the reviews.service pattern from 2D.1.)

```typescript
import { todayInBrt } from "@pruvi/shared";

private async maybeProtectMissedDay(userId: string): Promise<void> {
  // Use BRT-local date math — UTC would mis-fire near midnight for users.
  const now = new Date();
  const todayStr = todayInBrt(now);
  const yesterdayStr = todayInBrt(new Date(now.getTime() - 86_400_000));
  const dates = await this.streaksService!.getRecentCompletedDates(userId, 2);
  if (dates.length < 2) return;
  if (dates[0] !== todayStr) return;
  // Both dates are YYYY-MM-DD BRT strings — convert to date-aware Date at midnight BRT (UTC 03:00).
  const todayDate = new Date(todayStr + "T03:00:00Z");
  const prevDate = new Date(dates[1] + "T03:00:00Z");
  const diffDays = Math.round((todayDate.getTime() - prevDate.getTime()) / 86_400_000);
  if (diffDays !== 2) return;
  await this.shieldsService!.tryUseShield(userId, yesterdayStr);
}
```

**Sub-step (CRITICAL): verify `getCompletedSessionDates` returns DISTINCT BRT dates.**

Before wiring the hook, open `streaks.repository.ts` and inspect the SQL of `getCompletedSessionDates`. The query MUST return one row per distinct BRT calendar day (not per session). Without DISTINCT, two same-day sessions yield `dates = ['today', 'today']`, making `(today - dates[1]).days === 0` and breaking the gap math.

- If the current query uses `created_at::date` without a timezone conversion or without DISTINCT: fix it to use `(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date` AND wrap with `DISTINCT` or `GROUP BY`.
- If already correct, leave it.

**`StreaksService.getRecentCompletedDates(userId, limit)` helper** — add this method. It exposes the streaks repo's date list to the sessions hook without duplicating the query. Match the existing repo signature; slice to `limit` in the service.

```typescript
// streaks.service.ts
async getRecentCompletedDates(userId: string, limit: number): Promise<string[]> {
  const dates = await this.repo.getCompletedSessionDates(userId);
  return dates.slice(0, limit);
}
```

The sessions service already has `streaksService` injected, so no new wiring is needed beyond this method.

- [ ] **Step 3: Wire in `sessions.route.ts`**

Open `sessions.route.ts`. The `new SessionsService(...)` instantiation MUST be inside the `async (fastify) => { ... }` plugin function body — NOT at module level. This is the established pattern from the 2D.1 reviews-route fix (commit `60564c0`); module-level construction triggers DB connections at boot and can't access `fastify.*`.

- If `new SessionsService(...)` is already inside the plugin function, just append `new ShieldsService(new ShieldsRepository(db))` as the new constructor arg.
- If it's at module level, FIRST move all related construction inside the plugin function (match `reviews.route.ts` structure), THEN add the shields arg.

- [ ] **Step 4: Tests**

`sessions.service.test.ts`:
- Cases:
  - `completeSession` with prev-completed-date = 2 days ago AND `shieldsService` injected → `tryUseShield` called with yesterday's date.
  - `completeSession` with prev-completed-date = 1 day ago → `tryUseShield` NOT called (no missed day).
  - `completeSession` with prev-completed-date = 3 days ago → `tryUseShield` NOT called (gap too large).
  - `completeSession` with no `shieldsService` → no error.
  - Fire-and-forget: if `tryUseShield` rejects, `completeSession` still returns `ok`.

Use `await new Promise((r) => setImmediate(r))` to flush microtasks before asserting.

- [ ] **Step 5: Run + commit**

```bash
pnpm --filter server test sessions
git add apps/server/src/features/sessions
git commit -m "feat(sessions): auto-use shield on 1-day-gap completion"
```

---

### Task 6: Final verification + push

- [ ] **Step 1: Full sweep**

```bash
pnpm --filter server test
pnpm --filter server test:integration
pnpm --filter @pruvi/shared test
pnpm verify:migration
pnpm --filter server check-types
```

All must pass.

- [ ] **Step 2: Worker boot smoke**

```bash
pnpm dev:worker  # Ctrl-C after ready
```

- [ ] **Step 3: Push + PR**

```bash
git push -u origin feature/phase-2e2-streak-shield
gh pr create --base main --title "feat: phase 2e.2 — streak shield (Ultra perk + auto-protect)" --body "..."
```

PR body: summarize lazy refill, atomic tryUseShield via transaction, streak compute merging protected dates, sessions hook. Reference spec.

---

## Self-review

**Spec coverage:**
- ✅ Schema (columns + CHECK + table + indexes) → Task 2
- ✅ `MAX_STREAK_SHIELDS = 3` constant + `SHIELD_REFILL_INTERVAL_MS` → Task 1
- ✅ Lazy refill (`materializeRefill`) → Task 3
- ✅ Atomic `tryUseShield` via transaction → Task 3
- ✅ Streaks integration → Task 4
- ✅ Auto-use hook → Task 5
- ✅ `GET /users/me/shields` → Task 3

**Type consistency:**
- `tryUseShield` returns `{ used: boolean, balanceAfter: number | null }` consistently in repo + service.
- `materializeRefill` returns `{ available, lastGrantAt, isUltraActive }` — service uses for `nextRefillAt` calc.
- Protected dates are `YYYY-MM-DD` strings throughout (`listProtectedDates` returns strings, `tryUseShield` accepts string).

**Placeholder scan:** None.

**Atomicity:** `tryUseShield` is transaction-wrapped (NOT a multi-CTE) — the plan corrects an earlier exploration of CTE-based atomicity that wouldn't have worked.
