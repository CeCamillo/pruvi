import { z } from "zod";

export const PushPlatformSchema = z.enum(["ios", "android"]);
export type PushPlatform = z.infer<typeof PushPlatformSchema>;

export const RegisterPushTokenBodySchema = z.object({
  token: z.string().regex(/^Expo(nent)?PushToken\[.+\]$/, {
    message: "Invalid Expo push token format",
  }),
  platform: PushPlatformSchema,
});
export type RegisterPushTokenBody = z.infer<typeof RegisterPushTokenBodySchema>;

export const PushTokenResponseSchema = z.object({
  id: z.number().int().positive(),
  token: z.string(),
  platform: PushPlatformSchema,
});

export const NotificationPreferencesSchema = z.object({
  notificationHour: z.number().int().min(0).max(23),
  streakRemindersEnabled: z.boolean(),
  achievementNotificationsEnabled: z.boolean(),
});
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

export const UpdateNotificationPreferencesBodySchema = NotificationPreferencesSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "At least one preference field must be provided" },
);
export type UpdateNotificationPreferencesBody = z.infer<typeof UpdateNotificationPreferencesBodySchema>;
