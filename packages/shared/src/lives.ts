import { z } from "zod";

export const MAX_LIVES = 5;
export const LIVES_RESET_HOURS = 24;

/** GET /users/me/lives — response */
export const LivesResponseSchema = z.object({
  lives: z.number().int().min(0).max(MAX_LIVES),
  maxLives: z.literal(MAX_LIVES),
  resetsAt: z.coerce.date().nullable(),
  unlimited: z.boolean(),
});

export type LivesResponse = z.infer<typeof LivesResponseSchema>;

export const LIVES_REGEN_INTERVAL_MS = 4 * 60 * 60 * 1000;

export function computeRegenSnapshot(
  lives: number,
  lastRegenAt: Date | null,
  now: Date,
): { lives: number; lastRegenAt: Date | null; regenerated: number } {
  if (lives >= MAX_LIVES) {
    return { lives: MAX_LIVES, lastRegenAt: null, regenerated: 0 };
  }
  if (lastRegenAt === null) {
    return { lives, lastRegenAt: now, regenerated: 0 };
  }
  const elapsed = Math.max(0, now.getTime() - lastRegenAt.getTime());
  const ticks = Math.floor(elapsed / LIVES_REGEN_INTERVAL_MS);
  const regenerated = Math.min(ticks, MAX_LIVES - lives);
  if (regenerated === 0) {
    return { lives, lastRegenAt, regenerated: 0 };
  }
  const newLives = lives + regenerated;
  const newAnchor =
    newLives >= MAX_LIVES
      ? null
      : new Date(lastRegenAt.getTime() + regenerated * LIVES_REGEN_INTERVAL_MS);
  return { lives: newLives, lastRegenAt: newAnchor, regenerated };
}

export function nextRegenAt(
  lives: number,
  lastRegenAt: Date | null,
): Date | null {
  if (lives >= MAX_LIVES) return null;
  if (lastRegenAt === null) return null;
  return new Date(lastRegenAt.getTime() + LIVES_REGEN_INTERVAL_MS);
}
