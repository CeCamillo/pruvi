import { relations } from "drizzle-orm";
import { index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const friendship = pgTable(
  "friendship",
  {
    id: serial("id").primaryKey(),
    requesterId: text("requester_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    recipientId: text("recipient_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "accepted", "declined"] }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at"),
  },
  (table) => [
    index("friendship_requester_idx").on(table.requesterId),
    index("friendship_recipient_idx").on(table.recipientId),
    // Pair-uniqueness via LEAST/GREATEST functional index added in raw migration SQL —
    // Drizzle can't express functional UNIQUE indexes natively. The PGlite mirror gets the
    // same index via raw SQL in test-client.ts.
  ],
);

export const friendshipRelations = relations(friendship, ({ one }) => ({
  requester: one(user, { fields: [friendship.requesterId], references: [user.id], relationName: "requester" }),
  recipient: one(user, { fields: [friendship.recipientId], references: [user.id], relationName: "recipient" }),
}));
