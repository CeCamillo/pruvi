CREATE TABLE "weekly_simulado" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"week_start_date" date NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"questions_count" integer NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_simulado_question" (
	"simulado_id" integer NOT NULL,
	"position" integer NOT NULL,
	"question_id" integer NOT NULL,
	"selected_option_index" integer,
	"is_correct" boolean,
	"answered_at" timestamp with time zone,
	CONSTRAINT "weekly_simulado_question_simulado_id_position_pk" PRIMARY KEY("simulado_id","position")
);
--> statement-breakpoint
ALTER TABLE "weekly_simulado" ADD CONSTRAINT "weekly_simulado_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_simulado_question" ADD CONSTRAINT "weekly_simulado_question_simulado_id_weekly_simulado_id_fk" FOREIGN KEY ("simulado_id") REFERENCES "public"."weekly_simulado"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_simulado_question" ADD CONSTRAINT "weekly_simulado_question_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_simulado_user_week_uq" ON "weekly_simulado" USING btree ("user_id","week_start_date");--> statement-breakpoint
CREATE INDEX "weekly_simulado_user_week_idx" ON "weekly_simulado" USING btree ("user_id","week_start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_simulado_question_simulado_question_uq" ON "weekly_simulado_question" USING btree ("simulado_id","question_id");--> statement-breakpoint
CREATE INDEX "weekly_simulado_question_simulado_idx" ON "weekly_simulado_question" USING btree ("simulado_id");