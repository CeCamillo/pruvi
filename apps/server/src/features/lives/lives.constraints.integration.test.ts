import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  setupTestDb,
  getTestDb,
  teardownTestDb,
  cleanupTestDb,
} from "../../test/db-helpers";
import { user } from "@pruvi/db/schema/auth";

const db = getTestDb();

const userId = "u-constraints-1";

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanupTestDb();
  await db.insert(user).values({
    id: userId,
    name: "Test",
    email: "t@test.com",
    lives: 5,
    totalXp: 0,
    currentLevel: 1,
  });
});

describe("user CHECK constraints (integration)", () => {
  // Note: the Drizzle/pg error wrapper replaces the message with
  // "Failed query: ...", so we cannot match the constraint name via regex.
  // We fall back to asserting that *some* error is thrown and verify the
  // row was NOT mutated (the real observable guarantee of the constraint).

  it("rejects lives = -1 (violates user_lives_chk)", async () => {
    await expect(
      db.update(user).set({ lives: -1 }).where(eq(user.id, userId)),
    ).rejects.toThrow();

    // Confirm row was NOT mutated
    const rows = await db
      .select({ lives: user.lives })
      .from(user)
      .where(eq(user.id, userId));
    expect(rows[0]?.lives).toBe(5);
  });

  it("rejects lives = 6 (violates user_lives_chk)", async () => {
    await expect(
      db.update(user).set({ lives: 6 }).where(eq(user.id, userId)),
    ).rejects.toThrow();

    const rows = await db
      .select({ lives: user.lives })
      .from(user)
      .where(eq(user.id, userId));
    expect(rows[0]?.lives).toBe(5);
  });

  it("rejects totalXp = -1 (violates user_total_xp_chk)", async () => {
    await expect(
      db.update(user).set({ totalXp: -1 }).where(eq(user.id, userId)),
    ).rejects.toThrow();

    const rows = await db
      .select({ totalXp: user.totalXp })
      .from(user)
      .where(eq(user.id, userId));
    expect(rows[0]?.totalXp).toBe(0);
  });

  it("rejects currentLevel = 0 (violates user_current_level_chk)", async () => {
    await expect(
      db.update(user).set({ currentLevel: 0 }).where(eq(user.id, userId)),
    ).rejects.toThrow();

    const rows = await db
      .select({ currentLevel: user.currentLevel })
      .from(user)
      .where(eq(user.id, userId));
    expect(rows[0]?.currentLevel).toBe(1);
  });
});
