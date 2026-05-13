import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { setupTestDb, cleanupTestDb, teardownTestDb, getTestDb } from "../../test/db-helpers";
import { user } from "@pruvi/db/schema/auth";
import { eq } from "drizzle-orm";
import { LivesPacksRepository } from "./lives-packs.repository";

describe("LivesPacksRepository (integration)", () => {
  const db = getTestDb();
  const repo = new LivesPacksRepository();

  beforeAll(async () => setupTestDb());
  beforeEach(async () => cleanupTestDb());
  afterAll(async () => teardownTestDb());

  async function insertUser(id: string) {
    await db.insert(user).values({
      id,
      name: `U ${id}`,
      email: `${id}@e.com`,
      emailVerified: false,
      inviteCode: `c${id.replace(/-/g, "").slice(0, 8)}`,
      username: null,
      updatedAt: new Date(),
    });
  }

  it("insertPurchase idempotency: second call with same (provider, transactionId) returns null", async () => {
    await insertUser("u-lp-1");
    const args = {
      userId: "u-lp-1",
      provider: "google_play" as const,
      transactionId: "tok-abc-123",
      productId: "vidas_pack_5",
      livesGranted: 5,
      acknowledgedAt: new Date(),
    };
    const first = await repo.insertPurchase(db, args);
    const second = await repo.insertPurchase(db, args);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(first!.transactionId).toBe("tok-abc-123");
    expect(first!.livesGranted).toBe(5);
  });

  it("findByTxn returns the row after insertion; null when not present", async () => {
    await insertUser("u-lp-2");
    const notFound = await repo.findByTxn(db, "google_play", "tok-not-there");
    expect(notFound).toBeNull();

    await repo.insertPurchase(db, {
      userId: "u-lp-2",
      provider: "google_play",
      transactionId: "tok-lp-2",
      productId: "vidas_pack_20",
      livesGranted: 20,
      acknowledgedAt: null,
    });

    const found = await repo.findByTxn(db, "google_play", "tok-lp-2");
    expect(found).not.toBeNull();
    expect(found!.userId).toBe("u-lp-2");
    expect(found!.productId).toBe("vidas_pack_20");
    expect(found!.livesGranted).toBe(20);
  });

  it("incrementBonusLives increases user.bonus_lives and returns the new total", async () => {
    await insertUser("u-lp-3");
    // Confirm starting value is 0
    const before = await db.select({ bonusLives: user.bonusLives }).from(user).where(eq(user.id, "u-lp-3"));
    expect(before[0]!.bonusLives).toBe(0);

    const after5 = await repo.incrementBonusLives(db, "u-lp-3", 5);
    expect(after5).toBe(5);

    const after20 = await repo.incrementBonusLives(db, "u-lp-3", 20);
    expect(after20).toBe(25);
  });
});
