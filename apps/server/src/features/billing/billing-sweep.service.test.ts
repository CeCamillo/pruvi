import { describe, expect, it, vi } from "vitest";
import { BillingService } from "./billing.service";
import type { BillingRepository, SubscriptionRow } from "./billing.repository";
import type { UltraService } from "../ultra/ultra.service";
import type { db as DbClient } from "@pruvi/db";

type FakeDb = Pick<typeof DbClient, "transaction">;


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
    } as unknown as FakeDb as typeof DbClient;

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
    const fakeDb = { transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => fn({}) } as unknown as FakeDb as typeof DbClient;

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
    const fakeDb = { transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => fn({}) } as unknown as FakeDb as typeof DbClient;

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
    const fakeDb = { transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => fn({}) } as unknown as FakeDb as typeof DbClient;

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
      expireSubscriptionIfStale: vi.fn().mockImplementation(async (_tx: unknown, id: number) => ({ ...candidates.find((c) => c.id === id)!, status: "expired" })),
      insertEvent: vi.fn().mockResolvedValue({ id: 1 }),
      markEventProcessed: vi.fn().mockResolvedValue(undefined),
      hasOtherActiveSubscription: vi.fn().mockResolvedValue(false),
    } as unknown as BillingRepository;
    const ultra = { revoke: vi.fn().mockResolvedValue(undefined), grant: vi.fn() } as unknown as UltraService;
    const fakeDb = { transaction: txSpy } as unknown as FakeDb as typeof DbClient;

    const svc = new BillingService(fakeDb, repo, ultra);
    const out = await svc.runReconciliationSweep({ now });

    expect(out).toEqual({ scanned: 2, expired: 2, revoked: 2 });
    expect(txSpy).toHaveBeenCalledTimes(2);
  });
});
