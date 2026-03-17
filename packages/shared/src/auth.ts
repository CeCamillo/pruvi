import { z } from "zod";

/** POST /questions/:questionId/answer — request body */
export const AnswerQuestionBodySchema = z.object({
  selectedOptionIndex: z.number().int().min(0).max(3),
});

export type AnswerQuestionBody = z.infer<typeof AnswerQuestionBodySchema>;

/** POST /questions/:questionId/answer — response */
export const AnswerQuestionResponseSchema = z.object({
  correct: z.boolean(),
  correctOptionIndex: z.number().int().min(0).max(3),
  livesRemaining: z.number().int().min(0),
  xpAwarded: z.number().int().min(0),
});

export type AnswerQuestionResponse = z.infer<
  typeof AnswerQuestionResponseSchema
>;

/** GET /streaks — response */
export const StreakResponseSchema = z.object({
  currentStreak: z.number().int().min(0),
  longestStreak: z.number().int().min(0),
  totalSessions: z.number().int().min(0),
});

export type StreakResponse = z.infer<typeof StreakResponseSchema>;
