import { describe, expect, it, vi } from "vitest";
import { PreferencesService } from "./preferences.service";

function stubRepo(overrides: any = {}) {
  return {
    get: vi.fn().mockResolvedValue({
      notificationHour: 19,
      streakRemindersEnabled: true,
      achievementNotificationsEnabled: true,
    }),
    update: vi.fn().mockImplementation(async (_userId: string, patch: any) => ({
      notificationHour: patch.notificationHour ?? 19,
      streakRemindersEnabled: patch.streakRemindersEnabled ?? true,
      achievementNotificationsEnabled: patch.achievementNotificationsEnabled ?? true,
    })),
    ...overrides,
  };
}

describe("PreferencesService.get", () => {
  it("returns ok with prefs from repo", async () => {
    const repo = stubRepo();
    const service = new PreferencesService(repo as any);
    const result = await service.get("u");
    expect(result._unsafeUnwrap()).toMatchObject({
      notificationHour: 19,
      streakRemindersEnabled: true,
      achievementNotificationsEnabled: true,
    });
  });

  it("returns NotFoundError when repo returns null", async () => {
    const repo = stubRepo({ get: vi.fn().mockResolvedValue(null) });
    const service = new PreferencesService(repo as any);
    const result = await service.get("u");
    expect(result.isErr()).toBe(true);
  });
});

describe("PreferencesService.update", () => {
  it("applies partial patch", async () => {
    const repo = stubRepo();
    const service = new PreferencesService(repo as any);
    const result = await service.update("u", { notificationHour: 20 });
    expect(result._unsafeUnwrap().notificationHour).toBe(20);
    expect(repo.update).toHaveBeenCalledWith("u", { notificationHour: 20 });
  });

  it("rejects an out-of-range hour", async () => {
    const repo = stubRepo();
    const service = new PreferencesService(repo as any);
    const result = await service.update("u", { notificationHour: 25 });
    expect(result.isErr()).toBe(true);
  });

  it("rejects a negative hour", async () => {
    const repo = stubRepo();
    const service = new PreferencesService(repo as any);
    const result = await service.update("u", { notificationHour: -1 });
    expect(result.isErr()).toBe(true);
  });

  it("rejects an empty patch with ValidationError", async () => {
    const repo = stubRepo();
    const service = new PreferencesService(repo as any);
    const result = await service.update("u", {});
    expect(result.isErr()).toBe(true);
    expect(repo.update).not.toHaveBeenCalled();
  });
});
