import { describe, it, expect, vi, beforeEach } from "vitest";
import { UltraService } from "./ultra.service";

const FUTURE = new Date(Date.now() + 86400_000);
const PAST = new Date(Date.now() - 86400_000);

describe("UltraService", () => {
  let repo: {
    get: ReturnType<typeof vi.fn>;
    grant: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
  };
  let service: UltraService;

  beforeEach(() => {
    repo = { get: vi.fn(), grant: vi.fn(), revoke: vi.fn() };
    service = new UltraService(repo as any);
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
    it("returns NotFoundError when user does not exist", async () => {
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

  it("grant calls repo.grant with correct args", async () => {
    repo.grant.mockResolvedValue(undefined);
    await service.grant("u", FUTURE);
    expect(repo.grant).toHaveBeenCalledWith("u", FUTURE);
  });

  it("revoke calls repo.revoke with correct userId", async () => {
    repo.revoke.mockResolvedValue(undefined);
    await service.revoke("u");
    expect(repo.revoke).toHaveBeenCalledWith("u");
  });
});
