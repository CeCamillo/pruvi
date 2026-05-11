DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user' AND column_name = 'lives_reset_at'
  ) THEN
    ALTER TABLE "user" RENAME COLUMN "lives_reset_at" TO "lives_last_regen_at";
  END IF;
END $$;
--> statement-breakpoint
UPDATE "user"
SET "lives_last_regen_at" = LEAST("lives_last_regen_at", now())
WHERE "lives_last_regen_at" IS NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_lives_chk') THEN
    ALTER TABLE "user" ADD CONSTRAINT "user_lives_chk" CHECK ("lives" BETWEEN 0 AND 5);
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_total_xp_chk') THEN
    ALTER TABLE "user" ADD CONSTRAINT "user_total_xp_chk" CHECK ("total_xp" >= 0);
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_current_level_chk') THEN
    ALTER TABLE "user" ADD CONSTRAINT "user_current_level_chk" CHECK ("current_level" >= 1);
  END IF;
END $$;
