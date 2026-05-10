ALTER TABLE "user" ADD COLUMN "selected_exam" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "exam_date" date;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "difficulties" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "daily_study_time_minutes" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "onboarding_completed" boolean DEFAULT false NOT NULL;