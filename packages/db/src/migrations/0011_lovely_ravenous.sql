ALTER TABLE "user" ADD COLUMN "invite_reward_preference" text DEFAULT 'xp' NOT NULL;--> statement-breakpoint
ALTER TABLE "invitation_acceptance" ADD COLUMN "reward_type" text DEFAULT 'xp' NOT NULL;