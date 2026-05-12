CREATE TABLE "billing_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"message_id" text NOT NULL,
	"event_type" text NOT NULL,
	"purchase_token" text,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_error" text
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"provider" text NOT NULL,
	"product_id" text NOT NULL,
	"purchase_token" text NOT NULL,
	"status" text NOT NULL,
	"current_period_end" timestamp with time zone,
	"linked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_event_provider_message_uq" ON "billing_event" USING btree ("provider","message_id");--> statement-breakpoint
CREATE INDEX "billing_event_token_idx" ON "billing_event" USING btree ("purchase_token");--> statement-breakpoint
CREATE INDEX "billing_event_unprocessed_idx" ON "billing_event" USING btree ("processed_at") WHERE "billing_event"."processed_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_provider_token_uq" ON "subscription" USING btree ("provider","purchase_token");--> statement-breakpoint
CREATE INDEX "subscription_user_idx" ON "subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscription_status_idx" ON "subscription" USING btree ("status");