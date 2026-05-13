import { z } from "zod";

/** PUT /users/me/profile — body (name + image fields) */
export const UpdateBasicProfileBodySchema = z.object({
  name: z.string().min(1).max(80).optional(),
  image: z.url().nullable().optional(),
});

export type UpdateBasicProfileBody = z.infer<typeof UpdateBasicProfileBodySchema>;

/** PUT /users/me/profile — response */
export const ProfileResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
});

export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;

/** PATCH /users/me/invite-reward-preference — body */
export const InviteRewardPreferenceBodySchema = z.object({
  preference: z.enum(["xp", "shield"]),
});
export type InviteRewardPreferenceBody = z.infer<typeof InviteRewardPreferenceBodySchema>;

/** PATCH /users/me/invite-reward-preference — response */
export const InviteRewardPreferenceResponseSchema = z.object({
  preference: z.enum(["xp", "shield"]),
});
export type InviteRewardPreferenceResponse = z.infer<typeof InviteRewardPreferenceResponseSchema>;

export const SessionPreferencesSchema = z.object({
  showTimer: z.boolean(),
});
export type SessionPreferences = z.infer<typeof SessionPreferencesSchema>;
export const UpdateSessionPreferencesBodySchema = SessionPreferencesSchema;
