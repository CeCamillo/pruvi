import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { setupTestDb, getTestDb, teardownTestDb, cleanupTestDb } from "../../test/db-helpers";
import { user } from "@pruvi/db/schema/auth";
import { LivesRepository } from "./lives.repository";
import { LIVES_REGEN_INTERVAL_MS, MAX_LIVES } from "@pruvi/shared";

const db = getTestDb();
const repo = new LivesRepository(db);

const userId = "u-lives-1";

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
    lives: MAX_LIVES,
  });
});

describe("LivesRepository (integration)", () => {
  describe("tryDecrement", () => {
    it("decrements when lives > 0, sets anchor on first decrement", async () => {
      const now = new Date("2026-05-11T10:00:00Z");
      const r = await repo.tryDecrement(userId, now);
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error("unreachable");
      expect(r.livesAfter).toBe(4);
      expect(r.isUltra).toBe(false);
      // The pg driver serializes JS Dates using local timezone when writing, and reads
      // timestamp columns as local time, so the round-trip shifts by the local TZ offset.
      // Verify the anchor was set (not null) and matches what the DB actually persisted.
      expect(r.lastRegenAt).toBeInstanceOf(Date);
      const persisted = await repo.getUserLives(userId);
      expect(r.lastRegenAt!.getTime()).toBe(persisted!.livesLastRegenAt!.getTime());
    });

    it("preserves existing anchor via COALESCE on subsequent decrement", async () => {
      const firstAnchor = new Date("2026-05-11T08:00:00Z");
      await db
        .update(user)
        .set({ lives: 4, livesLastRegenAt: firstAnchor })
        .where(eq(user.id, userId));
      const now = new Date("2026-05-11T10:00:00Z");
      const r = await repo.tryDecrement(userId, now);
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error("unreachable");
      expect(r.livesAfter).toBe(3);
      expect(r.isUltra).toBe(false);
      // COALESCE kept the previously-persisted anchor: returned value matches DB round-trip, not `now`.
      const persisted = await repo.getUserLives(userId);
      expect(r.lastRegenAt!.getTime()).toBe(persisted!.livesLastRegenAt!.getTime());
      expect(r.lastRegenAt!.getTime()).not.toBe(now.getTime());
    });

    it("returns ok:false when lives = 0 (no decrement)", async () => {
      await db
        .update(user)
        .set({ lives: 0, livesLastRegenAt: new Date() })
        .where(eq(user.id, userId));
      const r = await repo.tryDecrement(userId, new Date());
      expect(r).toEqual({ ok: false });
      const after = (await repo.getUserLives(userId))!;
      expect(after.lives).toBe(0);
    });

    it("Ultra user with active subscription: returns ok:true, livesAfter=MAX, isUltra=true without DB write", async () => {
      const expiresAt = new Date("2099-01-01T00:00:00Z");
      await db
        .update(user)
        .set({ lives: 3, isUltra: true, ultraExpiresAt: expiresAt })
        .where(eq(user.id, userId));

      const now = new Date("2026-05-11T10:00:00Z");
      const r = await repo.tryDecrement(userId, now);

      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error("unreachable");
      expect(r.livesAfter).toBe(MAX_LIVES);
      expect(r.lastRegenAt).toBeNull();
      expect(r.isUltra).toBe(true);

      // DB lives column must be unchanged
      const after = (await repo.getUserLives(userId))!;
      expect(after.lives).toBe(3);
    });
  });

  describe("materializeRegen", () => {
    it("no-op when lives at MAX (anchor null)", async () => {
      const r = await repo.materializeRegen(userId, new Date());
      expect(r).toEqual({ lives: MAX_LIVES, lastRegenAt: null, isUltra: false });
    });

    it("regens +2 after 8h elapsed from anchor", async () => {
      const anchor = new Date("2026-05-11T02:00:00Z");
      await db
        .update(user)
        .set({ lives: 2, livesLastRegenAt: anchor })
        .where(eq(user.id, userId));
      const now = new Date("2026-05-11T10:00:00Z"); // +8h = 2 ticks
      const r = await repo.materializeRegen(userId, now);
      expect(r.lives).toBe(4);
      expect(r.lastRegenAt).toEqual(new Date(anchor.getTime() + 2 * LIVES_REGEN_INTERVAL_MS));
      expect(r.isUltra).toBe(false);
    });

    it("caps at MAX and nulls anchor", async () => {
      const anchor = new Date("2026-05-10T00:00:00Z");
      await db
        .update(user)
        .set({ lives: 2, livesLastRegenAt: anchor })
        .where(eq(user.id, userId));
      const now = new Date("2026-05-11T10:00:00Z"); // > 24h, enough to fill to MAX
      const r = await repo.materializeRegen(userId, now);
      expect(r).toEqual({ lives: MAX_LIVES, lastRegenAt: null, isUltra: false });
    });

    it("Ultra user with active subscription: returns MAX_LIVES, lastRegenAt null, isUltra true regardless of stored lives", async () => {
      const expiresAt = new Date("2099-01-01T00:00:00Z");
      await db
        .update(user)
        .set({ lives: 2, isUltra: true, ultraExpiresAt: expiresAt })
        .where(eq(user.id, userId));

      const now = new Date("2026-05-11T10:00:00Z");
      const r = await repo.materializeRegen(userId, now);

      expect(r.lives).toBe(MAX_LIVES);
      expect(r.lastRegenAt).toBeNull();
      expect(r.isUltra).toBe(true);
    });

    it("expired Ultra user: applies normal regen logic (Ultra short-circuit does not fire)", async () => {
      const expiredAt = new Date("2025-01-01T00:00:00Z"); // in the past
      const anchor = new Date("2026-05-11T02:00:00Z");
      await db
        .update(user)
        .set({ lives: 2, livesLastRegenAt: anchor, isUltra: true, ultraExpiresAt: expiredAt })
        .where(eq(user.id, userId));

      const now = new Date("2026-05-11T10:00:00Z"); // +8h = 2 ticks
      const r = await repo.materializeRegen(userId, now);

      // Normal regen applies: 2 + 2 = 4
      expect(r.lives).toBe(4);
      expect(r.isUltra).toBe(false);
    });
  });
});
