import { z } from "zod";
import { clientQuestionSchema } from "./questions";

// --- Session object as returned by API ---

export const sessionSchema = z.object({
  id: z.number(),
  userId: z.string(),
  date: z.string(),
  questionsAnswered: z.number(),
  questionsCorrect: z.number(),
  completedAt: z.string().nullable(),
});

export type Session = z.infer<typeof sessionSchema>;

// --- POST /sessions/start ---

export const startSessionBodySchema = z.object({
  mode: z.enum(["all", "theoretical"]),
});

export type StartSessionBody = z.infer<typeof startSessionBodySchema>;

export const startSessionResponseSchema = z.object({
  session: sessionSchema,
  questions: z.array(clientQuestionSchema),
});

export type StartSessionResponse = z.infer<typeof startSessionResponseSchema>;

// --- POST /sessions/:id/complete ---

export const completeSessionBodySchema = z.object({
  questionCount: z.number().int().min(0),
  correctCount: z.number().int().min(0),
});

export type CompleteSessionBody = z.infer<typeof completeSessionBodySchema>;

export const completeSessionResponseSchema = z.object({
  session: sessionSchema,
});

export type CompleteSessionResponse = z.infer<typeof completeSessionResponseSchema>;

// --- GET /sessions/today ---

export const todaySessionResponseSchema = z.object({
  session: sessionSchema.nullable(),
});

export type TodaySessionResponse = z.infer<typeof todaySessionResponseSchema>;

// --- GET /streaks (kept for backward compat, duplicates StreakResponseSchema in auth.ts) ---

export const sessionStatsSchema = z.object({
  currentStreak: z.number(),
  longestStreak: z.number(),
  totalSessions: z.number(),
});

export type SessionStats = z.infer<typeof sessionStatsSchema>;
