ALTER TABLE "user" RENAME COLUMN "lives_reset_at" TO "lives_last_regen_at";
--> statement-breakpoint
UPDATE "user"
SET "lives_last_regen_at" = LEAST("lives_last_regen_at", now())
WHERE "lives_last_regen_at" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_lives_chk" CHECK ("lives" BETWEEN 0 AND 5);
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_total_xp_chk" CHECK ("total_xp" >= 0);
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_current_level_chk" CHECK ("current_level" >= 1);