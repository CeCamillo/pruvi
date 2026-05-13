CREATE TABLE "lives_purchase" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"transaction_id" text NOT NULL,
	"product_id" text NOT NULL,
	"lives_granted" integer NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "bonus_lives" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lives_purchase" ADD CONSTRAINT "lives_purchase_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lives_purchase_provider_txn_uq" ON "lives_purchase" USING btree ("provider","transaction_id");--> statement-breakpoint
CREATE INDEX "lives_purchase_user_created_idx" ON "lives_purchase" USING btree ("user_id","created_at");