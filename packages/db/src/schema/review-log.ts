import { relations } from "drizzle-orm";
import {
  decimal,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { question } from "./questions";

export const reviewLog = pgTable(
  "review_log",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => question.id),
    quality: integer("quality").notNull(),
    easinessFactor: decimal("easiness_factor", {
      precision: 4,
      scale: 2,
    }).notNull(),
    interval: integer("interval").notNull(),
    repetitions: integer("repetitions").notNull(),
    nextReviewAt: timestamp("next_review_at").notNull(),
    reviewedAt: timestamp("reviewed_at").defaultNow().notNull(),
  },
  (table) => [
    index("review_log_user_next_review_idx").on(
      table.userId,
      table.nextReviewAt
    ),
    index("review_log_user_question_idx").on(table.userId, table.questionId),
  ]
);

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
