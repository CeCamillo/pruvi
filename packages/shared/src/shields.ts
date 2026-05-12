import { z } from "zod";

export const MAX_STREAK_SHIELDS = 3;
export const SHIELD_REFILL_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

export const ShieldBalanceResponseSchema = z.object({
  available: z.number().int().min(0).max(MAX_STREAK_SHIELDS),
  maxAvailable: z.literal(MAX_STREAK_SHIELDS),
  nextRefillAt: z.string().datetime().nullable(),
});
export type ShieldBalanceResponse = z.infer<typeof ShieldBalanceResponseSchema>;
