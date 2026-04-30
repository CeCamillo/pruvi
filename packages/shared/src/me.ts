import { z } from "zod";

export const planSchema = z.enum(["free", "premium"]);
export type Plan = z.infer<typeof planSchema>;

export const meResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().url().nullable(),
  plan: planSchema,

  totalXp: z.number().int().min(0),
  weeklyXp: z.number().int().min(0),
  currentLevel: z.number().int().min(1).max(11),
  xpForNextLevel: z.number().int().min(0),
  currentStreak: z.number().int().min(0),
  longestStreak: z.number().int().min(0),
  freezeTokens: z.number().int().min(0),
  lives: z.number().int().min(0).max(5),
  livesResetAt: z.string().datetime().nullable(),

  selectedExam: z.string().nullable(),
  dailyGoalMinutes: z.number().int().min(30).max(180).nullable(),
  onboardingCompleted: z.boolean(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
