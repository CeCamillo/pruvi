import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ShieldsService } from "./shields.service";
import { SHIELD_REFILL_INTERVAL_MS } from "@pruvi/shared";

const NOW = new Date("2026-05-11T12:00:00.000Z");

describe("ShieldsService", () => {
  let repo: {
    materializeRefill: ReturnType<typeof vi.fn>;
    tryUseShield: ReturnType<typeof vi.fn>;
  };
  let service: ShieldsService;

  beforeEach(() => {
    repo = {
      materializeRefill: vi.fn(),
      tryUseShield: vi.fn(),
    };
    service = new ShieldsService(repo as any);
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getBalance", () => {
    it("non-Ultra user: available=0, nextRefillAt=null", async () => {
      repo.materializeRefill.mockResolvedValue({
        available: 0,
        lastGrantAt: null,
        isUltraActive: false,
      });
      const result = await service.getBalance("user-1");
      const data = result._unsafeUnwrap();
      expect(data.available).toBe(0);
      expect(data.maxAvailable).toBe(1);
      expect(data.nextRefillAt).toBeNull();
    });

    it("Ultra user, NULL lastShieldGrantAt: refill grants 1; available=1, nextRefillAt=null (at cap)", async () => {
      repo.materializeRefill.mockResolvedValue({
        available: 1,
        lastGrantAt: NOW,
        isUltraActive: true,
      });
      const result = await service.getBalance("user-2");
      const data = result._unsafeUnwrap();
      expect(data.available).toBe(1);
      expect(data.maxAvailable).toBe(1);
      // at cap → nextRefillAt null
      expect(data.nextRefillAt).toBeNull();
    });

    it("Ultra user with 0 shields, last grant 31d ago: refill grants 1; available=1, nextRefillAt=null (at cap)", async () => {
      const lastGrantAt = new Date(NOW.getTime() - 31 * 24 * 60 * 60 * 1000);
      repo.materializeRefill.mockResolvedValue({
        available: 1,
        lastGrantAt,
        isUltraActive: true,
      });
      const result = await service.getBalance("user-3");
      const data = result._unsafeUnwrap();
      expect(data.available).toBe(1);
      expect(data.nextRefillAt).toBeNull();
    });

    it("Ultra user with 0 shields, last grant 5d ago: no refill; nextRefillAt = lastGrant + 30d", async () => {
      const lastGrantAt = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000);
      repo.materializeRefill.mockResolvedValue({
        available: 0,
        lastGrantAt,
        isUltraActive: true,
      });
      const result = await service.getBalance("user-4");
      const data = result._unsafeUnwrap();
      expect(data.available).toBe(0);
      const expectedNextRefill = new Date(lastGrantAt.getTime() + SHIELD_REFILL_INTERVAL_MS);
      expect(data.nextRefillAt).toBe(expectedNextRefill.toISOString());
    });

    it("Ultra user already at 1 shield: no refill; available=1, nextRefillAt=null", async () => {
      const lastGrantAt = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000);
      repo.materializeRefill.mockResolvedValue({
        available: 1,
        lastGrantAt,
        isUltraActive: true,
      });
      const result = await service.getBalance("user-5");
      const data = result._unsafeUnwrap();
      expect(data.available).toBe(1);
      expect(data.nextRefillAt).toBeNull();
    });
  });

  describe("tryUseShield", () => {
    it("happy path: returns { used: true, balanceAfter: 0 }", async () => {
      repo.materializeRefill.mockResolvedValue({
        available: 1,
        lastGrantAt: NOW,
        isUltraActive: true,
      });
      repo.tryUseShield.mockResolvedValue({ used: true, balanceAfter: 0 });
      const result = await service.tryUseShield("user-6", "2026-05-10");
      expect(result).toEqual({ used: true, balanceAfter: 0 });
      expect(repo.tryUseShield).toHaveBeenCalledWith("user-6", "2026-05-10");
    });

    it("no shields: returns { used: false, balanceAfter: null }", async () => {
      repo.materializeRefill.mockResolvedValue({
        available: 0,
        lastGrantAt: null,
        isUltraActive: true,
      });
      repo.tryUseShield.mockResolvedValue({ used: false, balanceAfter: null });
      const result = await service.tryUseShield("user-7", "2026-05-10");
      expect(result).toEqual({ used: false, balanceAfter: null });
    });

    it("already-protected: returns { used: false, balanceAfter: null }", async () => {
      repo.materializeRefill.mockResolvedValue({
        available: 1,
        lastGrantAt: NOW,
        isUltraActive: true,
      });
      repo.tryUseShield.mockResolvedValue({ used: false, balanceAfter: null });
      const result = await service.tryUseShield("user-8", "2026-05-10");
      expect(result).toEqual({ used: false, balanceAfter: null });
    });
  });
});
