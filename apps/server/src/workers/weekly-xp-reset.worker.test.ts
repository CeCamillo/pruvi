import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb, teardownTestDb, getTestDb } from "../test/db-helpers";
import { MeRepository } from "../features/me/me.repository";
import { user } from "@pruvi/db/schema/auth";
import { eq } from "drizzle-orm";

// We test the repository methods that the worker calls, not the BullMQ
// integration itself (Redis-bound, slow). The worker's only job is to call
// repo.resetWeeklyXpForAll() / resetWeeklyXpForUser() and clear cache keys —
// both are unit-testable independently.

describe("weekly-xp-reset repo methods", () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("resetWeeklyXpForAll zeros every user", async () => {
    const db = getTestDb();
    const repo = new MeRepository(db);

    await db.insert(user).values([
      { id: "u1", name: "A", email: "a@x.com", emailVerified: false, weeklyXp: 100 },
      { id: "u2", name: "B", email: "b@x.com", emailVerified: false, weeklyXp: 250 },
    ]);

    await repo.resetWeeklyXpForAll();

    const rows = await db.select({ id: user.id, weeklyXp: user.weeklyXp }).from(user);
    expect(rows.find((r) => r.id === "u1")?.weeklyXp).toBe(0);
    expect(rows.find((r) => r.id === "u2")?.weeklyXp).toBe(0);
  });

  it("resetWeeklyXpForUser zeros one user only", async () => {
    const db = getTestDb();
    const repo = new MeRepository(db);

    await db.insert(user).values([
      { id: "u1", name: "A", email: "a@x.com", emailVerified: false, weeklyXp: 100 },
      { id: "u2", name: "B", email: "b@x.com", emailVerified: false, weeklyXp: 250 },
    ]);

    await repo.resetWeeklyXpForUser("u1");

    const [u1] = await db.select({ weeklyXp: user.weeklyXp }).from(user).where(eq(user.id, "u1"));
    const [u2] = await db.select({ weeklyXp: user.weeklyXp }).from(user).where(eq(user.id, "u2"));
    expect(u1?.weeklyXp).toBe(0);
    expect(u2?.weeklyXp).toBe(250);
  });
});
