import { z } from "zod";

/** PUT /users/me/profile — body */
export const UpdateProfileBodySchema = z.object({
  name: z.string().min(1).max(80).optional(),
  image: z.url().nullable().optional(),
});

export type UpdateProfileBody = z.infer<typeof UpdateProfileBodySchema>;

/** PUT /users/me/profile — response */
export const ProfileResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
});

export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;
