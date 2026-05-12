import { and, asc, count, desc, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
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

export type RecordAnswerResult =
  | { kind: "recorded"; isCorrect: boolean; correctOptionIndex: number; explanation: string | null; answeredCount: number; completed: boolean }
  | { kind: "already_answered"; isCorrect: boolean; selectedOptionIndex: number; correctOptionIndex: number; explanation: string | null; answeredCount: number; completed: boolean }
  | { kind: "not_found" }
  | { kind: "bad_question" }
  | { kind: "already_completed" };

export type ForceCompleteResult =
  | { kind: "completed"; completedAt: Date }
  | { kind: "not_found" };

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

  /**
   * Race-safe under Read Committed via `SELECT ... FOR UPDATE` on the parent
   * simulado row. Serializes concurrent answers on the same simulado to
   * eliminate auto-completion races. First-answer-wins idempotency on the
   * question row via WHERE selected_option_index IS NULL predicate.
   */
  async recordAnswer(simuladoId: number, userId: string, questionId: number, selectedOptionIndex: number): Promise<RecordAnswerResult> {
    return await this.db.transaction(async (tx) => {
      // 1. Lock parent row using Drizzle's typed .for("update"). Check ownership and completion.
      const lockedRows = await tx
        .select({
          id: weeklySimulado.id,
          userId: weeklySimulado.userId,
          completedAt: weeklySimulado.completedAt,
          correctCount: weeklySimulado.correctCount,
          questionsCount: weeklySimulado.questionsCount,
        })
        .from(weeklySimulado)
        .where(eq(weeklySimulado.id, simuladoId))
        .for("update")
        .limit(1);
      const parent = lockedRows[0];
      if (!parent || parent.userId !== userId) return { kind: "not_found" };
      if (parent.completedAt !== null) return { kind: "already_completed" };

      // 2. Look up the question within this simulado.
      const qRow = await tx
        .select({
          selectedOptionIndex: weeklySimuladoQuestion.selectedOptionIndex,
          isCorrect: weeklySimuladoQuestion.isCorrect,
          correctOptionIndex: question.correctOptionIndex,
          explanation: question.explanation,
        })
        .from(weeklySimuladoQuestion)
        .innerJoin(question, eq(weeklySimuladoQuestion.questionId, question.id))
        .where(and(eq(weeklySimuladoQuestion.simuladoId, simuladoId), eq(weeklySimuladoQuestion.questionId, questionId)))
        .limit(1);
      const qr = qRow[0];
      if (!qr) return { kind: "bad_question" };

      const correctOpt = qr.correctOptionIndex;
      const explanation = qr.explanation;

      // 3. If already answered, return the recorded outcome (first answer wins).
      if (qr.selectedOptionIndex !== null) {
        const answered = await tx
          .select({ value: count() })
          .from(weeklySimuladoQuestion)
          .where(and(eq(weeklySimuladoQuestion.simuladoId, simuladoId), isNotNull(weeklySimuladoQuestion.selectedOptionIndex)));
        return {
          kind: "already_answered",
          isCorrect: qr.isCorrect ?? false,
          selectedOptionIndex: qr.selectedOptionIndex,
          correctOptionIndex: correctOpt,
          explanation,
          answeredCount: Number(answered[0]!.value),
          completed: parent.completedAt !== null,
        };
      }

      // 4. Record the new answer (conditional on IS NULL to be race-safe).
      const isCorrect = selectedOptionIndex === correctOpt;
      await tx
        .update(weeklySimuladoQuestion)
        .set({ selectedOptionIndex, isCorrect, answeredAt: new Date() })
        .where(and(
          eq(weeklySimuladoQuestion.simuladoId, simuladoId),
          eq(weeklySimuladoQuestion.questionId, questionId),
          isNull(weeklySimuladoQuestion.selectedOptionIndex),
        ));

      // 5. Increment correct_count if correct.
      if (isCorrect) {
        await tx
          .update(weeklySimulado)
          .set({ correctCount: sql`${weeklySimulado.correctCount} + 1` })
          .where(eq(weeklySimulado.id, simuladoId));
      }

      // 6. Count remaining unanswered. Because parent is FOR UPDATE-locked, no
      //    other answer transaction can have committed since step 1.
      const unanswered = await tx
        .select({ value: count() })
        .from(weeklySimuladoQuestion)
        .where(and(eq(weeklySimuladoQuestion.simuladoId, simuladoId), isNull(weeklySimuladoQuestion.selectedOptionIndex)));
      const remaining = Number(unanswered[0]!.value);
      let completed = false;
      if (remaining === 0) {
        await tx
          .update(weeklySimulado)
          .set({ completedAt: new Date() })
          .where(and(eq(weeklySimulado.id, simuladoId), isNull(weeklySimulado.completedAt)));
        completed = true;
      }
      const answeredCount = parent.questionsCount - remaining;
      return { kind: "recorded", isCorrect, correctOptionIndex: correctOpt, explanation, answeredCount, completed };
    });
  }

  async forceComplete(simuladoId: number, userId: string): Promise<ForceCompleteResult> {
    const result = await this.db
      .update(weeklySimulado)
      .set({ completedAt: sql`COALESCE(${weeklySimulado.completedAt}, now())` })
      .where(and(eq(weeklySimulado.id, simuladoId), eq(weeklySimulado.userId, userId)))
      .returning({ completedAt: weeklySimulado.completedAt });
    const row = result[0];
    if (!row) return { kind: "not_found" };
    return { kind: "completed", completedAt: row.completedAt! };
  }

  async getOneForUser(simuladoId: number, userId: string): Promise<{ simulado: SimuladoRow; questions: SimuladoQuestionRow[] } | null> {
    const rows = await this.db
      .select()
      .from(weeklySimulado)
      .where(and(eq(weeklySimulado.id, simuladoId), eq(weeklySimulado.userId, userId)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const questions = await this.fetchQuestionsForSimulado(row.id);
    return { simulado: this.toSimuladoRow(row), questions };
  }

  /**
   * Returns up to `limit` most recent COMPLETED simulados strictly BEFORE
   * `currentWeekStart`, ordered oldest first, with per-subject breakdown.
   */
  async listPriorCompletedSimulados(
    userId: string,
    currentWeekStart: string,
    limit: number,
  ): Promise<
    Array<{
      weekStart: string;
      correct: number;
      total: number;
      perSubject: Array<{ subjectId: number; correct: number; total: number }>;
    }>
  > {
    const recent = await this.db
      .select({
        id: weeklySimulado.id,
        weekStartDate: weeklySimulado.weekStartDate,
        correctCount: weeklySimulado.correctCount,
        questionsCount: weeklySimulado.questionsCount,
      })
      .from(weeklySimulado)
      .where(
        and(
          eq(weeklySimulado.userId, userId),
          isNotNull(weeklySimulado.completedAt),
          lt(weeklySimulado.weekStartDate, currentWeekStart),
        ),
      )
      .orderBy(desc(weeklySimulado.weekStartDate))
      .limit(limit);
    if (recent.length === 0) return [];

    const ids = recent.map((r) => r.id);
    const perSubjectRows = await this.db
      .select({
        simuladoId: weeklySimuladoQuestion.simuladoId,
        subjectId: question.subjectId,
        correct: sql<number>`SUM(CASE WHEN ${weeklySimuladoQuestion.isCorrect} = true THEN 1 ELSE 0 END)`,
        total: count(),
      })
      .from(weeklySimuladoQuestion)
      .innerJoin(question, eq(weeklySimuladoQuestion.questionId, question.id))
      .where(inArray(weeklySimuladoQuestion.simuladoId, ids))
      .groupBy(weeklySimuladoQuestion.simuladoId, question.subjectId);

    const bySimulado = new Map<number, Array<{ subjectId: number; correct: number; total: number }>>();
    for (const r of perSubjectRows) {
      const list = bySimulado.get(r.simuladoId) ?? [];
      list.push({ subjectId: r.subjectId, correct: Number(r.correct), total: Number(r.total) });
      bySimulado.set(r.simuladoId, list);
    }

    return recent
      .map((r) => ({
        weekStart: typeof r.weekStartDate === "string" ? r.weekStartDate : new Date(r.weekStartDate).toISOString().slice(0, 10),
        correct: r.correctCount,
        total: r.questionsCount,
        perSubject: bySimulado.get(r.id) ?? [],
      }))
      .reverse(); // oldest first
  }

  /** Per-subject aggregate for a single simulado. */
  async getResultsAggregate(simuladoId: number): Promise<{
    correct: number;
    total: number;
    perSubject: Array<{ subjectId: number; correct: number; total: number }>;
  }> {
    const head = await this.db
      .select({ correctCount: weeklySimulado.correctCount, questionsCount: weeklySimulado.questionsCount })
      .from(weeklySimulado)
      .where(eq(weeklySimulado.id, simuladoId))
      .limit(1);
    const h = head[0];
    if (!h) return { correct: 0, total: 0, perSubject: [] };

    const perSubject = await this.db
      .select({
        subjectId: question.subjectId,
        correct: sql<number>`SUM(CASE WHEN ${weeklySimuladoQuestion.isCorrect} = true THEN 1 ELSE 0 END)`,
        total: count(),
      })
      .from(weeklySimuladoQuestion)
      .innerJoin(question, eq(weeklySimuladoQuestion.questionId, question.id))
      .where(eq(weeklySimuladoQuestion.simuladoId, simuladoId))
      .groupBy(question.subjectId);

    return {
      correct: h.correctCount,
      total: h.questionsCount,
      perSubject: perSubject.map((p) => ({ subjectId: p.subjectId, correct: Number(p.correct), total: Number(p.total) })),
    };
  }

  async findByUserAndWeek(userId: string, weekStart: string): Promise<SimuladoRow | null> {
    const rows = await this.db
      .select()
      .from(weeklySimulado)
      .where(and(eq(weeklySimulado.userId, userId), eq(weeklySimulado.weekStartDate, weekStart)))
      .limit(1);
    const r = rows[0];
    return r ? this.toSimuladoRow(r) : null;
  }

  async countAnswered(simuladoId: number): Promise<number> {
    const res = await this.db
      .select({ value: count() })
      .from(weeklySimuladoQuestion)
      .where(and(eq(weeklySimuladoQuestion.simuladoId, simuladoId), isNotNull(weeklySimuladoQuestion.selectedOptionIndex)));
    return Number(res[0]!.value);
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
