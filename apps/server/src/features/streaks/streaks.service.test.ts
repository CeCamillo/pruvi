import { describe, it, expect, vi, beforeEach } from "vitest";
import { StreaksService } from "./streaks.service";

function todayStr() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function createMocks() {
  const repo = {
    getCompletedSessionDates: vi.fn(),
    countCompletedSessions: vi.fn(),
  };
  const service = new StreaksService(repo as any);
  return { repo, service };
}

describe("StreaksService", () => {
  let repo: ReturnType<typeof createMocks>["repo"];
  let service: StreaksService;

  beforeEach(() => {
    ({ repo, service } = createMocks());
  });

  it("returns all zeros when no sessions exist", async () => {
    repo.getCompletedSessionDates.mockResolvedValue([]);
    repo.countCompletedSessions.mockResolvedValue(0);

    const result = await service.getStreaks("user-1");

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      totalSessions: 0,
    });
  });

  it("returns currentStreak=1 and longestStreak=1 for one session today", async () => {
    repo.getCompletedSessionDates.mockResolvedValue([todayStr()]);
    repo.countCompletedSessions.mockResolvedValue(1);

    const result = await service.getStreaks("user-1");

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.currentStreak).toBe(1);
    expect(value.longestStreak).toBe(1);
    expect(value.totalSessions).toBe(1);
  });

  it("returns currentStreak=3 for three consecutive days", async () => {
    // Dates are newest-first
    const dates = [todayStr(), daysAgo(1), daysAgo(2)];
    repo.getCompletedSessionDates.mockResolvedValue(dates);
    repo.countCompletedSessions.mockResolvedValue(3);

    const result = await service.getStreaks("user-1");

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.currentStreak).toBe(3);
    expect(value.longestStreak).toBe(3);
  });

  it("a gap breaks the streak", async () => {
    // today, yesterday, 3 days ago (gap at 2 days ago)
    const dates = [todayStr(), daysAgo(1), daysAgo(3)];
    repo.getCompletedSessionDates.mockResolvedValue(dates);
    repo.countCompletedSessions.mockResolvedValue(3);

    const result = await service.getStreaks("user-1");

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.currentStreak).toBe(2);
    expect(value.longestStreak).toBe(2);
  });
});
