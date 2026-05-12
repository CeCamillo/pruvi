import { and, asc, eq, sql } from "drizzle-orm";
import type { db as DbClient } from "@pruvi/db";
import { question } from "@pruvi/db/schema/questions";
import { weeklySimulado, weeklySimuladoQuestion } from "@pruvi/db/schema/weekly-simulado";

type Db = typeof DbClient;

export type SimuladoRow = {
  id: number;
  userId: string;
  weekStartDate: string;
  startedAt: Date;
  completedAt: Date | null;
  questionsCount: number;
  correctCount: number;
};

export type SimuladoQuestionRow = {
  position: number;
  questionId: number;
  content: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string | null;
  subjectId: number;
  subtopicId: number;
  requiresCalculation: boolean;
  selectedOptionIndex: number | null;
  isCorrect: boolean | null;
};

export class SimuladosRepository {
  constructor(private db: Db) {}

  /**
   * Deterministic pseudo-random sample of `count` questions for a given
   * (userId, weekStart). Repeatable as long as the bank doesn't change.
   * If bank size < count, returns all available (graceful degradation).
   */
  async selectQuestionsForSimulado(userId: string, weekStart: string, count: number) {
    const seed = `${userId}|${weekStart}`;
    const rows = await this.db
      .select({
        id: question.id,
        subjectId: question.subjectId,
        subtopicId: question.subtopicId,
        content: question.content,
        options: question.options,
        correctOptionIndex: question.correctOptionIndex,
        explanation: question.explanation,
        requiresCalculation: question.requiresCalculation,
      })
      .from(question)
      .orderBy(sql`md5(${question.id}::text || ${seed})`)
      .limit(count);
    return rows;
  }

  /**
   * Idempotent under concurrency: uses INSERT ... ON CONFLICT DO NOTHING
   * RETURNING. If conflict path is taken, re-reads the existing row.
   * Question selection + bulk insert happen inside the same transaction so
   * a simulado is never visible without its question set.
   */
  async startOrGetSimulado(userId: string, weekStart: string, requestedCount: number) {
    return await this.db.transaction(async (tx) => {
      // Attempt insert; ON CONFLICT (user_id, week_start_date) DO NOTHING.
      const selection = await tx
        .select({
          id: question.id,
          subjectId: question.subjectId,
          subtopicId: question.subtopicId,
          content: question.content,
          options: question.options,
          correctOptionIndex: question.correctOptionIndex,
          explanation: question.explanation,
          requiresCalculation: question.requiresCalculation,
        })
        .from(question)
        .orderBy(sql`md5(${question.id}::text || ${`${userId}|${weekStart}`})`)
        .limit(requestedCount);
      const effectiveCount = selection.length;

      const inserted = await tx
        .insert(weeklySimulado)
        .values({ userId, weekStartDate: weekStart, questionsCount: effectiveCount })
        .onConflictDoNothing({ target: [weeklySimulado.userId, weeklySimulado.weekStartDate] })
        .returning();

      if (inserted.length > 0) {
        const simulado = inserted[0]!;
        // Bulk insert question rows.
        if (effectiveCount > 0) {
          await tx.insert(weeklySimuladoQuestion).values(
            selection.map((q, idx) => ({
              simuladoId: simulado.id,
              position: idx,
              questionId: q.id,
            })),
          );
        }
        const questions = selection.map((q, idx) => ({
          position: idx,
          questionId: q.id,
          content: q.content,
          options: q.options as string[],
          correctOptionIndex: q.correctOptionIndex,
          explanation: q.explanation,
          subjectId: q.subjectId,
          subtopicId: q.subtopicId,
          requiresCalculation: q.requiresCalculation,
          selectedOptionIndex: null as number | null,
          isCorrect: null as boolean | null,
        }));
        return { simulado: this.toSimuladoRow(simulado), questions, created: true };
      }

      // Conflict path — re-read existing row + question set (inline; uses tx not this.db so
      // it sees any uncommitted state in this transaction, though in practice the conflict
      // means another committed transaction wrote it).
      const existing = await tx
        .select()
        .from(weeklySimulado)
        .where(and(eq(weeklySimulado.userId, userId), eq(weeklySimulado.weekStartDate, weekStart)))
        .limit(1);
      const simulado = existing[0];
      if (!simulado) throw new Error("startOrGetSimulado: conflict but no existing row");
      const rows = await tx
        .select({
          position: weeklySimuladoQuestion.position,
          questionId: weeklySimuladoQuestion.questionId,
          selectedOptionIndex: weeklySimuladoQuestion.selectedOptionIndex,
          isCorrect: weeklySimuladoQuestion.isCorrect,
          content: question.content,
          options: question.options,
          correctOptionIndex: question.correctOptionIndex,
          explanation: question.explanation,
          subjectId: question.subjectId,
          subtopicId: question.subtopicId,
          requiresCalculation: question.requiresCalculation,
        })
        .from(weeklySimuladoQuestion)
        .innerJoin(question, eq(weeklySimuladoQuestion.questionId, question.id))
        .where(eq(weeklySimuladoQuestion.simuladoId, simulado.id))
        .orderBy(asc(weeklySimuladoQuestion.position));
      const existingQs: SimuladoQuestionRow[] = rows.map((r) => ({
        position: r.position,
        questionId: r.questionId,
        content: r.content,
        options: r.options as string[],
        correctOptionIndex: r.correctOptionIndex,
        explanation: r.explanation,
        subjectId: r.subjectId,
        subtopicId: r.subtopicId,
        requiresCalculation: r.requiresCalculation,
        selectedOptionIndex: r.selectedOptionIndex,
        isCorrect: r.isCorrect,
      }));
      return { simulado: this.toSimuladoRow(simulado), questions: existingQs, created: false };
    });
  }

  private toSimuladoRow(row: typeof weeklySimulado.$inferSelect): SimuladoRow {
    return {
      id: row.id,
      userId: row.userId,
      weekStartDate: typeof row.weekStartDate === "string" ? row.weekStartDate : new Date(row.weekStartDate).toISOString().slice(0, 10),
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      questionsCount: row.questionsCount,
      correctCount: row.correctCount,
    };
  }

  private async fetchQuestionsForSimulado(simuladoId: number): Promise<SimuladoQuestionRow[]> {
    const rows = await this.db
      .select({
        position: weeklySimuladoQuestion.position,
        questionId: weeklySimuladoQuestion.questionId,
        selectedOptionIndex: weeklySimuladoQuestion.selectedOptionIndex,
        isCorrect: weeklySimuladoQuestion.isCorrect,
        content: question.content,
        options: question.options,
        correctOptionIndex: question.correctOptionIndex,
        explanation: question.explanation,
        subjectId: question.subjectId,
        subtopicId: question.subtopicId,
        requiresCalculation: question.requiresCalculation,
      })
      .from(weeklySimuladoQuestion)
      .innerJoin(question, eq(weeklySimuladoQuestion.questionId, question.id))
      .where(eq(weeklySimuladoQuestion.simuladoId, simuladoId))
      .orderBy(asc(weeklySimuladoQuestion.position));
    return rows.map((r) => ({
      position: r.position,
      questionId: r.questionId,
      content: r.content,
      options: r.options as string[],
      correctOptionIndex: r.correctOptionIndex,
      explanation: r.explanation,
      subjectId: r.subjectId,
      subtopicId: r.subtopicId,
      requiresCalculation: r.requiresCalculation,
      selectedOptionIndex: r.selectedOptionIndex,
      isCorrect: r.isCorrect,
    }));
  }
}
