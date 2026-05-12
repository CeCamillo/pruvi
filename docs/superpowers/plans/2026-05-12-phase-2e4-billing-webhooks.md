# Phase 2E.4 — Google Play Billing Webhooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Each task gets Gate C (Opus 4.7 per-task review). Final Gate D before PR.

**Goal:** Wire Google Play Real-Time Developer Notifications into the existing Ultra entitlement so subscription purchases, renewals, and revocations grant/revoke Ultra automatically. Includes parked-event replay for the pre-link race.

**Architecture:** New `billing` feature module under `apps/server/src/features/`. Two new tables (`subscription`, `billing_event`). Pure decoder + repository + service split. Shared `applyDecodedEvent(decoded, subscription, tx)` state-machine function used by both the webhook handler and the link-time replay loop. Multi-subscription revoke guard before calling `UltraService.revoke`. New optional env var `GOOGLE_PLAY_WEBHOOK_TOKEN`.

**Tech Stack:** Drizzle ORM + drizzle-kit, Fastify 5 + fastify-type-provider-zod on Bun, neverthrow Result, real Postgres for integration tests.

**Authoritative spec:** `docs/superpowers/specs/2026-05-12-phase-2e4-billing-webhooks-design.md` (v2 post Gate A).

---

## Task 1 — Env, shared schemas, notification-type enum

**Files:**
- Modify: `packages/env/src/server.ts`
- Create: `packages/shared/src/billing.ts`
- Create: `packages/shared/src/billing.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1.1: Add `GOOGLE_PLAY_WEBHOOK_TOKEN` to env**

In `packages/env/src/server.ts`, add inside the `server: {...}` block after `ADMIN_API_TOKEN`:

```ts
    GOOGLE_PLAY_WEBHOOK_TOKEN: z.string().min(16).optional(),
```

- [ ] **Step 1.2: Create the shared billing module**

Create `packages/shared/src/billing.ts`:

```ts
import { z } from "zod";

export const BILLING_PROVIDERS = ["google_play", "app_store"] as const;
export type BillingProvider = (typeof BILLING_PROVIDERS)[number];

export const SUBSCRIPTION_STATUSES = [
  "pending",
  "active",
  "in_grace",
  "on_hold",
  "paused",
  "canceled",
  "expired",
  "revoked",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Conservative default expiry when the webhook payload doesn't carry expiryTimeMillis. */
export const DEFAULT_SUBSCRIPTION_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/** Mapping from Google Play RTDN notificationType integer → name. Values not listed
 *  are decoded as { kind: "unknown" } and result in no state mutation. */
export const GOOGLE_PLAY_NOTIFICATION_TYPES = {
  1: "RECOVERED",
  2: "RENEWED",
  3: "CANCELED",
  4: "PURCHASED",
  5: "ON_HOLD",
  6: "IN_GRACE_PERIOD",
  7: "RESTARTED",
  8: "PRICE_CHANGE_CONFIRMED",
  9: "DEFERRED",
  10: "PAUSED",
  11: "PAUSE_SCHEDULE_CHANGED",
  12: "REVOKED",
  13: "EXPIRED",
  17: "ITEMS_CHANGED",
  18: "CANCELLATION_SCHEDULED",
  19: "PRICE_CHANGE_UPDATED",
  20: "PENDING_PURCHASE_CANCELED",
  22: "PRICE_STEP_UP_CONSENT_UPDATED",
} as const;
export type GooglePlayNotificationTypeName =
  (typeof GOOGLE_PLAY_NOTIFICATION_TYPES)[keyof typeof GOOGLE_PLAY_NOTIFICATION_TYPES];

export const GooglePlayLinkBodySchema = z.object({
  purchaseToken: z.string().min(1),
  productId: z.string().min(1),
});
export type GooglePlayLinkBody = z.infer<typeof GooglePlayLinkBodySchema>;

export const GooglePlayLinkResponseSchema = z.object({
  subscription: z.object({
    id: z.number().int(),
    status: z.enum(SUBSCRIPTION_STATUSES),
    productId: z.string(),
    currentPeriodEnd: z.string().nullable(),
  }),
});
export type GooglePlayLinkResponse = z.infer<typeof GooglePlayLinkResponseSchema>;
```

- [ ] **Step 1.3: Failing tests**

Create `packages/shared/src/billing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  BILLING_PROVIDERS,
  SUBSCRIPTION_STATUSES,
  GOOGLE_PLAY_NOTIFICATION_TYPES,
  GooglePlayLinkBodySchema,
  DEFAULT_SUBSCRIPTION_PERIOD_MS,
} from "./billing";

describe("billing shared module", () => {
  it("declares the v1 providers", () => {
    expect(BILLING_PROVIDERS).toEqual(["google_play", "app_store"]);
  });

  it("declares all 8 subscription statuses", () => {
    expect(SUBSCRIPTION_STATUSES).toHaveLength(8);
    expect(SUBSCRIPTION_STATUSES).toContain("pending");
    expect(SUBSCRIPTION_STATUSES).toContain("active");
    expect(SUBSCRIPTION_STATUSES).toContain("expired");
  });

  it("maps Google Play notificationType integers to enum names", () => {
    expect(GOOGLE_PLAY_NOTIFICATION_TYPES[4]).toBe("PURCHASED");
    expect(GOOGLE_PLAY_NOTIFICATION_TYPES[13]).toBe("EXPIRED");
    expect(GOOGLE_PLAY_NOTIFICATION_TYPES[18]).toBe("CANCELLATION_SCHEDULED");
  });

  it("DEFAULT_SUBSCRIPTION_PERIOD_MS is 30 days", () => {
    expect(DEFAULT_SUBSCRIPTION_PERIOD_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("validates link body shape", () => {
    expect(GooglePlayLinkBodySchema.safeParse({ purchaseToken: "t", productId: "pruvi_ultra_monthly" }).success).toBe(true);
    expect(GooglePlayLinkBodySchema.safeParse({ purchaseToken: "", productId: "x" }).success).toBe(false);
  });
});
```

- [ ] **Step 1.4: Re-export**

In `packages/shared/src/index.ts`, append:
```ts
export * from "./billing";
```

- [ ] **Step 1.5: Run tests, commit**

```bash
cd packages/shared && bun test src/billing.test.ts
```
Expected: 5 pass.

```bash
git add packages/env/src/server.ts packages/shared/src/billing.ts packages/shared/src/billing.test.ts packages/shared/src/index.ts
git commit -m "feat(shared,env): billing module — providers, statuses, google play notification types, link schemas"
```

---

## Task 2 — DB schema + migration + test cleanup

**Files:**
- Create: `packages/db/src/schema/billing.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/migrations/0010_<generated>.sql` (auto-named)
- Create: `packages/db/src/migrations/meta/0010_snapshot.json`
- Modify: `packages/db/src/migrations/meta/_journal.json`
- Modify: `apps/server/src/test/db-helpers.ts`

- [ ] **Step 2.1: Define schema**

Create `packages/db/src/schema/billing.ts`:

```ts
import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
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
  ],
);

export const subscriptionRelations = relations(subscription, ({ one }) => ({
  user: one(user, { fields: [subscription.userId], references: [user.id] }),
}));
```

- [ ] **Step 2.2: Register in schema index**

In `packages/db/src/schema/index.ts`, add:
```ts
export * from "./billing";
```

- [ ] **Step 2.3: Generate migration**

```bash
cd /Users/cesarcamillo/dev/pruvi && pnpm -F db db:generate
```

(If the package script name differs, check `packages/db/package.json`.) Verify the generated `0010_*.sql` contains both tables with the expected constraints (CHECK for provider + status enums, UNIQUE indexes, ON DELETE SET NULL for user_id). If unrelated diffs appear, STOP and report BLOCKED.

- [ ] **Step 2.4: Update `cleanupTestDb`**

In `apps/server/src/test/db-helpers.ts`, modify the `cleanupTestDb` TRUNCATE list to include the new tables. The current list (after Phase 2E.3) is:
```sql
TRUNCATE TABLE weekly_simulado_question, weekly_simulado, push_token, review_log, daily_session,
  streak_shield_usage, question, subtopic, topic, subject,
  account, session, verification, "user" CASCADE
```

Add `billing_event, subscription,` at the front (children-first ordering; both have CASCADE/SET NULL but explicit listing prevents UNIQUE pollution):

```sql
TRUNCATE TABLE billing_event, subscription,
  weekly_simulado_question, weekly_simulado, push_token, review_log, daily_session,
  streak_shield_usage, question, subtopic, topic, subject,
  account, session, verification, "user" CASCADE
```

- [ ] **Step 2.5: Commit**

```bash
git add packages/db/src/schema/billing.ts packages/db/src/schema/index.ts packages/db/src/migrations/ apps/server/src/test/db-helpers.ts
git commit -m "feat(db): subscription + billing_event tables and test cleanup"
```

---

## Task 3 — Pure Google Play decoder

**Files:**
- Create: `apps/server/src/features/billing/google-play.decoder.ts`
- Create: `apps/server/src/features/billing/google-play.decoder.test.ts`

- [ ] **Step 3.1: Implement the decoder**

Create `apps/server/src/features/billing/google-play.decoder.ts`:

```ts
import { GOOGLE_PLAY_NOTIFICATION_TYPES, type GooglePlayNotificationTypeName } from "@pruvi/shared";

export type DecodedGooglePlayEvent =
  | {
      kind: "subscription";
      messageId: string;
      publishTime: string;
      packageName: string;
      eventTimeMillis: string;
      notificationType: number;
      notificationTypeName: GooglePlayNotificationTypeName;
      purchaseToken: string;
    }
  | { kind: "test"; messageId: string }
  | { kind: "unknown"; messageId: string; notificationType: number; purchaseToken: string };

export class DecoderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecoderError";
  }
}

type PubSubMessage = {
  message?: {
    messageId?: string;
    publishTime?: string;
    data?: string;
  };
};

/** Pure decoder: throws DecoderError on unparseable input. */
export function decodeGooglePlayPubSubEnvelope(raw: unknown): DecodedGooglePlayEvent {
  if (!raw || typeof raw !== "object") {
    throw new DecoderError("Envelope is not an object");
  }
  const env = raw as PubSubMessage;
  const msg = env.message;
  if (!msg || typeof msg !== "object") {
    throw new DecoderError("Missing message field");
  }
  const messageId = msg.messageId;
  if (!messageId || typeof messageId !== "string") {
    throw new DecoderError("Missing message.messageId");
  }
  if (!msg.data || typeof msg.data !== "string") {
    throw new DecoderError("Missing message.data");
  }
  let inner: unknown;
  try {
    const decoded = Buffer.from(msg.data, "base64").toString("utf-8");
    inner = JSON.parse(decoded);
  } catch (_e) {
    throw new DecoderError("message.data is not valid base64+JSON");
  }
  if (!inner || typeof inner !== "object") {
    throw new DecoderError("Decoded payload is not an object");
  }

  const obj = inner as {
    packageName?: string;
    eventTimeMillis?: string;
    testNotification?: unknown;
    subscriptionNotification?: { notificationType?: number; purchaseToken?: string };
  };

  if (obj.testNotification) {
    return { kind: "test", messageId };
  }

  const sub = obj.subscriptionNotification;
  if (!sub || typeof sub !== "object") {
    throw new DecoderError("Missing subscriptionNotification");
  }
  const ntype = sub.notificationType;
  const token = sub.purchaseToken;
  if (typeof ntype !== "number" || !token || typeof token !== "string") {
    throw new DecoderError("Malformed subscriptionNotification");
  }

  const name = GOOGLE_PLAY_NOTIFICATION_TYPES[ntype as keyof typeof GOOGLE_PLAY_NOTIFICATION_TYPES];
  if (!name) {
    return { kind: "unknown", messageId, notificationType: ntype, purchaseToken: token };
  }
  return {
    kind: "subscription",
    messageId,
    publishTime: msg.publishTime ?? "",
    packageName: obj.packageName ?? "",
    eventTimeMillis: obj.eventTimeMillis ?? "",
    notificationType: ntype,
    notificationTypeName: name,
    purchaseToken: token,
  };
}
```

- [ ] **Step 3.2: Failing tests**

Create `apps/server/src/features/billing/google-play.decoder.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { decodeGooglePlayPubSubEnvelope, DecoderError } from "./google-play.decoder";

function buildEnvelope(inner: object, messageId = "msg-1") {
  return {
    message: {
      messageId,
      publishTime: "2026-05-12T10:00:00Z",
      data: Buffer.from(JSON.stringify(inner)).toString("base64"),
    },
  };
}

describe("decodeGooglePlayPubSubEnvelope", () => {
  it("decodes PURCHASED (type 4)", () => {
    const env = buildEnvelope({
      version: "1.0",
      packageName: "com.pruvi.app",
      eventTimeMillis: "1747044000000",
      subscriptionNotification: { version: "1.0", notificationType: 4, purchaseToken: "tok-A" },
    });
    const decoded = decodeGooglePlayPubSubEnvelope(env);
    expect(decoded.kind).toBe("subscription");
    if (decoded.kind === "subscription") {
      expect(decoded.notificationType).toBe(4);
      expect(decoded.notificationTypeName).toBe("PURCHASED");
      expect(decoded.purchaseToken).toBe("tok-A");
      expect(decoded.messageId).toBe("msg-1");
    }
  });

  it("decodes RENEWED (type 2)", () => {
    const env = buildEnvelope({
      subscriptionNotification: { notificationType: 2, purchaseToken: "tok-B" },
    });
    const decoded = decodeGooglePlayPubSubEnvelope(env);
    expect(decoded.kind === "subscription" && decoded.notificationTypeName).toBe("RENEWED");
  });

  it("decodes EXPIRED (type 13)", () => {
    const env = buildEnvelope({
      subscriptionNotification: { notificationType: 13, purchaseToken: "tok-C" },
    });
    const decoded = decodeGooglePlayPubSubEnvelope(env);
    expect(decoded.kind === "subscription" && decoded.notificationTypeName).toBe("EXPIRED");
  });

  it("decodes CANCELLATION_SCHEDULED (type 18)", () => {
    const env = buildEnvelope({
      subscriptionNotification: { notificationType: 18, purchaseToken: "tok-D" },
    });
    const decoded = decodeGooglePlayPubSubEnvelope(env);
    expect(decoded.kind === "subscription" && decoded.notificationTypeName).toBe("CANCELLATION_SCHEDULED");
  });

  it("returns kind=unknown for unrecognized notificationType", () => {
    const env = buildEnvelope({
      subscriptionNotification: { notificationType: 99, purchaseToken: "tok-E" },
    });
    const decoded = decodeGooglePlayPubSubEnvelope(env);
    expect(decoded.kind).toBe("unknown");
    if (decoded.kind === "unknown") {
      expect(decoded.notificationType).toBe(99);
      expect(decoded.purchaseToken).toBe("tok-E");
    }
  });

  it("returns kind=test for testNotification envelopes", () => {
    const env = buildEnvelope({ testNotification: { version: "1.0" } });
    const decoded = decodeGooglePlayPubSubEnvelope(env);
    expect(decoded.kind).toBe("test");
  });

  it("throws on missing messageId", () => {
    expect(() =>
      decodeGooglePlayPubSubEnvelope({ message: { data: Buffer.from("{}").toString("base64") } }),
    ).toThrow(DecoderError);
  });

  it("throws on missing message.data", () => {
    expect(() => decodeGooglePlayPubSubEnvelope({ message: { messageId: "x" } })).toThrow(DecoderError);
  });

  it("throws on malformed base64", () => {
    expect(() => decodeGooglePlayPubSubEnvelope({ message: { messageId: "x", data: "!!!notbase64!!!" } })).toThrow(DecoderError);
  });

  it("throws on missing subscriptionNotification", () => {
    const env = buildEnvelope({ packageName: "x" });
    expect(() => decodeGooglePlayPubSubEnvelope(env)).toThrow(DecoderError);
  });
});
```

- [ ] **Step 3.3: Run tests, commit**

```bash
cd apps/server && bun test src/features/billing/google-play.decoder.test.ts
```
Expected: 10 pass.

```bash
git add apps/server/src/features/billing/google-play.decoder.ts apps/server/src/features/billing/google-play.decoder.test.ts
git commit -m "feat(billing): google play rtdn decoder — pure pubsub envelope parser"
```

---

## Task 4 — Billing repository (subscription + event storage)

**Files:**
- Create: `apps/server/src/features/billing/billing.repository.ts`
- Create: `apps/server/src/features/billing/billing.repository.integration.test.ts`

- [ ] **Step 4.1: Implement the repository**

Create `apps/server/src/features/billing/billing.repository.ts`:

```ts
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
```

- [ ] **Step 4.2: Failing integration tests**

Create `apps/server/src/features/billing/billing.repository.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { setupTestDb, cleanupTestDb, teardownTestDb, getTestDb } from "../../test/db-helpers";
import { user } from "@pruvi/db/schema/auth";
import { BillingRepository } from "./billing.repository";

describe("BillingRepository (integration)", () => {
  const db = getTestDb();
  const repo = new BillingRepository(db);

  beforeAll(async () => setupTestDb());
  beforeEach(async () => cleanupTestDb());
  afterAll(async () => teardownTestDb());

  async function insertUser(id: string) {
    await db.insert(user).values({
      id, name: `U ${id}`, email: `${id}@e.com`, emailVerified: false,
      inviteCode: `c${id.replace(/-/g, "").slice(0, 8)}`, username: null, updatedAt: new Date(),
    });
  }

  it("insertEvent dedup: same (provider, message_id) returns null on second insert", async () => {
    const a = await repo.insertEvent(db, { provider: "google_play", messageId: "m1", eventType: "PURCHASED", purchaseToken: "t1", payload: { x: 1 } });
    const b = await repo.insertEvent(db, { provider: "google_play", messageId: "m1", eventType: "PURCHASED", purchaseToken: "t1", payload: { x: 2 } });
    expect(a).not.toBeNull();
    expect(b).toBeNull();
  });

  it("createOrphanSubscription is idempotent on conflict", async () => {
    const a = await repo.createOrphanSubscription(db, "google_play", "t-orph");
    const b = await repo.createOrphanSubscription(db, "google_play", "t-orph");
    expect(b.id).toBe(a.id);
    expect(b.userId).toBeNull();
  });

  it("upsertLinkedSubscription creates with linked_at set; second call by same user returns existing", async () => {
    await insertUser("u-link-1");
    const r1 = await repo.upsertLinkedSubscription(db, { userId: "u-link-1", provider: "google_play", productId: "p1", token: "t-link-1" });
    expect(r1.created).toBe(true);
    expect(r1.subscription.linkedAt).toBeInstanceOf(Date);
    const r2 = await repo.upsertLinkedSubscription(db, { userId: "u-link-1", provider: "google_play", productId: "p1", token: "t-link-1" });
    expect(r2.created).toBe(false);
    expect(r2.subscription.id).toBe(r1.subscription.id);
  });

  it("claimOrphanSubscription sets user_id, product_id, linked_at", async () => {
    await insertUser("u-claim-1");
    const orph = await repo.createOrphanSubscription(db, "google_play", "t-claim-1");
    const claimed = await repo.claimOrphanSubscription(db, orph.id, "u-claim-1", "pruvi_ultra_monthly");
    expect(claimed.userId).toBe("u-claim-1");
    expect(claimed.productId).toBe("pruvi_ultra_monthly");
    expect(claimed.linkedAt).toBeInstanceOf(Date);
  });

  it("claimOrphanSubscription rejects already-claimed", async () => {
    await insertUser("u-claim-2a");
    await insertUser("u-claim-2b");
    const orph = await repo.createOrphanSubscription(db, "google_play", "t-claim-2");
    await repo.claimOrphanSubscription(db, orph.id, "u-claim-2a", "p");
    await expect(repo.claimOrphanSubscription(db, orph.id, "u-claim-2b", "p")).rejects.toThrow();
  });

  it("hasOtherActiveSubscription detects sibling active row", async () => {
    await insertUser("u-multi-1");
    const a = await repo.upsertLinkedSubscription(db, { userId: "u-multi-1", provider: "google_play", productId: "p", token: "t-A" });
    await repo.updateSubscriptionState(db, a.subscription.id, { status: "active", currentPeriodEnd: new Date(Date.now() + 86400000) });
    const b = await repo.upsertLinkedSubscription(db, { userId: "u-multi-1", provider: "google_play", productId: "p", token: "t-B" });
    expect(await repo.hasOtherActiveSubscription(db, "u-multi-1", b.subscription.id)).toBe(true);
  });

  it("hasOtherActiveSubscription returns false when only this subscription is active", async () => {
    await insertUser("u-multi-2");
    const a = await repo.upsertLinkedSubscription(db, { userId: "u-multi-2", provider: "google_play", productId: "p", token: "t-only" });
    await repo.updateSubscriptionState(db, a.subscription.id, { status: "active" });
    expect(await repo.hasOtherActiveSubscription(db, "u-multi-2", a.subscription.id)).toBe(false);
  });

  it("listUnprocessedEventsForToken returns rows oldest-first, processed rows excluded", async () => {
    await repo.insertEvent(db, { provider: "google_play", messageId: "m-a", eventType: "PURCHASED", purchaseToken: "t-X", payload: {} });
    await new Promise((r) => setTimeout(r, 10));
    const ev2 = await repo.insertEvent(db, { provider: "google_play", messageId: "m-b", eventType: "RENEWED", purchaseToken: "t-X", payload: {} });
    await repo.markEventProcessed(db, ev2!.id);
    const unprocessed = await repo.listUnprocessedEventsForToken(db, "google_play", "t-X");
    expect(unprocessed).toHaveLength(1);
    expect(unprocessed[0]!.messageId).toBe("m-a");
  });
});
```

- [ ] **Step 4.3: Run tests, commit**

```bash
cd apps/server && bun test src/features/billing/billing.repository.integration.test.ts
```
Expected: 8 pass.

```bash
git add apps/server/src/features/billing/billing.repository.ts apps/server/src/features/billing/billing.repository.integration.test.ts
git commit -m "feat(billing): repository — event dedup, subscription upsert, orphan claim, multi-sub guard"
```

---

## Task 5 — Service with `applyDecodedEvent` shared state machine

**Files:**
- Create: `apps/server/src/features/billing/billing.service.ts`
- Create: `apps/server/src/features/billing/billing.service.test.ts`

- [ ] **Step 5.1: Implement service**

Create `apps/server/src/features/billing/billing.service.ts`:

```ts
import { ok, err, type Result } from "neverthrow";
import { AppError, ConflictError } from "../../utils/errors";
import { DEFAULT_SUBSCRIPTION_PERIOD_MS, type GooglePlayLinkResponse, type SubscriptionStatus } from "@pruvi/shared";
import type { BillingRepository, DbOrTx, SubscriptionRow } from "./billing.repository";
import type { UltraService } from "../ultra/ultra.service";
import type { DecodedGooglePlayEvent } from "./google-play.decoder";
import { decodeGooglePlayPubSubEnvelope } from "./google-play.decoder";
import type { db as DbClient } from "@pruvi/db";

type Db = typeof DbClient;

/** Effect to apply AFTER the transaction commits (two-phase pattern per spec §7.6). */
type PostCommitUltraEffect =
  | { kind: "grant"; userId: string; expiresAt: Date }
  | { kind: "revoke_if_no_other_active"; userId: string; excludeSubscriptionId: number }
  | { kind: "none" };

export class BillingService {
  constructor(
    private db: Db,
    private repo: BillingRepository,
    private ultra: UltraService,
  ) {}

  /** Webhook entry point. Returns the response payload; always 200 on accepted shapes.
   *  Auth + envelope-shape validation happens in the route. */
  async processWebhookEnvelope(envelope: unknown): Promise<Result<{ messageId: string; kind: string }, AppError>> {
    let decoded: DecodedGooglePlayEvent;
    try {
      decoded = decodeGooglePlayPubSubEnvelope(envelope);
    } catch (e) {
      return err(new AppError(`MALFORMED_ENVELOPE: ${(e as Error).message}`, 200, "MALFORMED_ENVELOPE"));
    }

    if (decoded.kind === "test") {
      // Record audit row with no purchase token; idempotent on messageId.
      await this.repo.insertEvent(this.db, {
        provider: "google_play",
        messageId: decoded.messageId,
        eventType: "TEST",
        purchaseToken: null,
        payload: { kind: "test" },
      });
      return ok({ messageId: decoded.messageId, kind: "test" });
    }

    const effect = await this.db.transaction(async (tx) => {
      const eventType =
        decoded.kind === "subscription" ? decoded.notificationTypeName : `UNKNOWN_${decoded.notificationType}`;
      const inserted = await this.repo.insertEvent(tx, {
        provider: "google_play",
        messageId: decoded.messageId,
        eventType,
        purchaseToken: decoded.purchaseToken,
        payload: decoded as unknown as Record<string, unknown>,
      });
      if (!inserted) {
        // Duplicate delivery — already processed (or processed previously). No-op.
        return { kind: "none" } as PostCommitUltraEffect;
      }

      if (decoded.kind === "unknown") {
        await this.repo.markEventProcessed(tx, inserted.id);
        return { kind: "none" };
      }

      // Find or create subscription row.
      let sub = await this.repo.findSubscriptionByToken(tx, "google_play", decoded.purchaseToken);
      if (!sub) {
        sub = await this.repo.createOrphanSubscription(tx, "google_play", decoded.purchaseToken);
      }

      const { newStatus, newPeriodEnd, ultraEffect } = this.applyDecodedEvent(decoded, sub);
      await this.repo.updateSubscriptionState(tx, sub.id, { status: newStatus, currentPeriodEnd: newPeriodEnd });

      // If subscription has no user yet, leave processed_at = NULL so link can replay.
      if (sub.userId === null) {
        return { kind: "none" };
      }

      await this.repo.markEventProcessed(tx, inserted.id);
      return ultraEffect;
    });

    await this.applyUltraEffect(effect);
    return ok({ messageId: decoded.messageId, kind: decoded.kind });
  }

  /** Link entry point: associates a purchase token with the authenticated user and replays parked events. */
  async linkGooglePlayPurchase(
    userId: string,
    body: { purchaseToken: string; productId: string },
  ): Promise<Result<GooglePlayLinkResponse, AppError>> {
    const effects: PostCommitUltraEffect[] = [];
    const finalRow = await this.db.transaction(async (tx) => {
      const existing = await this.repo.findSubscriptionByToken(tx, "google_play", body.purchaseToken);
      let sub: SubscriptionRow;
      if (!existing) {
        const created = await this.repo.upsertLinkedSubscription(tx, {
          userId, provider: "google_play", productId: body.productId, token: body.purchaseToken,
        });
        sub = created.subscription;
      } else if (existing.userId !== null && existing.userId !== userId) {
        throw new ConflictError("PURCHASE_TOKEN_OWNED_BY_OTHER_USER");
      } else if (existing.userId === userId) {
        sub = existing;
      } else {
        // Orphan claim
        sub = await this.repo.claimOrphanSubscription(tx, existing.id, userId, body.productId);
      }

      // Replay parked events for this token (only if we just claimed an orphan or first-link).
      const parked = await this.repo.listUnprocessedEventsForToken(tx, "google_play", body.purchaseToken);
      for (const event of parked) {
        // Reconstruct the decoded event from the audit payload.
        const decoded = event.payload as unknown as DecodedGooglePlayEvent;
        if (decoded.kind !== "subscription") {
          await this.repo.markEventProcessed(tx, event.id);
          continue;
        }
        const fresh = await this.repo.findSubscriptionByToken(tx, "google_play", body.purchaseToken);
        if (!fresh) throw new Error("replay: subscription disappeared mid-transaction");
        sub = fresh;
        const { newStatus, newPeriodEnd, ultraEffect } = this.applyDecodedEvent(decoded, sub);
        await this.repo.updateSubscriptionState(tx, sub.id, { status: newStatus, currentPeriodEnd: newPeriodEnd });
        await this.repo.markEventProcessed(tx, event.id);
        effects.push(ultraEffect);
      }
      const final = await this.repo.findSubscriptionByToken(tx, "google_play", body.purchaseToken);
      if (!final) throw new Error("link: subscription disappeared mid-transaction");
      return final;
    }).catch((e) => {
      if (e instanceof ConflictError) throw e;
      throw e;
    });

    for (const e of effects) await this.applyUltraEffect(e);

    return ok({
      subscription: {
        id: finalRow.id,
        status: finalRow.status,
        productId: finalRow.productId,
        currentPeriodEnd: finalRow.currentPeriodEnd?.toISOString() ?? null,
      },
    });
  }

  /** Pure state-machine: maps (event, current subscription) → next state + ultra effect. NO DB writes. */
  applyDecodedEvent(
    decoded: DecodedGooglePlayEvent,
    sub: SubscriptionRow,
  ): { newStatus: SubscriptionStatus; newPeriodEnd: Date | null; ultraEffect: PostCommitUltraEffect } {
    if (decoded.kind !== "subscription") {
      return { newStatus: sub.status, newPeriodEnd: sub.currentPeriodEnd, ultraEffect: { kind: "none" } };
    }
    const now = new Date();
    const defaultEnd = new Date(now.getTime() + DEFAULT_SUBSCRIPTION_PERIOD_MS);
    const name = decoded.notificationTypeName;
    const grant = (end: Date): PostCommitUltraEffect =>
      sub.userId !== null ? { kind: "grant", userId: sub.userId, expiresAt: end } : { kind: "none" };
    const revoke = (): PostCommitUltraEffect =>
      sub.userId !== null
        ? { kind: "revoke_if_no_other_active", userId: sub.userId, excludeSubscriptionId: sub.id }
        : { kind: "none" };

    switch (name) {
      case "PURCHASED":
      case "RENEWED":
      case "RECOVERED":
      case "RESTARTED":
        return { newStatus: "active", newPeriodEnd: defaultEnd, ultraEffect: grant(defaultEnd) };
      case "IN_GRACE_PERIOD":
        return { newStatus: "in_grace", newPeriodEnd: sub.currentPeriodEnd, ultraEffect: { kind: "none" } };
      case "CANCELED":
        return { newStatus: "canceled", newPeriodEnd: sub.currentPeriodEnd, ultraEffect: { kind: "none" } };
      case "ON_HOLD":
        return { newStatus: "on_hold", newPeriodEnd: sub.currentPeriodEnd, ultraEffect: revoke() };
      case "PAUSED":
        return { newStatus: "paused", newPeriodEnd: sub.currentPeriodEnd, ultraEffect: revoke() };
      case "EXPIRED":
        return { newStatus: "expired", newPeriodEnd: sub.currentPeriodEnd, ultraEffect: revoke() };
      case "REVOKED":
        return { newStatus: "revoked", newPeriodEnd: sub.currentPeriodEnd, ultraEffect: revoke() };
      case "PRICE_CHANGE_CONFIRMED":
      case "DEFERRED":
      case "PAUSE_SCHEDULE_CHANGED":
      case "ITEMS_CHANGED":
      case "CANCELLATION_SCHEDULED":
      case "PRICE_CHANGE_UPDATED":
      case "PENDING_PURCHASE_CANCELED":
      case "PRICE_STEP_UP_CONSENT_UPDATED":
        return { newStatus: sub.status, newPeriodEnd: sub.currentPeriodEnd, ultraEffect: { kind: "none" } };
    }
  }

  private async applyUltraEffect(effect: PostCommitUltraEffect): Promise<void> {
    if (effect.kind === "grant") {
      await this.ultra.grant(effect.userId, effect.expiresAt);
    } else if (effect.kind === "revoke_if_no_other_active") {
      const hasOther = await this.repo.hasOtherActiveSubscription(this.db, effect.userId, effect.excludeSubscriptionId);
      if (!hasOther) await this.ultra.revoke(effect.userId);
    }
  }
}
```

- [ ] **Step 5.2: Failing service tests (mocked repo + ultra)**

Create `apps/server/src/features/billing/billing.service.test.ts`. Cover:
1. **PURCHASED webhook on a linked subscription**: state→active, currentPeriodEnd≈now+30d, ultra.grant called with that expiry.
2. **PURCHASED on no-existing-subscription (pre-link)**: creates orphan, applies state, NO grant called.
3. **EXPIRED on active with NO other active subscriptions**: state→expired, ultra.revoke called.
4. **EXPIRED on active WITH another active subscription**: state→expired, ultra.revoke NOT called (multi-sub guard).
5. **CANCELED**: state→canceled, no Ultra change.
6. **Duplicate messageId**: second call returns ok with no effect; ultra.grant NOT called second time.
7. **Unknown notificationType**: audit row inserted with `UNKNOWN_99` type, no state change, no grant/revoke.
8. **`linkGooglePlayPurchase` happy path on token already owned by same user**: returns existing subscription, no error.
9. **`linkGooglePlayPurchase` on token owned by other user**: throws ConflictError.
10. **`linkGooglePlayPurchase` after pre-link webhook**: claims orphan, replays parked PURCHASED event, ultra.grant called.

For each, build a `buildSut` helper similar to Phase 2E.3's service test pattern, mocking `BillingRepository` and `UltraService`. The service's `db` reference can be a stub since the mocked repo intercepts all calls — but the service does call `this.db.transaction(async (tx) => ...)`. Mock the transaction to immediately invoke the callback with `tx = mockRepo` (or use a thin `txRunner` injection — but staying consistent with existing pattern, mock `db.transaction` to call the callback with a stub).

The mocked db pattern:
```ts
const db = { transaction: vi.fn(async (cb: (tx: any) => any) => cb(mockTx)) };
```

- [ ] **Step 5.3: Run tests, commit**

```bash
cd apps/server && bun test src/features/billing/
```
Expected: 10 unit + 8 integration + 10 decoder = 28 pass.

```bash
git add apps/server/src/features/billing/billing.service.ts apps/server/src/features/billing/billing.service.test.ts
git commit -m "feat(billing): service — applydecodedevent state machine, two-phase ultra effect, multi-sub revoke guard, link-time replay"
```

---

## Task 6 — Webhook route + Link route + plugin registration

**Files:**
- Create: `apps/server/src/features/billing/billing.route.ts`
- Create: `apps/server/src/features/billing/index.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 6.1: Implement routes**

Create `apps/server/src/features/billing/billing.route.ts`:

```ts
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest, FastifyReply } from "fastify";
import { GooglePlayLinkBodySchema, GooglePlayLinkResponseSchema } from "@pruvi/shared";
import { env } from "@pruvi/env/server";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";
import { BillingRepository } from "./billing.repository";
import { BillingService } from "./billing.service";
import { UltraRepository } from "../ultra/ultra.repository";
import { UltraService } from "../ultra/ultra.service";

const repo = new BillingRepository(db);
const ultra = new UltraService(new UltraRepository(db));
const service = new BillingService(db, repo, ultra);

async function webhookGuard(request: FastifyRequest, reply: FastifyReply) {
  if (!env.GOOGLE_PLAY_WEBHOOK_TOKEN) {
    reply.code(503);
    throw new Error("WEBHOOK_DISABLED");
  }
  const provided = request.headers["x-pruvi-webhook-token"];
  if (typeof provided !== "string") {
    reply.code(401);
    throw new Error("UNAUTHORIZED");
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(env.GOOGLE_PLAY_WEBHOOK_TOKEN);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    reply.code(401);
    throw new Error("UNAUTHORIZED");
  }
}

export const billingRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/webhooks/google-play",
    {
      schema: {
        body: z.unknown(),
        response: {
          200: z.object({
            success: z.literal(true),
            data: z.object({ received: z.boolean(), messageId: z.string().optional(), kind: z.string().optional(), error: z.string().optional() }),
          }),
        },
      },
      preHandler: [webhookGuard],
    },
    async (request, reply) => {
      const result = await service.processWebhookEnvelope(request.body);
      if (result.isErr()) {
        const error = result.error;
        // For MALFORMED_ENVELOPE we still return 200 so Pub/Sub stops retrying.
        if (error.code === "MALFORMED_ENVELOPE") {
          fastify.log.warn({ err: error.message }, "google-play webhook malformed envelope");
          return successResponse({ received: false, error: "MALFORMED_ENVELOPE" });
        }
        fastify.log.error({ err: error.message }, "google-play webhook processing failed");
        return successResponse({ received: false, error: "PROCESSING_FAILED" });
      }
      return successResponse({ received: true, messageId: result.value.messageId, kind: result.value.kind });
    },
  );

  fastify.post(
    "/billing/google-play/link",
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: GooglePlayLinkBodySchema,
        response: { 200: z.object({ success: z.literal(true), data: GooglePlayLinkResponseSchema }) },
      },
    },
    async (request) => {
      const data = unwrapResult(await service.linkGooglePlayPurchase(request.userId, request.body)).data;
      return successResponse(data);
    },
  );
};
```

Create `apps/server/src/features/billing/index.ts`:
```ts
export { billingRoutes } from "./billing.route";
```

- [ ] **Step 6.2: Register routes**

In `apps/server/src/index.ts`, add the import and registration after `simuladosRoutes`:
```ts
import { billingRoutes } from "./features/billing";
// ...
await app.register(billingRoutes);
```

- [ ] **Step 6.3: Run typecheck + tests, commit**

```bash
cd /Users/cesarcamillo/dev/pruvi && pnpm -F server test src/features/billing/ && pnpm check-types 2>&1 | grep "billing\|simulados" || true
```

Expected: tests green; no NEW type errors in `billing/` (pre-existing errors in unrelated files are acceptable).

```bash
git add apps/server/src/features/billing/billing.route.ts apps/server/src/features/billing/index.ts apps/server/src/index.ts
git commit -m "feat(billing): routes — webhook with shared-secret guard, link endpoint"
```

---

## Task 7 — Push, open PR

- [ ] **Step 7.1: Full test sweep**

```bash
cd /Users/cesarcamillo/dev/pruvi && pnpm -F server test
```

Expected: all green (pre-existing failures in unrelated tests are acceptable but flag them).

- [ ] **Step 7.2: Push + PR**

```bash
git push -u origin feature/phase-2e4-billing-webhooks
gh pr create --title "feat: phase 2e.4 — google play billing webhooks (ultra entitlement)" --body "$(cat <<'EOF'
## Summary
- New `billing` module wires Google Play RTDN → UltraService.grant/revoke
- `subscription` table tracks per-user-per-token state; `billing_event` is an append-only audit log dedup'd on `(provider, message_id)`
- Shared `applyDecodedEvent` state machine used by both webhook handler and link-time replay
- Pre-link race resolved via orphan-subscription pattern + parked-event replay on link
- Multi-subscription revoke guard prevents EXPIRED on old subscription from stripping Ultra from new one
- Optional `GOOGLE_PLAY_WEBHOOK_TOKEN` env var; missing → 503; mismatch → 401
- App Store deferred to 2E.5; schema accommodates `app_store` provider without migration

## Workflow gates
- ✅ Gate A — spec self-review (6 blockers → spec v2)
- ✅ Gate B — plan self-review
- ✅ Gate C — per-task review after each commit
- ✅ Gate D — final spec-coverage review

## Test plan
- [ ] Decoder unit tests pass (10 cases including testNotification, unknown type, malformed envelope)
- [ ] Repository integration tests pass (8 cases including dedup, orphan claim, multi-sub guard)
- [ ] Service unit tests pass (10 cases including multi-sub guard, link-time replay)
- [ ] Manual: POST /webhooks/google-play with missing header → 401; with bad token → 401; with no env token → 503
EOF
)"
```

---

## Self-review checklist (post Gate B)

1. **Spec coverage** A1–A19: A1 → T6; A2 → T6; A3 → T4/T5; A4 → T5/T6; A5 → T5; A6 → T5; A7 → T5; A8 → T5; A9 → T5; A10 → T4/T5; A11 → T5; A12 → T2; A13 → T2; A14 → T5/T6 (structured logs); A15 → T4/T5 (multi-sub guard); A16 → T5 (shared `applyDecodedEvent`); A17 → T1 (env declaration); A18 → T2 (db-helpers update); A19 → T3/T5 (unknown branch).
2. **Placeholder scan:** No TBDs.
3. **Type consistency:** `BillingProvider`/`SubscriptionStatus` come from `@pruvi/shared` consistently across schema, repo, service, decoder.
4. **No raw SQL where Drizzle has helpers** (except the `IN (...)` for multi-sub check — could be `inArray` but a sql template is acceptable for the `IN` with literal strings).
5. **Migration safety:** drizzle-kit generates `0010_*`; no manual SQL edits.
