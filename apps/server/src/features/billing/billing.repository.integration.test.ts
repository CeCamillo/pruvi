import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { setupTestDb, cleanupTestDb, teardownTestDb, getTestDb } from "../../test/db-helpers";
import { user } from "@pruvi/db/schema/auth";
import { BillingRepository } from "./billing.repository";

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
});
