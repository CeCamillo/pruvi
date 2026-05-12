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

  describe("recordAnswer", () => {
    it("records first answer, increments correct_count on correct, returns correct outcome", async () => {
      await insertUser("u-ans-1");
      await seedQuestions(35);
      const { simulado, questions } = await repo.startOrGetSimulado("u-ans-1", "2026-05-10", 35);
      const q = questions[0]!;
      const correctOpt = q.correctOptionIndex;
      const result = await repo.recordAnswer(simulado.id, "u-ans-1", q.questionId, correctOpt);
      expect(result.kind).toBe("recorded");
      if (result.kind === "recorded") {
        expect(result.isCorrect).toBe(true);
        expect(result.completed).toBe(false);
        expect(result.answeredCount).toBe(1);
      }
    });

    it("first-answer-wins idempotency: second answer with different option returns original outcome", async () => {
      await insertUser("u-ans-2");
      await seedQuestions(35);
      const { simulado, questions } = await repo.startOrGetSimulado("u-ans-2", "2026-05-10", 35);
      const q = questions[0]!;
      const correctOpt = q.correctOptionIndex;
      const wrongOpt = (correctOpt + 1) % 4;
      await repo.recordAnswer(simulado.id, "u-ans-2", q.questionId, correctOpt);
      const second = await repo.recordAnswer(simulado.id, "u-ans-2", q.questionId, wrongOpt);
      expect(second.kind).toBe("already_answered");
      if (second.kind === "already_answered") {
        expect(second.isCorrect).toBe(true);
        expect(second.selectedOptionIndex).toBe(correctOpt);
      }
    });

    it("auto-completes when the last unanswered question is answered", async () => {
      await insertUser("u-ans-3");
      await seedQuestions(5);
      const { simulado, questions } = await repo.startOrGetSimulado("u-ans-3", "2026-05-10", 5);
      for (let i = 0; i < 4; i++) {
        const q = questions[i]!;
        await repo.recordAnswer(simulado.id, "u-ans-3", q.questionId, q.correctOptionIndex);
      }
      const final = await repo.recordAnswer(simulado.id, "u-ans-3", questions[4]!.questionId, questions[4]!.correctOptionIndex);
      expect(final.kind).toBe("recorded");
      if (final.kind === "recorded") {
        expect(final.completed).toBe(true);
        expect(final.answeredCount).toBe(5);
      }
    });

    it("returns kind='not_found' when simulado doesn't exist or isn't owned by user", async () => {
      await insertUser("u-ans-4a");
      await insertUser("u-ans-4b");
      await seedQuestions(35);
      const { simulado, questions } = await repo.startOrGetSimulado("u-ans-4a", "2026-05-10", 35);
      const result = await repo.recordAnswer(simulado.id, "u-ans-4b", questions[0]!.questionId, 0);
      expect(result.kind).toBe("not_found");
    });

    it("returns kind='bad_question' when questionId doesn't belong to this simulado", async () => {
      await insertUser("u-ans-5");
      await seedQuestions(40);
      const { simulado, questions } = await repo.startOrGetSimulado("u-ans-5", "2026-05-10", 35);
      const includedIds = new Set(questions.map((q) => q.questionId));
      // Find a question NOT in the simulado
      const allQuestions = await db.select({ id: question.id }).from(question);
      const outsider = allQuestions.find((q) => !includedIds.has(q.id))!;
      const result = await repo.recordAnswer(simulado.id, "u-ans-5", outsider.id, 0);
      expect(result.kind).toBe("bad_question");
    });

    it("returns kind='already_completed' when simulado is already finalized", async () => {
      await insertUser("u-ans-6");
      await seedQuestions(35);
      const { simulado, questions } = await repo.startOrGetSimulado("u-ans-6", "2026-05-10", 35);
      await repo.forceComplete(simulado.id, "u-ans-6");
      const result = await repo.recordAnswer(simulado.id, "u-ans-6", questions[0]!.questionId, 0);
      expect(result.kind).toBe("already_completed");
    });
  });

  describe("forceComplete", () => {
    it("sets completed_at when not yet completed", async () => {
      await insertUser("u-fc-1");
      await seedQuestions(35);
      const { simulado } = await repo.startOrGetSimulado("u-fc-1", "2026-05-10", 35);
      const res = await repo.forceComplete(simulado.id, "u-fc-1");
      expect(res.kind).toBe("completed");
      if (res.kind === "completed") expect(res.completedAt).toBeInstanceOf(Date);
    });

    it("is idempotent on already-completed simulado", async () => {
      await insertUser("u-fc-2");
      await seedQuestions(35);
      const { simulado } = await repo.startOrGetSimulado("u-fc-2", "2026-05-10", 35);
      await repo.forceComplete(simulado.id, "u-fc-2");
      const res = await repo.forceComplete(simulado.id, "u-fc-2");
      expect(res.kind).toBe("completed");
    });

    it("returns not_found for unowned simulado", async () => {
      await insertUser("u-fc-3a");
      await insertUser("u-fc-3b");
      await seedQuestions(35);
      const { simulado } = await repo.startOrGetSimulado("u-fc-3a", "2026-05-10", 35);
      const res = await repo.forceComplete(simulado.id, "u-fc-3b");
      expect(res.kind).toBe("not_found");
    });
  });
});
