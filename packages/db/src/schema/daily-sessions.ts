import { relations } from "drizzle-orm";
import { date, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const dailySession = pgTable("daily_session", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  questionsAnswered: integer("questions_answered").notNull().default(0),
  questionsCorrect: integer("questions_correct").notNull().default(0),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dailySessionRelations = relations(dailySession, ({ one }) => ({
  user: one(user, {
    fields: [dailySession.userId],
    references: [user.id],
  }),
}));
