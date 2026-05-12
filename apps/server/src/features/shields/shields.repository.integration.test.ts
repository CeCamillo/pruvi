import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../test/db-helpers";
import { user } from "@pruvi/db/schema/auth";
import { streakShieldUsage } from "@pruvi/db/schema/streak-shield-usage";
import { ShieldsRepository } from "./shields.repository";

describe("ShieldsRepository (integration)", () => {
  const db = getTestDb();
  const repo = new ShieldsRepository(db);

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function insertUser(
    id: string,
    overrides: {
      isUltra?: boolean;
      ultraExpiresAt?: Date | null;
      streakShieldsAvailable?: number;
      lastShieldGrantAt?: Date | null;
    } = {},
  ) {
    await db.insert(user).values({
      id,
      name: `User ${id}`,
      email: `${id}@example.com`,
      emailVerified: false,
      inviteCode: `code${id.replace(/-/g, "").slice(0, 8)}`,
      username: null,
      updatedAt: new Date(),
      isUltra: overrides.isUltra ?? false,
      ultraExpiresAt: overrides.ultraExpiresAt ?? null,
      streakShieldsAvailable: overrides.streakShieldsAvailable ?? 0,
      lastShieldGrantAt: overrides.lastShieldGrantAt ?? null,
    });
  }

  describe("tryUseShield", () => {
    it("with shields=1: decrement to 0, insert usage row, return { used: true, balanceAfter: 0 }", async () => {
      await insertUser("u-try-1", { streakShieldsAvailable: 1 });
      const result = await repo.tryUseShield("u-try-1", "2026-05-10");
      expect(result).toEqual({ used: true, balanceAfter: 0 });

      // Verify usage row inserted
      const rows = await db
        .select()
        .from(streakShieldUsage)
        .where(eq(streakShieldUsage.userId, "u-try-1"));
      expect(rows).toHaveLength(1);
      expect(rows[0]!.protectedDate).toBe("2026-05-10");

      // Verify shield balance decremented
      const userRow = await repo.getUserShieldState("u-try-1");
      expect(userRow?.streakShieldsAvailable).toBe(0);
    });

    it("with shields=0: returns { used: false, balanceAfter: null }. No usage row inserted", async () => {
      await insertUser("u-try-2", { streakShieldsAvailable: 0 });
      const result = await repo.tryUseShield("u-try-2", "2026-05-10");
      expect(result).toEqual({ used: false, balanceAfter: null });

      const rows = await db
        .select()
        .from(streakShieldUsage)
        .where(eq(streakShieldUsage.userId, "u-try-2"));
      expect(rows).toHaveLength(0);
    });

    it("for already-protected date: returns { used: false, balanceAfter: null }. Shields count NOT decremented (transaction rolled back)", async () => {
      await insertUser("u-try-3", { streakShieldsAvailable: 1 });
      // First use: succeed
      await repo.tryUseShield("u-try-3", "2026-05-10");

      // Second use on same date: should return used: false, roll back decrement
      const result = await repo.tryUseShield("u-try-3", "2026-05-10");
      expect(result).toEqual({ used: false, balanceAfter: null });

      // Shield was rolled back — balance should still be 0 (not -1 or anything else)
      const userRow = await repo.getUserShieldState("u-try-3");
      expect(userRow?.streakShieldsAvailable).toBe(0);

      // Only one usage row should exist
      const rows = await db
        .select()
        .from(streakShieldUsage)
        .where(eq(streakShieldUsage.userId, "u-try-3"));
      expect(rows).toHaveLength(1);
    });
  });

  describe("CHECK constraint", () => {
    it("rejects direct UPDATE attempting streak_shields_available = -1", async () => {
      await insertUser("u-chk-1", { streakShieldsAvailable: 0 });
      await expect(
        db.execute(
          sql`UPDATE "user" SET streak_shields_available = -1 WHERE id = 'u-chk-1'`,
        ),
      ).rejects.toThrow();
    });

    it("rejects direct UPDATE attempting streak_shields_available above max (e.g. 10)", async () => {
      await insertUser("u-chk-2", { streakShieldsAvailable: 0 });
      await expect(
        db.execute(
          sql`UPDATE "user" SET streak_shields_available = 10 WHERE id = 'u-chk-2'`,
        ),
      ).rejects.toThrow();
    });
  });

  describe("materializeRefill", () => {
    it("for Ultra user with NULL last_grant: grants 1 shield, sets last_grant_at = now", async () => {
      await insertUser("u-refill-1", {
        isUltra: true,
        ultraExpiresAt: null,
        streakShieldsAvailable: 0,
        lastShieldGrantAt: null,
      });
      const now = new Date();
      const result = await repo.materializeRefill("u-refill-1", now);
      expect(result.available).toBe(1);
      expect(result.isUltraActive).toBe(true);
      expect(result.lastGrantAt).toBeInstanceOf(Date);

      // Verify DB updated
      const userRow = await repo.getUserShieldState("u-refill-1");
      expect(userRow?.streakShieldsAvailable).toBe(1);
      expect(userRow?.lastShieldGrantAt).toBeInstanceOf(Date);
    });

    it("for Ultra user with stale (40 days ago) last_grant and 0 shields: grants 1 shield, sets last_grant_at = now", async () => {
      const staleGrant = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      await insertUser("u-refill-2", {
        isUltra: true,
        ultraExpiresAt: null,
        streakShieldsAvailable: 0,
        lastShieldGrantAt: staleGrant,
      });
      const now = new Date();
      const result = await repo.materializeRefill("u-refill-2", now);
      expect(result.available).toBe(1);
      expect(result.isUltraActive).toBe(true);

      const userRow = await repo.getUserShieldState("u-refill-2");
      expect(userRow?.streakShieldsAvailable).toBe(1);
    });

    it("for Ultra user with 1 shield already (regardless of stale grant): NO-op", async () => {
      const staleGrant = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      await insertUser("u-refill-3", {
        isUltra: true,
        ultraExpiresAt: null,
        streakShieldsAvailable: 1,
        lastShieldGrantAt: staleGrant,
      });
      const now = new Date();
      const result = await repo.materializeRefill("u-refill-3", now);
      expect(result.available).toBe(1);

      // lastGrantAt should remain unchanged (staleGrant)
      const userRow = await repo.getUserShieldState("u-refill-3");
      expect(userRow?.streakShieldsAvailable).toBe(1);
    });

    it("for non-Ultra user: NO-op", async () => {
      await insertUser("u-refill-4", {
        isUltra: false,
        streakShieldsAvailable: 0,
        lastShieldGrantAt: null,
      });
      const now = new Date();
      const result = await repo.materializeRefill("u-refill-4", now);
      expect(result.available).toBe(0);
      expect(result.isUltraActive).toBe(false);

      const userRow = await repo.getUserShieldState("u-refill-4");
      expect(userRow?.streakShieldsAvailable).toBe(0);
    });

    it("for Ultra user with 5d-old grant and 0 shields: NO-op (interval not elapsed)", async () => {
      const recentGrant = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      await insertUser("u-refill-5", {
        isUltra: true,
        ultraExpiresAt: null,
        streakShieldsAvailable: 0,
        lastShieldGrantAt: recentGrant,
      });
      const now = new Date();
      const result = await repo.materializeRefill("u-refill-5", now);
      expect(result.available).toBe(0);
      expect(result.isUltraActive).toBe(true);

      const userRow = await repo.getUserShieldState("u-refill-5");
      expect(userRow?.streakShieldsAvailable).toBe(0);
    });

    it("race safety: two sequential calls — second observes freshly-granted state, no double-grant", async () => {
      await insertUser("u-refill-race", {
        isUltra: true,
        ultraExpiresAt: null,
        streakShieldsAvailable: 0,
        lastShieldGrantAt: null,
      });
      const now = new Date();
      // First call grants
      const r1 = await repo.materializeRefill("u-refill-race", now);
      expect(r1.available).toBe(1);

      // Second call — now shields = 1, which is at MAX_STREAK_SHIELDS (1), so no second grant
      const r2 = await repo.materializeRefill("u-refill-race", now);
      expect(r2.available).toBe(1);

      const userRow = await repo.getUserShieldState("u-refill-race");
      expect(userRow?.streakShieldsAvailable).toBe(1);
    });
  });

  describe("listProtectedDates", () => {
    it("returns ISO date strings for the user's protected dates", async () => {
      await insertUser("u-list-1", { streakShieldsAvailable: 1 });

      // Insert a protection row directly
      await db.insert(streakShieldUsage).values({
        userId: "u-list-1",
        protectedDate: "2026-05-09",
      });
      await db.insert(streakShieldUsage).values({
        userId: "u-list-1",
        protectedDate: "2026-05-10",
      });

      const dates = await repo.listProtectedDates("u-list-1");
      expect(dates).toHaveLength(2);
      // Should be ISO YYYY-MM-DD strings
      expect(dates).toContain("2026-05-09");
      expect(dates).toContain("2026-05-10");
    });

    it("returns empty array when no protected dates", async () => {
      await insertUser("u-list-2");
      const dates = await repo.listProtectedDates("u-list-2");
      expect(dates).toEqual([]);
    });
  });
});
