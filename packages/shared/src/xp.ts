import { z } from "zod";
import type { Difficulty } from "./questions";

export const XP_PER_DIFFICULTY: Record<Difficulty, number> = {
  easy: 10,
  medium: 20,
  hard: 35,
} as const;

/**
 * Cumulative XP thresholds for each level.
 * Level 1 = 0 XP, Level 2 = 100 XP, Level 3 = 350 XP, etc.
 */
export const LEVEL_THRESHOLDS = [
  100, 350, 750, 1400, 2400, 3900, 6000, 9000, 13000, 18500,
] as const;

/** XP awarded for a single answer. 0 if wrong. */
export function calculateXpForAnswer(
  correct: boolean,
  difficulty: Difficulty
): number {
  if (!correct) return 0;
  return XP_PER_DIFFICULTY[difficulty];
}

/** Determine the level for a given total XP amount. */
export function getLevelForXp(totalXp: number): number {
  let level = 1;
  for (const threshold of LEVEL_THRESHOLDS) {
    if (totalXp >= threshold) {
      level += 1;
    } else {
      break;
    }
  }
  return level;
}

/** Calculate XP remaining until next level. */
export function xpForNextLevel(totalXp: number): number {
  for (const threshold of LEVEL_THRESHOLDS) {
    if (totalXp < threshold) {
      return threshold - totalXp;
    }
  }
  return 0; // max level reached
}

/** GET response schema for XP/level endpoint */
export const XpResponseSchema = z.object({
  totalXp: z.number().int().min(0),
  currentLevel: z.number().int().min(1),
  xpForNextLevel: z.number().int().min(0),
});

export type XpResponse = z.infer<typeof XpResponseSchema>;

// ─── Session-completion XP bonus ──────────────────────────────────────────────

export const SESSION_COMPLETION_BASE_XP = 50;
export const SESSION_PER_CORRECT_XP = 5;
export const SESSION_STREAK_MULTIPLIER_THRESHOLD = 7;
export const SESSION_STREAK_MULTIPLIER = 1.10;

export function calculateSessionCompletionXp(
  questionsCorrect: number,
  streakAfter: number,
): { base: number; correctBonus: number; streakMultiplier: number; total: number } {
  const base = SESSION_COMPLETION_BASE_XP;
  const correctBonus = Math.max(0, questionsCorrect) * SESSION_PER_CORRECT_XP;
  const streakMultiplier =
    streakAfter > SESSION_STREAK_MULTIPLIER_THRESHOLD ? SESSION_STREAK_MULTIPLIER : 1;
  const total = Math.floor((base + correctBonus) * streakMultiplier);
  return { base, correctBonus, streakMultiplier, total };
}
