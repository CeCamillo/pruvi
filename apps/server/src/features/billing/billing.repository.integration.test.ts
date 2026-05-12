import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { setupTestDb, cleanupTestDb, teardownTestDb, getTestDb } from "../../test/db-helpers";
import { user } from "@pruvi/db/schema/auth";
import { eq } from "drizzle-orm";
import { BillingRepository } from "./billing.repository";
import { subscription } from "@pruvi/db/schema/billing";

describe("BillingRepository (integration)", () => {
  const db = getTestDb();
  const repo = new BillingRepository();

  beforeAll(async () => setupTestDb());
  beforeEach(async () => cleanupTestDb());
  afterAll(async () => teardownTestDb());

  async function insertUser(id: string) {
    await db.insert(user).values({
      id, name: `U ${id}`, email: `${id}@e.com`, emailVerified: false,
      inviteCode: `c${id.replace(/-/g, "").slice(0, 8)}`, username: null, updatedAt: new Date(),
    });
  }

  it("insertEvent dedup: same (provider, message_id) returns null on second insert", async () => {
    const a = await repo.insertEvent(db, { provider: "google_play", messageId: "m1", eventType: "PURCHASED", purchaseToken: "t1", payload: { x: 1 } });
    const b = await repo.insertEvent(db, { provider: "google_play", messageId: "m1", eventType: "PURCHASED", purchaseToken: "t1", payload: { x: 2 } });
    expect(a).not.toBeNull();
    expect(b).toBeNull();
  });

  it("createOrphanSubscription is idempotent on conflict", async () => {
    const a = await repo.createOrphanSubscription(db, "google_play", "t-orph");
    const b = await repo.createOrphanSubscription(db, "google_play", "t-orph");
    expect(b.id).toBe(a.id);
    expect(b.userId).toBeNull();
  });

  it("upsertLinkedSubscription creates with linked_at set; second call by same user returns existing", async () => {
    await insertUser("u-link-1");
    const r1 = await repo.upsertLinkedSubscription(db, { userId: "u-link-1", provider: "google_play", productId: "p1", token: "t-link-1" });
    expect(r1.created).toBe(true);
    expect(r1.subscription.linkedAt).toBeInstanceOf(Date);
    const r2 = await repo.upsertLinkedSubscription(db, { userId: "u-link-1", provider: "google_play", productId: "p1", token: "t-link-1" });
    expect(r2.created).toBe(false);
    expect(r2.subscription.id).toBe(r1.subscription.id);
  });

  it("claimOrphanSubscription sets user_id, product_id, linked_at", async () => {
    await insertUser("u-claim-1");
    const orph = await repo.createOrphanSubscription(db, "google_play", "t-claim-1");
    const claimed = await repo.claimOrphanSubscription(db, orph.id, "u-claim-1", "pruvi_ultra_monthly");
    expect(claimed.userId).toBe("u-claim-1");
    expect(claimed.productId).toBe("pruvi_ultra_monthly");
    expect(claimed.linkedAt).toBeInstanceOf(Date);
  });

  it("claimOrphanSubscription rejects already-claimed", async () => {
    await insertUser("u-claim-2a");
    await insertUser("u-claim-2b");
    const orph = await repo.createOrphanSubscription(db, "google_play", "t-claim-2");
    await repo.claimOrphanSubscription(db, orph.id, "u-claim-2a", "p");
    await expect(repo.claimOrphanSubscription(db, orph.id, "u-claim-2b", "p")).rejects.toThrow();
  });

  it("hasOtherActiveSubscription detects sibling active row", async () => {
    await insertUser("u-multi-1");
    const a = await repo.upsertLinkedSubscription(db, { userId: "u-multi-1", provider: "google_play", productId: "p", token: "t-A" });
    await repo.updateSubscriptionState(db, a.subscription.id, { status: "active", currentPeriodEnd: new Date(Date.now() + 86400000) });
    const b = await repo.upsertLinkedSubscription(db, { userId: "u-multi-1", provider: "google_play", productId: "p", token: "t-B" });
    expect(await repo.hasOtherActiveSubscription(db, "u-multi-1", b.subscription.id)).toBe(true);
  });

  it("hasOtherActiveSubscription returns false when only this subscription is active", async () => {
    await insertUser("u-multi-2");
    const a = await repo.upsertLinkedSubscription(db, { userId: "u-multi-2", provider: "google_play", productId: "p", token: "t-only" });
    await repo.updateSubscriptionState(db, a.subscription.id, { status: "active" });
    expect(await repo.hasOtherActiveSubscription(db, "u-multi-2", a.subscription.id)).toBe(false);
  });

  it("listUnprocessedEventsForToken returns rows oldest-first, processed rows excluded", async () => {
    await repo.insertEvent(db, { provider: "google_play", messageId: "m-a", eventType: "PURCHASED", purchaseToken: "t-X", payload: {} });
    await new Promise((r) => setTimeout(r, 10));
    const ev2 = await repo.insertEvent(db, { provider: "google_play", messageId: "m-b", eventType: "RENEWED", purchaseToken: "t-X", payload: {} });
    await repo.markEventProcessed(db, ev2!.id);
    const unprocessed = await repo.listUnprocessedEventsForToken(db, "google_play", "t-X");
    expect(unprocessed).toHaveLength(1);
    expect(unprocessed[0]!.messageId).toBe("m-a");
  });

  it("getMaxOtherActivePeriodEnd returns the LATER end across other active subs", async () => {
    await insertUser("u-max-1");
    const future30 = new Date(Date.now() + 30 * 86400000);
    const future365 = new Date(Date.now() + 365 * 86400000);
    // Create subscription A with 30-day end
    const a = await repo.upsertLinkedSubscription(db, { userId: "u-max-1", provider: "google_play", productId: "p", token: "t-A" });
    await repo.updateSubscriptionState(db, a.subscription.id, { status: "active", currentPeriodEnd: future30 });
    // Create subscription B with 365-day end
    const b = await repo.upsertLinkedSubscription(db, { userId: "u-max-1", provider: "google_play", productId: "p", token: "t-B" });
    await repo.updateSubscriptionState(db, b.subscription.id, { status: "active", currentPeriodEnd: future365 });
    // When excluding A, the max-other should be B's (365 days)
    const maxOther = await repo.getMaxOtherActivePeriodEnd(db, "u-max-1", a.subscription.id);
    expect(maxOther).not.toBeNull();
    expect(Math.abs(maxOther!.getTime() - future365.getTime())).toBeLessThan(1000);
  });

  it("getMaxOtherActivePeriodEnd returns null when only this sub is active", async () => {
    await insertUser("u-max-2");
    const a = await repo.upsertLinkedSubscription(db, { userId: "u-max-2", provider: "google_play", productId: "p", token: "t-solo" });
    await repo.updateSubscriptionState(db, a.subscription.id, { status: "active", currentPeriodEnd: new Date(Date.now() + 86400000) });
    expect(await repo.getMaxOtherActivePeriodEnd(db, "u-max-2", a.subscription.id)).toBeNull();
  });

  it("ON DELETE SET NULL: deleting a user with linked subscriptions sets user_id to NULL", async () => {
    await insertUser("u-cascade-1");
    const a = await repo.upsertLinkedSubscription(db, { userId: "u-cascade-1", provider: "google_play", productId: "p", token: "t-casc" });
    expect(a.subscription.userId).toBe("u-cascade-1");
    // Delete the user
    await db.delete(user).where(eq(user.id, "u-cascade-1"));
    // Subscription row must still exist with userId = NULL
    const after = await repo.findSubscriptionByToken(db, "google_play", "t-casc");
    expect(after).not.toBeNull();
    expect(after!.userId).toBeNull();
  });

  it("cross-provider: same message_id string for google_play and app_store coexist (composite UNIQUE)", async () => {
    const a = await repo.insertEvent(db, { provider: "google_play", messageId: "shared-id", eventType: "PURCHASED", purchaseToken: "tA", payload: {} });
    const b = await repo.insertEvent(db, { provider: "app_store", messageId: "shared-id", eventType: "SUBSCRIBED", purchaseToken: "tB", payload: {} });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.id).not.toBe(b!.id);
  });

  it("cross-provider: same purchase_token string for google_play and app_store coexist", async () => {
    const a = await repo.createOrphanSubscription(db, "google_play", "shared-token");
    const b = await repo.createOrphanSubscription(db, "app_store", "shared-token");
    expect(a.id).not.toBe(b.id);
    expect(a.provider).toBe("google_play");
    expect(b.provider).toBe("app_store");
  });

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
      const updated = await repo.expireSubscriptionIfStale(db, row!.id, cutoff);
      expect(updated?.status).toBe("expired");
      expect(updated?.id).toBe(row!.id);
    });

    it("expireSubscriptionIfStale returns null when status no longer in set (concurrent webhook won)", async () => {
      const userId = "u-sweep-6"; await insertUser(userId);
      const cutoff = new Date("2026-05-11T12:00:00Z");
      const past = new Date(cutoff.getTime() - 60_000);
      const [row] = await db.insert(subscription).values({
        userId, provider: "google_play", productId: "p", purchaseToken: "tok_already_expired",
        status: "expired", currentPeriodEnd: past,
      }).returning();
      const updated = await repo.expireSubscriptionIfStale(db, row!.id, cutoff);
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
      const updated = await repo.expireSubscriptionIfStale(db, row!.id, cutoff);
      expect(updated).toBeNull();
    });
  });
});
