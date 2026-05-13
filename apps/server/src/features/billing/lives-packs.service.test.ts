import { describe, it, expect, vi } from "vitest";
import { LivesPacksService } from "./lives-packs.service";
import type { LivesPacksRepository } from "./lives-packs.repository";
import type { GooglePlayApiClient } from "./google-play.api-client";
import type { db as DbClient } from "@pruvi/db";

type MockRepo = {
  findByTxn: ReturnType<typeof vi.fn>;
  insertPurchase: ReturnType<typeof vi.fn>;
  incrementBonusLives: ReturnType<typeof vi.fn>;
};

type MockApiClient = {
  getOneTimeProduct: ReturnType<typeof vi.fn>;
  acknowledgeOneTimeProduct: ReturnType<typeof vi.fn>;
};

function makeRepo(overrides: Partial<MockRepo> = {}): MockRepo {
  return {
    findByTxn: vi.fn().mockResolvedValue(null),
    insertPurchase: vi.fn().mockResolvedValue({ id: 1, userId: "u1", provider: "google_play", transactionId: "tok", productId: "vidas_pack_5", livesGranted: 5, acknowledgedAt: new Date(), createdAt: new Date() }),
    incrementBonusLives: vi.fn().mockResolvedValue(5),
    ...overrides,
  };
}

function makeApiClient(overrides: Partial<MockApiClient> = {}): MockApiClient {
  return {
    getOneTimeProduct: vi.fn().mockResolvedValue({ purchaseState: 0, consumptionState: 0, acknowledgementState: 0 }),
    acknowledgeOneTimeProduct: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makeDb(repo: MockRepo): typeof DbClient {
  return {
    transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(repo)),
  } as unknown as typeof DbClient;
}

function buildSut(opts: {
  repo?: MockRepo;
  apiClient?: MockApiClient;
  packageName?: string | null;
  invalidateLivesCache?: ReturnType<typeof vi.fn>;
  logger?: { error: ReturnType<typeof vi.fn> };
} = {}) {
  const repo = opts.repo ?? makeRepo();
  const apiClient = opts.apiClient ?? makeApiClient();
  const db = makeDb(repo);
  const invalidateLivesCache = opts.invalidateLivesCache ?? vi.fn().mockResolvedValue(undefined);
  const logger = opts.logger ?? { error: vi.fn() };
  const service = new LivesPacksService(
    db,
    repo as unknown as LivesPacksRepository,
    apiClient as unknown as GooglePlayApiClient,
    opts.packageName !== undefined ? opts.packageName : "com.pruvi.app",
    invalidateLivesCache,
    logger,
  );
  return { service, repo, apiClient, db, invalidateLivesCache, logger };
}

describe("LivesPacksService", () => {
  it("happy path: returns bonusLivesAdded=5, bonusLivesAfter=5", async () => {
    const { service } = buildSut();
    const result = await service.redeemGooglePlay("u1", { purchaseToken: "tok", productId: "vidas_pack_5" });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.bonusLivesAdded).toBe(5);
      expect(result.value.bonusLivesAfter).toBe(5);
    }
  });

  it("idempotency: existing purchase returns bonusLivesAdded=0", async () => {
    const repo = makeRepo({
      findByTxn: vi.fn().mockResolvedValue({ id: 1, userId: "u1", provider: "google_play", transactionId: "tok", productId: "vidas_pack_5", livesGranted: 5, acknowledgedAt: new Date(), createdAt: new Date() }),
      incrementBonusLives: vi.fn().mockResolvedValue(5),
    });
    const apiClient = makeApiClient();
    const { service } = buildSut({ repo, apiClient });
    const result = await service.redeemGooglePlay("u1", { purchaseToken: "tok", productId: "vidas_pack_5" });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.bonusLivesAdded).toBe(0);
    }
    // Should not call google API
    expect(apiClient.getOneTimeProduct).not.toHaveBeenCalled();
  });

  it("purchaseState=1 (canceled) returns ValidationError, no ack, no insert", async () => {
    const apiClient = makeApiClient({
      getOneTimeProduct: vi.fn().mockResolvedValue({ purchaseState: 1, consumptionState: 0, acknowledgementState: 0 }),
    });
    const { service, repo } = buildSut({ apiClient });
    const result = await service.redeemGooglePlay("u1", { purchaseToken: "tok", productId: "vidas_pack_5" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(apiClient.acknowledgeOneTimeProduct).not.toHaveBeenCalled();
    expect(repo.insertPurchase).not.toHaveBeenCalled();
  });

  it("consumptionState=1 (already consumed) returns ValidationError", async () => {
    const apiClient = makeApiClient({
      getOneTimeProduct: vi.fn().mockResolvedValue({ purchaseState: 0, consumptionState: 1, acknowledgementState: 0 }),
    });
    const { service } = buildSut({ apiClient });
    const result = await service.redeemGooglePlay("u1", { purchaseToken: "tok", productId: "vidas_pack_5" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("API returns null (auth fail) → AppError VALIDATION_FAILED", async () => {
    const apiClient = makeApiClient({
      getOneTimeProduct: vi.fn().mockResolvedValue(null),
    });
    const { service } = buildSut({ apiClient });
    const result = await service.redeemGooglePlay("u1", { purchaseToken: "tok", productId: "vidas_pack_5" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
      expect(result.error.statusCode).toBe(422);
    }
  });

  it("ack returns false → AppError ACK_FAILED, no insert", async () => {
    const apiClient = makeApiClient({
      acknowledgeOneTimeProduct: vi.fn().mockResolvedValue(false),
    });
    const { service, repo } = buildSut({ apiClient });
    const result = await service.redeemGooglePlay("u1", { purchaseToken: "tok", productId: "vidas_pack_5" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("ACK_FAILED");
      expect(result.error.statusCode).toBe(422);
    }
    expect(repo.insertPurchase).not.toHaveBeenCalled();
  });

  it("insert returns null (concurrent race) → returns bonusLivesAdded=0", async () => {
    const repo = makeRepo({
      insertPurchase: vi.fn().mockResolvedValue(null),
      incrementBonusLives: vi.fn().mockResolvedValue(5),
    });
    const { service } = buildSut({ repo });
    const result = await service.redeemGooglePlay("u1", { purchaseToken: "tok", productId: "vidas_pack_5" });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.bonusLivesAdded).toBe(0);
    }
  });

  it("TX rollback path: incrementBonusLives returns null → AppError CREDIT_TX_FAILED + critical log", async () => {
    const repo = makeRepo({
      incrementBonusLives: vi.fn().mockResolvedValue(null), // user deleted
    });
    const { service, logger } = buildSut({ repo });
    const result = await service.redeemGooglePlay("u1", { purchaseToken: "tok", productId: "vidas_pack_5" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("CREDIT_TX_FAILED");
      expect(result.error.statusCode).toBe(500);
    }
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", purchaseToken: "tok", productId: "vidas_pack_5" }),
      "app-store-acked-but-uncredited",
    );
  });

  it("packageName null → AppError BILLING_NOT_CONFIGURED", async () => {
    const { service, apiClient } = buildSut({ packageName: null });
    const result = await service.redeemGooglePlay("u1", { purchaseToken: "tok", productId: "vidas_pack_5" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("BILLING_NOT_CONFIGURED");
      expect(result.error.statusCode).toBe(503);
    }
    expect(apiClient.getOneTimeProduct).not.toHaveBeenCalled();
  });

  it("cache invalidator called after successful credit", async () => {
    const invalidateLivesCache = vi.fn().mockResolvedValue(undefined);
    const { service } = buildSut({ invalidateLivesCache });
    const result = await service.redeemGooglePlay("u1", { purchaseToken: "tok", productId: "vidas_pack_5" });
    expect(result.isOk()).toBe(true);
    expect(invalidateLivesCache).toHaveBeenCalledWith("u1");
  });

  it("cache invalidator NOT called when ack fails", async () => {
    const apiClient = makeApiClient({
      acknowledgeOneTimeProduct: vi.fn().mockResolvedValue(false),
    });
    const invalidateLivesCache = vi.fn().mockResolvedValue(undefined);
    const { service } = buildSut({ apiClient, invalidateLivesCache });
    await service.redeemGooglePlay("u1", { purchaseToken: "tok", productId: "vidas_pack_5" });
    expect(invalidateLivesCache).not.toHaveBeenCalled();
  });
});
