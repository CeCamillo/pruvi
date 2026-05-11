CREATE TABLE "push_token" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"platform" text NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "notification_hour" integer DEFAULT 19 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "streak_reminders_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "achievement_notifications_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "push_token" ADD CONSTRAINT "push_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_token_user_idx" ON "push_token" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_notification_hour_chk" CHECK ("notification_hour" BETWEEN 0 AND 23);