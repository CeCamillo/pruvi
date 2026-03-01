import { z } from "zod";

import { questionSchema } from "./questions";

export const publicQuestionSchema = questionSchema.omit({ correctOptionIndex: true });
export type PublicQuestion = z.infer<typeof publicQuestionSchema>;

export const dailySessionSchema = z.object({
  id: z.number(),
  userId: z.string(),
  date: z.string(),
  questionsAnswered: z.number(),
  questionsCorrect: z.number(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type DailySession = z.infer<typeof dailySessionSchema>;

export const startSessionResponseSchema = z.object({
  session: dailySessionSchema,
  questions: z.array(publicQuestionSchema),
});
export type StartSessionResponse = z.infer<typeof startSessionResponseSchema>;

export const completeSessionRequestSchema = z.object({
  questionsAnswered: z.number().int().min(0),
  questionsCorrect: z.number().int().min(0),
});
export type CompleteSessionRequest = z.infer<typeof completeSessionRequestSchema>;

export const sessionStatsSchema = z.object({
  currentStreak: z.number(),
  longestStreak: z.number(),
  totalSessions: z.number(),
});
export type SessionStats = z.infer<typeof sessionStatsSchema>;
