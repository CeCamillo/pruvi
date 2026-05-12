ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "streak_shields_available" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "last_shield_grant_at" timestamp;
--> statement-breakpoint
-- Drop-and-recreate so the constraint reflects the current bound (per spec v2 §5.3 MAX = 1).
-- Idempotent: IF EXISTS guard handles fresh installs.
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_streak_shields_chk";
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_streak_shields_chk"
  CHECK ("streak_shields_available" >= 0 AND "streak_shields_available" <= 1);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "streak_shield_usage" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "protected_date" date NOT NULL,
  "used_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "streak_shield_usage_user_date_idx" ON "streak_shield_usage" ("user_id", "protected_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "streak_shield_usage_user_idx" ON "streak_shield_usage" ("user_id");
