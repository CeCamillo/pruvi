import { pgTable, serial, text, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const livesPurchase = pgTable(
  "lives_purchase",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["google_play", "app_store"] }).notNull(),
    transactionId: text("transaction_id").notNull(),
    productId: text("product_id").notNull(),
    livesGranted: integer("lives_granted").notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    providerTxnUq: uniqueIndex("lives_purchase_provider_txn_uq").on(t.provider, t.transactionId),
    userCreatedIdx: index("lives_purchase_user_created_idx").on(t.userId, t.createdAt),
  }),
);
