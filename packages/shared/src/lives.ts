import { z } from "zod";

export const MAX_LIVES = 5;
export const LIVES_RESET_HOURS = 24;

/** GET /users/me/lives — response */
export const LivesResponseSchema = z.object({
  lives: z.number().int().min(0).max(MAX_LIVES),
  maxLives: z.literal(MAX_LIVES),
  resetsAt: z.coerce.date().nullable(),
});

export type LivesResponse = z.infer<typeof LivesResponseSchema>;
