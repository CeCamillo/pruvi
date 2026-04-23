-- Phase 5: onboarding preferences on the user row.
-- Nullable (user may not have onboarded yet); onboarding_completed is the flag
-- the native auth guard uses to decide whether to route into the onboarding stack.

ALTER TABLE "user" ADD COLUMN "selected_exam" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "prep_timeline" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "difficulties" jsonb;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "daily_study_time" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "onboarding_completed" boolean DEFAULT false NOT NULL;
