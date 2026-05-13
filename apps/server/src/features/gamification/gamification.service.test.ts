import { describe, it, expect, vi, beforeEach } from "vitest";
import { GamificationService } from "./gamification.service";
import { NotFoundError } from "../../utils/errors";

function createMocks() {
  const repo = {
    getUserXp: vi.fn(),
    awardXp: vi.fn(),
  };
  const service = new GamificationService(repo as any);
  return { repo, service };
}

describe("GamificationService", () => {
  let repo: ReturnType<typeof createMocks>["repo"];
  let service: GamificationService;

  beforeEach(() => {
    ({ repo, service } = createMocks());
  });

  describe("getXp", () => {
    it("returns totalXp, currentLevel, and xpForNextLevel", async () => {
      repo.getUserXp.mockResolvedValue({ totalXp: 50, currentLevel: 1 });

      const result = await service.getXp("user-1");

      expect(result.isOk()).toBe(true);
      const value = result._unsafeUnwrap();
      expect(value.totalXp).toBe(50);
      expect(value.currentLevel).toBe(1);
      // Level 1 threshold is 100, so xpForNextLevel = 100 - 50 = 50
      expect(value.xpForNextLevel).toBe(50);
    });

    it("returns NotFoundError when user not found", async () => {
      repo.getUserXp.mockResolvedValue(null);

      const result = await service.getXp("user-1");

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(NotFoundError);
    });
  });

  describe("awardXpForAnswer", () => {
    it("awards 0 XP for a wrong answer and does not call awardXp", async () => {
      repo.getUserXp.mockResolvedValue({ totalXp: 50, currentLevel: 1 });

      const result = await service.awardXpForAnswer("user-1", false, "easy");

      expect(result.isOk()).toBe(true);
      const value = result._unsafeUnwrap();
      expect(value.xpAwarded).toBe(0);
      expect(value.totalXp).toBe(50);
      expect(value.currentLevel).toBe(1);
      expect(repo.getUserXp).toHaveBeenCalledWith("user-1");
      expect(repo.awardXp).not.toHaveBeenCalled();
    });

    it("awards 10 XP for a correct easy answer and calculates level", async () => {
      repo.getUserXp.mockResolvedValue({ totalXp: 80, currentLevel: 1 });
      repo.awardXp.mockResolvedValue({ totalXp: 90, currentLevel: 1 });

      const result = await service.awardXpForAnswer("user-1", true, "easy");

      expect(result.isOk()).toBe(true);
      const value = result._unsafeUnwrap();
      expect(value.xpAwarded).toBe(10);
      expect(value.totalXp).toBe(90);
      expect(value.currentLevel).toBe(1);
      expect(repo.awardXp).toHaveBeenCalledWith("user-1", 10, 1);
    });
  });

  describe("awardXpForSessionCompletion", () => {
    it("happy path: 8 correct, streak=3 → xpAwarded=90", async () => {
      repo.getUserXp.mockResolvedValue({ totalXp: 0, currentLevel: 1 });
      repo.awardXp.mockResolvedValue({ totalXp: 90, currentLevel: 1 });

      const result = await service.awardXpForSessionCompletion("user-1", 8, 3);

      expect(result.isOk()).toBe(true);
      const value = result._unsafeUnwrap();
      expect(value.xpAwarded).toBe(90); // (50 + 40) * 1 = 90
      expect(repo.awardXp).toHaveBeenCalledWith("user-1", 90, expect.any(Number));
    });

    it("streak above threshold: 10 correct, streak=8 → repo.awardXp called with 110", async () => {
      repo.getUserXp.mockResolvedValue({ totalXp: 0, currentLevel: 1 });
      repo.awardXp.mockResolvedValue({ totalXp: 110, currentLevel: 1 });

      const result = await service.awardXpForSessionCompletion("user-1", 10, 8);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().xpAwarded).toBe(110);
      expect(repo.awardXp).toHaveBeenCalledWith("user-1", 110, expect.any(Number));
    });

    it("streak at boundary 7: 10 correct, streak=7 → 100 (no multiplier)", async () => {
      repo.getUserXp.mockResolvedValue({ totalXp: 0, currentLevel: 1 });
      repo.awardXp.mockResolvedValue({ totalXp: 100, currentLevel: 1 });

      const result = await service.awardXpForSessionCompletion("user-1", 10, 7);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().xpAwarded).toBe(100); // (50 + 50) * 1 = 100
      expect(repo.awardXp).toHaveBeenCalledWith("user-1", 100, expect.any(Number));
    });

    it("repo.awardXp returns undefined (user deleted) → returns ok with fallback totalXp, no throw", async () => {
      repo.getUserXp.mockResolvedValue({ totalXp: 50, currentLevel: 1 });
      repo.awardXp.mockResolvedValue(undefined);

      const result = await service.awardXpForSessionCompletion("user-1", 8, 3);

      expect(result.isOk()).toBe(true);
      const value = result._unsafeUnwrap();
      // xpAwarded is 90; totalXp falls back to 50 + 90 = 140
      expect(value.xpAwarded).toBe(90);
      expect(value.totalXp).toBe(140);
    });
  });
});
