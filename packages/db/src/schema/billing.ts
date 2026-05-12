import { relations, isNull } from "drizzle-orm";
import { index, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const subscription = pgTable(
  "subscription",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    provider: text("provider", { enum: ["google_play", "app_store"] }).notNull(),
    productId: text("product_id").notNull(),
    purchaseToken: text("purchase_token").notNull(),
    status: text("status", {
      enum: ["pending", "active", "in_grace", "on_hold", "paused", "canceled", "expired", "revoked"],
    }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    linkedAt: timestamp("linked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("subscription_provider_token_uq").on(t.provider, t.purchaseToken),
    index("subscription_user_idx").on(t.userId),
    index("subscription_status_idx").on(t.status),
  ],
);

export const billingEvent = pgTable(
  "billing_event",
  {
    id: serial("id").primaryKey(),
    provider: text("provider", { enum: ["google_play", "app_store"] }).notNull(),
    messageId: text("message_id").notNull(),
    eventType: text("event_type").notNull(),
    purchaseToken: text("purchase_token"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processingError: text("processing_error"),
  },
  (t) => [
    uniqueIndex("billing_event_provider_message_uq").on(t.provider, t.messageId),
    index("billing_event_token_idx").on(t.purchaseToken),
    // Partial index — spec §5.2. Speeds up `listUnprocessedEventsForToken` on the
    // link-replay hot path. Without it, that query degrades to a full scan.
    index("billing_event_unprocessed_idx").on(t.processedAt).where(isNull(t.processedAt)),
  ],
);

export const subscriptionRelations = relations(subscription, ({ one }) => ({
  user: one(user, { fields: [subscription.userId], references: [user.id] }),
}));
