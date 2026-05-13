import { z } from "zod";

export const LIVES_PACK_SKUS = {
  vidas_pack_5: { lives: 5 },
  vidas_pack_20: { lives: 20 },
} as const;
export type LivesPackSku = keyof typeof LIVES_PACK_SKUS;
export const LIVES_PACK_SKU_LIST = Object.keys(LIVES_PACK_SKUS) as LivesPackSku[];

export const LivesPackRedeemBodySchema = z.object({
  provider: z.literal("google_play"),
  purchaseToken: z.string().min(1),
  productId: z.enum(LIVES_PACK_SKU_LIST as [LivesPackSku, ...LivesPackSku[]]),
});
export type LivesPackRedeemBody = z.infer<typeof LivesPackRedeemBodySchema>;

export const LivesPackRedeemResponseSchema = z.object({
  // NOTE: spec §4.2 declares `bonusLivesAdded: z.number().int().positive()` — that is a spec BUG.
  // The idempotency-replay path returns 0, which would fail positive(). Use nonnegative() (plan wins).
  bonusLivesAdded: z.number().int().nonnegative(),
  bonusLivesAfter: z.number().int().nonnegative(),
});
export type LivesPackRedeemResponse = z.infer<typeof LivesPackRedeemResponseSchema>;
