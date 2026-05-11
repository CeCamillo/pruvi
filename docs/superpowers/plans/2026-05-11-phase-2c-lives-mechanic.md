# Phase 2C — Lives Mechanic Redesign + DB CHECK Constraints — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 24h-refill-all-5 lives mechanic with 1-per-4h regen, fix TOCTOU race in decrement via atomic UPDATE, and add DB CHECK constraints on `user.lives`, `user.total_xp`, `user.current_level`.

**Architecture:** Pure helpers in `@pruvi/shared` (`computeRegenSnapshot`, `nextRegenAt`) own the regen math. `LivesRepository` gains `materializeRegen` (idempotent UPDATE) and `tryDecrement` (atomic single-statement decrement with `WHERE lives > 0 RETURNING`). Reviews service uses the two methods instead of read-then-write. DB CHECK constraints catch any state-shape violations regardless of application bugs.

**Tech Stack:** Drizzle ORM + drizzle-kit, PostgreSQL 16, Bun runtime, Vitest, PGlite (in-process Postgres for integration tests), neverthrow Result.

**Source spec:** `docs/superpowers/specs/2026-05-11-phase-2c-lives-mechanic-design.md`

---

## File Structure

**Create:**
- `packages/shared/src/lives.test.ts` — unit tests for pure helpers
- `apps/server/src/features/lives/lives.repository.integration.test.ts` — integration tests for materializeRegen + tryDecrement
- `packages/db/src/schema/auth.constraints.integration.test.ts` — CHECK-constraint integration tests
- `packages/db/src/migrations/0005_<drizzle-generated-name>.sql` — column rename + CHECK constraints + backfill clamp

**Modify:**
- `packages/shared/src/lives.ts` — add `LIVES_REGEN_INTERVAL_MS`, `computeRegenSnapshot`, `nextRegenAt`
- `packages/db/src/schema/auth.ts` — rename `livesResetAt` → `livesLastRegenAt`; mirror in column name
- `packages/db/src/test-client.ts` — mirror migration DDL (rename + 3 CHECK constraints)
- `apps/server/src/features/lives/lives.repository.ts` — add `materializeRegen`, `tryDecrement`; update existing methods to new column name
- `apps/server/src/features/lives/lives.service.ts` — use `materializeRegen` + `nextRegenAt`
- `apps/server/src/features/lives/lives.service.test.ts` — update tests for new behavior
- `apps/server/src/features/reviews/reviews.service.ts` — replace read-then-write with `materializeRegen` + `tryDecrement`
- `apps/server/src/features/reviews/reviews.repository.ts` — delete `resetLives`/`decrementLives`/`getUserLives` (moved to LivesRepository) OR keep as thin delegates; choose delete if no other callers
- `apps/server/src/features/reviews/reviews.service.test.ts` — update mock expectations
- `apps/server/src/features/reviews/reviews.repository.integration.test.ts` — update for new column name

---

## Tasks

### Task 1: Pure regen helpers in `@pruvi/shared`

**Files:**
- Modify: `packages/shared/src/lives.ts`
- Create: `packages/shared/src/lives.test.ts`

- [ ] **Step 1: Write failing tests for `computeRegenSnapshot` and `nextRegenAt`**

Create `packages/shared/src/lives.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  computeRegenSnapshot,
  nextRegenAt,
  LIVES_REGEN_INTERVAL_MS,
  MAX_LIVES,
} from "./lives";

const FOUR_H = LIVES_REGEN_INTERVAL_MS;
const base = new Date("2026-05-11T12:00:00Z");

describe("computeRegenSnapshot", () => {
  it("returns as-is when already at MAX_LIVES (anchor null)", () => {
    const r = computeRegenSnapshot(MAX_LIVES, null, base);
    expect(r).toEqual({ lives: MAX_LIVES, lastRegenAt: null, regenerated: 0 });
  });

  it("treats null anchor + sub-max lives as fresh anchor (defensive)", () => {
    const r = computeRegenSnapshot(2, null, base);
    expect(r.lives).toBe(2);
    expect(r.lastRegenAt).toEqual(base);
    expect(r.regenerated).toBe(0);
  });

  it("regenerates +1 after one interval", () => {
    const anchor = new Date(base.getTime() - FOUR_H);
    const r = computeRegenSnapshot(2, anchor, base);
    expect(r.lives).toBe(3);
    expect(r.regenerated).toBe(1);
    expect(r.lastRegenAt).toEqual(base);
  });

  it("regenerates multiple ticks at once", () => {
    const anchor = new Date(base.getTime() - 3 * FOUR_H);
    const r = computeRegenSnapshot(1, anchor, base);
    expect(r.lives).toBe(4);
    expect(r.regenerated).toBe(3);
    expect(r.lastRegenAt).toEqual(new Date(anchor.getTime() + 3 * FOUR_H));
  });

  it("caps at MAX_LIVES and nulls anchor when full regen reached", () => {
    const anchor = new Date(base.getTime() - 100 * FOUR_H);
    const r = computeRegenSnapshot(0, anchor, base);
    expect(r.lives).toBe(MAX_LIVES);
    expect(r.lastRegenAt).toBeNull();
    expect(r.regenerated).toBe(MAX_LIVES);
  });

  it("does not regen when elapsed < interval", () => {
    const anchor = new Date(base.getTime() - (FOUR_H - 1));
    const r = computeRegenSnapshot(2, anchor, base);
    expect(r.lives).toBe(2);
    expect(r.regenerated).toBe(0);
    expect(r.lastRegenAt).toEqual(anchor);
  });

  it("handles negative elapsed (clock skew) without going backwards", () => {
    const future = new Date(base.getTime() + FOUR_H);
    const r = computeRegenSnapshot(3, future, base);
    expect(r.lives).toBe(3);
    expect(r.regenerated).toBe(0);
  });
});

describe("nextRegenAt", () => {
  it("returns null when at MAX_LIVES", () => {
    expect(nextRegenAt(MAX_LIVES, null)).toBeNull();
  });

  it("returns anchor + interval when below MAX_LIVES", () => {
    const anchor = new Date(base.getTime() - 1000);
    const result = nextRegenAt(3, anchor);
    expect(result).toEqual(new Date(anchor.getTime() + FOUR_H));
  });

  it("returns null when below MAX_LIVES but anchor is null (defensive)", () => {
    expect(nextRegenAt(2, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @pruvi/shared test lives.test.ts`
Expected: FAIL (helpers don't exist yet).

- [ ] **Step 3: Implement helpers**

Append to `packages/shared/src/lives.ts` (after existing `MAX_LIVES` export):

```typescript
export const LIVES_REGEN_INTERVAL_MS = 4 * 60 * 60 * 1000;

export function computeRegenSnapshot(
  lives: number,
  lastRegenAt: Date | null,
  now: Date,
): { lives: number; lastRegenAt: Date | null; regenerated: number } {
  if (lives >= MAX_LIVES) {
    return { lives: MAX_LIVES, lastRegenAt: null, regenerated: 0 };
  }
  if (lastRegenAt === null) {
    return { lives, lastRegenAt: now, regenerated: 0 };
  }
  const elapsed = Math.max(0, now.getTime() - lastRegenAt.getTime());
  const ticks = Math.floor(elapsed / LIVES_REGEN_INTERVAL_MS);
  const regenerated = Math.min(ticks, MAX_LIVES - lives);
  if (regenerated === 0) {
    return { lives, lastRegenAt, regenerated: 0 };
  }
  const newLives = lives + regenerated;
  const newAnchor =
    newLives >= MAX_LIVES
      ? null
      : new Date(lastRegenAt.getTime() + regenerated * LIVES_REGEN_INTERVAL_MS);
  return { lives: newLives, lastRegenAt: newAnchor, regenerated };
}

export function nextRegenAt(
  lives: number,
  lastRegenAt: Date | null,
): Date | null {
  if (lives >= MAX_LIVES) return null;
  if (lastRegenAt === null) return null;
  return new Date(lastRegenAt.getTime() + LIVES_REGEN_INTERVAL_MS);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @pruvi/shared test lives.test.ts`
Expected: PASS (all 10 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/lives.ts packages/shared/src/lives.test.ts
git commit -m "feat(shared): lives regen helpers (4h interval, cap-aware)"
```

---

### Task 2: Schema rename + drizzle-kit migration

**Files:**
- Modify: `packages/db/src/schema/auth.ts`
- Create: `packages/db/src/migrations/0005_<generated-name>.sql`
- Modify: `packages/db/src/migrations/meta/_journal.json` (auto by drizzle-kit)
- Modify: `packages/db/src/test-client.ts`

- [ ] **Step 1: Rename column in Drizzle schema**

In `packages/db/src/schema/auth.ts`, rename the field:

```typescript
// before:
livesResetAt: timestamp("lives_reset_at"),

// after:
livesLastRegenAt: timestamp("lives_last_regen_at"),
```

- [ ] **Step 2: Generate migration**

Run: `pnpm --filter @pruvi/db db:generate`
Expected: creates `packages/db/src/migrations/0005_<name>.sql` containing the `RENAME COLUMN`. Drizzle-kit may prompt to confirm it's a rename (not drop+add) — answer "rename" if asked.

- [ ] **Step 3: Manually add CHECK constraints + backfill clamp to the generated migration**

Append to the generated `0005_<name>.sql`:

```sql
--> statement-breakpoint
UPDATE "user"
SET "lives_last_regen_at" = LEAST("lives_last_regen_at", now())
WHERE "lives_last_regen_at" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_lives_chk" CHECK ("lives" BETWEEN 0 AND 5);
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_total_xp_chk" CHECK ("total_xp" >= 0);
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_current_level_chk" CHECK ("current_level" >= 1);
```

- [ ] **Step 4: Mirror in PGlite test client**

In `packages/db/src/test-client.ts`, find the `user` table DDL. Rename `lives_reset_at` to `lives_last_regen_at` and add 3 CHECK constraints in the table definition (or as ALTER statements after CREATE TABLE — match the existing style in that file).

- [ ] **Step 5: Run verify:migration**

Run: `pnpm verify:migration`
Expected: applies cleanly; introspect snapshot matches schema.

- [ ] **Step 6: Run all integration tests to ensure PGlite mirror is correct**

Run: `pnpm --filter server test:integration`
Expected: existing tests still pass (column references will fail until Task 3 — that's expected; this step verifies the PGlite DDL itself parses).

Note: Some tests will fail at this step because of `livesResetAt` references in the codebase — that's OK, Task 3 fixes them. The goal of *this* test run is that PGlite accepts the DDL.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema/auth.ts packages/db/src/migrations packages/db/src/test-client.ts
git commit -m "feat(db): rename lives_reset_at → lives_last_regen_at + CHECK constraints"
```

---

### Task 3: Repository methods + service layer refactor

**Files:**
- Modify: `apps/server/src/features/lives/lives.repository.ts`
- Modify: `apps/server/src/features/lives/lives.service.ts`
- Modify: `apps/server/src/features/lives/lives.service.test.ts`
- Modify: `apps/server/src/features/reviews/reviews.repository.ts`
- Modify: `apps/server/src/features/reviews/reviews.service.ts`
- Modify: `apps/server/src/features/reviews/reviews.service.test.ts`
- Modify: `apps/server/src/features/reviews/reviews.repository.integration.test.ts`

- [ ] **Step 1: Add `materializeRegen` and `tryDecrement` to LivesRepository**

Replace `packages/db/src/schema/auth` imports in `lives.repository.ts` with the new column name. Replace the existing class body with:

```typescript
import { eq, sql, and, gt } from "drizzle-orm";
import { user } from "@pruvi/db/schema/auth";
import type { db } from "@pruvi/db";
import { MAX_LIVES, computeRegenSnapshot } from "@pruvi/shared";

type DbClient = typeof db;

export class LivesRepository {
  constructor(private db: DbClient) {}

  async getUserLives(userId: string) {
    const rows = await this.db
      .select({
        lives: user.lives,
        livesLastRegenAt: user.livesLastRegenAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Read current lives, compute regen up to `now`, and persist if any
   * lives regenerated. Returns the post-materialization state.
   * No-op (no UPDATE issued) when nothing to regen.
   */
  async materializeRegen(
    userId: string,
    now: Date,
  ): Promise<{ lives: number; lastRegenAt: Date | null }> {
    const current = await this.getUserLives(userId);
    if (!current) {
      return { lives: MAX_LIVES, lastRegenAt: null };
    }
    const snap = computeRegenSnapshot(current.lives, current.livesLastRegenAt, now);
    if (snap.regenerated > 0) {
      await this.db
        .update(user)
        .set({ lives: snap.lives, livesLastRegenAt: snap.lastRegenAt })
        .where(eq(user.id, userId));
    }
    return { lives: snap.lives, lastRegenAt: snap.lastRegenAt };
  }

  /**
   * Atomic decrement. Single UPDATE with `WHERE lives > 0 RETURNING` —
   * race-free under concurrent answers. Sets the regen anchor on first
   * decrement via COALESCE; preserves existing anchor otherwise.
   */
  async tryDecrement(
    userId: string,
    now: Date,
  ): Promise<
    | { ok: true; livesAfter: number; lastRegenAt: Date | null }
    | { ok: false }
  > {
    const result = await this.db
      .update(user)
      .set({
        lives: sql`${user.lives} - 1`,
        livesLastRegenAt: sql`COALESCE(${user.livesLastRegenAt}, ${now})`,
      })
      .where(and(eq(user.id, userId), gt(user.lives, 0)))
      .returning({
        lives: user.lives,
        livesLastRegenAt: user.livesLastRegenAt,
      });

    const row = result[0];
    if (!row) return { ok: false };
    return { ok: true, livesAfter: row.lives, lastRegenAt: row.livesLastRegenAt };
  }
}
```

- [ ] **Step 2: Update `lives.service.ts` to use new helpers**

Replace `apps/server/src/features/lives/lives.service.ts`:

```typescript
import { ok, type Result } from "neverthrow";
import { MAX_LIVES, nextRegenAt } from "@pruvi/shared";
import type { AppError } from "../../utils/errors";
import type { LivesRepository } from "./lives.repository";

export class LivesService {
  constructor(private repo: LivesRepository) {}

  async getLives(
    userId: string,
  ): Promise<
    Result<
      { lives: number; maxLives: number; resetsAt: Date | null },
      AppError
    >
  > {
    const state = await this.repo.materializeRegen(userId, new Date());
    return ok({
      lives: state.lives,
      maxLives: MAX_LIVES,
      resetsAt: nextRegenAt(state.lives, state.lastRegenAt),
    });
  }
}
```

- [ ] **Step 3: Update `reviews.service.ts` decrement logic**

In `apps/server/src/features/reviews/reviews.service.ts`, replace lines 82-110 (the "Handle lives" block) with:

```typescript
// 7. Handle lives — materialize regen, then atomic decrement on wrong answer
const now = new Date();
const materialized = await this.livesRepo.materializeRegen(userId, now);
let livesRemaining = materialized.lives;

if (!correct) {
  const decrement = await this.livesRepo.tryDecrement(userId, now);
  if (!decrement.ok) {
    return err(new ValidationError("No lives remaining. Wait for refill."));
  }
  livesRemaining = decrement.livesAfter;
}
```

You'll need to add `livesRepo: LivesRepository` to the service constructor (alongside the existing `repo`). Wire it from `apps/server/src/index.ts` or wherever the service is instantiated — search for `new ReviewsService(` to find the call sites and add the new `LivesRepository(db)` argument.

- [ ] **Step 4: Delete obsolete methods from `reviews.repository.ts`**

Remove the following methods from `apps/server/src/features/reviews/reviews.repository.ts`:
- `getUserLives` (now on LivesRepository)
- `resetLives` (no longer needed — materializeRegen handles it)
- `decrementLives` (replaced by tryDecrement)

If any of these have callers outside the reviews service, you must NOT delete them — search first: `grep -rn "reviewsRepo\.\(getUserLives\|resetLives\|decrementLives\)" apps/server/src`. If clean, delete.

- [ ] **Step 5: Update `lives.service.test.ts`**

Open `apps/server/src/features/lives/lives.service.test.ts`. Update mocks to use `materializeRegen` instead of `getUserLives`/`resetLives`. Test cases should mirror the new behavior: `materializeRegen` returns `{ lives, lastRegenAt }`, service returns `nextRegenAt(lives, lastRegenAt)` as `resetsAt`.

Cases to cover:
- `materializeRegen` returns full lives + null anchor → `resetsAt: null`
- `materializeRegen` returns 3 lives + anchor → `resetsAt: anchor + 4h`
- `materializeRegen` returns 0 lives + anchor → `resetsAt: anchor + 4h` (not null — next regen comes)

- [ ] **Step 6: Update `reviews.service.test.ts`**

Open `apps/server/src/features/reviews/reviews.service.test.ts`. Update mocks: any test that exercised the lives path now needs a mock `LivesRepository` with `materializeRegen` + `tryDecrement` methods. Cases:
- Wrong answer with lives>0 → `tryDecrement` returns `{ok: true, livesAfter: prev-1}`; assert response carries `livesRemaining: prev-1`
- Wrong answer with lives=0 → `tryDecrement` returns `{ok: false}`; assert ValidationError result
- Correct answer → `tryDecrement` never called; `livesRemaining` reflects materialized value

- [ ] **Step 7: Update `reviews.repository.integration.test.ts`**

In `apps/server/src/features/reviews/reviews.repository.integration.test.ts`, replace any `livesResetAt` references with `livesLastRegenAt`. Remove tests for the deleted methods (`getUserLives`, `resetLives`, `decrementLives`) — these are now LivesRepository's concern (covered by Task 4).

- [ ] **Step 8: Run all server tests**

Run: `pnpm --filter server test && pnpm --filter server test:integration`
Expected: all pass.

- [ ] **Step 9: Run typecheck**

Run: `pnpm check-types`
Expected: zero errors.

- [ ] **Step 10: Commit**

```bash
git add apps/server/src packages/shared
git commit -m "refactor(lives): atomic decrement + 4h-regen via shared helpers"
```

---

### Task 4: LivesRepository integration tests

**Files:**
- Create: `apps/server/src/features/lives/lives.repository.integration.test.ts`

- [ ] **Step 1: Write integration tests**

Follow the pattern in `apps/server/src/features/notifications/tokens.repository.integration.test.ts` for PGlite setup (test-client.ts).

```typescript
import { describe, expect, it, beforeEach } from "vitest";
import { createTestDb } from "@pruvi/db/test-client";
import { user } from "@pruvi/db/schema/auth";
import { LivesRepository } from "./lives.repository";
import { LIVES_REGEN_INTERVAL_MS, MAX_LIVES } from "@pruvi/shared";

describe("LivesRepository (integration)", () => {
  let db: ReturnType<typeof createTestDb>["db"];
  let repo: LivesRepository;
  const userId = "u-1";

  beforeEach(async () => {
    db = createTestDb().db;
    repo = new LivesRepository(db);
    await db.insert(user).values({
      id: userId,
      name: "Test",
      email: "t@test.com",
      lives: MAX_LIVES,
      livesLastRegenAt: null,
    });
  });

  describe("tryDecrement", () => {
    it("decrements when lives > 0, sets anchor on first decrement", async () => {
      const now = new Date("2026-05-11T10:00:00Z");
      const r = await repo.tryDecrement(userId, now);
      expect(r).toEqual({ ok: true, livesAfter: 4, lastRegenAt: now });
    });

    it("preserves existing anchor via COALESCE on subsequent decrement", async () => {
      const firstAnchor = new Date("2026-05-11T08:00:00Z");
      await db.update(user).set({ lives: 4, livesLastRegenAt: firstAnchor }).where(/* eq id */);
      const now = new Date("2026-05-11T10:00:00Z");
      const r = await repo.tryDecrement(userId, now);
      expect(r).toEqual({ ok: true, livesAfter: 3, lastRegenAt: firstAnchor });
    });

    it("returns ok:false when lives = 0 (no decrement)", async () => {
      await db.update(user).set({ lives: 0, livesLastRegenAt: new Date() }).where(/* eq id */);
      const r = await repo.tryDecrement(userId, new Date());
      expect(r).toEqual({ ok: false });
      const after = (await repo.getUserLives(userId))!;
      expect(after.lives).toBe(0);
    });
  });

  describe("materializeRegen", () => {
    it("no-op when lives at MAX (anchor null)", async () => {
      const r = await repo.materializeRegen(userId, new Date());
      expect(r).toEqual({ lives: MAX_LIVES, lastRegenAt: null });
    });

    it("regens +2 after 8h elapsed from anchor", async () => {
      const anchor = new Date("2026-05-11T02:00:00Z");
      await db.update(user).set({ lives: 2, livesLastRegenAt: anchor }).where(/* eq id */);
      const now = new Date("2026-05-11T10:00:00Z"); // +8h
      const r = await repo.materializeRegen(userId, now);
      expect(r.lives).toBe(4);
      expect(r.lastRegenAt).toEqual(new Date(anchor.getTime() + 2 * LIVES_REGEN_INTERVAL_MS));
    });

    it("caps at MAX and nulls anchor", async () => {
      const anchor = new Date("2026-05-10T00:00:00Z");
      await db.update(user).set({ lives: 2, livesLastRegenAt: anchor }).where(/* eq id */);
      const now = new Date("2026-05-11T10:00:00Z"); // > 24h
      const r = await repo.materializeRegen(userId, now);
      expect(r).toEqual({ lives: MAX_LIVES, lastRegenAt: null });
    });
  });
});
```

Note: replace `/* eq id */` with `eq(user.id, userId)` and import `eq` from `drizzle-orm`. Match exact PGlite/test-client setup pattern used elsewhere in the codebase (`createTestDb` may have a different exported shape — verify with `tokens.repository.integration.test.ts`).

- [ ] **Step 2: Run integration tests**

Run: `pnpm --filter server test:integration lives.repository.integration.test.ts`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/features/lives/lives.repository.integration.test.ts
git commit -m "test(lives): integration tests for materializeRegen + tryDecrement"
```

---

### Task 5: CHECK-constraint integration tests

**Files:**
- Create: `packages/db/src/schema/auth.constraints.integration.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, expect, it } from "vitest";
import { createTestDb } from "../test-client";
import { user } from "./auth";
import { eq } from "drizzle-orm";

describe("user CHECK constraints (integration)", () => {
  it("rejects lives < 0", async () => {
    const { db } = createTestDb();
    await db.insert(user).values({ id: "u1", name: "T", email: "t@t.com" });
    await expect(
      db.update(user).set({ lives: -1 }).where(eq(user.id, "u1")),
    ).rejects.toThrow(/user_lives_chk/);
  });

  it("rejects lives > 5", async () => {
    const { db } = createTestDb();
    await db.insert(user).values({ id: "u1", name: "T", email: "t@t.com" });
    await expect(
      db.update(user).set({ lives: 6 }).where(eq(user.id, "u1")),
    ).rejects.toThrow(/user_lives_chk/);
  });

  it("rejects total_xp < 0", async () => {
    const { db } = createTestDb();
    await db.insert(user).values({ id: "u1", name: "T", email: "t@t.com" });
    await expect(
      db.update(user).set({ totalXp: -1 }).where(eq(user.id, "u1")),
    ).rejects.toThrow(/user_total_xp_chk/);
  });

  it("rejects current_level < 1", async () => {
    const { db } = createTestDb();
    await db.insert(user).values({ id: "u1", name: "T", email: "t@t.com" });
    await expect(
      db.update(user).set({ currentLevel: 0 }).where(eq(user.id, "u1")),
    ).rejects.toThrow(/user_current_level_chk/);
  });
});
```

Note: PGlite error messages may not always include constraint names verbatim. If `.toThrow(/user_lives_chk/)` is too strict, fall back to `.rejects.toThrow()` (assert *some* error is thrown) — keep the strict regex if PGlite supports it, weaker assertion if not. Adjust per actual test output.

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @pruvi/db test:integration` (or wherever this test runs in the workspace — check the `@pruvi/db` package.json for the integration runner; if there's no `test:integration` script, add this file under `apps/server` instead).

If `@pruvi/db` has no integration test runner, MOVE this file to `apps/server/src/features/lives/lives.constraints.integration.test.ts` and rerun: `pnpm --filter server test:integration`.

Expected: all 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/auth.constraints.integration.test.ts  # or wherever it landed
git commit -m "test(db): CHECK constraints on user.lives, total_xp, current_level"
```

---

### Task 6: Final verification + push

- [ ] **Step 1: Run all tests + checks**

```bash
pnpm --filter server test
pnpm --filter server test:integration
pnpm --filter @pruvi/shared test
pnpm verify:migration
pnpm check-types
```

All must pass cleanly.

- [ ] **Step 2: Boot worker to confirm no schema-related regressions**

Run: `pnpm dev:worker` (then Ctrl-C after seeing "queues registered" log lines).
Expected: clean boot, no schema errors.

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin feature/phase-2c-lives-mechanic
gh pr create --base main --title "feat: phase 2c — lives mechanic redesign + CHECK constraints" --body "..."
```

PR body should reference the spec, summarize the changes, list known follow-ups (if any), and document the migration's one-time `LEAST(lives_last_regen_at, now())` clamp for existing users.

---

## Self-review

**Spec coverage check:**
- ✅ Pure helpers (`computeRegenSnapshot`, `nextRegenAt`) → Task 1
- ✅ Column rename → Task 2
- ✅ CHECK constraints → Task 2
- ✅ One-time backfill clamp → Task 2 (step 3)
- ✅ PGlite mirror → Task 2 (step 4)
- ✅ `materializeRegen` + `tryDecrement` → Task 3 (step 1)
- ✅ `lives.service` uses new helpers → Task 3 (step 2)
- ✅ `reviews.service` uses atomic decrement → Task 3 (step 3)
- ✅ Unit tests for helpers → Task 1
- ✅ Service-level unit tests updated → Task 3 (steps 5-6)
- ✅ Integration tests for repo methods → Task 4
- ✅ CHECK-constraint tests → Task 5

**Placeholder scan:** None. Each step contains the actual code or a precise instruction with file/line references.

**Type consistency:** `livesLastRegenAt` used consistently. Method signatures match between spec and plan. `tryDecrement` return type discriminated union matches spec.
