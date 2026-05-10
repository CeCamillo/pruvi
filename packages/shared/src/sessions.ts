import { z } from "zod";

export const sessionStatsSchema = z.object({
  currentStreak: z.number(),
  longestStreak: z.number(),
  totalSessions: z.number(),
});

export type SessionStats = z.infer<typeof sessionStatsSchema>;

/** POST /sessions/start — request body */
export const StartSessionBodySchema = z.object({
  mode: z.enum(["all", "theoretical"]).default("all"),
});

export type StartSessionBody = z.infer<typeof StartSessionBodySchema>;
