import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const dailySession = pgTable(
  "daily_session",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["active", "completed"],
    })
      .default("active")
      .notNull(),
    questionCount: integer("question_count").default(0).notNull(),
    correctCount: integer("correct_count").default(0).notNull(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("daily_session_user_created_idx").on(table.userId, table.createdAt),
  ]
);

export const dailySessionRelations = relations(dailySession, ({ one }) => ({
  user: one(user, {
    fields: [dailySession.userId],
    references: [user.id],
  }),
}));
