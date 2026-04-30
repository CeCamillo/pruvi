ALTER TABLE "review_log" ALTER COLUMN "next_review_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "roleta_subjects" jsonb;--> statement-breakpoint
ALTER TABLE "review_log" ADD COLUMN "source" text;