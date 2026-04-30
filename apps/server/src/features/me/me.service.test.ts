import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb, teardownTestDb, getTestDb } from "../../test/db-helpers";
import { MeRepository } from "./me.repository";
import { MeService } from "./me.service";
import { computeLastMondayBoundary } from "./me.service";
import { StreaksRepository } from "../streaks/streaks.repository";
import { StreaksService } from "../streaks/streaks.service";
import { LivesRepository } from "../lives/lives.repository";
import { LivesService } from "../lives/lives.service";
import { user } from "@pruvi/db/schema/auth";

describe("MeService.buildBundle", () => {
  let testDb: ReturnType<typeof getTestDb>;
  let service: MeService;

  beforeEach(async () => {
    await setupTestDb();
    testDb = getTestDb();
    service = new MeService(
      new MeRepository(testDb),
      new StreaksService(new StreaksRepository(testDb)),
      new LivesService(new LivesRepository(testDb)),
    );
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function insertUser(overrides: Partial<typeof user.$inferInsert> = {}) {
    const [row] = await testDb
      .insert(user)
      .values({
        id: overrides.id ?? "u1",
        name: overrides.name ?? "Cesar",
        email: overrides.email ?? "u1@test.com",
        emailVerified: false,
        ...overrides,
      })
      .returning();
    return row;
  }

  it("returns the full bundle for a cold user", async () => {
    await insertUser({ id: "u1" });
    const result = await service.buildBundle("u1");
    expect(result.isOk()).toBe(true);
    const bundle = result._unsafeUnwrap();
    expect(bundle).toMatchObject({
      id: "u1",
      name: "Cesar",
      email: "u1@test.com",
      avatarUrl: null,
      plan: "free",
      totalXp: 0,
      weeklyXp: 0,
      currentLevel: 1,
      xpForNextLevel: 100,
      currentStreak: 0,
      longestStreak: 0,
      freezeTokens: 0,
      lives: 5,
      onboardingCompleted: false,
    });
  });

  it("returns xpForNextLevel = 0 at max level", async () => {
    await insertUser({ id: "u1", totalXp: 25000, currentLevel: 11 });
    const bundle = (await service.buildBundle("u1"))._unsafeUnwrap();
    expect(bundle.currentLevel).toBe(11);
    expect(bundle.xpForNextLevel).toBe(0);
  });

  it("self-heals stale weeklyXp when reset_at is older than last Monday boundary", async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await insertUser({
      id: "u1",
      weeklyXp: 500,
      weeklyXpResetAt: eightDaysAgo,
    });
    const bundle = (await service.buildBundle("u1"))._unsafeUnwrap();
    expect(bundle.weeklyXp).toBe(0);
  });

  it("does not self-heal when reset_at is within the current week", async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await insertUser({
      id: "u1",
      weeklyXp: 500,
      weeklyXpResetAt: oneHourAgo,
    });
    const bundle = (await service.buildBundle("u1"))._unsafeUnwrap();
    expect(bundle.weeklyXp).toBe(500);
  });

  it("returns NotFoundError for a missing user", async () => {
    const result = await service.buildBundle("nonexistent");
    expect(result.isErr()).toBe(true);
  });

  it("auto-refills lives when livesResetAt is in the past", async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000);
    await insertUser({ id: "u1", lives: 2, livesResetAt: past });
    const bundle = (await service.buildBundle("u1"))._unsafeUnwrap();
    expect(bundle.lives).toBe(5);
    expect(bundle.livesResetAt).toBeNull();
  });
});

describe("computeLastMondayBoundary", () => {
  it("returns previous Monday 00:00 BRT for a Thursday afternoon", () => {
    // Thursday 2026-04-30 14:30 UTC = 11:30 BRT → boundary Monday 2026-04-27 00:00 BRT = 2026-04-27 03:00 UTC
    const now = new Date("2026-04-30T14:30:00Z");
    const result = computeLastMondayBoundary(now);
    expect(result.toISOString()).toBe("2026-04-27T03:00:00.000Z");
  });

  it("returns previous Monday for a late-Sunday-evening BRT (the previous bug window)", () => {
    // Sunday 2026-04-26 23:00 BRT = Monday 2026-04-27 02:00 UTC
    // BUT in BRT wall-time it's still Sunday — boundary should be Monday 2026-04-20 00:00 BRT = 2026-04-20 03:00 UTC
    const now = new Date("2026-04-27T02:00:00Z");
    const result = computeLastMondayBoundary(now);
    expect(result.toISOString()).toBe("2026-04-20T03:00:00.000Z");
  });

  it("returns the same Monday when called exactly on the boundary", () => {
    // Monday 2026-04-27 00:00 BRT = 2026-04-27 03:00 UTC — same day, same boundary
    const now = new Date("2026-04-27T03:00:00Z");
    const result = computeLastMondayBoundary(now);
    expect(result.toISOString()).toBe("2026-04-27T03:00:00.000Z");
  });
});
