import { relations } from "drizzle-orm";
import { index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const invitationAcceptance = pgTable(
  "invitation_acceptance",
  {
    id: serial("id").primaryKey(),
    inviterId: text("inviter_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    inviteeId: text("invitee_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
    acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
    rewardType: text("reward_type", { enum: ["xp", "shield"] }).notNull().default("xp"),
  },
  (table) => [index("invitation_acceptance_inviter_idx").on(table.inviterId)],
);

export const invitationAcceptanceRelations = relations(invitationAcceptance, ({ one }) => ({
  inviter: one(user, { fields: [invitationAcceptance.inviterId], references: [user.id], relationName: "inviter" }),
  invitee: one(user, { fields: [invitationAcceptance.inviteeId], references: [user.id], relationName: "invitee" }),
}));
