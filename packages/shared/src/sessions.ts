import { z } from "zod";

export const dailySessionSchema = z.object({
  id: z.number(),
  date: z.string(),
  questionsAnswered: z.number(),
  questionsCorrect: z.number(),
  completedAt: z.string().nullable(),
});

export type DailySession = z.infer<typeof dailySessionSchema>;

export const sessionStatsSchema = z.object({
  currentStreak: z.number(),
  longestStreak: z.number(),
  totalSessions: z.number(),
});

export type SessionStats = z.infer<typeof sessionStatsSchema>;
