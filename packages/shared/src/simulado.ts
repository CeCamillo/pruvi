import { z } from "zod";
import { BRT_OFFSET_MS } from "./time";

export const SIMULADO_QUESTION_COUNT = 35;

/** Sunday-anchored BRT week bounds. Returns BRT calendar dates as YYYY-MM-DD.
 *  Subtraction is applied before truncation so the returned string is the BRT
 *  calendar date, not the UTC calendar date. */
export function weekBoundsForSimulado(now: Date): { weekStart: string; weekEnd: string } {
  const brtMs = now.getTime() - BRT_OFFSET_MS;
  const brt = new Date(brtMs);
  const dow = brt.getUTCDay(); // 0=Sun..6=Sat
  brt.setUTCDate(brt.getUTCDate() - dow);
  brt.setUTCHours(0, 0, 0, 0);
  const start = new Date(brt);
  const end = new Date(brt);
  end.setUTCDate(end.getUTCDate() + 7);
  return {
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10),
  };
}

const PerSubjectSchema = z.object({
  subjectId: z.number().int(),
  correct: z.number().int(),
  total: z.number().int(),
});

const HistoryEntrySchema = z.object({
  weekStart: z.string(),
  correct: z.number().int(),
  total: z.number().int(),
  perSubject: z.array(PerSubjectSchema),
});

export const SimuladoCurrentResponseSchema = z.object({
  weekStart: z.string(),
  weekEnd: z.string(),
  status: z.enum(["not_started", "in_progress", "completed"]),
  simulado: z
    .object({
      id: z.number().int(),
      startedAt: z.string(),
      completedAt: z.string().nullable(),
      questionsCount: z.number().int(),
      answeredCount: z.number().int(),
      correctCount: z.number().int(),
    })
    .nullable(),
  history: z.array(HistoryEntrySchema),
});
export type SimuladoCurrentResponse = z.infer<typeof SimuladoCurrentResponseSchema>;

export const SimuladoQuestionSchema = z.object({
  position: z.number().int(),
  questionId: z.number().int(),
  content: z.string(),
  options: z.array(z.string()),
  subjectId: z.number().int(),
  subtopicId: z.number().int(),
  requiresCalculation: z.boolean(),
});
export type SimuladoQuestion = z.infer<typeof SimuladoQuestionSchema>;

export const SimuladoStartResponseSchema = z.object({
  simulado: z.object({
    id: z.number().int(),
    startedAt: z.string(),
    questionsCount: z.number().int(),
  }),
  questions: z.array(SimuladoQuestionSchema),
});
export type SimuladoStartResponse = z.infer<typeof SimuladoStartResponseSchema>;

export const SimuladoAnsweredQuestionSchema = SimuladoQuestionSchema.extend({
  selectedOptionIndex: z.number().int().nullable(),
  isCorrect: z.boolean().nullable(),
  correctOptionIndex: z.number().int().nullable(),
  explanation: z.string().nullable(),
});
export type SimuladoAnsweredQuestion = z.infer<typeof SimuladoAnsweredQuestionSchema>;

export const SimuladoDetailResponseSchema = z.object({
  simulado: z.object({
    id: z.number().int(),
    weekStart: z.string(),
    startedAt: z.string(),
    completedAt: z.string().nullable(),
    questionsCount: z.number().int(),
    answeredCount: z.number().int(),
    correctCount: z.number().int(),
    status: z.enum(["in_progress", "completed"]),
  }),
  questions: z.array(SimuladoAnsweredQuestionSchema),
});
export type SimuladoDetailResponse = z.infer<typeof SimuladoDetailResponseSchema>;

export const SimuladoAnswerBodySchema = z.object({
  questionId: z.number().int(),
  selectedOptionIndex: z.number().int().min(0).max(3),
});
export type SimuladoAnswerBody = z.infer<typeof SimuladoAnswerBodySchema>;

export const SimuladoAnswerResponseSchema = z.object({
  isCorrect: z.boolean(),
  correctOptionIndex: z.number().int(),
  explanation: z.string().nullable(),
  answeredCount: z.number().int(),
  completed: z.boolean(),
});
export type SimuladoAnswerResponse = z.infer<typeof SimuladoAnswerResponseSchema>;

export const SimuladoResultsResponseSchema = z.object({
  weekStart: z.string(),
  correct: z.number().int(),
  total: z.number().int(),
  perSubject: z.array(PerSubjectSchema),
  history: z.array(HistoryEntrySchema),
});
export type SimuladoResultsResponse = z.infer<typeof SimuladoResultsResponseSchema>;
