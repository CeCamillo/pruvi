import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../test/db-helpers";
import { QuestionsRepository } from "./questions.repository";
import { user } from "@pruvi/db/schema/auth";
import { subject } from "@pruvi/db/schema/subjects";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";

describe("QuestionsRepository (integration)", () => {
  const db = getTestDb();
  const repo = new QuestionsRepository(db);

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

  /** Seed 2 subjects and 6 questions with varying difficulty/requiresCalculation. */
  async function seedQuestionsData() {
    const [subj1, subj2] = await db
      .insert(subject)
      .values([
        { name: "Math", slug: "math" },
        { name: "Physics", slug: "physics" },
      ])
      .returning();

    const questions = await db
      .insert(question)
      .values([
        // 3 easy (2 theoretical, 1 requires calculation)
        {
          subjectId: subj1.id,
          content: "Easy Q1",
          options: ["A", "B", "C", "D"],
          correctOptionIndex: 0,
          difficulty: "easy" as const,
          requiresCalculation: false,
        },
        {
          subjectId: subj1.id,
          content: "Easy Q2",
          options: ["A", "B", "C", "D"],
          correctOptionIndex: 1,
          difficulty: "easy" as const,
          requiresCalculation: false,
        },
        {
          subjectId: subj2.id,
          content: "Easy Q3 (calc)",
          options: ["A", "B", "C", "D"],
          correctOptionIndex: 2,
          difficulty: "easy" as const,
          requiresCalculation: true,
        },
        // 2 medium (1 theoretical, 1 requires calculation)
        {
          subjectId: subj1.id,
          content: "Medium Q4",
          options: ["A", "B", "C", "D"],
          correctOptionIndex: 0,
          difficulty: "medium" as const,
          requiresCalculation: false,
        },
        {
          subjectId: subj2.id,
          content: "Medium Q5 (calc)",
          options: ["A", "B", "C", "D"],
          correctOptionIndex: 3,
          difficulty: "medium" as const,
          requiresCalculation: true,
        },
        // 1 hard (theoretical)
        {
          subjectId: subj2.id,
          content: "Hard Q6",
          options: ["A", "B", "C", "D"],
          correctOptionIndex: 1,
          difficulty: "hard" as const,
          requiresCalculation: false,
        },
      ])
      .returning();

    return { subjects: [subj1, subj2], questions };
  }

  describe("unseen questions", () => {
    it("returns all questions as unseen when no review_log entries exist", async () => {
      await seedUser();
      const { questions: seeded } = await seedQuestionsData();

      const result = await repo.selectQuestions("test-user-1", 10, "all");

      expect(result).toHaveLength(seeded.length);
      const resultIds = result.map((q) => q.id).sort();
      const seededIds = seeded.map((q) => q.id).sort();
      expect(resultIds).toEqual(seededIds);
    });
  });

  describe("overdue first", () => {
    it("returns overdue questions before unseen ones", async () => {
      await seedUser();
      const { questions: seeded } = await seedQuestionsData();

      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday

      // Mark the first 2 questions as reviewed with nextReviewAt in the past
      await db.insert(reviewLog).values([
        {
          userId: "test-user-1",
          questionId: seeded[0].id,
          quality: 3,
          easinessFactor: "2.50",
          interval: 1,
          repetitions: 1,
          nextReviewAt: pastDate,
          reviewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          userId: "test-user-1",
          questionId: seeded[1].id,
          quality: 4,
          easinessFactor: "2.60",
          interval: 1,
          repetitions: 1,
          nextReviewAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago, more overdue
          reviewedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
      ]);

      const result = await repo.selectQuestions("test-user-1", 10, "all");

      // Overdue questions should come first, most overdue first
      expect(result[0].id).toBe(seeded[1].id); // 2 days overdue
      expect(result[1].id).toBe(seeded[0].id); // 1 day overdue

      // All 6 should still be returned (2 overdue + 4 unseen)
      expect(result).toHaveLength(6);
    });
  });

  describe("mode filter", () => {
    it("excludes requiresCalculation=true questions in theoretical mode", async () => {
      await seedUser();
      await seedQuestionsData();

      const result = await repo.selectQuestions(
        "test-user-1",
        10,
        "theoretical"
      );

      // 6 total, 2 require calculation -> 4 theoretical
      expect(result).toHaveLength(4);
      expect(result.every((q) => q.requiresCalculation === false)).toBe(true);
    });
  });

  describe("limit respected", () => {
    it("returns at most the requested number of questions", async () => {
      await seedUser();
      await seedQuestionsData();

      const result = await repo.selectQuestions("test-user-1", 3, "all");

      expect(result).toHaveLength(3);
    });
  });

  describe("getSubjectSlugForQuestion", () => {
    it("returns the slug of the subject owning the question", async () => {
      const [s] = await db
        .insert(subject)
        .values({ slug: "fisica", name: "Física" })
        .returning();
      const [q] = await db
        .insert(question)
        .values({
          subjectId: s.id,
          body: "q",
          options: ["a", "b", "c", "d"],
          correctOptionIndex: 0,
          difficulty: 3,
        })
        .returning();
      expect(await repo.getSubjectSlugForQuestion(q.id)).toBe("fisica");
    });

    it("returns null for unknown question id", async () => {
      expect(await repo.getSubjectSlugForQuestion(999999)).toBeNull();
    });
  });
});
