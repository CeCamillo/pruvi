import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../test/db-helpers";
import { user } from "@pruvi/db/schema/auth";
import { SessionPreferencesRepository } from "./session-preferences.repository";

describe("SessionPreferencesRepository (integration)", () => {
  const db = getTestDb();
  const repo = new SessionPreferencesRepository(db);

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("get returns showTimer = true by default for a new user", async () => {
    const userId = "test-session-pref-user";

    await db.insert(user).values({
      id: userId,
      name: "Session Pref User",
      email: `${userId}@example.com`,
      emailVerified: false,
      updatedAt: new Date(),
    });

    const result = await repo.get(userId);
    expect(result).not.toBeNull();
    expect(result?.showTimer).toBe(true);
  });

  it("update sets showTimer to false and get returns false", async () => {
    const userId = "test-session-pref-update";

    await db.insert(user).values({
      id: userId,
      name: "Session Pref Update",
      email: `${userId}@example.com`,
      emailVerified: false,
      updatedAt: new Date(),
    });

    const updated = await repo.update(userId, { showTimer: false });
    expect(updated).not.toBeNull();
    expect(updated?.showTimer).toBe(false);

    const row = await repo.get(userId);
    expect(row?.showTimer).toBe(false);
  });

  it("get returns null for unknown user", async () => {
    const result = await repo.get("non-existent-user");
    expect(result).toBeNull();
  });

  it("update returns null for unknown user", async () => {
    const result = await repo.update("non-existent-user", { showTimer: false });
    expect(result).toBeNull();
  });
});
