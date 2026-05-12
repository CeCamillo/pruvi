# Phase 2E.7 — Billing reconciliation sweep — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` with Sonnet 4.6 implementers and Opus 4.7 reviewers. Every task ends with both spec-compliance and code-quality reviews. Branch already created: `feature/phase-2e7-billing-reconciliation-sweep`.

**Goal:** A BullMQ hourly cron job that flips stale `active`/`in_grace`/`canceled` subscriptions to `expired` and revokes Ultra via the existing two-phase-commit pipeline. DB-only — no provider REST calls.

**Architecture:** New `billing-cron` queue + new `billing-sweep` worker → calls `BillingService.runReconciliationSweep` → per-row transaction (`expireSubscriptionIfStale` + audit insert + mark processed) → post-commit `applyUltraEffect`. Reuses every existing piece of 2E.4/2E.5 (state machine, multi-sub guards, two-phase pattern).

**Tech Stack:** BullMQ 5, Drizzle ORM, fastify-type-provider-zod, neverthrow, Vitest (real Postgres via `db-helpers`).

**Spec:** `docs/superpowers/specs/2026-05-12-phase-2e7-billing-reconciliation-sweep-design.md`

---

## File map

**Create:**
- `apps/server/src/workers/billing-sweep.worker.ts` — BullMQ Worker that runs the sweep, mirrors `notifications.worker.ts`.
- `apps/server/src/features/billing/billing-sweep.service.test.ts` — unit test for `runReconciliationSweep` (mocked repo).
- `apps/server/src/features/billing/billing-sweep.integration.test.ts` — real-Postgres integration test for the end-to-end sweep.

**Modify:**
- `apps/server/src/features/billing/billing.repository.ts` — add `findExpiredCandidates` and `expireSubscriptionIfStale`.
- `apps/server/src/features/billing/billing.service.ts` — add `runReconciliationSweep`.
- `apps/server/src/plugins/queue.ts` — add `billingSweep: Queue<BillingSweepJobData> | null` entry, register `billing-cron` repeatable.
- `apps/server/src/worker.ts` — start the new sweep worker.
- `apps/server/src/features/billing/billing.repository.integration.test.ts` — add the new repository tests (or co-locate in new integration file — see Task 2).

---

### Task 1: Repository methods — `findExpiredCandidates` + `expireSubscriptionIfStale`

**Files:**
- Modify: `apps/server/src/features/billing/billing.repository.ts`
- Modify/extend: `apps/server/src/features/billing/billing.repository.integration.test.ts`

- [ ] **Step 1: Add failing integration tests** in `billing.repository.integration.test.ts`. Append a new `describe("reconciliation sweep")` block INSIDE the existing outer `describe("BillingRepository (integration)", ...)` so it reuses the same `db`, `repo`, and the local `insertUser(id)` helper at line 15 of that file. There is NO `seedUser` helper in this codebase — always use `await insertUser("u-sweep-1")` with an explicit id, copying the pattern from existing tests at line 37+.

```ts
import { subscription, billingEvent } from "@pruvi/db/schema/billing";
// Note: `eq`, `sql` are already imported at the top of the file. Add `subscription, billingEvent`
// to the existing `@pruvi/db/schema/billing` import line if not already there.

describe("reconciliation sweep", () => {
  const GRACE_MS = 24 * 60 * 60 * 1000;

  it("findExpiredCandidates returns linked stale active rows", async () => {
    await insertUser("u-sweep-1");
    const now = new Date("2026-05-12T12:00:00Z");
    const cutoff = new Date(now.getTime() - GRACE_MS);
    const stalePast = new Date(cutoff.getTime() - 60_000);    // 1 min past cutoff
    await db.insert(subscription).values({
      userId: "u-sweep-1",
      provider: "google_play",
      productId: "ultra_monthly",
      purchaseToken: "tok_stale",
      status: "active",
      currentPeriodEnd: stalePast,
      linkedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    });

    const rows = await repo.findExpiredCandidates(db, cutoff);
    expect(rows.map((r) => r.purchaseToken)).toEqual(["tok_stale"]);
  });

  it("findExpiredCandidates excludes orphans (userId IS NULL)", async () => {
    const now = new Date("2026-05-12T12:00:00Z");
    const cutoff = new Date(now.getTime() - GRACE_MS);
    await db.insert(subscription).values({
      userId: null,
      provider: "google_play",
      productId: "",
      purchaseToken: "tok_orphan",
      status: "pending",
      currentPeriodEnd: new Date(cutoff.getTime() - 60_000),
    });
    const rows = await repo.findExpiredCandidates(db, cutoff);
    expect(rows).toEqual([]);
  });

  it("findExpiredCandidates excludes status='expired' and status='revoked'", async () => {
    const userId = "u-sweep-1"; await insertUser(userId);
    const now = new Date("2026-05-12T12:00:00Z");
    const cutoff = new Date(now.getTime() - GRACE_MS);
    const past = new Date(cutoff.getTime() - 60_000);
    await db.insert(subscription).values([
      { userId, provider: "google_play", productId: "p", purchaseToken: "tok_expired", status: "expired", currentPeriodEnd: past },
      { userId, provider: "app_store", productId: "p", purchaseToken: "tok_revoked", status: "revoked", currentPeriodEnd: past },
    ]);
    const rows = await repo.findExpiredCandidates(db, cutoff);
    expect(rows).toEqual([]);
  });

  it("findExpiredCandidates excludes rows with currentPeriodEnd IS NULL (incl canceled)", async () => {
    const userId = "u-sweep-2"; await insertUser(userId);
    const cutoff = new Date("2026-05-11T12:00:00Z");
    await db.insert(subscription).values([
      { userId, provider: "google_play", productId: "p", purchaseToken: "tok_canc_null", status: "canceled", currentPeriodEnd: null },
      { userId, provider: "app_store", productId: "p", purchaseToken: "tok_active_null", status: "active", currentPeriodEnd: null },
    ]);
    const rows = await repo.findExpiredCandidates(db, cutoff);
    expect(rows).toEqual([]);
  });

  it("findExpiredCandidates excludes rows within the cutoff window", async () => {
    const userId = "u-sweep-3"; await insertUser(userId);
    const cutoff = new Date("2026-05-11T12:00:00Z");
    const justFresh = new Date(cutoff.getTime() + 1000);   // 1s after cutoff
    await db.insert(subscription).values({
      userId, provider: "google_play", productId: "p", purchaseToken: "tok_fresh",
      status: "active", currentPeriodEnd: justFresh,
    });
    const rows = await repo.findExpiredCandidates(db, cutoff);
    expect(rows).toEqual([]);
  });

  it("findExpiredCandidates includes canceled and in_grace when stale", async () => {
    const userId = "u-sweep-4"; await insertUser(userId);
    const cutoff = new Date("2026-05-11T12:00:00Z");
    const past = new Date(cutoff.getTime() - 60_000);
    await db.insert(subscription).values([
      { userId, provider: "google_play", productId: "p", purchaseToken: "tok_canc", status: "canceled", currentPeriodEnd: past },
      { userId, provider: "app_store", productId: "p", purchaseToken: "tok_grace", status: "in_grace", currentPeriodEnd: past },
    ]);
    const rows = await repo.findExpiredCandidates(db, cutoff);
    expect(rows.map((r) => r.purchaseToken).sort()).toEqual(["tok_canc", "tok_grace"]);
  });

  it("expireSubscriptionIfStale flips status to expired and returns the row when predicate matches", async () => {
    const userId = "u-sweep-5"; await insertUser(userId);
    const cutoff = new Date("2026-05-11T12:00:00Z");
    const past = new Date(cutoff.getTime() - 60_000);
    const [row] = await db.insert(subscription).values({
      userId, provider: "google_play", productId: "p", purchaseToken: "tok_stale2",
      status: "active", currentPeriodEnd: past,
    }).returning();
    const updated = await repo.expireSubscriptionIfStale(db, row.id, cutoff);
    expect(updated?.status).toBe("expired");
    expect(updated?.id).toBe(row.id);
  });

  it("expireSubscriptionIfStale returns null when status no longer in set (concurrent webhook won)", async () => {
    const userId = "u-sweep-6"; await insertUser(userId);
    const cutoff = new Date("2026-05-11T12:00:00Z");
    const past = new Date(cutoff.getTime() - 60_000);
    const [row] = await db.insert(subscription).values({
      userId, provider: "google_play", productId: "p", purchaseToken: "tok_already_expired",
      status: "expired", currentPeriodEnd: past,
    }).returning();
    const updated = await repo.expireSubscriptionIfStale(db, row.id, cutoff);
    expect(updated).toBeNull();
  });

  it("expireSubscriptionIfStale returns null when currentPeriodEnd no longer stale (concurrent RENEWED won)", async () => {
    const userId = "u-sweep-7"; await insertUser(userId);
    const cutoff = new Date("2026-05-11T12:00:00Z");
    const fresh = new Date(cutoff.getTime() + 60_000);
    const [row] = await db.insert(subscription).values({
      userId, provider: "google_play", productId: "p", purchaseToken: "tok_renewed",
      status: "active", currentPeriodEnd: fresh,
    }).returning();
    const updated = await repo.expireSubscriptionIfStale(db, row.id, cutoff);
    expect(updated).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail.** Expected: 9 failures with "repo.findExpiredCandidates is not a function" or similar.

Run: `bun test apps/server/src/features/billing/billing.repository.integration.test.ts`

- [ ] **Step 3: Implement `findExpiredCandidates`** in `billing.repository.ts`. Place it after `getMaxOtherActivePeriodEnd` (or wherever fits the file order, but co-locate with other read methods).

```ts
import { and, asc, eq, inArray, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
// (existing line already imports `and, asc, eq, isNull, ne, sql` — ADD only `inArray, isNotNull, lt`)

  async findExpiredCandidates(d: DbOrTx, cutoff: Date): Promise<SubscriptionRow[]> {
    const rows = await d
      .select()
      .from(subscription)
      .where(
        and(
          isNotNull(subscription.userId),
          inArray(subscription.status, ["active", "in_grace", "canceled"] as SubscriptionStatus[]),
          isNotNull(subscription.currentPeriodEnd),
          lt(subscription.currentPeriodEnd, cutoff),
        ),
      )
      .orderBy(asc(subscription.currentPeriodEnd))
      .limit(500);
    return rows as SubscriptionRow[];
  }
```

- [ ] **Step 4: Implement `expireSubscriptionIfStale`** below it.

```ts
  async expireSubscriptionIfStale(d: DbOrTx, id: number, cutoff: Date): Promise<SubscriptionRow | null> {
    const now = new Date();
    const rows = await d
      .update(subscription)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(subscription.id, id),
          inArray(subscription.status, ["active", "in_grace", "canceled"] as SubscriptionStatus[]),
          isNotNull(subscription.currentPeriodEnd),
          lt(subscription.currentPeriodEnd, cutoff),
        ),
      )
      .returning();
    return (rows[0] as SubscriptionRow | undefined) ?? null;
  }
```

NOTE: `subscription.updatedAt` exists in the schema (`packages/db/src/schema/billing.ts:19`) as `defaultNow().notNull()` with NO `$onUpdate` hook — Drizzle does not auto-touch it on UPDATE, so the explicit `updatedAt: now` in `.set({...})` is required and correct as written.

- [ ] **Step 5: Run tests to verify they pass.**

Run: `bun test apps/server/src/features/billing/billing.repository.integration.test.ts`
Expected: all 9 new tests pass plus all existing pass.

- [ ] **Step 6: Run typecheck.**

Run: `bun --cwd apps/server check-types` (or whatever command the repo uses — check `package.json` if uncertain).

- [ ] **Step 7: Commit.**

```bash
git add apps/server/src/features/billing/billing.repository.ts apps/server/src/features/billing/billing.repository.integration.test.ts
git commit -m "feat(billing): add reconciliation sweep repository queries"
```

---

### Task 2: Service method — `runReconciliationSweep`

**Files:**
- Modify: `apps/server/src/features/billing/billing.service.ts`
- Create: `apps/server/src/features/billing/billing-sweep.service.test.ts` (unit, mocked repo)
- Create: `apps/server/src/features/billing/billing-sweep.integration.test.ts` (real Postgres, end-to-end)

- [ ] **Step 1: Write the failing unit test** in `billing-sweep.service.test.ts`. Mock `BillingRepository` and `UltraService` per the patterns in the existing `billing.service.test.ts`.

```ts
import { describe, expect, it, vi } from "vitest";
import { BillingService } from "./billing.service";
import type { BillingRepository, SubscriptionRow } from "./billing.repository";
import type { UltraService } from "../ultra/ultra.service";

function makeSub(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: 1,
    userId: "u1",
    provider: "google_play",
    productId: "ultra_monthly",
    purchaseToken: "tok_1",
    status: "active",
    currentPeriodEnd: new Date("2026-05-10T00:00:00Z"),
    linkedAt: new Date("2026-04-10T00:00:00Z"),
    ...overrides,
  };
}

describe("BillingService.runReconciliationSweep", () => {
  const now = new Date("2026-05-12T12:00:00Z");

  it("scans candidates, flips each stale row, calls revoke once per non-other-active", async () => {
    const stale = makeSub({ id: 1, userId: "u1", purchaseToken: "tok_a" });
    const repo = {
      findExpiredCandidates: vi.fn().mockResolvedValue([stale]),
      expireSubscriptionIfStale: vi.fn().mockResolvedValue({ ...stale, status: "expired" }),
      insertEvent: vi.fn().mockResolvedValue({ id: 99 }),
      markEventProcessed: vi.fn().mockResolvedValue(undefined),
      hasOtherActiveSubscription: vi.fn().mockResolvedValue(false),
    } as unknown as BillingRepository;
    const ultra = { revoke: vi.fn().mockResolvedValue(undefined), grant: vi.fn() } as unknown as UltraService;
    const fakeDb = {
      transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => fn({}),
    } as unknown as Parameters<typeof BillingService>[0];

    const svc = new BillingService(fakeDb, repo, ultra);
    const out = await svc.runReconciliationSweep({ now });

    expect(out).toEqual({ scanned: 1, expired: 1, revoked: 1 });
    expect(ultra.revoke).toHaveBeenCalledWith("u1");
  });

  it("skips revoke when user holds another active subscription (multi-sub guard)", async () => {
    const stale = makeSub({ id: 1 });
    const repo = {
      findExpiredCandidates: vi.fn().mockResolvedValue([stale]),
      expireSubscriptionIfStale: vi.fn().mockResolvedValue({ ...stale, status: "expired" }),
      insertEvent: vi.fn().mockResolvedValue({ id: 100 }),
      markEventProcessed: vi.fn().mockResolvedValue(undefined),
      hasOtherActiveSubscription: vi.fn().mockResolvedValue(true),
    } as unknown as BillingRepository;
    const ultra = { revoke: vi.fn(), grant: vi.fn() } as unknown as UltraService;
    const fakeDb = { transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => fn({}) } as unknown as Parameters<typeof BillingService>[0];

    const svc = new BillingService(fakeDb, repo, ultra);
    const out = await svc.runReconciliationSweep({ now });

    expect(out).toEqual({ scanned: 1, expired: 1, revoked: 0 });
    expect(ultra.revoke).not.toHaveBeenCalled();
  });

  it("does not double-count when expireSubscriptionIfStale returns null (predicate no longer matches)", async () => {
    const stale = makeSub({ id: 1 });
    const repo = {
      findExpiredCandidates: vi.fn().mockResolvedValue([stale]),
      expireSubscriptionIfStale: vi.fn().mockResolvedValue(null),
      insertEvent: vi.fn(),
      markEventProcessed: vi.fn(),
      hasOtherActiveSubscription: vi.fn(),
    } as unknown as BillingRepository;
    const ultra = { revoke: vi.fn(), grant: vi.fn() } as unknown as UltraService;
    const fakeDb = { transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => fn({}) } as unknown as Parameters<typeof BillingService>[0];

    const svc = new BillingService(fakeDb, repo, ultra);
    const out = await svc.runReconciliationSweep({ now });

    expect(out).toEqual({ scanned: 1, expired: 0, revoked: 0 });
    expect(repo.insertEvent).not.toHaveBeenCalled();
    expect(ultra.revoke).not.toHaveBeenCalled();
  });

  it("does not double-count or revoke when insertEvent returns null (concurrent worker won)", async () => {
    const stale = makeSub({ id: 1 });
    const repo = {
      findExpiredCandidates: vi.fn().mockResolvedValue([stale]),
      expireSubscriptionIfStale: vi.fn().mockResolvedValue({ ...stale, status: "expired" }),
      insertEvent: vi.fn().mockResolvedValue(null),
      markEventProcessed: vi.fn(),
      hasOtherActiveSubscription: vi.fn(),
    } as unknown as BillingRepository;
    const ultra = { revoke: vi.fn(), grant: vi.fn() } as unknown as UltraService;
    const fakeDb = { transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => fn({}) } as unknown as Parameters<typeof BillingService>[0];

    const svc = new BillingService(fakeDb, repo, ultra);
    const out = await svc.runReconciliationSweep({ now });

    expect(out).toEqual({ scanned: 1, expired: 0, revoked: 0 });
    expect(ultra.revoke).not.toHaveBeenCalled();
  });

  it("processes each candidate in its own transaction (one call per row)", async () => {
    const candidates = [makeSub({ id: 1, userId: "u1", purchaseToken: "a" }), makeSub({ id: 2, userId: "u2", purchaseToken: "b" })];
    const txSpy = vi.fn(async <T,>(fn: (tx: unknown) => Promise<T>) => fn({}));
    const repo = {
      findExpiredCandidates: vi.fn().mockResolvedValue(candidates),
      expireSubscriptionIfStale: vi.fn().mockImplementation(async (_tx, id) => ({ ...candidates.find((c) => c.id === id)!, status: "expired" })),
      insertEvent: vi.fn().mockResolvedValue({ id: 1 }),
      markEventProcessed: vi.fn().mockResolvedValue(undefined),
      hasOtherActiveSubscription: vi.fn().mockResolvedValue(false),
    } as unknown as BillingRepository;
    const ultra = { revoke: vi.fn().mockResolvedValue(undefined), grant: vi.fn() } as unknown as UltraService;
    const fakeDb = { transaction: txSpy } as unknown as Parameters<typeof BillingService>[0];

    const svc = new BillingService(fakeDb, repo, ultra);
    const out = await svc.runReconciliationSweep({ now });

    expect(out).toEqual({ scanned: 2, expired: 2, revoked: 2 });
    expect(txSpy).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `bun test apps/server/src/features/billing/billing-sweep.service.test.ts`
Expected: 5 failures with "svc.runReconciliationSweep is not a function".

- [ ] **Step 3: Implement `runReconciliationSweep`** on `BillingService`. Place after `applyUltraEffect`. Mirror the structure of `processGooglePlayEnvelope` for the two-phase pattern.

```ts
  /** Hourly reconciliation. Flips stale linked subscriptions to `expired` and runs the revoke pipeline.
   *  See spec docs/superpowers/specs/2026-05-12-phase-2e7-billing-reconciliation-sweep-design.md. */
  async runReconciliationSweep(opts: { now: Date; graceMs?: number }): Promise<{ scanned: number; expired: number; revoked: number }> {
    const graceMs = opts.graceMs ?? 24 * 60 * 60 * 1000;
    const cutoff = new Date(opts.now.getTime() - graceMs);
    const candidates = await this.repo.findExpiredCandidates(this.db, cutoff);

    let expired = 0;
    let revoked = 0;

    for (const candidate of candidates) {
      const effect = await this.db.transaction(async (tx): Promise<PostCommitUltraEffect> => {
        const updated = await this.repo.expireSubscriptionIfStale(tx, candidate.id, cutoff);
        if (!updated) return { kind: "none" };

        const audit = await this.repo.insertEvent(tx, {
          provider: updated.provider,
          messageId: `sweep:${updated.id}:${cutoff.toISOString()}`,
          eventType: "SWEEP_EXPIRED",
          purchaseToken: updated.purchaseToken,
          payload: {
            kind: "sweep",
            subId: updated.id,
            previousStatus: candidate.status,
            currentPeriodEnd: updated.currentPeriodEnd?.toISOString() ?? null,
            ranAt: opts.now.toISOString(),
          },
        });
        if (!audit) return { kind: "none" };
        await this.repo.markEventProcessed(tx, audit.id);

        if (updated.userId === null) return { kind: "none" };
        return { kind: "revoke_if_no_other_active", userId: updated.userId, excludeSubscriptionId: updated.id };
      });

      if (effect.kind !== "none") expired += 1;

      // Two-phase commit: apply ultra effect AFTER the transaction commits, with bare this.db.
      if (effect.kind === "revoke_if_no_other_active") {
        const hasOther = await this.repo.hasOtherActiveSubscription(this.db, effect.userId, effect.excludeSubscriptionId);
        if (!hasOther) {
          await this.ultra.revoke(effect.userId);
          revoked += 1;
        }
      }
    }

    return { scanned: candidates.length, expired, revoked };
  }
```

**Reconciling with spec §4.1 line 68 (which writes `await this.applyUltraEffect(effect)`):** the spec's diagram is correct in intent — the effect MUST be applied post-commit against `this.db`, exactly as the implementation here does. We diverge on the *spelling* only: instead of calling `this.applyUltraEffect`, we inline the `revoke_if_no_other_active` branch because we need to know whether `ultra.revoke` actually fired in order to maintain the `revoked` counter for observability. `applyUltraEffect` is a void function and gives the caller no signal. This is a deliberate, narrow deviation; semantics are identical (same guard query, same `ultra.revoke` call, same two-phase ordering). The spec should be read as authoritative on *ordering* and *semantics*, and this plan as authoritative on the *exact call shape*. Gate D should accept this.

- [ ] **Step 4: Run unit tests to verify they pass.**

Run: `bun test apps/server/src/features/billing/billing-sweep.service.test.ts`

- [ ] **Step 5: Write the integration test** in `billing-sweep.integration.test.ts`. This is the heart of the safety guarantee — exercises the real DB + real two-phase commit.

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@pruvi/db";
import { subscription, billingEvent } from "@pruvi/db/schema/billing";
import { BillingService } from "./billing.service";
import { BillingRepository } from "./billing.repository";
import { UltraService } from "../ultra/ultra.service";
import { UltraRepository } from "../ultra/ultra.repository";
import { setupTestDb, cleanupTestDb, teardownTestDb, getTestDb } from "../../test/db-helpers";
import { user } from "@pruvi/db/schema/auth";
// There is no `seedUser` helper. Copy the local `insertUser(id)` pattern verbatim
// from `billing.repository.integration.test.ts:15`:
async function insertUser(id: string) {
  await db.insert(user).values({
    id, name: `U ${id}`, email: `${id}@e.com`, emailVerified: false,
    inviteCode: `c${id.replace(/-/g, "").slice(0, 8)}`, username: null, updatedAt: new Date(),
  });
}

describe("BillingService.runReconciliationSweep (integration)", () => {
  const GRACE_MS = 24 * 60 * 60 * 1000;
  const now = new Date("2026-05-12T12:00:00Z");
  const cutoff = new Date(now.getTime() - GRACE_MS);
  const past = new Date(cutoff.getTime() - 60_000);
  const fresh = new Date(cutoff.getTime() + 60_000);

  let svc: BillingService;
  beforeEach(async () => {
    await cleanupTestDb();
    const repo = new BillingRepository();
    const ultra = new UltraService(new UltraRepository(db));   // canonical construction per billing.route.ts:16
    svc = new BillingService(db, repo, ultra);
  });

  it("flips a single stale active sub to expired, writes SWEEP_EXPIRED audit, revokes ultra", async () => {
    const userId = "u-sweep-8"; await insertUser(userId);
    // Pre-grant ultra so we can assert revoke
    // (Use whatever the existing tests use to seed an active ultra entitlement.)
    await db.insert(subscription).values({
      userId, provider: "google_play", productId: "p", purchaseToken: "tok",
      status: "active", currentPeriodEnd: past,
    });

    const out = await svc.runReconciliationSweep({ now });
    expect(out).toEqual({ scanned: 1, expired: 1, revoked: 1 });

    const sub = (await db.select().from(subscription).where(eq(subscription.purchaseToken, "tok")))[0];
    expect(sub.status).toBe("expired");
    const events = await db.select().from(billingEvent).where(eq(billingEvent.eventType, "SWEEP_EXPIRED"));
    expect(events).toHaveLength(1);
    expect(events[0].provider).toBe("google_play");
    expect(events[0].messageId).toMatch(/^sweep:\d+:/);
    expect(events[0].processedAt).not.toBeNull();
    // Assert ultra was revoked — use whatever assertion the existing tests use to inspect ultra state.
  });

  it("does not revoke when user has another active subscription on the other provider", async () => {
    const userId = "u-sweep-9"; await insertUser(userId);
    await db.insert(subscription).values([
      { userId, provider: "google_play", productId: "p", purchaseToken: "stale", status: "active", currentPeriodEnd: past },
      { userId, provider: "app_store",   productId: "p", purchaseToken: "alive", status: "active", currentPeriodEnd: fresh },
    ]);

    const out = await svc.runReconciliationSweep({ now });
    expect(out).toEqual({ scanned: 1, expired: 1, revoked: 0 });

    // Assert ultra still granted for this user.
  });

  it("is idempotent — second run reports zeros", async () => {
    const userId = "u-sweep-10"; await insertUser(userId);
    await db.insert(subscription).values({
      userId, provider: "google_play", productId: "p", purchaseToken: "tok2",
      status: "active", currentPeriodEnd: past,
    });

    const first = await svc.runReconciliationSweep({ now });
    expect(first.expired).toBe(1);
    const second = await svc.runReconciliationSweep({ now });
    expect(second).toEqual({ scanned: 0, expired: 0, revoked: 0 });
    // Verify only one SWEEP_EXPIRED audit row exists.
    const events = await db.select().from(billingEvent).where(eq(billingEvent.eventType, "SWEEP_EXPIRED"));
    expect(events).toHaveLength(1);
  });

  it("late RENEWED webhook after sweep re-grants correctly via the existing state machine", async () => {
    const userId = "u-sweep-11"; await insertUser(userId);
    await db.insert(subscription).values({
      userId, provider: "google_play", productId: "p", purchaseToken: "tok3",
      status: "active", currentPeriodEnd: past,
    });
    await svc.runReconciliationSweep({ now });

    // Simulate a late RENEWED webhook arriving AFTER the sweep already flipped the sub to expired.
    // Reuse the envelope-builder pattern from billing.service.test.ts:43 — copy it inline:
    function buildEnvelope(notificationType: number, purchaseToken: string, messageId: string) {
      const inner = { packageName: "com.pruvi.app", subscriptionNotification: { notificationType, purchaseToken, version: "1.0" } };
      return { message: { messageId, publishTime: "2026-05-12T12:30:00Z", data: Buffer.from(JSON.stringify(inner)).toString("base64") } };
    }

    // notificationType = 2 is SUBSCRIPTION_RENEWED in Google Play RTDN.
    const renewed = buildEnvelope(2, "tok3", "renew-late-1");
    const r = await svc.processGooglePlayEnvelope(renewed);
    expect(r.isOk()).toBe(true);

    const sub = (await db.select().from(subscription).where(eq(subscription.purchaseToken, "tok3")))[0];
    expect(sub.status).toBe("active");
    expect(sub.currentPeriodEnd).not.toBeNull();
    // ultra grant was called for this user — assert using the same pattern existing integration tests use
    // to inspect the ultra entitlement table.
  });
});
```

NOTE on the integration test: there are several "use whatever the existing tests use" markers. Read `billing.service.test.ts` and `billing.repository.integration.test.ts` BEFORE writing this file, copy their fixture-construction style verbatim — do not invent new helpers. If `UltraService` requires constructor args you don't have, copy from those tests too.

- [ ] **Step 6: Run integration tests to verify they pass.**

Run: `bun test apps/server/src/features/billing/billing-sweep.integration.test.ts`

- [ ] **Step 7: Run full server typecheck and test.**

Run: `bun --cwd apps/server check-types && bun --cwd apps/server test`

- [ ] **Step 8: Commit.**

```bash
git add apps/server/src/features/billing/billing.service.ts apps/server/src/features/billing/billing-sweep.service.test.ts apps/server/src/features/billing/billing-sweep.integration.test.ts
git commit -m "feat(billing): add runReconciliationSweep with per-row two-phase commit"
```

---

### Task 3: Queue registration — `billing-cron`

**Files:**
- Modify: `apps/server/src/plugins/queue.ts`

- [ ] **Step 1: Extend the `FastifyInstance['queues']` declaration** to include `billingSweep`.

```ts
export type BillingSweepJobData = { kind: "sweep" };

declare module "fastify" {
  interface FastifyInstance {
    queues: {
      sessionPrefetch: Queue | null;
      notificationsCron: Queue | null;
      notificationsSend: Queue<SendJobData> | null;
      billingSweep: Queue<BillingSweepJobData> | null;
    };
  }
}
```

- [ ] **Step 2: In the no-REDIS branch, decorate with `billingSweep: null`.**

```ts
  if (!env.REDIS_URL) {
    fastify.log.info("No REDIS_URL — BullMQ queues disabled");
    fastify.decorate("queues", {
      sessionPrefetch: null,
      notificationsCron: null,
      notificationsSend: null,
      billingSweep: null,
    });
    return;
  }
```

- [ ] **Step 3: In the REDIS-present branch, construct the queue, register the hourly repeat, and decorate.**

```ts
  const billingSweepQueue = new Queue<BillingSweepJobData>("billing-cron", { connection });
  await billingSweepQueue.add(
    "sweep",
    { kind: "sweep" },
    { repeat: { pattern: "0 * * * *" }, removeOnComplete: true, removeOnFail: true },
  );

  fastify.decorate("queues", {
    sessionPrefetch: sessionPrefetchQueue,
    notificationsCron: notificationsCronQueue,
    notificationsSend: notificationsSendQueue,
    billingSweep: billingSweepQueue,
  });
```

- [ ] **Step 4: Add `billingSweepQueue.close()` to the onClose hook.**

```ts
  fastify.addHook("onClose", async () => {
    await Promise.all([
      sessionPrefetchQueue.close(),
      notificationsCronQueue.close(),
      notificationsSendQueue.close(),
      billingSweepQueue.close(),
    ]);
  });
```

- [ ] **Step 5: Run typecheck.**

Run: `bun --cwd apps/server check-types`

- [ ] **Step 6: Commit.**

```bash
git add apps/server/src/plugins/queue.ts
git commit -m "feat(billing): register billing-cron BullMQ queue with hourly sweep"
```

---

### Task 4: Worker — `billing-sweep.worker.ts`

**Files:**
- Create: `apps/server/src/workers/billing-sweep.worker.ts`
- Modify: `apps/server/src/worker.ts`

- [ ] **Step 1: Inspect `apps/server/src/worker.ts`** (read the file) to learn how existing workers are started and cleaned up. Match that pattern.

- [ ] **Step 2: Create the worker.**

```ts
import { Worker, type Job } from "bullmq";
import { env } from "@pruvi/env/server";
import { db } from "@pruvi/db";
import { parseRedisUrl } from "../utils/redis";
import { BillingRepository } from "../features/billing/billing.repository";
import { BillingService } from "../features/billing/billing.service";
import { UltraService } from "../features/ultra/ultra.service";
import { UltraRepository } from "../features/ultra/ultra.repository";

type BillingSweepJobData = { kind: "sweep" };

export function startBillingSweepWorker() {
  if (!env.REDIS_URL) {
    console.log("No REDIS_URL — billing sweep worker disabled");
    return null;
  }

  const connection = parseRedisUrl(env.REDIS_URL);
  const repo = new BillingRepository();
  const ultra = new UltraService(new UltraRepository(db));   // canonical construction per billing.route.ts:16
  const service = new BillingService(db, repo, ultra);

  const worker = new Worker<BillingSweepJobData>(
    "billing-cron",
    async (_job: Job<BillingSweepJobData>) => {
      const result = await service.runReconciliationSweep({ now: new Date() });
      return result;
    },
    { connection, concurrency: 1 },
  );

  worker.on("failed", (job, err) => console.error("billing-sweep job failed:", job?.id, err));
  worker.on("completed", (_job, result) => console.log("billing-sweep done:", result));

  const cleanup = async () => {
    await worker.close();
  };

  return { cleanup };
}
```

NOTE: read `apps/server/src/features/billing/billing.route.ts` or `billing.service.test.ts` to learn the exact UltraService construction (does it take `db`? a repo? both?). Replicate that. If construction is non-trivial enough to warrant a shared factory, the implementer should NOT introduce one — copy the call site verbatim. We can DRY later if the duplication grows past 3 sites.

- [ ] **Step 3: Wire into `worker.ts`.** The current file (read it before editing) has:

```ts
import { startSessionPrefetchWorker } from "./workers/session-prefetch.worker";
import { startNotificationsWorker } from "./workers/notifications.worker";

const prefetch = startSessionPrefetchWorker();
const notifications = startNotificationsWorker();

if (!prefetch && !notifications) { /* exit */ }

console.log("Workers started:", { prefetch: !!prefetch, notifications: !!notifications });

const shutdown = async () => {
  if (prefetch) await prefetch.cleanup();
  if (notifications) await notifications.cleanup();
  ...
};
```

Apply these THREE edits (all are required):

1. Add `import { startBillingSweepWorker } from "./workers/billing-sweep.worker";` next to the other worker imports.
2. Add `const billing = startBillingSweepWorker();` after the existing two.
3. Update the guard: `if (!prefetch && !notifications && !billing) { ... }` — without this, when only REDIS-less mode runs and all three return null, the process still exits 1 correctly; but the guard's semantics must include all workers to remain meaningful.
4. Add `billing: !!billing` to the `console.log` object.
5. Add `if (billing) await billing.cleanup();` to the `shutdown` function.

- [ ] **Step 4: Run typecheck.**

Run: `bun --cwd apps/server check-types`

- [ ] **Step 5: Smoke test (no-REDIS).** Boot the worker process without `REDIS_URL` — should log "No REDIS_URL — billing sweep worker disabled" and not crash.

- [ ] **Step 6: Commit.**

```bash
git add apps/server/src/workers/billing-sweep.worker.ts apps/server/src/worker.ts
git commit -m "feat(billing): start billing-sweep BullMQ worker"
```

---

### Task 5: Concurrency / race regression test

**Files:**
- Modify: `apps/server/src/features/billing/billing-sweep.integration.test.ts`

- [ ] **Step 1: Append the race test.** This guards the "sweep + late RENEWED in opposite orders" promise from spec §7.

```ts
  it("sweep losing to a concurrent RENEWED leaves the sub active and ultra granted", async () => {
    const userId = "u-sweep-12"; await insertUser(userId);
    const [row] = await db.insert(subscription).values({
      userId, provider: "google_play", productId: "p", purchaseToken: "tokR",
      status: "active", currentPeriodEnd: past,
    }).returning();

    // Bump the row to "fresh" before sweep sees it (simulating RENEWED winning the race).
    await db.update(subscription).set({ currentPeriodEnd: fresh }).where(eq(subscription.id, row.id));

    const out = await svc.runReconciliationSweep({ now });
    // findExpiredCandidates already filters on currentPeriodEnd < cutoff, so scanned should be 0.
    expect(out.scanned).toBe(0);

    const sub = (await db.select().from(subscription).where(eq(subscription.id, row.id)))[0];
    expect(sub.status).toBe("active");
  });

  it("two sweep workers processing the same stale row → only one audit row, only one revoke", async () => {
    const userId = "u-sweep-13"; await insertUser(userId);
    await db.insert(subscription).values({
      userId, provider: "google_play", productId: "p", purchaseToken: "tokC",
      status: "active", currentPeriodEnd: past,
    });

    const [a, b] = await Promise.all([
      svc.runReconciliationSweep({ now }),
      svc.runReconciliationSweep({ now }),
    ]);
    // Sum across both runs: exactly one should claim the expire+revoke; the other should report 0.
    expect((a.expired ?? 0) + (b.expired ?? 0)).toBe(1);
    expect((a.revoked ?? 0) + (b.revoked ?? 0)).toBe(1);

    const events = await db.select().from(billingEvent).where(eq(billingEvent.eventType, "SWEEP_EXPIRED"));
    expect(events).toHaveLength(1);
  });
```

- [ ] **Step 2: Run integration tests.**

Run: `bun test apps/server/src/features/billing/billing-sweep.integration.test.ts`
Expected: both new tests pass.

- [ ] **Step 3: Run full server test suite to catch any regressions.**

Run: `bun --cwd apps/server test`

- [ ] **Step 4: Commit.**

```bash
git add apps/server/src/features/billing/billing-sweep.integration.test.ts
git commit -m "test(billing): concurrent sweep + RENEWED race regression"
```

---

## Gate D (final spec-coverage review)

After Task 5 the implementer subagent stops. The controller dispatches a final Opus 4.7 spec-coverage reviewer against the full branch diff vs `main`, prompted to find:
- Acceptance criteria from spec §9 not covered.
- Integration test cases from spec §8.2 missing.
- The "test canceled + currentPeriodEnd IS NULL" case from B7 specifically.
- The two-phase commit ordering literally matching the spec §4.1 diagram (audit insert inside TX, ultra revoke after commit).

Then proceed to PR / merge.
