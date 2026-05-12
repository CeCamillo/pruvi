import { describe, it, expect, vi, beforeEach } from "vitest";
import { BillingService } from "./billing.service";
import type { BillingRepository, SubscriptionRow, BillingEventRow } from "./billing.repository";
import type { UltraService } from "../ultra/ultra.service";
import type { db as DbClient } from "@pruvi/db";

type Mocked<T> = { [K in keyof T]: T[K] extends (...a: infer A) => infer R ? ReturnType<typeof vi.fn<(...a: A) => R>> : T[K] };

function buildSut(opts: {
  insertEvent?: BillingEventRow | null;
  findSubscription?: SubscriptionRow | null;
  createOrphan?: SubscriptionRow;
  updateState?: SubscriptionRow;
  listUnprocessed?: BillingEventRow[];
  hasOtherActive?: boolean;
  maxOtherEnd?: Date | null;
  upsertLinked?: { subscription: SubscriptionRow; created: boolean };
  claimOrphan?: SubscriptionRow;
} = {}) {
  const repo = {
    insertEvent: vi.fn().mockResolvedValue(opts.insertEvent ?? { id: 1, provider: "google_play", messageId: "m1", eventType: "PURCHASED", purchaseToken: "tok", payload: {}, receivedAt: new Date(), processedAt: null, processingError: null }),
    findSubscriptionByToken: vi.fn().mockResolvedValue(opts.findSubscription ?? null),
    createOrphanSubscription: vi.fn().mockResolvedValue(opts.createOrphan ?? { id: 10, userId: null, provider: "google_play", productId: "", purchaseToken: "tok", status: "pending", currentPeriodEnd: null, linkedAt: null }),
    upsertLinkedSubscription: vi.fn().mockResolvedValue(opts.upsertLinked ?? { subscription: { id: 10, userId: "u1", provider: "google_play", productId: "p", purchaseToken: "tok", status: "pending", currentPeriodEnd: null, linkedAt: new Date() }, created: true }),
    claimOrphanSubscription: vi.fn().mockResolvedValue(opts.claimOrphan ?? { id: 10, userId: "u1", provider: "google_play", productId: "p", purchaseToken: "tok", status: "pending", currentPeriodEnd: null, linkedAt: new Date() }),
    updateSubscriptionState: vi.fn().mockResolvedValue(opts.updateState ?? { id: 10, userId: "u1", provider: "google_play", productId: "p", purchaseToken: "tok", status: "active", currentPeriodEnd: new Date(Date.now() + 30 * 86400000), linkedAt: new Date() }),
    markEventProcessed: vi.fn().mockResolvedValue(undefined),
    listUnprocessedEventsForToken: vi.fn().mockResolvedValue(opts.listUnprocessed ?? []),
    hasOtherActiveSubscription: vi.fn().mockResolvedValue(opts.hasOtherActive ?? false),
    getMaxOtherActivePeriodEnd: vi.fn().mockResolvedValue(opts.maxOtherEnd ?? null),
  } as unknown as Mocked<BillingRepository>;
  const ultra = {
    grant: vi.fn().mockResolvedValue(undefined),
    revoke: vi.fn().mockResolvedValue(undefined),
  } as unknown as Mocked<UltraService>;
  const db = {
    transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(repo)),
  } as unknown as typeof DbClient;
  const service = new BillingService(db, repo as unknown as BillingRepository, ultra as unknown as UltraService);
  return { service, repo, ultra, db };
}

function buildEnvelope(notificationType: number, purchaseToken = "tok", messageId = "msg-1") {
  const inner = { packageName: "com.pruvi.app", subscriptionNotification: { notificationType, purchaseToken, version: "1.0" } };
  return { message: { messageId, publishTime: "2026-05-12T10:00:00Z", data: Buffer.from(JSON.stringify(inner)).toString("base64") } };
}

describe("BillingService", () => {
  beforeEach(() => vi.clearAllMocks());

  // Case 1
  it("PURCHASED on linked subscription: active + grant called with ~now+30d", async () => {
    const linked: SubscriptionRow = { id: 10, userId: "u1", provider: "google_play", productId: "p", purchaseToken: "tok", status: "pending", currentPeriodEnd: null, linkedAt: new Date() };
    const { service, ultra, repo } = buildSut({ findSubscription: linked });
    const r = await service.processGooglePlayEnvelope(buildEnvelope(4));
    expect(r.isOk()).toBe(true);
    expect(repo.updateSubscriptionState).toHaveBeenCalledWith(expect.anything(), 10, expect.objectContaining({ status: "active" }));
    expect(ultra.grant).toHaveBeenCalledTimes(1);
    const grantedExpiry = ultra.grant.mock.calls[0]![1] as Date;
    const expected = Date.now() + 30 * 86400000;
    expect(Math.abs(grantedExpiry.getTime() - expected)).toBeLessThan(60_000);
  });

  // Case 2
  it("PURCHASED with NO existing subscription: orphan created, NO grant", async () => {
    const { service, ultra, repo } = buildSut({ findSubscription: null });
    await service.processGooglePlayEnvelope(buildEnvelope(4));
    expect(repo.createOrphanSubscription).toHaveBeenCalled();
    expect(ultra.grant).not.toHaveBeenCalled();
  });

  // Case 3
  it("EXPIRED with no other active subs: revoke called", async () => {
    const active: SubscriptionRow = { id: 10, userId: "u1", provider: "google_play", productId: "p", purchaseToken: "tok", status: "active", currentPeriodEnd: new Date(), linkedAt: new Date() };
    const { service, ultra } = buildSut({ findSubscription: active, hasOtherActive: false });
    await service.processGooglePlayEnvelope(buildEnvelope(13));
    expect(ultra.revoke).toHaveBeenCalledWith("u1");
  });

  // Case 4 — MULTI-SUB REVOKE GUARD (critical)
  it("EXPIRED with another active subscription: revoke NOT called (multi-sub guard)", async () => {
    const active: SubscriptionRow = { id: 10, userId: "u1", provider: "google_play", productId: "p", purchaseToken: "tok", status: "active", currentPeriodEnd: new Date(), linkedAt: new Date() };
    const { service, ultra, repo } = buildSut({ findSubscription: active, hasOtherActive: true });
    await service.processGooglePlayEnvelope(buildEnvelope(13));
    expect(repo.hasOtherActiveSubscription).toHaveBeenCalledWith(expect.anything(), "u1", 10);
    expect(ultra.revoke).not.toHaveBeenCalled();
  });

  // Bonus: MULTI-SUB GRANT GUARD (also critical)
  it("PURCHASED with another active sub having LATER period end: grant uses MAX expiry, not now+30d", async () => {
    const linked: SubscriptionRow = { id: 10, userId: "u1", provider: "google_play", productId: "p", purchaseToken: "tok", status: "pending", currentPeriodEnd: null, linkedAt: new Date() };
    const farFuture = new Date(Date.now() + 365 * 86400000); // 1 year out
    const { service, ultra } = buildSut({ findSubscription: linked, maxOtherEnd: farFuture });
    await service.processGooglePlayEnvelope(buildEnvelope(4));
    expect(ultra.grant).toHaveBeenCalledWith("u1", farFuture);
  });

  // Case 5
  it("CANCELED: state=canceled, no Ultra change", async () => {
    const linked: SubscriptionRow = { id: 10, userId: "u1", provider: "google_play", productId: "p", purchaseToken: "tok", status: "active", currentPeriodEnd: new Date(), linkedAt: new Date() };
    const { service, ultra, repo } = buildSut({ findSubscription: linked });
    await service.processGooglePlayEnvelope(buildEnvelope(3));
    expect(repo.updateSubscriptionState).toHaveBeenCalledWith(expect.anything(), 10, expect.objectContaining({ status: "canceled" }));
    expect(ultra.grant).not.toHaveBeenCalled();
    expect(ultra.revoke).not.toHaveBeenCalled();
  });

  // Case 6
  it("Duplicate messageId: second call no-op (insertEvent returns null)", async () => {
    const { service, ultra } = buildSut({ insertEvent: null });
    await service.processGooglePlayEnvelope(buildEnvelope(4));
    expect(ultra.grant).not.toHaveBeenCalled();
  });

  // Case 7
  it("Unknown notificationType: UNKNOWN_99 event recorded, no state mutation", async () => {
    const { service, ultra, repo } = buildSut();
    await service.processGooglePlayEnvelope(buildEnvelope(99));
    expect(repo.insertEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventType: "UNKNOWN_99" }));
    expect(repo.updateSubscriptionState).not.toHaveBeenCalled();
    expect(ultra.grant).not.toHaveBeenCalled();
  });

  // Case 8
  it("link: same user re-call returns existing subscription, no error", async () => {
    const existing: SubscriptionRow = { id: 10, userId: "u1", provider: "google_play", productId: "p", purchaseToken: "tok", status: "active", currentPeriodEnd: null, linkedAt: new Date() };
    const { service } = buildSut({ findSubscription: existing });
    const r = await service.linkGooglePlayPurchase("u1", { purchaseToken: "tok", productId: "p" });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.value.subscription.id).toBe(10);
  });

  // Case 9
  it("link: token owned by other user throws ConflictError", async () => {
    const owned: SubscriptionRow = { id: 10, userId: "OTHER", provider: "google_play", productId: "p", purchaseToken: "tok", status: "active", currentPeriodEnd: null, linkedAt: new Date() };
    const { service } = buildSut({ findSubscription: owned });
    await expect(service.linkGooglePlayPurchase("u1", { purchaseToken: "tok", productId: "p" })).rejects.toThrow(/PURCHASE_TOKEN_OWNED/);
  });

  // Case 10 — LINK-TIME REPLAY (critical)
  it("link after pre-link webhook: claims orphan, replays parked PURCHASED, ultra.grant called", async () => {
    const orphan: SubscriptionRow = { id: 10, userId: null, provider: "google_play", productId: "", purchaseToken: "tok", status: "pending", currentPeriodEnd: null, linkedAt: null };
    const claimed: SubscriptionRow = { ...orphan, userId: "u1", productId: "p", linkedAt: new Date() };
    const parkedEvent: BillingEventRow = {
      id: 5,
      provider: "google_play",
      messageId: "m-parked",
      eventType: "PURCHASED",
      purchaseToken: "tok",
      payload: { kind: "subscription", messageId: "m-parked", notificationType: 4, notificationTypeName: "PURCHASED", purchaseToken: "tok", publishTime: "", packageName: "", eventTimeMillis: "" } as unknown as Record<string, unknown>,
      receivedAt: new Date(Date.now() - 60_000),
      processedAt: null,
      processingError: null,
    };
    const afterUpdate: SubscriptionRow = { ...claimed, status: "active", currentPeriodEnd: new Date(Date.now() + 30 * 86400000) };

    const { service, repo, ultra } = buildSut({ findSubscription: orphan, claimOrphan: claimed, listUnprocessed: [parkedEvent], updateState: afterUpdate });
    // After claim, findSubscriptionByToken inside the replay loop should return the claimed row.
    (repo.findSubscriptionByToken as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(orphan)     // first call: pre-claim
      .mockResolvedValueOnce(claimed)    // inside replay loop: post-claim, before applyDecoded
      .mockResolvedValueOnce(afterUpdate); // final read at end of transaction

    const r = await service.linkGooglePlayPurchase("u1", { purchaseToken: "tok", productId: "p" });
    expect(r.isOk()).toBe(true);
    expect(repo.claimOrphanSubscription).toHaveBeenCalledWith(expect.anything(), 10, "u1", "p");
    expect(repo.markEventProcessed).toHaveBeenCalledWith(expect.anything(), 5);
    expect(ultra.grant).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// App Store builder helpers
// ---------------------------------------------------------------------------

function buildAppStoreEnvelope(
  notificationType: string,
  opts: {
    subtype?: string;
    expiresDate?: number;
    originalTransactionId?: string;
    notificationUUID?: string;
  } = {},
) {
  const header = Buffer.from(JSON.stringify({ alg: "ES256" })).toString("base64url");
  const tx = {
    originalTransactionId: opts.originalTransactionId ?? "tok",
    productId: "pruvi_ultra_monthly",
    expiresDate: opts.expiresDate ?? Date.now() + 30 * 86400000,
    environment: "Production",
  };
  const innerJws = `${header}.${Buffer.from(JSON.stringify(tx)).toString("base64url")}.sig`;
  const outer: Record<string, unknown> = {
    notificationUUID: opts.notificationUUID ?? "uuid-1",
    notificationType,
    version: "2.0",
    signedDate: Date.now(),
    data: { signedTransactionInfo: innerJws, environment: "Production" },
  };
  if (opts.subtype) outer.subtype = opts.subtype;
  return { signedPayload: `${header}.${Buffer.from(JSON.stringify(outer)).toString("base64url")}.sig` };
}

describe("BillingService — App Store", () => {
  beforeEach(() => vi.clearAllMocks());

  // Case 1: SUBSCRIBED with linked sub → active, grant with expiresDate from Apple
  it("SUBSCRIBED with linked sub: state=active, grant called with expiresDate from Apple", async () => {
    const futureMs = Date.now() + 30 * 86400000;
    const linked: SubscriptionRow = { id: 10, userId: "u1", provider: "app_store", productId: "pruvi_ultra_monthly", purchaseToken: "tok", status: "pending", currentPeriodEnd: null, linkedAt: new Date() };
    const { service, ultra, repo } = buildSut({ findSubscription: linked });
    const r = await service.processAppStoreEnvelope(buildAppStoreEnvelope("SUBSCRIBED", { subtype: "INITIAL_BUY", expiresDate: futureMs }));
    expect(r.isOk()).toBe(true);
    expect(repo.updateSubscriptionState).toHaveBeenCalledWith(expect.anything(), 10, expect.objectContaining({ status: "active" }));
    expect(ultra.grant).toHaveBeenCalledTimes(1);
    const grantedExpiry = ultra.grant.mock.calls[0]![1] as Date;
    expect(Math.abs(grantedExpiry.getTime() - futureMs)).toBeLessThan(1000);
  });

  // Case 2: DID_RENEW → active, grant with new expiresDate
  it("DID_RENEW: state=active, grant called with new expiresDate", async () => {
    const futureMs = Date.now() + 30 * 86400000;
    const linked: SubscriptionRow = { id: 10, userId: "u1", provider: "app_store", productId: "pruvi_ultra_monthly", purchaseToken: "tok", status: "active", currentPeriodEnd: new Date(), linkedAt: new Date() };
    const { service, ultra, repo } = buildSut({ findSubscription: linked });
    const r = await service.processAppStoreEnvelope(buildAppStoreEnvelope("DID_RENEW", { expiresDate: futureMs }));
    expect(r.isOk()).toBe(true);
    expect(repo.updateSubscriptionState).toHaveBeenCalledWith(expect.anything(), 10, expect.objectContaining({ status: "active" }));
    expect(ultra.grant).toHaveBeenCalledTimes(1);
    const grantedExpiry = ultra.grant.mock.calls[0]![1] as Date;
    expect(Math.abs(grantedExpiry.getTime() - futureMs)).toBeLessThan(1000);
  });

  // Case 3: DID_FAIL_TO_RENEW (no subtype) → on_hold, no Ultra change
  it("DID_FAIL_TO_RENEW (no subtype): state=on_hold, no Ultra change", async () => {
    const linked: SubscriptionRow = { id: 10, userId: "u1", provider: "app_store", productId: "pruvi_ultra_monthly", purchaseToken: "tok", status: "active", currentPeriodEnd: new Date(), linkedAt: new Date() };
    const { service, ultra, repo } = buildSut({ findSubscription: linked });
    await service.processAppStoreEnvelope(buildAppStoreEnvelope("DID_FAIL_TO_RENEW"));
    expect(repo.updateSubscriptionState).toHaveBeenCalledWith(expect.anything(), 10, expect.objectContaining({ status: "on_hold" }));
    expect(ultra.grant).not.toHaveBeenCalled();
    expect(ultra.revoke).not.toHaveBeenCalled();
  });

  // Case 4: DID_FAIL_TO_RENEW:GRACE_PERIOD → in_grace, no Ultra change
  it("DID_FAIL_TO_RENEW:GRACE_PERIOD: state=in_grace, no Ultra change", async () => {
    const linked: SubscriptionRow = { id: 10, userId: "u1", provider: "app_store", productId: "pruvi_ultra_monthly", purchaseToken: "tok", status: "active", currentPeriodEnd: new Date(), linkedAt: new Date() };
    const { service, ultra, repo } = buildSut({ findSubscription: linked });
    await service.processAppStoreEnvelope(buildAppStoreEnvelope("DID_FAIL_TO_RENEW", { subtype: "GRACE_PERIOD" }));
    expect(repo.updateSubscriptionState).toHaveBeenCalledWith(expect.anything(), 10, expect.objectContaining({ status: "in_grace" }));
    expect(ultra.grant).not.toHaveBeenCalled();
    expect(ultra.revoke).not.toHaveBeenCalled();
  });

  // Case 5: EXPIRED with no other active → revoke called
  it("EXPIRED with no other active subs: revoke called", async () => {
    const linked: SubscriptionRow = { id: 10, userId: "u1", provider: "app_store", productId: "pruvi_ultra_monthly", purchaseToken: "tok", status: "active", currentPeriodEnd: new Date(), linkedAt: new Date() };
    const { service, ultra } = buildSut({ findSubscription: linked, hasOtherActive: false });
    await service.processAppStoreEnvelope(buildAppStoreEnvelope("EXPIRED"));
    expect(ultra.revoke).toHaveBeenCalledWith("u1");
  });

  // Case 6: EXPIRED with other active sub → revoke NOT called (multi-sub guard)
  it("EXPIRED with another active subscription: revoke NOT called (multi-sub guard)", async () => {
    const linked: SubscriptionRow = { id: 10, userId: "u1", provider: "app_store", productId: "pruvi_ultra_monthly", purchaseToken: "tok", status: "active", currentPeriodEnd: new Date(), linkedAt: new Date() };
    const { service, ultra, repo } = buildSut({ findSubscription: linked, hasOtherActive: true });
    await service.processAppStoreEnvelope(buildAppStoreEnvelope("EXPIRED"));
    expect(repo.hasOtherActiveSubscription).toHaveBeenCalledWith(expect.anything(), "u1", 10);
    expect(ultra.revoke).not.toHaveBeenCalled();
  });

  // Case 7: REFUND_REVERSED with future expiry → active, grant
  it("REFUND_REVERSED with future expiry: state=active, ultra.grant called", async () => {
    const futureMs = Date.now() + 30 * 86400000;
    const linked: SubscriptionRow = { id: 10, userId: "u1", provider: "app_store", productId: "pruvi_ultra_monthly", purchaseToken: "tok", status: "revoked", currentPeriodEnd: new Date(), linkedAt: new Date() };
    const { service, ultra, repo } = buildSut({ findSubscription: linked });
    await service.processAppStoreEnvelope(buildAppStoreEnvelope("REFUND_REVERSED", { expiresDate: futureMs }));
    expect(repo.updateSubscriptionState).toHaveBeenCalledWith(expect.anything(), 10, expect.objectContaining({ status: "active" }));
    expect(ultra.grant).toHaveBeenCalledTimes(1);
  });

  // Case 8: Duplicate notificationUUID → no state change, no Ultra call
  it("Duplicate notificationUUID: second delivery is no-op (insertEvent returns null)", async () => {
    const { service, ultra, repo } = buildSut();
    // Override insertEvent to return null (simulates duplicate rejection by DB unique constraint).
    (repo.insertEvent as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await service.processAppStoreEnvelope(buildAppStoreEnvelope("SUBSCRIBED", { notificationUUID: "uuid-dup" }));
    expect(ultra.grant).not.toHaveBeenCalled();
    expect(repo.updateSubscriptionState).not.toHaveBeenCalled();
  });

  // Case 9: TEST notification → audit insert with eventType="TEST", no other action
  it("TEST notification: audit row inserted with eventType=TEST, no state mutation", async () => {
    const { service, ultra, repo } = buildSut();
    const testEnv = { signedPayload: (() => {
      const header = Buffer.from(JSON.stringify({ alg: "ES256" })).toString("base64url");
      const body = Buffer.from(JSON.stringify({ notificationUUID: "uuid-test", notificationType: "TEST", version: "2.0" })).toString("base64url");
      return `${header}.${body}.sig`;
    })() };
    const r = await service.processAppStoreEnvelope(testEnv);
    expect(r.isOk()).toBe(true);
    expect(repo.insertEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventType: "TEST", provider: "app_store" }));
    expect(ultra.grant).not.toHaveBeenCalled();
    expect(ultra.revoke).not.toHaveBeenCalled();
    expect(repo.updateSubscriptionState).not.toHaveBeenCalled();
  });

  // Case 10: Link with conflict (other user owns token) → ConflictError thrown
  it("linkAppStorePurchase: token owned by other user throws ConflictError", async () => {
    const owned: SubscriptionRow = { id: 10, userId: "OTHER", provider: "app_store", productId: "p", purchaseToken: "tok", status: "active", currentPeriodEnd: null, linkedAt: new Date() };
    const { service } = buildSut({ findSubscription: owned });
    await expect(service.linkAppStorePurchase("u1", { originalTransactionId: "tok", productId: "pruvi_ultra_monthly" })).rejects.toThrow(/PURCHASE_TOKEN_OWNED/);
  });

  // Case 11: Multi-sub GRANT guard with App Store — another active sub with LATER end → ultra.grant uses MAX
  it("App Store SUBSCRIBED with another active sub having LATER period end: grant uses MAX expiry", async () => {
    const futureMs = Date.now() + 30 * 86400000;
    const linked: SubscriptionRow = { id: 10, userId: "u1", provider: "app_store", productId: "pruvi_ultra_monthly", purchaseToken: "tok", status: "pending", currentPeriodEnd: null, linkedAt: new Date() };
    const farFuture = new Date(Date.now() + 365 * 86400000); // 1 year out
    const { service, ultra } = buildSut({ findSubscription: linked, maxOtherEnd: farFuture });
    await service.processAppStoreEnvelope(buildAppStoreEnvelope("SUBSCRIBED", { expiresDate: futureMs }));
    expect(ultra.grant).toHaveBeenCalledWith("u1", farFuture);
  });
});
