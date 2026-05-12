import { relations } from "drizzle-orm";
import { date, index, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const streakShieldUsage = pgTable(
  "streak_shield_usage",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    protectedDate: date("protected_date").notNull(),
    usedAt: timestamp("used_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("streak_shield_usage_user_date_idx").on(table.userId, table.protectedDate),
    index("streak_shield_usage_user_idx").on(table.userId),
  ],
);

export const streakShieldUsageRelations = relations(streakShieldUsage, ({ one }) => ({
  user: one(user, { fields: [streakShieldUsage.userId], references: [user.id] }),
}));
