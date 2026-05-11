-- 1. User extensions (idempotent)
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "username" text;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "invite_code" text;
--> statement-breakpoint

-- 2. Backfill invite_code for existing users
UPDATE "user"
SET "invite_code" = SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8)
WHERE "invite_code" IS NULL;
--> statement-breakpoint

-- 3. NOT NULL + UNIQUE on the populated columns
ALTER TABLE "user" ALTER COLUMN "invite_code" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "invite_code" SET DEFAULT SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_invite_code_unique') THEN
    ALTER TABLE "user" ADD CONSTRAINT "user_invite_code_unique" UNIQUE ("invite_code");
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_username_unique') THEN
    ALTER TABLE "user" ADD CONSTRAINT "user_username_unique" UNIQUE ("username");
  END IF;
END $$;
--> statement-breakpoint

-- 4. Case-insensitive username search
CREATE INDEX IF NOT EXISTS "user_username_lower_idx"
  ON "user" (LOWER("username")) WHERE "username" IS NOT NULL;
--> statement-breakpoint

-- 5. review_log.xp_earned
ALTER TABLE "review_log" ADD COLUMN IF NOT EXISTS "xp_earned" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_log_xp_earned_chk') THEN
    ALTER TABLE "review_log" ADD CONSTRAINT "review_log_xp_earned_chk" CHECK ("xp_earned" >= 0);
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_log_user_reviewed_idx" ON "review_log" ("user_id", "reviewed_at");
--> statement-breakpoint

-- 6. friendship
CREATE TABLE IF NOT EXISTS "friendship" (
  "id" serial PRIMARY KEY,
  "requester_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "recipient_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "status" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "accepted_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friendship_status_chk') THEN
    ALTER TABLE "friendship" ADD CONSTRAINT "friendship_status_chk" CHECK ("status" IN ('pending','accepted','declined'));
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friendship_no_self_chk') THEN
    ALTER TABLE "friendship" ADD CONSTRAINT "friendship_no_self_chk" CHECK ("requester_id" <> "recipient_id");
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "friendship_pair_idx" ON "friendship"
  (LEAST("requester_id","recipient_id"), GREATEST("requester_id","recipient_id"));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "friendship_requester_idx" ON "friendship" ("requester_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "friendship_recipient_idx" ON "friendship" ("recipient_id");
--> statement-breakpoint

-- 7. invitation_acceptance
CREATE TABLE IF NOT EXISTS "invitation_acceptance" (
  "id" serial PRIMARY KEY,
  "inviter_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "invitee_id" text NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE CASCADE,
  "accepted_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitation_acceptance_inviter_idx" ON "invitation_acceptance" ("inviter_id");
