import { describe, it, expect, beforeEach, vi } from "vitest";
import { OnboardingService } from "./onboarding.service";
import type { OnboardingRepository } from "./onboarding.repository";

const USER_ID = "user-1";

function makeMockRepo() {
  return {
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
    completeOnboarding: vi.fn(),
    listSubjectSlugs: vi
      .fn()
      .mockResolvedValue([
        "matematica",
        "biologia",
        "fisica",
        "quimica",
        "portugues",
      ]),
  } as unknown as OnboardingRepository & {
    getPreferences: ReturnType<typeof vi.fn>;
    updatePreferences: ReturnType<typeof vi.fn>;
    completeOnboarding: ReturnType<typeof vi.fn>;
    listSubjectSlugs: ReturnType<typeof vi.fn>;
  };
}

const basePrefs = {
  selectedExam: null,
  examDate: null,
  difficulties: [],
  dailyStudyTimeMinutes: null,
  onboardingCompleted: false,
};

describe("OnboardingService", () => {
  let repo: ReturnType<typeof makeMockRepo>;
  let service: OnboardingService;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new OnboardingService(repo);
  });

  describe("getPreferences", () => {
    it("returns preferences when user exists", async () => {
      repo.getPreferences.mockResolvedValue(basePrefs);
      const result = await service.getPreferences(USER_ID);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value).toEqual(basePrefs);
    });

    it("returns NotFoundError when user missing", async () => {
      repo.getPreferences.mockResolvedValue(null);
      const result = await service.getPreferences(USER_ID);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.statusCode).toBe(404);
    });
  });

  describe("updatePreferences", () => {
    it("rejects unknown subject slugs", async () => {
      const result = await service.updatePreferences(USER_ID, {
        difficulties: ["matematica", "made_up_subject"],
      });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.statusCode).toBe(400);
        expect(result.error.message).toContain("made_up_subject");
      }
    });

    it("accepts known subject slugs and writes patch", async () => {
      repo.updatePreferences.mockResolvedValue({
        ...basePrefs,
        difficulties: ["matematica"],
      });
      const result = await service.updatePreferences(USER_ID, {
        difficulties: ["matematica"],
      });
      expect(result.isOk()).toBe(true);
      expect(repo.updatePreferences).toHaveBeenCalledWith(USER_ID, {
        difficulties: ["matematica"],
      });
    });
  });

  describe("completeOnboarding", () => {
    const validPayload = {
      selectedExam: "fuvest" as const,
      examDate: "2026-11-20",
      difficulties: ["quimica"],
      dailyStudyTimeMinutes: 30,
    };

    it("rejects with 409 when already completed", async () => {
      repo.getPreferences.mockResolvedValue({
        ...basePrefs,
        onboardingCompleted: true,
      });
      const result = await service.completeOnboarding(USER_ID, validPayload);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.statusCode).toBe(409);
    });

    it("rejects unknown subject slugs", async () => {
      repo.getPreferences.mockResolvedValue(basePrefs);
      const result = await service.completeOnboarding(USER_ID, {
        ...validPayload,
        difficulties: ["bogus"],
      });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.statusCode).toBe(400);
    });

    it("writes payload and sets onboardingCompleted=true", async () => {
      repo.getPreferences.mockResolvedValue(basePrefs);
      repo.completeOnboarding.mockResolvedValue({
        ...basePrefs,
        ...validPayload,
        onboardingCompleted: true,
      });
      const result = await service.completeOnboarding(USER_ID, validPayload);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.onboardingCompleted).toBe(true);
    });
  });
});
