import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProgressService } from "./progress.service";
import type { ProgressRepository } from "./progress.repository";

const USER_ID = "user-1";

function makeMockRepo() {
  return {
    getProgressBySubject: vi.fn(),
    getCompletedDatesInRange: vi.fn(),
  } as unknown as ProgressRepository & {
    getProgressBySubject: ReturnType<typeof vi.fn>;
    getCompletedDatesInRange: ReturnType<typeof vi.fn>;
  };
}

describe("ProgressService", () => {
  let repo: ReturnType<typeof makeMockRepo>;
  let service: ProgressService;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new ProgressService(repo);
  });

  describe("getProgress", () => {
    it("returns zero accuracy when no reviews", async () => {
      repo.getProgressBySubject.mockResolvedValue([]);
      const result = await service.getProgress(USER_ID);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual({
          totalReviews: 0,
          totalCorrect: 0,
          accuracy: 0,
          bySubject: [],
        });
      }
    });

    it("computes per-subject and global accuracy", async () => {
      repo.getProgressBySubject.mockResolvedValue([
        {
          subjectSlug: "matematica",
          subjectName: "Matemática",
          totalReviews: 10,
          totalCorrect: 8,
        },
        {
          subjectSlug: "biologia",
          subjectName: "Biologia",
          totalReviews: 5,
          totalCorrect: 5,
        },
      ]);
      const result = await service.getProgress(USER_ID);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.totalReviews).toBe(15);
        expect(result.value.totalCorrect).toBe(13);
        expect(result.value.accuracy).toBeCloseTo(13 / 15);
        expect(result.value.bySubject[0]?.accuracy).toBeCloseTo(0.8);
        expect(result.value.bySubject[1]?.accuracy).toBe(1);
      }
    });
  });

  describe("getCalendar", () => {
    it("returns dates from repo on valid range", async () => {
      repo.getCompletedDatesInRange.mockResolvedValue(["2026-05-01", "2026-05-03"]);
      const result = await service.getCalendar(USER_ID, "2026-05-01", "2026-05-31");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.dates).toEqual(["2026-05-01", "2026-05-03"]);
      }
    });

    it("rejects when to < from", async () => {
      const result = await service.getCalendar(USER_ID, "2026-05-10", "2026-05-01");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.statusCode).toBe(400);
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("rejects when range > 400 days with RANGE_TOO_LARGE", async () => {
      const result = await service.getCalendar(USER_ID, "2024-01-01", "2026-01-01");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.statusCode).toBe(400);
        expect(result.error.code).toBe("RANGE_TOO_LARGE");
      }
    });

    it("accepts exactly 400-day range", async () => {
      repo.getCompletedDatesInRange.mockResolvedValue([]);
      const result = await service.getCalendar(USER_ID, "2026-01-01", "2027-02-05");
      expect(result.isOk()).toBe(true);
    });
  });
});
