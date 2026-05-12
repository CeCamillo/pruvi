import { describe, expect, it, vi } from "vitest";
import { Dispatcher } from "./dispatcher";

function makeDeps(over: any = {}) {
  return {
    tokensService: { listTokensForUser: vi.fn().mockResolvedValue(["ExponentPushToken[a]"]) },
    prefsRepo: { get: vi.fn().mockResolvedValue({ notificationHour: 19, streakRemindersEnabled: true, achievementNotificationsEnabled: true }) },
    sweepRepo: {
      findEligibleForStreakReminder: vi.fn().mockResolvedValue([
        { userId: "u1", token: "ExponentPushToken[u1]" },
        { userId: "u2", token: "ExponentPushToken[u2]" },
      ]),
    },
    sendQueue: { add: vi.fn().mockResolvedValue(undefined) },
    ...over,
  };
}

describe("Dispatcher.sendAchievementNotification", () => {
  it("bails when achievement_notifications_enabled is false", async () => {
    const deps = makeDeps({
      prefsRepo: {
        get: vi.fn().mockResolvedValue({ notificationHour: 19, streakRemindersEnabled: true, achievementNotificationsEnabled: false }),
      },
    });
    const d = new Dispatcher(deps as any);
    await d.sendAchievementNotification("u", "7-day-streak");
    expect(deps.sendQueue.add).not.toHaveBeenCalled();
  });

  it("bails when user has no tokens", async () => {
    const deps = makeDeps({
      tokensService: { listTokensForUser: vi.fn().mockResolvedValue([]) },
    });
    const d = new Dispatcher(deps as any);
    await d.sendAchievementNotification("u", "7-day-streak");
    expect(deps.sendQueue.add).not.toHaveBeenCalled();
  });

  it("enqueues a send job for a 7-day streak", async () => {
    const deps = makeDeps();
    const d = new Dispatcher(deps as any);
    await d.sendAchievementNotification("u", "7-day-streak");
    expect(deps.sendQueue.add).toHaveBeenCalledTimes(1);
    const [, payload] = deps.sendQueue.add.mock.calls[0];
    expect(payload.tokens).toEqual(["ExponentPushToken[a]"]);
    expect(payload.title).toMatch(/7/);
  });

  it("includes the subtopic name in the mastery achievement body", async () => {
    const deps = makeDeps();
    const d = new Dispatcher(deps as any);
    await d.sendAchievementNotification("u", "quase-mestre", { subtopicName: "Membrana" });
    const [, payload] = deps.sendQueue.add.mock.calls[0];
    expect(payload.body).toContain("Membrana");
  });
});

describe("Dispatcher.sendOvertakenNotification", () => {
  it("skips when achievement_notifications_enabled is false", async () => {
    const deps = makeDeps({
      prefsRepo: {
        get: vi.fn().mockResolvedValue({ notificationHour: 19, streakRemindersEnabled: true, achievementNotificationsEnabled: false }),
      },
    });
    const d = new Dispatcher(deps as any);
    await d.sendOvertakenNotification("u", "Pedro");
    expect(deps.sendQueue.add).not.toHaveBeenCalled();
  });

  it("skips when user has no tokens", async () => {
    const deps = makeDeps({
      tokensService: { listTokensForUser: vi.fn().mockResolvedValue([]) },
    });
    const d = new Dispatcher(deps as any);
    await d.sendOvertakenNotification("u", "Pedro");
    expect(deps.sendQueue.add).not.toHaveBeenCalled();
  });

  it("enqueues a send job with the overtaken template payload", async () => {
    const deps = makeDeps();
    const d = new Dispatcher(deps as any);
    await d.sendOvertakenNotification("u", "Pedro");
    expect(deps.sendQueue.add).toHaveBeenCalledTimes(1);
    const [, payload] = deps.sendQueue.add.mock.calls[0];
    expect(payload.tokens).toEqual(["ExponentPushToken[a]"]);
    expect(payload.title).toBe("Você foi ultrapassado!");
    expect(payload.body).toContain("Pedro");
    expect(payload.data).toEqual({ kind: "overtaken" });
  });
});

describe("Dispatcher.sendStreakProtectedNotification", () => {
  it("happy path: enqueues job with streak_protected kind when prefs enabled and tokens present", async () => {
    const deps = makeDeps();
    const d = new Dispatcher(deps as any);
    await d.sendStreakProtectedNotification("u", 7);
    expect(deps.sendQueue.add).toHaveBeenCalledTimes(1);
    const [, payload] = deps.sendQueue.add.mock.calls[0];
    expect(payload.tokens).toEqual(["ExponentPushToken[a]"]);
    expect(payload.title).toBe("Seu escudo protegeu seu streak!");
    expect(payload.body).toContain("7 dias");
    expect(payload.data).toEqual({ kind: "streak_protected" });
  });

  it("opt-out: does not enqueue when streakRemindersEnabled is false", async () => {
    const deps = makeDeps({
      prefsRepo: {
        get: vi.fn().mockResolvedValue({ notificationHour: 19, streakRemindersEnabled: false, achievementNotificationsEnabled: true }),
      },
    });
    const d = new Dispatcher(deps as any);
    await d.sendStreakProtectedNotification("u", 7);
    expect(deps.sendQueue.add).not.toHaveBeenCalled();
  });

  it("no tokens: does not enqueue when user has no tokens", async () => {
    const deps = makeDeps({
      tokensService: { listTokensForUser: vi.fn().mockResolvedValue([]) },
    });
    const d = new Dispatcher(deps as any);
    await d.sendStreakProtectedNotification("u", 7);
    expect(deps.sendQueue.add).not.toHaveBeenCalled();
  });

  it("days < 1: returns immediately without calling prefs or tokens", async () => {
    const deps = makeDeps();
    const d = new Dispatcher(deps as any);
    await d.sendStreakProtectedNotification("u", 0);
    expect(deps.prefsRepo.get).not.toHaveBeenCalled();
    expect(deps.tokensService.listTokensForUser).not.toHaveBeenCalled();
    expect(deps.sendQueue.add).not.toHaveBeenCalled();
  });
});

describe("Dispatcher.dispatchStreakReminder", () => {
  it("calls the eligibility query with hour and enqueues a send per chunk", async () => {
    const deps = makeDeps();
    const d = new Dispatcher(deps as any);
    await d.dispatchStreakReminder({ brtHour: 19, variant: "primary" });
    expect(deps.sweepRepo.findEligibleForStreakReminder).toHaveBeenCalledWith(19);
    expect(deps.sendQueue.add).toHaveBeenCalledTimes(1);
    const [, payload] = deps.sendQueue.add.mock.calls[0];
    expect(payload.tokens).toEqual(["ExponentPushToken[u1]", "ExponentPushToken[u2]"]);
  });

  it("late variant queries hour minus 2 modulo 24", async () => {
    const deps = makeDeps();
    const d = new Dispatcher(deps as any);
    await d.dispatchStreakReminder({ brtHour: 1, variant: "late" });
    expect(deps.sweepRepo.findEligibleForStreakReminder).toHaveBeenCalledWith(23);
  });

  it("does nothing when no eligible users", async () => {
    const deps = makeDeps({
      sweepRepo: { findEligibleForStreakReminder: vi.fn().mockResolvedValue([]) },
    });
    const d = new Dispatcher(deps as any);
    await d.dispatchStreakReminder({ brtHour: 19, variant: "primary" });
    expect(deps.sendQueue.add).not.toHaveBeenCalled();
  });
});
