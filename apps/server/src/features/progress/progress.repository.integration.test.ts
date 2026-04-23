import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../test/db-helpers";
import { ProgressRepository } from "./progress.repository";
import { user } from "@pruvi/db/schema/auth";
import { subject } from "@pruvi/db/schema/subjects";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import { dailySession } from "@pruvi/db/schema/daily-sessions";

describe("ProgressRepository (integration)", () => {
  const db = getTestDb();
  const repo = new ProgressRepository(db);

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function seedUser(id: string) {
    await db.insert(user).values({
      id,
      name: id,
      email: `${id}@test.com`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async function seedSubject(slug: string, name: string) {
    const [row] = await db.insert(subject).values({ slug, name }).returning();
    return row!;
  }

  async function seedQuestion(subjectId: number, body: string) {
    const [row] = await db
      .insert(question)
      .values({
        subjectId,
        body,
        options: ["a", "b", "c", "d"],
        correctOptionIndex: 0,
        difficulty: 3,
      })
      .returning();
    return row!;
  }

  async function seedReview(
    userId: string,
    questionId: number,
    quality: number,
    reviewedAt: Date,
  ) {
    await db.insert(reviewLog).values({
      userId,
      questionId,
      quality,
      easinessFactor: "2.50",
      interval: 1,
      repetitions: 1,
      nextReviewAt: new Date(reviewedAt.getTime() + 86400000),
      reviewedAt,
    });
  }

  describe("getProgressForUser", () => {
    it("returns empty array for user with no reviews", async () => {
      await seedUser("u1");
      expect(await repo.getProgressForUser("u1")).toEqual([]);
    });

    it("aggregates totalQuestions and correctCount per subject", async () => {
      await seedUser("u1");
      const sMath = await seedSubject("matematica", "Matemática");
      const q1 = await seedQuestion(sMath.id, "q1");
      const q2 = await seedQuestion(sMath.id, "q2");
      const q3 = await seedQuestion(sMath.id, "q3");
      const now = new Date();
      await seedReview("u1", q1.id, 4, now);
      await seedReview("u1", q2.id, 1, now);
      await seedReview("u1", q3.id, 5, now);

      const result = await repo.getProgressForUser("u1");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        slug: "matematica",
        name: "Matemática",
        totalQuestions: 3,
        correctCount: 2,
      });
    });

    it("orders subjects by most recent activity (DESC)", async () => {
      await seedUser("u1");
      const sA = await seedSubject("a", "A");
      const sB = await seedSubject("b", "B");
      const qA = await seedQuestion(sA.id, "qa");
      const qB = await seedQuestion(sB.id, "qb");
      const older = new Date(Date.now() - 86400000);
      const newer = new Date();
      await seedReview("u1", qA.id, 3, older);
      await seedReview("u1", qB.id, 3, newer);

      const result = await repo.getProgressForUser("u1");
      expect(result.map((r) => r.slug)).toEqual(["b", "a"]);
    });

    it("isolates users — one user's reviews don't appear for another", async () => {
      await seedUser("u1");
      await seedUser("u2");
      const s = await seedSubject("a", "A");
      const q = await seedQuestion(s.id, "qa");
      await seedReview("u1", q.id, 3, new Date());

      expect(await repo.getProgressForUser("u2")).toEqual([]);
    });
  });

  describe("getSubjectReviews", () => {
    it("returns reviews for the given subject slug, newest first, capped", async () => {
      await seedUser("u1");
      const s = await seedSubject("biologia", "Biologia");
      const q1 = await seedQuestion(s.id, "q1 body");
      const q2 = await seedQuestion(s.id, "q2 body");
      const older = new Date(Date.now() - 1000);
      const newer = new Date();
      await seedReview("u1", q1.id, 3, older);
      await seedReview("u1", q2.id, 1, newer);

      const result = await repo.getSubjectReviews("u1", "biologia", 10);
      expect(result).toHaveLength(2);
      expect(result[0]!.questionId).toBe(q2.id);
      expect(result[0]!.quality).toBe(1);
      expect(result[0]!.body).toBe("q2 body");
      expect(result[1]!.questionId).toBe(q1.id);
    });

    it("respects the limit parameter", async () => {
      await seedUser("u1");
      const s = await seedSubject("a", "A");
      for (let i = 0; i < 5; i++) {
        const q = await seedQuestion(s.id, `q${i}`);
        await seedReview("u1", q.id, 3, new Date(Date.now() + i * 1000));
      }
      const result = await repo.getSubjectReviews("u1", "a", 3);
      expect(result).toHaveLength(3);
    });

    it("returns empty array for unknown slug", async () => {
      await seedUser("u1");
      expect(await repo.getSubjectReviews("u1", "nonexistent", 10)).toEqual([]);
    });
  });

  describe("subjectExists", () => {
    it("returns true when slug is present", async () => {
      await seedSubject("a", "A");
      expect(await repo.subjectExists("a")).toBe(true);
    });

    it("returns false when slug is absent", async () => {
      expect(await repo.subjectExists("ghost")).toBe(false);
    });
  });

  describe("getCalendarDates", () => {
    it("returns distinct completed dates in range", async () => {
      await seedUser("u1");
      await db.insert(dailySession).values([
        {
          userId: "u1",
          date: "2026-04-01",
          questionsAnswered: 10,
          questionsCorrect: 8,
          completedAt: new Date(),
        },
        {
          userId: "u1",
          date: "2026-04-15",
          questionsAnswered: 10,
          questionsCorrect: 9,
          completedAt: new Date(),
        },
        {
          userId: "u1",
          date: "2026-04-20",
          questionsAnswered: 5,
          questionsCorrect: 3,
          completedAt: null,
        },
        {
          userId: "u1",
          date: "2026-05-01",
          questionsAnswered: 10,
          questionsCorrect: 10,
          completedAt: new Date(),
        },
      ]);

      const start = "2026-04-01";
      const end = "2026-05-01";
      const result = await repo.getCalendarDates("u1", start, end);
      expect(result).toEqual(["2026-04-01", "2026-04-15"]);
    });

    it("isolates users", async () => {
      await seedUser("u1");
      await seedUser("u2");
      await db.insert(dailySession).values({
        userId: "u1",
        date: "2026-04-01",
        questionsAnswered: 10,
        questionsCorrect: 10,
        completedAt: new Date(),
      });
      const start = "2026-04-01";
      const end = "2026-05-01";
      expect(await repo.getCalendarDates("u2", start, end)).toEqual([]);
    });

    it("excludes sessions outside the requested range (inclusive start, exclusive end)", async () => {
      await seedUser("u1");
      await db.insert(dailySession).values([
        // Day before start — must be excluded
        {
          userId: "u1",
          date: "2026-03-31",
          questionsAnswered: 10,
          questionsCorrect: 10,
          completedAt: new Date(),
        },
        // First day of range — must be included
        {
          userId: "u1",
          date: "2026-04-01",
          questionsAnswered: 10,
          questionsCorrect: 10,
          completedAt: new Date(),
        },
        // Last day of month — must be included
        {
          userId: "u1",
          date: "2026-04-30",
          questionsAnswered: 10,
          questionsCorrect: 10,
          completedAt: new Date(),
        },
        // First day of next month (exclusive end) — must be excluded
        {
          userId: "u1",
          date: "2026-05-01",
          questionsAnswered: 10,
          questionsCorrect: 10,
          completedAt: new Date(),
        },
      ]);
      const result = await repo.getCalendarDates("u1", "2026-04-01", "2026-05-01");
      expect(result).toEqual(["2026-04-01", "2026-04-30"]);
    });
  });
});
