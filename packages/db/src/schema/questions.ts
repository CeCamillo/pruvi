import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
} from "drizzle-orm/pg-core";
import { subject } from "./subjects";

export const question = pgTable(
  "question",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subject.id),
    content: text("content").notNull(),
    options: jsonb("options").notNull().$type<string[]>(),
    correctOptionIndex: integer("correct_option_index").notNull(),
    difficulty: text("difficulty", {
      enum: ["easy", "medium", "hard"],
    }).notNull(),
    requiresCalculation: boolean("requires_calculation")
      .default(false)
      .notNull(),
    source: text("source"),
  },
  (table) => [
    index("question_subject_difficulty_idx").on(
      table.subjectId,
      table.difficulty
    ),
  ]
);

export const questionRelations = relations(question, ({ one }) => ({
  subject: one(subject, {
    fields: [question.subjectId],
    references: [subject.id],
  }),
}));
