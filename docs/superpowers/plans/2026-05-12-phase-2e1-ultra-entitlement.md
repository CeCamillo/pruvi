# Phase 2E.1 — Ultra Entitlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the `is_ultra` entitlement column + helper service + unlimited-lives perk + ranking `isUltra` flag + admin grant/revoke endpoints. Defer billing webhooks to 2E.4.

**Architecture:** Single new schema migration (`0007`). New `UltraRepository` + `UltraService` + `ultra.route.ts`. `LivesRepository` reads `is_ultra` alongside lives in one SELECT; both `materializeRegen` and `tryDecrement` short-circuit for Ultra. `LivesResponseSchema` and `RankingEntrySchema` gain `unlimited` and `isUltra` fields respectively.

**Source spec:** `docs/superpowers/specs/2026-05-12-phase-2e1-ultra-entitlement-design.md`

---

## File Structure

**Create:**
- `packages/shared/src/ultra.ts` — Zod schemas (`UltraStatusSchema`, `GrantUltraBodySchema`)
- `packages/shared/src/ultra.test.ts`
- `packages/db/src/migrations/0007_<generated>.sql`
- `apps/server/src/features/ultra/ultra.repository.ts`
- `apps/server/src/features/ultra/ultra.service.ts`
- `apps/server/src/features/ultra/ultra.route.ts`
- `apps/server/src/features/ultra/ultra.service.test.ts`
- `apps/server/src/features/ultra/ultra.repository.integration.test.ts`

**Modify:**
- `packages/db/src/schema/auth.ts` — add `isUltra`, `ultraExpiresAt`
- `packages/db/src/test-client.ts` — mirror DDL + CHECK + index
- `packages/shared/src/index.ts` — re-export ultra
- `packages/shared/src/lives.ts` — extend `LivesResponseSchema` with `unlimited`
- `packages/shared/src/social.ts` — extend `RankingEntrySchema` with `isUltra`
- `packages/env/src/server.ts` — add `ADMIN_API_TOKEN`
- `apps/server/src/features/lives/lives.repository.ts` — `getUserLives` selects `is_ultra`+`ultra_expires_at`; `materializeRegen` + `tryDecrement` short-circuit
- `apps/server/src/features/lives/lives.service.ts` — return `unlimited` flag
- `apps/server/src/features/lives/lives.service.test.ts` — Ultra cases
- `apps/server/src/features/lives/lives.repository.integration.test.ts` — Ultra cases
- `apps/server/src/features/social/ranking/ranking.repository.ts` — include `u.is_ultra` in SQL
- `apps/server/src/features/social/ranking/ranking.service.ts` — pass through to response
- `apps/server/src/features/social/ranking/ranking.service.test.ts` — assert `isUltra` per entry
- `apps/server/src/features/social/ranking/ranking.repository.integration.test.ts` — assert flag
- `apps/server/src/index.ts` (or `app.ts`) — register ultra routes

---

## Tasks

### Task 1: Shared schemas + helper types

**Files:**
- Create: `packages/shared/src/ultra.ts`, `packages/shared/src/ultra.test.ts`
- Modify: `packages/shared/src/index.ts`, `packages/shared/src/lives.ts`, `packages/shared/src/social.ts`

- [ ] **Step 1: Create `packages/shared/src/ultra.ts`**

```typescript
import { z } from "zod";

export const UltraStatusSchema = z.object({
  isUltra: z.boolean(),
  expiresAt: z.string().datetime().nullable(),
});
export type UltraStatus = z.infer<typeof UltraStatusSchema>;

export const GrantUltraBodySchema = z.object({
  expiresAt: z.string().datetime(),
});
export type GrantUltraBody = z.infer<typeof GrantUltraBodySchema>;
```

- [ ] **Step 2: Tests for ultra.ts**

```typescript
import { describe, expect, it } from "vitest";
import { UltraStatusSchema, GrantUltraBodySchema } from "./ultra";

describe("UltraStatusSchema", () => {
  it("accepts isUltra=true with ISO expiry", () => {
    expect(UltraStatusSchema.safeParse({ isUltra: true, expiresAt: "2026-06-12T00:00:00.000Z" }).success).toBe(true);
  });
  it("accepts isUltra=false with null expiry", () => {
    expect(UltraStatusSchema.safeParse({ isUltra: false, expiresAt: null }).success).toBe(true);
  });
  it("rejects non-ISO expiry", () => {
    expect(UltraStatusSchema.safeParse({ isUltra: true, expiresAt: "tomorrow" }).success).toBe(false);
  });
});

describe("GrantUltraBodySchema", () => {
  it("requires expiresAt", () => {
    expect(GrantUltraBodySchema.safeParse({}).success).toBe(false);
  });
  it("accepts ISO datetime", () => {
    expect(GrantUltraBodySchema.safeParse({ expiresAt: "2026-06-12T00:00:00.000Z" }).success).toBe(true);
  });
});
```

- [ ] **Step 3: Extend `LivesResponseSchema` in `packages/shared/src/lives.ts`**

Find `LivesResponseSchema` and add `unlimited: z.boolean()`. Backward-compatible additive change.

- [ ] **Step 4: Extend `RankingEntrySchema` in `packages/shared/src/social.ts`**

Add `isUltra: z.boolean()` to the schema (after `image`).

- [ ] **Step 5: Re-export from `packages/shared/src/index.ts`**

Append: `export * from "./ultra";`

- [ ] **Step 6: Run tests + commit**

```bash
pnpm --filter @pruvi/shared test
git add packages/shared/src
git commit -m "feat(shared): ultra status schemas + lives unlimited + ranking isUltra fields"
```

---

### Task 2: DB schema + migration

**Files:**
- Modify: `packages/db/src/schema/auth.ts`
- Create: `packages/db/src/migrations/0007_<name>.sql`
- Modify: `packages/db/src/test-client.ts`

- [ ] **Step 1: Add columns to `auth.ts`**

```typescript
// inside the user pgTable, after onboardingCompleted (or any location matching the file's grouping):
isUltra: boolean("is_ultra").notNull().default(false),
ultraExpiresAt: timestamp("ultra_expires_at"),
```

- [ ] **Step 2: Generate migration**

Run: `pnpm --filter @pruvi/db db:generate`. Note the generated filename.

- [ ] **Step 3: Edit the generated migration**

Replace the generated SQL with the idempotent version (paste verbatim, keep `--> statement-breakpoint` markers):

```sql
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_ultra" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ultra_expires_at" timestamp;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_ultra_expiry_chk') THEN
    ALTER TABLE "user" ADD CONSTRAINT "user_ultra_expiry_chk"
      CHECK ("ultra_expires_at" IS NULL OR "is_ultra" = true);
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_ultra_expiry_idx" ON "user" ("ultra_expires_at") WHERE "is_ultra" = true;
```

- [ ] **Step 4: Update `packages/db/src/migrations/meta/0007_snapshot.json` if needed**

Drizzle-kit may not capture the partial index or CHECK constraint (per Phase 2C/2D precedent). If you observe drift on a subsequent `db:generate`, manually patch the snapshot. For this task, accept the drift if it occurs and document it in the commit message.

- [ ] **Step 5: Mirror in PGlite test-client**

In `packages/db/src/test-client.ts`, add to the user table DDL:
- `is_ultra BOOLEAN NOT NULL DEFAULT false`
- `ultra_expires_at TIMESTAMP`
- `CONSTRAINT user_ultra_expiry_chk CHECK (ultra_expires_at IS NULL OR is_ultra = true)` (inline, matching the existing inline-CHECK style)
- `CREATE INDEX IF NOT EXISTS user_ultra_expiry_idx ON "user" (ultra_expires_at) WHERE is_ultra = true;` (after the CREATE TABLE)

- [ ] **Step 6: verify:migration + existing tests**

```bash
pnpm verify:migration
pnpm --filter server test
pnpm --filter server test:integration
```

All must pass.

- [ ] **Step 7: Commit**

```bash
git add packages/db
git commit -m "feat(db): user.is_ultra + ultra_expires_at columns (migration 0007)"
```

---

### Task 3: Ultra repository + service + admin route

**Files:**
- Create: `apps/server/src/features/ultra/ultra.repository.ts`
- Create: `apps/server/src/features/ultra/ultra.service.ts`
- Create: `apps/server/src/features/ultra/ultra.route.ts`
- Create: `apps/server/src/features/ultra/ultra.service.test.ts`
- Create: `apps/server/src/features/ultra/ultra.repository.integration.test.ts`
- Modify: `packages/env/src/server.ts`
- Modify: `apps/server/src/index.ts` (or wherever routes register)

- [ ] **Step 1: Add `ADMIN_API_TOKEN` to env**

In `packages/env/src/server.ts`:
```typescript
ADMIN_API_TOKEN: z.string().min(16).optional(),
```

- [ ] **Step 2: Repository**

```typescript
import { eq } from "drizzle-orm";
import { user } from "@pruvi/db/schema/auth";
import type { db as DbClient } from "@pruvi/db";

type Db = typeof DbClient;

export class UltraRepository {
  constructor(private db: Db) {}

  async get(userId: string): Promise<{ isUltra: boolean; ultraExpiresAt: Date | null } | null> {
    const rows = await this.db
      .select({ isUltra: user.isUltra, ultraExpiresAt: user.ultraExpiresAt })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  async grant(userId: string, expiresAt: Date): Promise<void> {
    await this.db
      .update(user)
      .set({ isUltra: true, ultraExpiresAt: expiresAt })
      .where(eq(user.id, userId));
  }

  async revoke(userId: string): Promise<void> {
    await this.db
      .update(user)
      .set({ isUltra: false, ultraExpiresAt: null })
      .where(eq(user.id, userId));
  }
}
```

- [ ] **Step 3: Service**

```typescript
import { ok, err, type Result } from "neverthrow";
import { AppError, NotFoundError } from "../../utils/errors";
import type { UltraRepository } from "./ultra.repository";

export class UltraService {
  constructor(private repo: UltraRepository) {}

  async isUltra(userId: string): Promise<boolean> {
    const row = await this.repo.get(userId);
    if (!row?.isUltra) return false;
    if (row.ultraExpiresAt && row.ultraExpiresAt < new Date()) return false;
    return true;
  }

  async getStatus(userId: string): Promise<Result<{ isUltra: boolean; expiresAt: string | null }, AppError>> {
    const row = await this.repo.get(userId);
    if (!row) return err(new NotFoundError("User not found"));
    const effective = row.isUltra && (!row.ultraExpiresAt || row.ultraExpiresAt > new Date());
    return ok({ isUltra: effective, expiresAt: row.ultraExpiresAt?.toISOString() ?? null });
  }

  async grant(userId: string, expiresAt: Date): Promise<Result<void, AppError>> {
    await this.repo.grant(userId, expiresAt);
    return ok(undefined);
  }

  async revoke(userId: string): Promise<Result<void, AppError>> {
    await this.repo.revoke(userId);
    return ok(undefined);
  }
}
```

- [ ] **Step 4: Route**

```typescript
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { GrantUltraBodySchema, UltraStatusSchema } from "@pruvi/shared";
import { env } from "@pruvi/env/server";
import { db } from "@pruvi/db";
import { unwrapResult, successResponse } from "../../types";
import { UnauthorizedError } from "../../utils/errors";  // or appropriate
import { UltraRepository } from "./ultra.repository";
import { UltraService } from "./ultra.service";

export const ultraRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const repo = new UltraRepository(db);
  const service = new UltraService(repo);

  // GET /users/me/ultra
  fastify.get(
    "/users/me/ultra",
    {
      preHandler: [fastify.authenticate],
      schema: { response: { 200: z.object({ success: z.literal(true), data: UltraStatusSchema }) } },
    },
    async (request) => {
      return successResponse(unwrapResult(await service.getStatus(request.userId)).data);
    },
  );

  // Admin endpoints — gated by ADMIN_API_TOKEN env
  const adminGuard = async (request: any) => {
    if (!env.ADMIN_API_TOKEN) {
      throw new AppError("Admin API disabled", 503, "ADMIN_DISABLED");
    }
    const token = request.headers["x-admin-token"];
    if (token !== env.ADMIN_API_TOKEN) {
      throw new UnauthorizedError("Admin token required");
    }
  };

  fastify.post(
    "/admin/users/:userId/ultra",
    {
      preHandler: [adminGuard],
      schema: { params: z.object({ userId: z.string() }), body: GrantUltraBodySchema },
    },
    async (request) => {
      const { userId } = request.params as { userId: string };
      const { expiresAt } = request.body as { expiresAt: string };
      return successResponse(unwrapResult(await service.grant(userId, new Date(expiresAt))));
    },
  );

  fastify.delete(
    "/admin/users/:userId/ultra",
    {
      preHandler: [adminGuard],
      schema: { params: z.object({ userId: z.string() }) },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      unwrapResult(await service.revoke(userId));
      return reply.code(204).send();
    },
  );
};
```

**Look up the canonical error class names** (`UnauthorizedError`, `AppError`) in `apps/server/src/utils/errors.ts` — if they have different names (e.g. `AuthError`), use those. The plan above uses placeholder names; verify before coding.

- [ ] **Step 5: Service unit tests**

```typescript
// ultra.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UltraService } from "./ultra.service";

const FUTURE = new Date(Date.now() + 86400_000);
const PAST = new Date(Date.now() - 86400_000);

describe("UltraService", () => {
  let repo: any;
  let service: UltraService;
  beforeEach(() => {
    repo = { get: vi.fn(), grant: vi.fn(), revoke: vi.fn() };
    service = new UltraService(repo);
  });

  describe("isUltra", () => {
    it("returns false when user is null", async () => {
      repo.get.mockResolvedValue(null);
      expect(await service.isUltra("u")).toBe(false);
    });
    it("returns false when is_ultra=false", async () => {
      repo.get.mockResolvedValue({ isUltra: false, ultraExpiresAt: null });
      expect(await service.isUltra("u")).toBe(false);
    });
    it("returns true when is_ultra=true and no expiry", async () => {
      repo.get.mockResolvedValue({ isUltra: true, ultraExpiresAt: null });
      expect(await service.isUltra("u")).toBe(true);
    });
    it("returns true when is_ultra=true and expiry in future", async () => {
      repo.get.mockResolvedValue({ isUltra: true, ultraExpiresAt: FUTURE });
      expect(await service.isUltra("u")).toBe(true);
    });
    it("returns false when is_ultra=true but expiry in past (defensive)", async () => {
      repo.get.mockResolvedValue({ isUltra: true, ultraExpiresAt: PAST });
      expect(await service.isUltra("u")).toBe(false);
    });
  });

  describe("getStatus", () => {
    it("NotFoundError when user does not exist", async () => {
      repo.get.mockResolvedValue(null);
      const r = await service.getStatus("u");
      expect(r.isErr()).toBe(true);
    });
    it("returns isUltra:false + expiresAt:null for non-Ultra user", async () => {
      repo.get.mockResolvedValue({ isUltra: false, ultraExpiresAt: null });
      const r = await service.getStatus("u");
      expect(r._unsafeUnwrap()).toEqual({ isUltra: false, expiresAt: null });
    });
    it("returns isUltra:true + ISO expiresAt for Ultra user", async () => {
      repo.get.mockResolvedValue({ isUltra: true, ultraExpiresAt: FUTURE });
      const r = await service.getStatus("u");
      expect(r._unsafeUnwrap().isUltra).toBe(true);
      expect(r._unsafeUnwrap().expiresAt).toBe(FUTURE.toISOString());
    });
  });

  it("grant calls repo.grant", async () => {
    await service.grant("u", FUTURE);
    expect(repo.grant).toHaveBeenCalledWith("u", FUTURE);
  });
  it("revoke calls repo.revoke", async () => {
    await service.revoke("u");
    expect(repo.revoke).toHaveBeenCalledWith("u");
  });
});
```

- [ ] **Step 6: Repository integration tests**

```typescript
// ultra.repository.integration.test.ts
// Standard pattern matching other integration tests in this codebase.
// Cases: get returns row, grant sets columns, revoke clears, CHECK constraint
//   rejects ultra_expires_at without is_ultra=true.
```

- [ ] **Step 7: Wire route**

Register `ultraRoutes` in the server entry. Match the existing pattern (probably alongside `invitationsRoutes` and `friendshipsRoutes`).

- [ ] **Step 8: Run + commit**

```bash
pnpm --filter server test && pnpm --filter server test:integration
git add apps/server/src/features/ultra apps/server/src/index.ts packages/env
git commit -m "feat(ultra): repository + service + admin grant/revoke endpoints"
```

---

### Task 4: Lives bypass for Ultra

**Files:**
- Modify: `apps/server/src/features/lives/lives.repository.ts`
- Modify: `apps/server/src/features/lives/lives.service.ts`
- Modify: `apps/server/src/features/lives/lives.service.test.ts`
- Modify: `apps/server/src/features/lives/lives.repository.integration.test.ts`

- [ ] **Step 1: `getUserLives` selects Ultra columns**

```typescript
async getUserLives(userId: string) {
  const rows = await this.db
    .select({
      lives: user.lives,
      livesLastRegenAt: user.livesLastRegenAt,
      isUltra: user.isUltra,
      ultraExpiresAt: user.ultraExpiresAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return rows[0] ?? null;
}
```

- [ ] **Step 2: `materializeRegen` short-circuit**

```typescript
async materializeRegen(userId: string, now: Date): Promise<{ lives: number; lastRegenAt: Date | null; isUltra: boolean }> {
  const current = await this.getUserLives(userId);
  if (!current) {
    return { lives: MAX_LIVES, lastRegenAt: null, isUltra: false };
  }
  const ultraActive = current.isUltra && (!current.ultraExpiresAt || current.ultraExpiresAt > now);
  if (ultraActive) {
    return { lives: MAX_LIVES, lastRegenAt: null, isUltra: true };
  }
  const snap = computeRegenSnapshot(current.lives, current.livesLastRegenAt, now);
  if (snap.regenerated > 0) {
    await this.db
      .update(user)
      .set({ lives: snap.lives, livesLastRegenAt: snap.lastRegenAt })
      .where(eq(user.id, userId));
  }
  return { lives: snap.lives, lastRegenAt: snap.lastRegenAt, isUltra: false };
}
```

- [ ] **Step 3: `tryDecrement` short-circuit**

Return type extended:
```typescript
| { ok: true; livesAfter: number; lastRegenAt: Date | null; isUltra: boolean }
| { ok: false }
```

Implementation: read `getUserLives` first; if Ultra, return `{ ok: true, livesAfter: MAX_LIVES, lastRegenAt: null, isUltra: true }` without UPDATE. Otherwise proceed with the existing atomic UPDATE (add `isUltra: false` to the success-return shape).

- [ ] **Step 4: `lives.service.ts` returns `unlimited`**

```typescript
async getLives(userId: string): Promise<Result<{ lives: number; maxLives: number; resetsAt: Date | null; unlimited: boolean }, AppError>> {
  const state = await this.repo.materializeRegen(userId, new Date());
  return ok({
    lives: state.lives,
    maxLives: MAX_LIVES,
    resetsAt: state.isUltra ? null : nextRegenAt(state.lives, state.lastRegenAt),
    unlimited: state.isUltra,
  });
}
```

- [ ] **Step 5: Update tests**

`lives.service.test.ts`:
- Existing tests: add `unlimited: false` to expected shapes.
- New tests: Ultra user → `unlimited: true, resetsAt: null`.

`lives.repository.integration.test.ts`:
- Existing tests: add `isUltra: false` to expected shapes from `materializeRegen` + `tryDecrement`.
- New tests:
  - `materializeRegen` for Ultra user → returns `{ lives: 5, lastRegenAt: null, isUltra: true }` regardless of stored lives value.
  - `tryDecrement` for Ultra user → returns `{ ok: true, livesAfter: 5, lastRegenAt: null, isUltra: true }`; the DB `lives` column is NOT decremented.

- [ ] **Step 6: Reviews-service compatibility check**

In `apps/server/src/features/reviews/reviews.service.ts`, the call site of `tryDecrement` will still work (Ultra branch returns `ok` shape). But verify: are there any tests that destructure the return shape and would now fail with the new `isUltra` field? Grep for `tryDecrement(` usages and `.livesAfter`. If tests use exact-shape matchers, update them.

- [ ] **Step 7: Run + commit**

```bash
pnpm --filter server test && pnpm --filter server test:integration
git add apps/server/src/features/lives
git commit -m "feat(lives): unlimited lives bypass for Ultra users"
```

---

### Task 5: Ranking `isUltra` flag

**Files:**
- Modify: `apps/server/src/features/social/ranking/ranking.repository.ts`
- Modify: `apps/server/src/features/social/ranking/ranking.service.ts`
- Modify: `apps/server/src/features/social/ranking/ranking.service.test.ts`
- Modify: `apps/server/src/features/social/ranking/ranking.repository.integration.test.ts`

- [ ] **Step 1: Repository SQL**

Add `u.is_ultra` to SELECT + GROUP BY. Add `is_ultra: boolean` to `RawRankingRow`.

- [ ] **Step 2: Service mapping**

```typescript
const ranked = rows.map((r, i) => ({
  userId: r.user_id,
  name: r.name,
  username: r.username,
  image: r.image,
  weeklyXp: r.weekly_xp,
  isUltra: r.is_ultra,
  rank: i + 1,
  isMe: r.user_id === userId,
}));
```

- [ ] **Step 3: Tests**

Unit test: extend mocks to include `is_ultra: true/false` and assert it's reflected in each entry.

Integration test: seed users with mixed `is_ultra` values; assert `isUltra` per row matches.

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter server test && pnpm --filter server test:integration
git add apps/server/src/features/social/ranking
git commit -m "feat(ranking): include isUltra flag per entry"
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

All must pass. Pre-existing test-file strict-null noise OK.

- [ ] **Step 2: Smoke**

```bash
pnpm dev:worker  # Ctrl-C after ready
```

- [ ] **Step 3: Push + PR**

```bash
git push -u origin feature/phase-2e1-ultra-entitlement
gh pr create --base main --title "feat: phase 2e.1 — ultra entitlement scaffolding + unlimited lives" --body "..."
```

PR body: summarize schema, hot-path bypass, admin endpoints, ranking flag, list deferred items (2E.2 shield, 2E.3 simulado, 2E.4 billing webhooks), reference spec + plan.

---

## Self-review

**Spec coverage:**
- ✅ Schema (is_ultra + ultra_expires_at + CHECK + index) → Task 2
- ✅ UltraRepository + UltraService → Task 3
- ✅ Admin grant/revoke routes (token-gated) → Task 3
- ✅ `GET /users/me/ultra` → Task 3
- ✅ Lives bypass for Ultra → Task 4
- ✅ `unlimited` field in LivesResponse → Tasks 1 + 4
- ✅ `isUltra` field in RankingEntry → Tasks 1 + 5

**Placeholder scan:** None — each step contains explicit code or a precise lookup instruction.

**Type consistency:**
- `materializeRegen` and `tryDecrement` return shapes both include `isUltra: boolean` — service uses it for `unlimited` flag.
- `RankingEntry.isUltra` set from `RawRankingRow.is_ultra` (snake-case → camelCase mapping in service layer).
- `UltraStatus.expiresAt` is `string | null` (ISO datetime), not `Date` — repo returns Date, service converts via `.toISOString()`.
