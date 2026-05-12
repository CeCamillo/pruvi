import { z } from "zod";
import { BRT_OFFSET_MS } from "./time";

export const MAX_STREAK_SHIELDS = 1;
/** BRT = UTC-3, no DST (Brazil dropped DST in 2019). */
export const SHIELD_REFILL_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

export const ShieldBalanceResponseSchema = z.object({
  available: z.number().int().min(0).max(MAX_STREAK_SHIELDS),
  maxAvailable: z.literal(MAX_STREAK_SHIELDS),
  nextRefillAt: z.string().datetime().nullable(),
});
export type ShieldBalanceResponse = z.infer<typeof ShieldBalanceResponseSchema>;

export const ShieldUseResultSchema = z.object({
  used: z.boolean(),
  balanceAfter: z.number().int().nullable(),
});
export type ShieldUseResult = z.infer<typeof ShieldUseResultSchema>;

/** Returns the BRT-local YYYY-MM-DD for a given instant. */
export function todayInBrt(now: Date): string {
  const brtMs = now.getTime() - BRT_OFFSET_MS;
  return new Date(brtMs).toISOString().slice(0, 10);
}
