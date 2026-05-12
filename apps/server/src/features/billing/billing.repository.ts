import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import type { db as DbClient } from "@pruvi/db";
import { subscription, billingEvent } from "@pruvi/db/schema/billing";
import type { BillingProvider, SubscriptionStatus } from "@pruvi/shared";

type Db = typeof DbClient;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

export type SubscriptionRow = {
  id: number;
  userId: string | null;
  provider: BillingProvider;
  productId: string;
  purchaseToken: string;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  linkedAt: Date | null;
};

export type BillingEventRow = {
  id: number;
  provider: BillingProvider;
  messageId: string;
  eventType: string;
  purchaseToken: string | null;
  payload: Record<string, unknown>;
  receivedAt: Date;
  processedAt: Date | null;
  processingError: string | null;
};

export class BillingRepository {
  constructor(private db: Db) {}

  /** Insert audit row with ON CONFLICT DO NOTHING. Returns the row if newly inserted, null on dup. */
  async insertEvent(
    tx: DbOrTx,
    args: { provider: BillingProvider; messageId: string; eventType: string; purchaseToken: string | null; payload: Record<string, unknown> },
  ): Promise<BillingEventRow | null> {
    const inserted = await tx
      .insert(billingEvent)
      .values({
        provider: args.provider,
        messageId: args.messageId,
        eventType: args.eventType,
        purchaseToken: args.purchaseToken,
        payload: args.payload,
      })
      .onConflictDoNothing({ target: [billingEvent.provider, billingEvent.messageId] })
      .returning();
    const row = inserted[0];
    return row ? this.toEvent(row) : null;
  }

  async findSubscriptionByToken(
    tx: DbOrTx,
    provider: BillingProvider,
    token: string,
  ): Promise<SubscriptionRow | null> {
    const rows = await tx
      .select()
      .from(subscription)
      .where(and(eq(subscription.provider, provider), eq(subscription.purchaseToken, token)))
      .limit(1);
    const r = rows[0];
    return r ? this.toSubscription(r) : null;
  }

  /** Create a webhook-orphaned subscription row (user_id null, product_id empty placeholder). */
  async createOrphanSubscription(
    tx: DbOrTx,
    provider: BillingProvider,
    token: string,
  ): Promise<SubscriptionRow> {
    const inserted = await tx
      .insert(subscription)
      .values({ provider, purchaseToken: token, productId: "", status: "pending", userId: null })
      .onConflictDoNothing({ target: [subscription.provider, subscription.purchaseToken] })
      .returning();
    if (inserted[0]) return this.toSubscription(inserted[0]);
    const existing = await this.findSubscriptionByToken(tx, provider, token);
    if (!existing) throw new Error("createOrphanSubscription: conflict but no existing row");
    return existing;
  }

  async upsertLinkedSubscription(
    tx: DbOrTx,
    args: { userId: string; provider: BillingProvider; productId: string; token: string },
  ): Promise<{ subscription: SubscriptionRow; created: boolean }> {
    const now = new Date();
    const inserted = await tx
      .insert(subscription)
      .values({
        provider: args.provider,
        purchaseToken: args.token,
        productId: args.productId,
        status: "pending",
        userId: args.userId,
        linkedAt: now,
      })
      .onConflictDoNothing({ target: [subscription.provider, subscription.purchaseToken] })
      .returning();
    if (inserted[0]) return { subscription: this.toSubscription(inserted[0]), created: true };

    const existing = await this.findSubscriptionByToken(tx, args.provider, args.token);
    if (!existing) throw new Error("upsertLinkedSubscription: conflict but no existing row");
    return { subscription: existing, created: false };
  }

  async claimOrphanSubscription(
    tx: DbOrTx,
    subscriptionId: number,
    userId: string,
    productId: string,
  ): Promise<SubscriptionRow> {
    const now = new Date();
    const updated = await tx
      .update(subscription)
      .set({ userId, productId, linkedAt: now, updatedAt: now })
      .where(and(eq(subscription.id, subscriptionId), isNull(subscription.userId)))
      .returning();
    const row = updated[0];
    if (!row) throw new Error("claimOrphanSubscription: row not found or already claimed");
    return this.toSubscription(row);
  }

  async updateSubscriptionState(
    tx: DbOrTx,
    subscriptionId: number,
    args: { status: SubscriptionStatus; currentPeriodEnd?: Date | null },
  ): Promise<SubscriptionRow> {
    const now = new Date();
    const updates: Record<string, unknown> = { status: args.status, updatedAt: now };
    if (args.currentPeriodEnd !== undefined) updates.currentPeriodEnd = args.currentPeriodEnd;
    const rows = await tx
      .update(subscription)
      .set(updates)
      .where(eq(subscription.id, subscriptionId))
      .returning();
    const r = rows[0];
    if (!r) throw new Error("updateSubscriptionState: not found");
    return this.toSubscription(r);
  }

  async markEventProcessed(
    tx: DbOrTx,
    eventId: number,
    processingError?: string | null,
  ): Promise<void> {
    await tx
      .update(billingEvent)
      .set({ processedAt: new Date(), processingError: processingError ?? null })
      .where(eq(billingEvent.id, eventId));
  }

  async listUnprocessedEventsForToken(
    tx: DbOrTx,
    provider: BillingProvider,
    token: string,
  ): Promise<BillingEventRow[]> {
    const rows = await tx
      .select()
      .from(billingEvent)
      .where(and(eq(billingEvent.provider, provider), eq(billingEvent.purchaseToken, token), isNull(billingEvent.processedAt)))
      .orderBy(asc(billingEvent.receivedAt));
    return rows.map((r) => this.toEvent(r));
  }

  /** True if the user has any OTHER subscription row (excluding this one) in active or in_grace status. */
  async hasOtherActiveSubscription(
    tx: DbOrTx,
    userId: string,
    excludeSubscriptionId: number,
  ): Promise<boolean> {
    const rows = await tx
      .select({ id: subscription.id })
      .from(subscription)
      .where(
        and(
          eq(subscription.userId, userId),
          ne(subscription.id, excludeSubscriptionId),
          sql`${subscription.status} IN ('active','in_grace')`,
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  /** Returns the maximum `current_period_end` across all OTHER active/in_grace subscriptions for this user.
   *  Used by the multi-subscription GRANT guard (spec §7.2): when granting Ultra, we must use
   *  MAX(allActive.currentPeriodEnd) so a short renewal doesn't truncate a longer active plan. */
  async getMaxOtherActivePeriodEnd(
    tx: DbOrTx,
    userId: string,
    excludeSubscriptionId: number,
  ): Promise<Date | null> {
    const rows = await tx
      .select({ end: subscription.currentPeriodEnd })
      .from(subscription)
      .where(
        and(
          eq(subscription.userId, userId),
          ne(subscription.id, excludeSubscriptionId),
          sql`${subscription.status} IN ('active','in_grace')`,
        ),
      );
    let max: Date | null = null;
    for (const r of rows) {
      if (r.end && (!max || r.end > max)) max = r.end;
    }
    return max;
  }

  private toSubscription(r: typeof subscription.$inferSelect): SubscriptionRow {
    return {
      id: r.id,
      userId: r.userId,
      provider: r.provider as BillingProvider,
      productId: r.productId,
      purchaseToken: r.purchaseToken,
      status: r.status as SubscriptionStatus,
      currentPeriodEnd: r.currentPeriodEnd,
      linkedAt: r.linkedAt,
    };
  }

  private toEvent(r: typeof billingEvent.$inferSelect): BillingEventRow {
    return {
      id: r.id,
      provider: r.provider as BillingProvider,
      messageId: r.messageId,
      eventType: r.eventType,
      purchaseToken: r.purchaseToken,
      payload: r.payload as Record<string, unknown>,
      receivedAt: r.receivedAt,
      processedAt: r.processedAt,
      processingError: r.processingError,
    };
  }
}
