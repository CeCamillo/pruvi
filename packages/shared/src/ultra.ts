import { z } from "zod";

export const UltraStatusSchema = z.object({
  isUltra: z.boolean(),
  expiresAt: z.string().datetime().nullable(),
});
export type UltraStatus = z.infer<typeof UltraStatusSchema>;

export const GrantUltraBodySchema = z.object({
  expiresAt: z.string().datetime(),
});
export type GrantUltraBody = z.infer<typeof GrantUltraBodySchema>;
