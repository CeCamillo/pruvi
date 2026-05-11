CREATE TABLE "topic" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "topic_subject_slug_uniq" UNIQUE("subject_id","slug")
);
--> statement-breakpoint
CREATE TABLE "subtopic" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subtopic_topic_slug_uniq" UNIQUE("topic_id","slug")
);
--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtopic" ADD CONSTRAINT "subtopic_topic_id_topic_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topic"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "topic_subject_order_idx" ON "topic" USING btree ("subject_id","display_order");--> statement-breakpoint
CREATE INDEX "subtopic_topic_order_idx" ON "subtopic" USING btree ("topic_id","display_order");--> statement-breakpoint
ALTER TABLE "daily_session" ADD COLUMN "mastery_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "subtopic_id" integer;--> statement-breakpoint

INSERT INTO "topic" (subject_id, name, slug, display_order)
SELECT id, 'Geral', 'geral', 0 FROM "subject"
ON CONFLICT (subject_id, slug) DO NOTHING;--> statement-breakpoint

INSERT INTO "subtopic" (topic_id, name, slug, display_order)
SELECT t.id, 'Geral', 'geral', 0
FROM "topic" t
WHERE t.slug = 'geral'
ON CONFLICT (topic_id, slug) DO NOTHING;--> statement-breakpoint

UPDATE "question" q
SET subtopic_id = s.id
FROM "topic" t
JOIN "subtopic" s ON s.topic_id = t.id AND s.slug = 'geral'
WHERE t.subject_id = q.subject_id
  AND t.slug = 'geral'
  AND q.subtopic_id IS NULL;--> statement-breakpoint

ALTER TABLE "question" ALTER COLUMN "subtopic_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "question" ADD CONSTRAINT "question_subtopic_id_subtopic_id_fk" FOREIGN KEY ("subtopic_id") REFERENCES "public"."subtopic"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "question_subtopic_difficulty_idx" ON "question" USING btree ("subtopic_id","difficulty");
