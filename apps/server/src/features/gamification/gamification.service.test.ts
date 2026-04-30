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

    it("increments both totalXp and weeklyXp by the same delta for a correct medium answer", async () => {
      repo.getUserXp.mockResolvedValue({ totalXp: 50, currentLevel: 1 });
      repo.awardXp.mockResolvedValue({
        totalXp: 70,
        weeklyXp: 40,
        currentLevel: 1,
      });

      const result = await service.awardXpForAnswer("user-1", true, "medium");

      expect(result.isOk()).toBe(true);
      // awardXp must be called with the 20 XP delta (medium correct = 20 XP)
      expect(repo.awardXp).toHaveBeenCalledWith("user-1", 20, 1);
      // The mock returns weeklyXp: 40 — verify the delta passed to awardXp is 20
      // (initial weeklyXp: 20 + 20 = 40, initial totalXp: 50 + 20 = 70)
      const callArgs = repo.awardXp.mock.calls[0];
      expect(callArgs[1]).toBe(20); // xpAmount
    });
  });
});
