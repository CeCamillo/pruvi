import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

import { subject } from "./subjects";

export const question = pgTable(
  "question",
  {
    id: serial("id").primaryKey(),
    content: text("content").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    correctOptionIndex: integer("correct_option_index").notNull(),
    difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] }).notNull(),
    requiresCalculation: boolean("requires_calculation").notNull().default(false),
    source: text("source"),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subject.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("question_subject_difficulty_idx").on(table.subjectId, table.difficulty),
  ],
);

export const questionRelations = relations(question, ({ one }) => ({
  subject: one(subject, {
    fields: [question.subjectId],
    references: [subject.id],
  }),
}));
