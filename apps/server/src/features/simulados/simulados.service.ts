import { ok, err, type Result } from "neverthrow";
import { AppError, NotFoundError, ValidationError, ForbiddenError, ConflictError } from "../../utils/errors";
import {
  SIMULADO_QUESTION_COUNT,
  weekBoundsForSimulado,
  type SimuladoCurrentResponse,
  type SimuladoStartResponse,
  type SimuladoDetailResponse,
  type SimuladoAnswerResponse,
  type SimuladoResultsResponse,
} from "@pruvi/shared";
import type { SimuladosRepository, SimuladoQuestionRow } from "./simulados.repository";
import type { UltraService } from "../ultra/ultra.service";
import type { FastifyBaseLogger } from "fastify";

const HISTORY_LIMIT = 4;

export class SimuladosService {
  constructor(
    private repo: SimuladosRepository,
    private ultra: UltraService,
    private logger?: FastifyBaseLogger,
  ) {}

  /** Strips correctOptionIndex + explanation from questions that haven't been answered
   *  (and the simulado is not completed). Once the simulado is completed, all
   *  questions reveal both fields. */
  private sanitizeQuestions(questions: SimuladoQuestionRow[], simuladoCompleted: boolean) {
    return questions.map((q) => {
      const reveal = simuladoCompleted || q.selectedOptionIndex !== null;
      return {
        position: q.position,
        questionId: q.questionId,
        content: q.content,
        options: q.options,
        subjectId: q.subjectId,
        subtopicId: q.subtopicId,
        requiresCalculation: q.requiresCalculation,
        selectedOptionIndex: q.selectedOptionIndex,
        isCorrect: q.isCorrect,
        correctOptionIndex: reveal ? q.correctOptionIndex : null,
        explanation: reveal ? q.explanation : null,
      };
    });
  }

  async getCurrent(userId: string, now = new Date()): Promise<Result<SimuladoCurrentResponse, AppError>> {
    // Per spec §4 / A9: Ultra check is deferred. A user who started a simulado while Ultra
    // was active retains read access even if Ultra has lapsed. We only enforce ULTRA_REQUIRED
    // when there is NO simulado for the current week (i.e., they'd be requesting a `not_started`
    // view that would normally lead to /start, which IS Ultra-gated).
    const { weekStart, weekEnd } = weekBoundsForSimulado(now);
    const existing = await this.repo.findByUserAndWeek(userId, weekStart);
    const history = await this.repo.listPriorCompletedSimulados(userId, weekStart, HISTORY_LIMIT);
    if (!existing) {
      if (!(await this.ultra.isUltra(userId))) return err(new ForbiddenError("ULTRA_REQUIRED"));
      return ok({ weekStart, weekEnd, status: "not_started", simulado: null, history });
    }
    const status: SimuladoCurrentResponse["status"] = existing.completedAt ? "completed" : "in_progress";
    const answeredCount = await this.repo.countAnswered(existing.id);
    return ok({
      weekStart,
      weekEnd,
      status,
      simulado: {
        id: existing.id,
        startedAt: existing.startedAt.toISOString(),
        completedAt: existing.completedAt?.toISOString() ?? null,
        questionsCount: existing.questionsCount,
        answeredCount,
        correctCount: existing.correctCount,
      },
      history,
    });
  }

  async start(userId: string, now = new Date()): Promise<Result<SimuladoStartResponse, AppError>> {
    if (!(await this.ultra.isUltra(userId))) return err(new ForbiddenError("ULTRA_REQUIRED"));
    const { weekStart } = weekBoundsForSimulado(now);
    const { simulado, questions } = await this.repo.startOrGetSimulado(userId, weekStart, SIMULADO_QUESTION_COUNT);
    return ok({
      simulado: { id: simulado.id, startedAt: simulado.startedAt.toISOString(), questionsCount: simulado.questionsCount },
      questions: questions.map((q) => ({
        position: q.position,
        questionId: q.questionId,
        content: q.content,
        options: q.options,
        subjectId: q.subjectId,
        subtopicId: q.subtopicId,
        requiresCalculation: q.requiresCalculation,
      })),
    });
  }

  // Intentionally NOT gated by ultra.isUltra — see spec §4 A9 (Ultra-lapse mid-simulado).
  async getDetail(simuladoId: number, userId: string): Promise<Result<SimuladoDetailResponse, AppError>> {
    const found = await this.repo.getOneForUser(simuladoId, userId);
    if (!found) return err(new NotFoundError("Simulado not found"));
    const completed = found.simulado.completedAt !== null;
    return ok({
      simulado: {
        id: found.simulado.id,
        weekStart: found.simulado.weekStartDate,
        startedAt: found.simulado.startedAt.toISOString(),
        completedAt: found.simulado.completedAt?.toISOString() ?? null,
        questionsCount: found.simulado.questionsCount,
        answeredCount: found.questions.filter((q) => q.selectedOptionIndex !== null).length,
        correctCount: found.simulado.correctCount,
        status: completed ? "completed" : "in_progress",
      },
      questions: this.sanitizeQuestions(found.questions, completed),
    });
  }

  // Intentionally NOT gated by ultra.isUltra — see spec §4 A9.
  async recordAnswer(
    simuladoId: number,
    userId: string,
    questionId: number,
    selectedOptionIndex: number,
  ): Promise<Result<SimuladoAnswerResponse, AppError>> {
    const r = await this.repo.recordAnswer(simuladoId, userId, questionId, selectedOptionIndex);
    switch (r.kind) {
      case "not_found":
        return err(new NotFoundError("Simulado not found"));
      case "bad_question":
        return err(new ValidationError("Question does not belong to this simulado"));
      case "already_completed":
        return err(new ConflictError("Simulado already completed"));
      case "recorded":
        return ok({
          isCorrect: r.isCorrect,
          correctOptionIndex: r.correctOptionIndex,
          explanation: r.explanation,
          answeredCount: r.answeredCount,
          completed: r.completed,
        });
      case "already_answered":
        return ok({
          isCorrect: r.isCorrect,
          correctOptionIndex: r.correctOptionIndex,
          explanation: r.explanation,
          answeredCount: r.answeredCount,
          completed: r.completed,
        });
    }
  }

  // Intentionally NOT gated by ultra.isUltra — see spec §4 A9.
  async forceComplete(simuladoId: number, userId: string): Promise<Result<{ id: number; completedAt: string }, AppError>> {
    const r = await this.repo.forceComplete(simuladoId, userId);
    if (r.kind === "not_found") return err(new NotFoundError("Simulado not found"));
    return ok({ id: simuladoId, completedAt: r.completedAt.toISOString() });
  }

  // Intentionally NOT gated by ultra.isUltra — see spec §4 A9.
  async getResults(simuladoId: number, userId: string): Promise<Result<SimuladoResultsResponse, AppError>> {
    const found = await this.repo.getOneForUser(simuladoId, userId);
    if (!found) return err(new NotFoundError("Simulado not found"));
    if (!found.simulado.completedAt) return err(new ValidationError("Simulado not yet completed"));
    const agg = await this.repo.getResultsAggregate(simuladoId);
    const history = await this.repo.listPriorCompletedSimulados(userId, found.simulado.weekStartDate, HISTORY_LIMIT);
    return ok({
      weekStart: found.simulado.weekStartDate,
      correct: agg.correct,
      total: agg.total,
      perSubject: agg.perSubject,
      history,
    });
  }
}
