import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    RESEND_API_KEY: z.string().min(1),
    RESEND_FROM_EMAIL: z.email(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    APPLE_CLIENT_ID: z.string().optional(),
    APPLE_CLIENT_SECRET: z.string().optional(),
    APPLE_BUNDLE_ID: z.string().optional(),
    EXPO_ACCESS_TOKEN: z.string().optional(),
    ADMIN_API_TOKEN: z.string().min(16).optional(),
    GOOGLE_PLAY_WEBHOOK_TOKEN: z.string().min(16).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
