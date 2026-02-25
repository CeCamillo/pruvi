import { relations } from "drizzle-orm";
import { integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";

import { question } from "./questions";
import { user } from "./auth";

export const reviewLog = pgTable("review_log", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  questionId: integer("question_id")
    .notNull()
    .references(() => question.id),
  quality: integer("quality").notNull(),
  easeFactor: real("ease_factor").notNull().default(2.5),
  interval: integer("interval").notNull().default(0),
  repetitions: integer("repetitions").notNull().default(0),
  nextReviewAt: timestamp("next_review_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reviewLogRelations = relations(reviewLog, ({ one }) => ({
  user: one(user, {
    fields: [reviewLog.userId],
    references: [user.id],
  }),
  question: one(question, {
    fields: [reviewLog.questionId],
    references: [question.id],
  }),
}));
