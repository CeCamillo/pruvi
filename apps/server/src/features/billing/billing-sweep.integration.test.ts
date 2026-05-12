import { describe, expect, it, beforeEach, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { setupTestDb, cleanupTestDb, teardownTestDb, getTestDb } from "../../test/db-helpers";
import { subscription, billingEvent } from "@pruvi/db/schema/billing";
import { user } from "@pruvi/db/schema/auth";
import { BillingService } from "./billing.service";
import { BillingRepository } from "./billing.repository";
import { UltraService } from "../ultra/ultra.service";
import { UltraRepository } from "../ultra/ultra.repository";

// There is no `seedUser` helper. Copy the local `insertUser(id)` pattern verbatim
// from `billing.repository.integration.test.ts:15`:
const db = getTestDb();

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

  beforeAll(async () => setupTestDb());
  beforeEach(async () => {
    await cleanupTestDb();
    const repo = new BillingRepository();
    const ultra = new UltraService(new UltraRepository(db));   // canonical construction per billing.route.ts:16
    svc = new BillingService(db, repo, ultra);
  });
  afterAll(async () => teardownTestDb());

  it("flips a single stale active sub to expired, writes SWEEP_EXPIRED audit, revokes ultra", async () => {
    const userId = "u-sweep-8"; await insertUser(userId);
    await db.insert(subscription).values({
      userId, provider: "google_play", productId: "p", purchaseToken: "tok",
      status: "active", currentPeriodEnd: past,
    });

    const out = await svc.runReconciliationSweep({ now });
    expect(out).toEqual({ scanned: 1, expired: 1, revoked: 1 });

    const sub = (await db.select().from(subscription).where(eq(subscription.purchaseToken, "tok")))[0];
    expect(sub!.status).toBe("expired");
    const events = await db.select().from(billingEvent).where(eq(billingEvent.eventType, "SWEEP_EXPIRED"));
    expect(events).toHaveLength(1);
    expect(events[0]!.provider).toBe("google_play");
    expect(events[0]!.messageId).toMatch(/^sweep:\d+:/);
    expect(events[0]!.processedAt).not.toBeNull();

    // Assert ultra was revoked: UltraRepository writes to `user.isUltra` column.
    const userRow = (await db.select({ isUltra: user.isUltra, ultraExpiresAt: user.ultraExpiresAt }).from(user).where(eq(user.id, userId)))[0];
    expect(userRow!.isUltra).toBe(false);
    expect(userRow!.ultraExpiresAt).toBeNull();
  });

  it("does not revoke when user has another active subscription on the other provider", async () => {
    const userId = "u-sweep-9"; await insertUser(userId);
    await db.insert(subscription).values([
      { userId, provider: "google_play", productId: "p", purchaseToken: "stale", status: "active", currentPeriodEnd: past },
      { userId, provider: "app_store",   productId: "p", purchaseToken: "alive", status: "active", currentPeriodEnd: fresh },
    ]);

    const out = await svc.runReconciliationSweep({ now });
    expect(out).toEqual({ scanned: 1, expired: 1, revoked: 0 });

    // Ultra should NOT be revoked when user has another active sub.
    // (The user was never explicitly granted ultra in this test, so we just verify revoke wasn't called
    // indirectly — the ultra row remains in its default state from user creation.)
    const staleSub = (await db.select().from(subscription).where(eq(subscription.purchaseToken, "stale")))[0];
    expect(staleSub!.status).toBe("expired");
    const aliveSub = (await db.select().from(subscription).where(eq(subscription.purchaseToken, "alive")))[0];
    expect(aliveSub!.status).toBe("active");
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

    // Verify sweep expired the sub.
    const afterSweep = (await db.select().from(subscription).where(eq(subscription.purchaseToken, "tok3")))[0];
    expect(afterSweep!.status).toBe("expired");

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
    expect(sub!.status).toBe("active");
    expect(sub!.currentPeriodEnd).not.toBeNull();

    // Assert ultra was re-granted after the late RENEWED webhook.
    const userRow = (await db.select({ isUltra: user.isUltra, ultraExpiresAt: user.ultraExpiresAt }).from(user).where(eq(user.id, userId)))[0];
    expect(userRow!.isUltra).toBe(true);
    expect(userRow!.ultraExpiresAt).not.toBeNull();
  });
});
