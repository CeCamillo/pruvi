import { describe, it, expect, vi, afterEach } from "vitest";
import { ProgressService } from "./progress.service";
import type { ProgressRepository } from "./progress.repository";
import { NotFoundError, ValidationError } from "../../utils/errors";

afterEach(() => {
  vi.useRealTimers();
});

function makeRepo(overrides: Partial<ProgressRepository> = {}): ProgressRepository {
  return {
    getProgressForUser: vi.fn().mockResolvedValue([]),
    getSubjectReviews: vi.fn().mockResolvedValue([]),
    subjectExists: vi.fn().mockResolvedValue(true),
    getCalendarDates: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as ProgressRepository;
}

describe("ProgressService.getProgress", () => {
  it("derives accuracy as round(correctCount / totalQuestions * 100)", async () => {
    const repo = makeRepo({
      getProgressForUser: vi.fn().mockResolvedValue([
        { slug: "a", name: "A", totalQuestions: 3, correctCount: 2 },
        { slug: "b", name: "B", totalQuestions: 10, correctCount: 10 },
        { slug: "c", name: "C", totalQuestions: 10, correctCount: 0 },
      ]),
    });
    const service = new ProgressService(repo);
    const result = await service.getProgress("u1");
    expect(result.isOk()).toBe(true);
    const { subjects } = result._unsafeUnwrap();
    expect(subjects[0]).toMatchObject({ slug: "a", accuracy: 67 });
    expect(subjects[1]).toMatchObject({ slug: "b", accuracy: 100 });
    expect(subjects[2]).toMatchObject({ slug: "c", accuracy: 0 });
  });

  it("returns empty subjects array when repo returns none", async () => {
    const service = new ProgressService(makeRepo());
    const result = await service.getProgress("u1");
    expect(result._unsafeUnwrap()).toEqual({ subjects: [] });
  });
});

describe("ProgressService.getSubjectReviews", () => {
  it("returns NotFoundError when subject doesn't exist", async () => {
    const service = new ProgressService(
      makeRepo({ subjectExists: vi.fn().mockResolvedValue(false) }),
    );
    const result = await service.getSubjectReviews("u1", "ghost");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(NotFoundError);
  });

  it("maps quality >= 3 to correct=true via qualityToCorrect", async () => {
    const now = new Date("2026-04-16T10:00:00Z");
    const service = new ProgressService(
      makeRepo({
        getSubjectReviews: vi.fn().mockResolvedValue([
          { questionId: 1, body: "q1", quality: 5, reviewedAt: now },
          { questionId: 2, body: "q2", quality: 2, reviewedAt: now },
          { questionId: 3, body: "q3", quality: 3, reviewedAt: now },
        ]),
      }),
    );
    const result = await service.getSubjectReviews("u1", "a");
    const { reviews } = result._unsafeUnwrap();
    expect(reviews).toEqual([
      { questionId: 1, body: "q1", correct: true, reviewedAt: now.toISOString() },
      { questionId: 2, body: "q2", correct: false, reviewedAt: now.toISOString() },
      { questionId: 3, body: "q3", correct: true, reviewedAt: now.toISOString() },
    ]);
  });
});

describe("ProgressService.getCalendar", () => {
  it("defaults month to current when not provided", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16));
    const getCalendarDates = vi.fn().mockResolvedValue(["2026-04-01"]);
    const service = new ProgressService(makeRepo({ getCalendarDates }));
    const result = await service.getCalendar("u1", undefined);
    expect(result.isOk()).toBe(true);
    const [, start, end] = getCalendarDates.mock.calls[0]!;
    expect(start).toBe("2026-04-01");
    expect(end).toBe("2026-05-01");
  });

  it("rejects future month with ValidationError", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16));
    const service = new ProgressService(makeRepo());
    const result = await service.getCalendar("u1", "2026-05");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
  });

  it("accepts past month", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16));
    const service = new ProgressService(makeRepo());
    const result = await service.getCalendar("u1", "2025-12");
    expect(result.isOk()).toBe(true);
  });

  it("accepts current month", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16));
    const service = new ProgressService(makeRepo());
    const result = await service.getCalendar("u1", "2026-04");
    expect(result.isOk()).toBe(true);
  });
});
