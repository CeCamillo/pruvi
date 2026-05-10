import { z } from "zod";

/** GET /streaks — response */
export const StreakResponseSchema = z.object({
  currentStreak: z.number().int().min(0),
  longestStreak: z.number().int().min(0),
  totalSessions: z.number().int().min(0),
});

export type StreakResponse = z.infer<typeof StreakResponseSchema>;
