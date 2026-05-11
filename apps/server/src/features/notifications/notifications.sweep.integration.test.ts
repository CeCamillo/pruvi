import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb, getTestDb, teardownTestDb, cleanupTestDb } from "../../test/db-helpers";
import { user } from "@pruvi/db/schema/auth";
import { pushToken } from "@pruvi/db/schema/push-tokens";
import { dailySession } from "@pruvi/db/schema/daily-sessions";
import { SweepRepository } from "./sweep.repository";

const db = getTestDb();
const repo = new SweepRepository(db);

beforeAll(async () => { await setupTestDb(); });
afterAll(async () => { await teardownTestDb(); });
beforeEach(async () => { await cleanupTestDb(); });

describe("SweepRepository.findEligibleForStreakReminder", () => {
  it("returns user with hour match + token + reminders enabled + no completed session today", async () => {
    await db.insert(user).values({ id: "u1", name: "U1", email: "u1@x.com", notificationHour: 19, streakRemindersEnabled: true });
    await db.insert(pushToken).values({ userId: "u1", token: "ExponentPushToken[u1]", platform: "ios" });
    const rows = await repo.findEligibleForStreakReminder(19);
    expect(rows).toEqual([{ userId: "u1", token: "ExponentPushToken[u1]" }]);
  });

  it("skips users with streakRemindersEnabled = false", async () => {
    await db.insert(user).values({ id: "u1", name: "U1", email: "u1@x.com", notificationHour: 19, streakRemindersEnabled: false });
    await db.insert(pushToken).values({ userId: "u1", token: "ExponentPushToken[u1]", platform: "ios" });
    const rows = await repo.findEligibleForStreakReminder(19);
    expect(rows).toEqual([]);
  });

  it("skips users whose hour doesn't match", async () => {
    await db.insert(user).values({ id: "u1", name: "U1", email: "u1@x.com", notificationHour: 20 });
    await db.insert(pushToken).values({ userId: "u1", token: "ExponentPushToken[u1]", platform: "ios" });
    const rows = await repo.findEligibleForStreakReminder(19);
    expect(rows).toEqual([]);
  });

  it("skips users who have a completed session today", async () => {
    await db.insert(user).values({ id: "u1", name: "U1", email: "u1@x.com", notificationHour: 19 });
    await db.insert(pushToken).values({ userId: "u1", token: "ExponentPushToken[u1]", platform: "ios" });
    await db.insert(dailySession).values({ userId: "u1", status: "completed" });
    const rows = await repo.findEligibleForStreakReminder(19);
    expect(rows).toEqual([]);
  });

  it("includes users with an active (incomplete) session today", async () => {
    await db.insert(user).values({ id: "u1", name: "U1", email: "u1@x.com", notificationHour: 19 });
    await db.insert(pushToken).values({ userId: "u1", token: "ExponentPushToken[u1]", platform: "ios" });
    await db.insert(dailySession).values({ userId: "u1", status: "active" });
    const rows = await repo.findEligibleForStreakReminder(19);
    expect(rows.map((r) => r.userId)).toEqual(["u1"]);
  });

  it("returns one row per (user, token) pair when user has multiple devices", async () => {
    await db.insert(user).values({ id: "u1", name: "U1", email: "u1@x.com", notificationHour: 19 });
    await db.insert(pushToken).values([
      { userId: "u1", token: "ExponentPushToken[a]", platform: "ios" },
      { userId: "u1", token: "ExponentPushToken[b]", platform: "android" },
    ]);
    const rows = await repo.findEligibleForStreakReminder(19);
    expect(rows.map((r) => r.token).sort()).toEqual(["ExponentPushToken[a]", "ExponentPushToken[b]"]);
  });

  it("skips users with no push tokens", async () => {
    await db.insert(user).values({ id: "u1", name: "U1", email: "u1@x.com", notificationHour: 19 });
    const rows = await repo.findEligibleForStreakReminder(19);
    expect(rows).toEqual([]);
  });
});
