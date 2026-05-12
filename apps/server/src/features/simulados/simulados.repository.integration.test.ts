import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { setupTestDb, cleanupTestDb, teardownTestDb, getTestDb } from "../../test/db-helpers";
import { user } from "@pruvi/db/schema/auth";
import { question } from "@pruvi/db/schema/questions";
import { subject } from "@pruvi/db/schema/subjects";
import { topic, subtopic } from "@pruvi/db/schema/topics";
import { SimuladosRepository } from "./simulados.repository";

describe("SimuladosRepository (integration)", () => {
  const db = getTestDb();
  const repo = new SimuladosRepository(db);

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

  /** Sets up subject/topic/subtopic FK prereqs and inserts `n` questions distributed
   *  across the requested number of subjects. Returns the created subject IDs. */
  async function seedQuestions(n: number, subjectCount = 1): Promise<number[]> {
    const subjects = await db
      .insert(subject)
      .values(Array.from({ length: subjectCount }, (_, i) => ({ name: `S${i + 1}`, slug: `s${i + 1}` })))
      .returning();
    const subtopicsBySubject = new Map<number, number>();
    for (const s of subjects) {
      const [t] = await db
        .insert(topic)
        .values({ subjectId: s.id, name: `T-${s.id}`, slug: `t-${s.id}`, displayOrder: 0 })
        .returning();
      const [st] = await db
        .insert(subtopic)
        .values({ topicId: t!.id, name: `ST-${s.id}`, slug: `st-${s.id}`, displayOrder: 0 })
        .returning();
      subtopicsBySubject.set(s.id, st!.id);
    }
    for (let i = 0; i < n; i++) {
      const subj = subjects[i % subjects.length]!;
      await db.insert(question).values({
        subjectId: subj.id,
        subtopicId: subtopicsBySubject.get(subj.id)!,
        content: `Q${i + 1}`,
        options: ["a", "b", "c", "d"],
        correctOptionIndex: i % 4,
        difficulty: "easy" as const,
        requiresCalculation: false,
      });
    }
    return subjects.map((s) => s.id);
  }

  describe("selectQuestionsForSimulado", () => {
    it("returns deterministic ordering for same (userId, weekStart)", async () => {
      await insertUser("u1");
      await seedQuestions(50);
      const a = await repo.selectQuestionsForSimulado("u1", "2026-05-10", 35);
      const b = await repo.selectQuestionsForSimulado("u1", "2026-05-10", 35);
      expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
      expect(a.length).toBe(35);
      expect(new Set(a.map((q) => q.id)).size).toBe(35);
    });

    it("returns all available when bank is smaller than requested count", async () => {
      await insertUser("u2");
      await seedQuestions(10);
      const a = await repo.selectQuestionsForSimulado("u2", "2026-05-10", 35);
      expect(a.length).toBe(10);
      expect(new Set(a.map((q) => q.id)).size).toBe(10);
    });

    it("returns different ordering for different (userId, weekStart)", async () => {
      await insertUser("u3");
      await seedQuestions(50);
      const a = await repo.selectQuestionsForSimulado("u3", "2026-05-10", 10);
      const b = await repo.selectQuestionsForSimulado("u3", "2026-05-17", 10);
      // Same seed inputs produce different orderings (probabilistic; with 50 questions and 10 picks, collision risk is negligible)
      expect(a.map((q) => q.id)).not.toEqual(b.map((q) => q.id));
    });
  });

  describe("startOrGetSimulado", () => {
    it("creates a new simulado with questions when none exists for (user, week)", async () => {
      await insertUser("u4");
      await seedQuestions(40);
      const { simulado, questions, created } = await repo.startOrGetSimulado("u4", "2026-05-10", 35);
      expect(created).toBe(true);
      expect(simulado.questionsCount).toBe(35);
      expect(simulado.correctCount).toBe(0);
      expect(simulado.completedAt).toBeNull();
      expect(questions.length).toBe(35);
      expect(questions[0]!.position).toBe(0);
      expect(questions[34]!.position).toBe(34);
    });

    it("is idempotent: second call returns the same simulado.id", async () => {
      await insertUser("u5");
      await seedQuestions(40);
      const a = await repo.startOrGetSimulado("u5", "2026-05-10", 35);
      const b = await repo.startOrGetSimulado("u5", "2026-05-10", 35);
      expect(a.simulado.id).toBe(b.simulado.id);
      expect(a.questions.map((q) => q.questionId)).toEqual(b.questions.map((q) => q.questionId));
      expect(b.created).toBe(false);
    });
  });
});
