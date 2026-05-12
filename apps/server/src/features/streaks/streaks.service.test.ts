import { describe, it, expect, vi, beforeEach } from "vitest";
import { todayInBrt } from "@pruvi/shared";
import { StreaksService } from "./streaks.service";

// BRT-local "today" — matches what the repo returns and what computeStreaks compares against.
function todayStr() {
  return todayInBrt(new Date());
}

function daysAgo(n: number) {
  return todayInBrt(new Date(Date.now() - n * 86_400_000));
}

function createMocks(shieldsProtectedDates: string[] = []) {
  const repo = {
    getCompletedSessionDates: vi.fn(),
    countCompletedSessions: vi.fn(),
  };
  const shieldsRepo = {
    listProtectedDates: vi.fn().mockResolvedValue(shieldsProtectedDates),
  };
  const service = new StreaksService(repo as any, shieldsRepo as any);
  return { repo, shieldsRepo, service };
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

  describe("shield protected dates merge", () => {
    it("protected yesterday fills gap: today + day-before-yesterday + protected yesterday = streak 3", async () => {
      // completed: today, 2 days ago (gap at yesterday)
      // protected: yesterday → merged → today, yesterday, 2daysAgo → streak = 3
      const { repo: r, service: s } = createMocks([daysAgo(1)]);
      r.getCompletedSessionDates.mockResolvedValue([todayStr(), daysAgo(2)]);
      r.countCompletedSessions.mockResolvedValue(2);

      const result = await s.getStreaks("user-1");

      expect(result.isOk()).toBe(true);
      const value = result._unsafeUnwrap();
      expect(value.currentStreak).toBe(3);
      expect(value.longestStreak).toBe(3);
      // totalSessions still uses countCompletedSessions — protected dates don't count
      expect(value.totalSessions).toBe(2);
    });

    it("without protected dates, today + day-before-yesterday = streak 1 (gap breaks it)", async () => {
      // No shield — gap at yesterday breaks streak, only today counts
      const { repo: r, service: s } = createMocks([]);
      r.getCompletedSessionDates.mockResolvedValue([todayStr(), daysAgo(2)]);
      r.countCompletedSessions.mockResolvedValue(2);

      const result = await s.getStreaks("user-1");

      expect(result.isOk()).toBe(true);
      const value = result._unsafeUnwrap();
      expect(value.currentStreak).toBe(1);
    });
  });
});
