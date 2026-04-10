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
export type Session = z.infer<typeof SessionSchema>;

/** POST /sessions/start — response */
export const StartSessionResponseSchema = z.object({
  session: SessionSchema,
  questions: z.array(QuestionSchema),
});

export type StartSessionResponse = z.infer<typeof StartSessionResponseSchema>;

/** POST /sessions/:id/complete — request body */
export const CompleteSessionBodySchema = z.object({
  questionCount: z.number().int().min(0),
  correctCount: z.number().int().min(0),
});

export type CompleteSessionBody = z.infer<typeof CompleteSessionBodySchema>;

/** POST /sessions/:id/complete — response */
export const CompleteSessionResponseSchema = z.object({
  session: SessionSchema,
});

export type CompleteSessionResponse = z.infer<
  typeof CompleteSessionResponseSchema
>;

/** GET /sessions/today — response (nullable if no session today) */
export const TodaySessionResponseSchema = z.object({
  session: SessionSchema.nullable(),
});

export type TodaySessionResponse = z.infer<typeof TodaySessionResponseSchema>;
