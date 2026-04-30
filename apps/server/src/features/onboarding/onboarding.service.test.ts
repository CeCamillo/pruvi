import { describe, it, expect, vi, beforeEach } from "vitest";
import { OnboardingService } from "./onboarding.service";
import { NotFoundError } from "../../utils/errors";

function createMocks() {
  const repo = {
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
    completeOnboarding: vi.fn(),
  };
  const service = new OnboardingService(repo as any);
  return { repo, service };
}

const emptyPrefs = {
  selectedExam: null,
  prepTimeline: null,
  difficulties: null,
  dailyGoalMinutes: null,
  onboardingCompleted: false,
};

describe("OnboardingService", () => {
  let repo: ReturnType<typeof createMocks>["repo"];
  let service: OnboardingService;

  beforeEach(() => {
    ({ repo, service } = createMocks());
  });

  describe("getPreferences", () => {
    it("returns the preferences row when found", async () => {
      repo.getPreferences.mockResolvedValue(emptyPrefs);

      const result = await service.getPreferences("user-1");

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual(emptyPrefs);
    });

    it("returns NotFoundError when user is missing", async () => {
      repo.getPreferences.mockResolvedValue(null);

      const result = await service.getPreferences("ghost");

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(NotFoundError);
    });
  });

  describe("updatePreferences", () => {
    it("forwards the patch to the repo and returns the updated row", async () => {
      const updated = {
        ...emptyPrefs,
        selectedExam: "enem" as const,
      };
      repo.getPreferences.mockResolvedValue(updated);

      const result = await service.updatePreferences("user-1", {
        selectedExam: "enem",
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual(updated);
      expect(repo.updatePreferences).toHaveBeenCalledWith("user-1", {
        selectedExam: "enem",
      });
    });

    it("returns NotFoundError if the follow-up read comes back empty", async () => {
      repo.getPreferences.mockResolvedValue(null);

      const result = await service.updatePreferences("ghost", {
        selectedExam: "enem",
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(NotFoundError);
    });
  });

  describe("completeOnboarding", () => {
    it("persists the payload and returns onboardingCompleted:true", async () => {
      const payload = {
        selectedExam: "enem" as const,
        prepTimeline: "3m" as const,
        difficulties: ["consistency"] as ["consistency"],
        dailyGoalMinutes: 60,
      };

      const result = await service.completeOnboarding("user-1", payload);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({ onboardingCompleted: true });
      expect(repo.completeOnboarding).toHaveBeenCalledWith("user-1", payload);
    });
  });
});
