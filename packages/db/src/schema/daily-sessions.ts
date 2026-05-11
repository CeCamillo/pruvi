import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";
import type { MasteryState } from "@pruvi/shared";

export const dailySession = pgTable(
  "daily_session",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["active", "completed"] }).notNull().default("active"),
    questionsAnswered: integer("questions_answered").notNull().default(0),
    questionsCorrect: integer("questions_correct").notNull().default(0),
    masterySnapshot: jsonb("mastery_snapshot").$type<Record<string, MasteryState>>(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("daily_session_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const dailySessionRelations = relations(dailySession, ({ one }) => ({
  user: one(user, {
    fields: [dailySession.userId],
    references: [user.id],
  }),
}));
