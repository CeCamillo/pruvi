import { relations } from "drizzle-orm";
import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

import { subject } from "./subjects";

export const question = pgTable("question", {
  id: serial("id").primaryKey(),
  body: text("body").notNull(),
  options: jsonb("options").$type<string[]>().notNull(),
  correctOptionIndex: integer("correct_option_index").notNull(),
  difficulty: integer("difficulty").notNull().default(1),
  source: text("source"),
  subjectId: integer("subject_id")
    .notNull()
    .references(() => subject.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const questionRelations = relations(question, ({ one }) => ({
  subject: one(subject, {
    fields: [question.subjectId],
    references: [subject.id],
  }),
}));
