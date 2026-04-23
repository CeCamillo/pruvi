import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../test/db-helpers";
import { RoletaRepository } from "./roleta.repository";
import { user } from "@pruvi/db/schema/auth";
import { subject } from "@pruvi/db/schema/subjects";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";

describe("RoletaRepository (integration)", () => {
  const db = getTestDb();
  const repo = new RoletaRepository(db);

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function seedUser(id = "u1") {
    await db.insert(user).values({
      id,
      name: "Test",
      email: `${id}@test.com`,
      emailVerified: false,
      updatedAt: new Date(),
    });
  }

  async function seedSubjectWithQuestions(slug: string, name: string, count: number) {
    const [subj] = await db.insert(subject).values({ slug, name }).returning();
    const values = Array.from({ length: count }, (_, i) => ({
      subjectId: subj!.id,
      body: `${slug}-Q${i + 1}`,
      options: ["a", "b", "c", "d"],
      correctOptionIndex: 0,
      difficulty: 1,
      requiresCalculation: false,
    }));
    await db.insert(question).values(values);
    return subj!;
  }

  describe("getConfig", () => {
    it("returns null when the user has not configured roleta", async () => {
      await seedUser();
      const row = await repo.getConfig("u1");
      expect(row).toBeNull();
    });

    it("returns the stored subjects array when set", async () => {
      await seedUser();
      await repo.saveConfig("u1", ["mat", "bio"]);
      const row = await repo.getConfig("u1");
      expect(row).toEqual(["mat", "bio"]);
    });
  });

  describe("saveConfig", () => {
    it("overwrites prior config", async () => {
      await seedUser();
      await repo.saveConfig("u1", ["mat"]);
      await repo.saveConfig("u1", ["bio", "fis"]);
      expect(await repo.getConfig("u1")).toEqual(["bio", "fis"]);
    });
  });

  describe("listSubjectSlugs", () => {
    it("returns every subject slug in the DB", async () => {
      await seedSubjectWithQuestions("mat", "Matemática", 1);
      await seedSubjectWithQuestions("bio", "Biologia", 1);
      const slugs = await repo.listSubjectSlugs();
      expect(slugs.sort()).toEqual(["bio", "mat"]);
    });
  });

  describe("findSubjectBySlug", () => {
    it("returns the subject row for a known slug", async () => {
      const s = await seedSubjectWithQuestions("mat", "Matemática", 1);
      const row = await repo.findSubjectBySlug("mat");
      expect(row).not.toBeNull();
      expect(row!.id).toBe(s.id);
      expect(row!.slug).toBe("mat");
    });

    it("returns null for an unknown slug", async () => {
      expect(await repo.findSubjectBySlug("ghost")).toBeNull();
    });
  });

  describe("selectRandomQuestions", () => {
    it("returns exactly N questions from the given subject", async () => {
      const s = await seedSubjectWithQuestions("mat", "Matemática", 10);
      const qs = await repo.selectRandomQuestions(s.id, 3);
      expect(qs).toHaveLength(3);
      expect(qs.every((q) => q.subjectId === s.id)).toBe(true);
    });

    it("returns fewer than N when the subject has fewer questions", async () => {
      const s = await seedSubjectWithQuestions("mat", "Matemática", 2);
      const qs = await repo.selectRandomQuestions(s.id, 3);
      expect(qs).toHaveLength(2);
    });

    it("returns an empty array when the subject has no questions", async () => {
      const [subj] = await db
        .insert(subject)
        .values({ slug: "empty", name: "Empty" })
        .returning();
      const qs = await repo.selectRandomQuestions(subj!.id, 3);
      expect(qs).toHaveLength(0);
      expect(Array.isArray(qs)).toBe(true);
    });
  });

  describe("insertRoletaReview", () => {
    it("writes a row with source='roleta' and null nextReviewAt", async () => {
      await seedUser();
      const s = await seedSubjectWithQuestions("mat", "Matemática", 1);
      const [q] = await db
        .select()
        .from(question)
        .where(eq(question.subjectId, s.id))
        .limit(1);

      await repo.insertRoletaReview({
        userId: "u1",
        questionId: q!.id,
        quality: 4,
      });

      const rows = await db
        .select()
        .from(reviewLog)
        .where(eq(reviewLog.userId, "u1"));
      expect(rows).toHaveLength(1);
      expect(rows[0]!.source).toBe("roleta");
      expect(rows[0]!.nextReviewAt).toBeNull();
      expect(rows[0]!.quality).toBe(4);
    });
  });

  describe("awardXp", () => {
    it("increments totalXp on the user row", async () => {
      await seedUser();
      await repo.awardXp("u1", 7);
      await repo.awardXp("u1", 3);
      const rows = await db
        .select({ totalXp: user.totalXp })
        .from(user)
        .where(eq(user.id, "u1"));
      expect(rows[0]!.totalXp).toBe(10);
    });
  });

  describe("findQuestionById", () => {
    it("returns the question with its correct index for grading", async () => {
      const s = await seedSubjectWithQuestions("mat", "Matemática", 1);
      const [q] = await db
        .select()
        .from(question)
        .where(eq(question.subjectId, s.id))
        .limit(1);
      const found = await repo.findQuestionById(q!.id);
      expect(found).not.toBeNull();
      expect(found!.correctOptionIndex).toBe(0);
      expect(found!.difficulty).toBe(1);
    });

    it("returns null for unknown id", async () => {
      expect(await repo.findQuestionById(9999999)).toBeNull();
    });
  });
});
