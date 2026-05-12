import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../test/db-helpers";
import { user } from "@pruvi/db/schema/auth";
import { friendship } from "@pruvi/db/schema/friendship";
import { subject } from "@pruvi/db/schema/subjects";
import { topic, subtopic } from "@pruvi/db/schema/topics";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import { RankingRepository } from "./ranking.repository";

describe("RankingRepository (integration)", () => {
  const db = getTestDb();
  const repo = new RankingRepository(db);

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function insertUser(id: string, opts?: { username?: string; isUltra?: boolean }) {
    await db.insert(user).values({
      id,
      name: `User ${id}`,
      email: `${id}@example.com`,
      emailVerified: false,
      username: opts?.username ?? null,
      isUltra: opts?.isUltra ?? false,
      updatedAt: new Date(),
    });
  }

  async function makeFriendship(aId: string, bId: string) {
    await db.insert(friendship).values({
      requesterId: aId,
      recipientId: bId,
      status: "accepted",
      acceptedAt: new Date(),
    });
  }

  /** Seed a question so review_log rows can be inserted. Returns questionId. */
  async function seedQuestion(): Promise<number> {
    const [subj] = await db
      .insert(subject)
      .values({ name: "Math", slug: "math" })
      .returning();
    const [t] = await db
      .insert(topic)
      .values({
        subjectId: subj!.id,
        name: "Algebra",
        slug: "algebra",
        displayOrder: 0,
      })
      .returning();
    const [st] = await db
      .insert(subtopic)
      .values({
        topicId: t!.id,
        name: "Basics",
        slug: "basics",
        displayOrder: 0,
      })
      .returning();
    const [q] = await db
      .insert(question)
      .values({
        subjectId: subj!.id,
        subtopicId: st!.id,
        content: "1+1?",
        options: ["1", "2", "3", "4"],
        correctOptionIndex: 1,
        difficulty: "easy" as const,
        requiresCalculation: false,
      })
      .returning();
    return q!.id;
  }

  async function insertReviewLog(
    userId: string,
    questionId: number,
    xpEarned: number,
    reviewedAt: Date,
  ) {
    await db.insert(reviewLog).values({
      userId,
      questionId,
      quality: 4,
      easinessFactor: "2.50",
      interval: 1,
      repetitions: 1,
      xpEarned,
      nextReviewAt: new Date(reviewedAt.getTime() + 24 * 60 * 60 * 1000),
      reviewedAt,
    });
  }

  describe("getFriendsRanking", () => {
    it("returns me + 3 friends, sums only current-week XP, excludes non-friend", async () => {
      // Seed users: me, 3 friends, 1 non-friend
      await insertUser("me");
      await insertUser("friend-a");
      await insertUser("friend-b");
      await insertUser("friend-c");
      await insertUser("non-friend");

      // Establish friendships
      await makeFriendship("me", "friend-a");
      await makeFriendship("friend-b", "me");
      await makeFriendship("me", "friend-c");

      const questionId = await seedQuestion();

      // Current week starts Monday 2026-05-11T03:00:00Z (for a Wednesday noon BRT now)
      const weekStart = new Date("2026-05-11T03:00:00.000Z");
      const currentWeekDate = new Date("2026-05-13T10:00:00Z"); // well within current week
      const lastWeekDate = new Date("2026-05-08T10:00:00Z"); // previous week

      // me: 50 XP this week + 20 XP last week (last week should NOT count)
      await insertReviewLog("me", questionId, 50, currentWeekDate);
      await insertReviewLog("me", questionId, 20, lastWeekDate);

      // friend-a: 80 XP this week
      await insertReviewLog("friend-a", questionId, 80, currentWeekDate);

      // friend-b: 30 XP this week
      await insertReviewLog("friend-b", questionId, 30, currentWeekDate);

      // friend-c: no XP this week → should appear with 0
      await insertReviewLog("friend-c", questionId, 40, lastWeekDate);

      // non-friend: 100 XP this week (should be excluded)
      await insertReviewLog("non-friend", questionId, 100, currentWeekDate);

      const rows = await repo.getFriendsRanking("me", weekStart);

      // Should include me + 3 friends = 4 rows
      expect(rows).toHaveLength(4);

      // Non-friend must not appear
      const nonFriendRow = rows.find((r) => r.user_id === "non-friend");
      expect(nonFriendRow).toBeUndefined();

      // All expected users present
      const userIds = rows.map((r) => r.user_id);
      expect(userIds).toContain("me");
      expect(userIds).toContain("friend-a");
      expect(userIds).toContain("friend-b");
      expect(userIds).toContain("friend-c");

      // Correct weekly XP
      const meRow = rows.find((r) => r.user_id === "me")!;
      expect(meRow.weekly_xp).toBe(50); // last week's 20 XP excluded

      const friendARow = rows.find((r) => r.user_id === "friend-a")!;
      expect(friendARow.weekly_xp).toBe(80);

      const friendBRow = rows.find((r) => r.user_id === "friend-b")!;
      expect(friendBRow.weekly_xp).toBe(30);

      const friendCRow = rows.find((r) => r.user_id === "friend-c")!;
      expect(friendCRow.weekly_xp).toBe(0); // only last-week review, not counted

      // Ordering: weekly_xp DESC
      expect(rows[0]!.weekly_xp).toBeGreaterThanOrEqual(rows[1]!.weekly_xp);
      expect(rows[1]!.weekly_xp).toBeGreaterThanOrEqual(rows[2]!.weekly_xp);
      expect(rows[2]!.weekly_xp).toBeGreaterThanOrEqual(rows[3]!.weekly_xp);

      // friend-a (80 XP) is first
      expect(rows[0]!.user_id).toBe("friend-a");
    });

    it("returns only me when I have no friends", async () => {
      await insertUser("solo-me");
      const questionId = await seedQuestion();
      const weekStart = new Date("2026-05-11T03:00:00.000Z");
      await insertReviewLog("solo-me", questionId, 25, new Date("2026-05-12T10:00:00Z"));

      const rows = await repo.getFriendsRanking("solo-me", weekStart);

      expect(rows).toHaveLength(1);
      expect(rows[0]!.user_id).toBe("solo-me");
      expect(rows[0]!.weekly_xp).toBe(25);
    });

    it("returns is_ultra per-row reflecting the user column value", async () => {
      const weekStart = new Date("2026-05-11T03:00:00.000Z");
      const futureDate = new Date("2099-01-01T00:00:00.000Z");

      // me: not Ultra; friend-ultra: Ultra with expiry; friend-regular: not Ultra
      await insertUser("me-ultra-test");
      await insertUser("friend-ultra", { isUltra: true });
      await insertUser("friend-regular");

      // Set ultraExpiresAt on the ultra friend via update
      await db
        .update(user)
        .set({ ultraExpiresAt: futureDate })
        .where(eq(user.id, "friend-ultra"));

      await makeFriendship("me-ultra-test", "friend-ultra");
      await makeFriendship("me-ultra-test", "friend-regular");

      const rows = await repo.getFriendsRanking("me-ultra-test", weekStart);

      expect(rows).toHaveLength(3);

      const meRow = rows.find((r) => r.user_id === "me-ultra-test")!;
      expect(meRow.is_ultra).toBe(false);

      const ultraRow = rows.find((r) => r.user_id === "friend-ultra")!;
      expect(ultraRow.is_ultra).toBe(true);

      const regularRow = rows.find((r) => r.user_id === "friend-regular")!;
      expect(regularRow.is_ultra).toBe(false);
    });
  });
});
