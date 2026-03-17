import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../test/db-helpers";
import { ReviewsRepository } from "./reviews.repository";
import { user } from "@pruvi/db/schema/auth";
import { subject } from "@pruvi/db/schema/subjects";
import { question } from "@pruvi/db/schema/questions";
import { eq } from "drizzle-orm";

describe("ReviewsRepository (integration)", () => {
  const db = getTestDb();
  const repo = new ReviewsRepository(db);

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function seedUser(id = "test-user-1") {
    await db.insert(user).values({
      id,
      name: "Test",
      email: `${id}@test.com`,
      emailVerified: false,
      updatedAt: new Date(),
    });
  }

  async function seedQuestion() {
    const [subj] = await db
      .insert(subject)
      .values({ name: "Math", slug: "math" })
      .returning();

    const [q] = await db
      .insert(question)
      .values({
        subjectId: subj.id,
        content: "What is 2+2?",
        options: ["3", "4", "5", "6"],
        correctOptionIndex: 1,
        difficulty: "easy" as const,
        requiresCalculation: false,
      })
      .returning();

    return q;
  }

  describe("insertReview + findLatestReview", () => {
    it("returns the most recent review for a user+question pair", async () => {
      await seedUser();
      const q = await seedQuestion();

      const olderDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const newerDate = new Date();

      await repo.insertReview({
        userId: "test-user-1",
        questionId: q.id,
        quality: 3,
        easinessFactor: "2.50",
        interval: 1,
        repetitions: 1,
        nextReviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // Small delay to ensure different reviewedAt timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      await repo.insertReview({
        userId: "test-user-1",
        questionId: q.id,
        quality: 5,
        easinessFactor: "2.70",
        interval: 6,
        repetitions: 2,
        nextReviewAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      });

      const latest = await repo.findLatestReview("test-user-1", q.id);

      expect(latest).not.toBeNull();
      expect(latest!.quality).toBe(5);
      expect(latest!.easinessFactor).toBe("2.70");
      expect(latest!.interval).toBe(6);
      expect(latest!.repetitions).toBe(2);
    });

    it("returns null when no review exists", async () => {
      await seedUser();
      const q = await seedQuestion();

      const latest = await repo.findLatestReview("test-user-1", q.id);

      expect(latest).toBeNull();
    });
  });

  describe("awardXp", () => {
    it("increments totalXp correctly across multiple awards", async () => {
      await seedUser();

      // Verify starting XP is 0
      const before = await db
        .select({ totalXp: user.totalXp })
        .from(user)
        .where(eq(user.id, "test-user-1"));
      expect(before[0].totalXp).toBe(0);

      await repo.awardXp("test-user-1", 10);

      const after1 = await db
        .select({ totalXp: user.totalXp })
        .from(user)
        .where(eq(user.id, "test-user-1"));
      expect(after1[0].totalXp).toBe(10);

      await repo.awardXp("test-user-1", 20);

      const after2 = await db
        .select({ totalXp: user.totalXp })
        .from(user)
        .where(eq(user.id, "test-user-1"));
      expect(after2[0].totalXp).toBe(30);
    });
  });

  describe("decrementLives + resetLives", () => {
    it("decrements lives and resets them to max", async () => {
      await seedUser();

      // Default lives should be 5
      const initial = await repo.getUserLives("test-user-1");
      expect(initial).not.toBeNull();
      expect(initial!.lives).toBe(5);

      // Decrement from 5 to 4 (setResetAt = true since going below max for first time)
      await repo.decrementLives("test-user-1", 5, true);

      const afterDecrement = await repo.getUserLives("test-user-1");
      expect(afterDecrement!.lives).toBe(4);
      expect(afterDecrement!.livesResetAt).toBeInstanceOf(Date);

      // Reset lives back to MAX_LIVES (5)
      await repo.resetLives("test-user-1");

      const afterReset = await repo.getUserLives("test-user-1");
      expect(afterReset!.lives).toBe(5);
      expect(afterReset!.livesResetAt).toBeNull();
    });
  });
});
