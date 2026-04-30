ALTER TABLE "user" ADD COLUMN "weekly_xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "weekly_xp_reset_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "freeze_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "plan" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "daily_goal_minutes" integer;--> statement-breakpoint

-- Backfill from the legacy text column before dropping it
UPDATE "user" SET "daily_goal_minutes" = CASE "daily_study_time"
  WHEN '30min' THEN 30
  WHEN '1h'    THEN 60
  WHEN '2h'    THEN 120
  WHEN '3h+'   THEN 180
  ELSE NULL
END WHERE "daily_study_time" IS NOT NULL;--> statement-breakpoint

ALTER TABLE "user" DROP COLUMN "daily_study_time";
