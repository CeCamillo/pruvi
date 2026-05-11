import { z } from "zod";

export const UsernameSchema = z.string().regex(/^[a-z0-9_]{3,20}$/, {
  message: "username must be 3-20 chars: lowercase, digits, underscore",
});
export const InviteCodeSchema = z.string().regex(/^[a-z0-9]{8}$/);

export const AcceptInvitationBodySchema = z.object({ code: InviteCodeSchema });
export const RequestFriendBodySchema = z.object({ username: UsernameSchema });
export const RespondRequestBodySchema = z.object({
  action: z.enum(["accept", "decline"]),
});
export const UpdateProfileBodySchema = z.object({ username: UsernameSchema });

export const FriendUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string().nullable(),
  image: z.string().nullable(),
});

export const InviteLinkResponseSchema = z.object({
  code: InviteCodeSchema,
  url: z.string().url(),
});

export const FriendListResponseSchema = z.object({
  friends: z.array(FriendUserSchema),
});

export const FriendRequestSchema = z.object({
  id: z.number().int(),
  from: FriendUserSchema,
  createdAt: z.string().datetime(),
});
export const RequestListResponseSchema = z.object({
  incoming: z.array(FriendRequestSchema),
});

export const RankingEntrySchema = z.object({
  userId: z.string(),
  name: z.string(),
  username: z.string().nullable(),
  image: z.string().nullable(),
  weeklyXp: z.number().int().nonnegative(),
  rank: z.number().int().positive(),
  isMe: z.boolean(),
});
export const RankingResponseSchema = z.object({
  weekStart: z.string().datetime(),
  entries: z.array(RankingEntrySchema).max(10),
});

export type RankingEntry = z.infer<typeof RankingEntrySchema>;
export type FriendUser = z.infer<typeof FriendUserSchema>;
