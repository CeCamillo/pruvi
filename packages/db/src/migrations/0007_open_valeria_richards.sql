ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_ultra" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ultra_expires_at" timestamp;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_ultra_expiry_chk') THEN
    ALTER TABLE "user" ADD CONSTRAINT "user_ultra_expiry_chk"
      CHECK ("ultra_expires_at" IS NULL OR "is_ultra" = true);
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_ultra_expiry_idx" ON "user" ("ultra_expires_at") WHERE "is_ultra" = true;
