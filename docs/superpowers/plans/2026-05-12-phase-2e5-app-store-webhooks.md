# Phase 2E.5 — App Store Server Notifications V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Gate C (Opus 4.7) after EVERY task. Final Gate D before PR.

**Goal:** Extend the existing `billing` module (from 2E.4) with an App Store Server Notifications V2 adapter. Reuse the `subscription`/`billing_event` tables, the `BillingRepository`, and `applyUltraEffect` (multi-sub guards). Add: shared schemas, an `applyAppStoreEvent` state-machine, an Apple JWS decoder, two new routes, and rename `processWebhookEnvelope` → `processGooglePlayEnvelope` for symmetry.

**Architecture:** Apple sends signed JWS payloads via direct HTTPS POST. Auth via URL-path secret (Apple cannot inject custom headers, so the Google header pattern can't transfer). The decoder parses two layers of JWS (no signature verification in v1 — deferred). The state machine has its own pure function (`applyAppStoreEvent`) sibling to `applyDecodedEvent` (Google). `applyUltraEffect` is reused unchanged.

**Tech Stack:** Drizzle ORM, Fastify 5 + fastify-type-provider-zod on Bun, neverthrow Result, real Postgres for integration tests.

**Authoritative spec:** `docs/superpowers/specs/2026-05-12-phase-2e5-app-store-webhooks-design.md` (v2 post Gate A).

---

## Task 1 — Shared schemas, env, rename Google webhook entry point

**Files:**
- Modify: `packages/env/src/server.ts`
- Modify: `packages/shared/src/billing.ts`
- Modify: `packages/shared/src/billing.test.ts`
- Modify: `apps/server/src/features/billing/billing.service.ts` (rename `processWebhookEnvelope` → `processGooglePlayEnvelope`)
- Modify: `apps/server/src/features/billing/billing.route.ts` (update the call site)

- [ ] **Step 1.1: Add `APP_STORE_WEBHOOK_TOKEN` to env**

In `packages/env/src/server.ts`, add after `GOOGLE_PLAY_WEBHOOK_TOKEN`:

```ts
    APP_STORE_WEBHOOK_TOKEN: z.string().min(32).optional(),
```

Note `min(32)`, not 16 — this token appears in the URL path and acts as the sole auth.

- [ ] **Step 1.2: Add App Store shared schemas**

In `packages/shared/src/billing.ts`, append:

```ts
export const APP_STORE_NOTIFICATION_TYPES = [
  "SUBSCRIBED",
  "DID_RENEW",
  "DID_FAIL_TO_RENEW",
  "EXPIRED",
  "GRACE_PERIOD_EXPIRED",
  "REFUND",
  "REFUND_DECLINED",
  "REFUND_REVERSED",
  "REVOKE",
  "DID_CHANGE_RENEWAL_STATUS",
  "DID_CHANGE_RENEWAL_PREF",
  "OFFER_REDEEMED",
  "PRICE_INCREASE",
  "RENEWAL_EXTENDED",
  "CONSUMPTION_REQUEST",
  "ONE_TIME_CHARGE",
  "TEST",
] as const;
export type AppStoreNotificationType = (typeof APP_STORE_NOTIFICATION_TYPES)[number];

export const AppStoreLinkBodySchema = z.object({
  originalTransactionId: z.string().min(1),
  productId: z.string().min(1),
});
export type AppStoreLinkBody = z.infer<typeof AppStoreLinkBodySchema>;

/** Type alias — Apple link response shape is identical to Google's (provider-agnostic). */
export const AppStoreLinkResponseSchema = GooglePlayLinkResponseSchema;
export type AppStoreLinkResponse = z.infer<typeof AppStoreLinkResponseSchema>;
```

- [ ] **Step 1.3: Extend `billing.test.ts`**

Append to `packages/shared/src/billing.test.ts` inside the existing top-level `describe("billing shared module", ...)`:

```ts
it("declares all 17 app store notification types", () => {
  expect(APP_STORE_NOTIFICATION_TYPES).toHaveLength(17);
  expect(APP_STORE_NOTIFICATION_TYPES).toContain("SUBSCRIBED");
  expect(APP_STORE_NOTIFICATION_TYPES).toContain("REFUND_REVERSED");
  expect(APP_STORE_NOTIFICATION_TYPES).toContain("ONE_TIME_CHARGE");
});

it("validates app store link body shape", () => {
  expect(AppStoreLinkBodySchema.safeParse({ originalTransactionId: "200000000000001", productId: "pruvi_ultra_monthly" }).success).toBe(true);
  expect(AppStoreLinkBodySchema.safeParse({ originalTransactionId: "", productId: "x" }).success).toBe(false);
});
```

Also extend the imports at the top of `billing.test.ts` to include the new symbols:

```ts
import {
  // ...existing imports...
  APP_STORE_NOTIFICATION_TYPES,
  AppStoreLinkBodySchema,
} from "./billing";
```

- [ ] **Step 1.4: Rename `processWebhookEnvelope` → `processGooglePlayEnvelope` (mechanical)**

In `apps/server/src/features/billing/billing.service.ts`, rename the method (the only definition site). Update the route call site in `apps/server/src/features/billing/billing.route.ts`. Update the test file if it references the old name. Run `grep -rn "processWebhookEnvelope" apps/ packages/` first to confirm there are exactly the expected three sites (definition + route call + service test). If there are more, STOP — there shouldn't be.

- [ ] **Step 1.5: Run tests + commit**

```bash
cd packages/shared && bun test src/billing.test.ts
cd /Users/cesarcamillo/dev/pruvi/apps/server && bun test src/features/billing/
```

Expected: shared package 7 pass (was 5, +2 new). Server `billing/` 34 pass (unchanged; only a rename).

```bash
git add packages/env/src/server.ts packages/shared/src/billing.ts packages/shared/src/billing.test.ts apps/server/src/features/billing/billing.service.ts apps/server/src/features/billing/billing.service.test.ts apps/server/src/features/billing/billing.route.ts
git commit -m "feat(shared,env): app store notification types + link schemas; rename processWebhookEnvelope → processGooglePlayEnvelope"
```

---

## Task 2 — App Store decoder (pure JWS parser + state-machine mapping)

**Files:**
- Create: `apps/server/src/features/billing/app-store.decoder.ts`
- Create: `apps/server/src/features/billing/app-store.decoder.test.ts`

- [ ] **Step 2.1: Implement the decoder**

Create `apps/server/src/features/billing/app-store.decoder.ts`:

```ts
import { APP_STORE_NOTIFICATION_TYPES, type AppStoreNotificationType } from "@pruvi/shared";

export type AppStoreMappedAction =
  | { kind: "activate"; expiresDate: Date }
  | { kind: "in_grace" }
  | { kind: "cancel_keep_entitlement" }
  | { kind: "on_hold_keep_entitlement" }
  | { kind: "expire" }
  | { kind: "revoke" }
  | { kind: "noop" };

export type DecodedAppStoreEvent =
  | {
      kind: "subscription";
      notificationUUID: string;
      notificationType: AppStoreNotificationType;
      subtype: string | null;
      mappedAction: AppStoreMappedAction;
      originalTransactionId: string;
      productId: string;
      expiresDate: Date | null;
      environment: "Sandbox" | "Production";
    }
  | { kind: "test"; notificationUUID: string }
  | {
      kind: "unknown";
      notificationUUID: string;
      notificationType: string;
      subtype: string | null;
      originalTransactionId: string | null;
    };

export class DecoderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecoderError";
  }
}

type AppStoreEnvelope = { signedPayload?: unknown };

function decodeJwsSegment(jws: string): unknown {
  const parts = jws.split(".");
  if (parts.length !== 3) throw new DecoderError("JWS must have exactly 3 segments");
  try {
    const decoded = Buffer.from(parts[1]!, "base64url").toString("utf-8");
    return JSON.parse(decoded);
  } catch (_e) {
    throw new DecoderError("JWS middle segment is not valid base64url+JSON");
  }
}

/** SECURITY: deferred — see spec §2 non-goals. v1 trusts the URL-path secret for auth.
 *  Real x5c certificate-chain verification is a hardening ticket. */
export function decodeAppStoreNotification(raw: unknown): DecodedAppStoreEvent {
  if (!raw || typeof raw !== "object") throw new DecoderError("Envelope is not an object");
  const env = raw as AppStoreEnvelope;
  if (typeof env.signedPayload !== "string") throw new DecoderError("Missing signedPayload");

  const outer = decodeJwsSegment(env.signedPayload) as {
    notificationUUID?: string;
    notificationType?: string;
    subtype?: string;
    data?: {
      signedTransactionInfo?: string;
      environment?: string;
    };
    version?: string;
    signedDate?: number;
  };

  const notificationUUID = outer.notificationUUID;
  if (!notificationUUID || typeof notificationUUID !== "string") {
    throw new DecoderError("Missing notificationUUID");
  }
  const notificationType = outer.notificationType;
  if (!notificationType || typeof notificationType !== "string") {
    throw new DecoderError("Missing notificationType");
  }

  // Step 3: TEST notification has no `data` object. Check FIRST.
  if (notificationType === "TEST") {
    return { kind: "test", notificationUUID };
  }

  const subtype = typeof outer.subtype === "string" ? outer.subtype : null;
  const data = outer.data;

  // Some notification types don't carry signedTransactionInfo.
  if (!data || typeof data.signedTransactionInfo !== "string") {
    return {
      kind: "unknown",
      notificationUUID,
      notificationType,
      subtype,
      originalTransactionId: null,
    };
  }

  const inner = decodeJwsSegment(data.signedTransactionInfo) as {
    originalTransactionId?: string;
    productId?: string;
    expiresDate?: number;
    environment?: string;
  };
  const originalTransactionId = inner.originalTransactionId;
  const productId = inner.productId;
  if (!originalTransactionId || typeof originalTransactionId !== "string") {
    throw new DecoderError("Missing originalTransactionId");
  }
  if (!productId || typeof productId !== "string") {
    throw new DecoderError("Missing productId");
  }
  const expiresDate = typeof inner.expiresDate === "number" ? new Date(inner.expiresDate) : null;
  const environment = (data.environment === "Production" ? "Production" : "Sandbox") as "Sandbox" | "Production";

  // Is this a known notification type?
  if (!APP_STORE_NOTIFICATION_TYPES.includes(notificationType as AppStoreNotificationType)) {
    return { kind: "unknown", notificationUUID, notificationType, subtype, originalTransactionId };
  }
  const typedNotificationType = notificationType as AppStoreNotificationType;

  let action = mapNotificationToAction(typedNotificationType, subtype, expiresDate);
  // Past-expiry safety: if "activate" but the date is in the past, downgrade to "expire".
  if (action.kind === "activate" && action.expiresDate.getTime() < Date.now()) {
    action = { kind: "expire" };
  }

  return {
    kind: "subscription",
    notificationUUID,
    notificationType: typedNotificationType,
    subtype,
    mappedAction: action,
    originalTransactionId,
    productId,
    expiresDate,
    environment,
  };
}

function mapNotificationToAction(
  type: AppStoreNotificationType,
  subtype: string | null,
  expiresDate: Date | null,
): AppStoreMappedAction {
  switch (type) {
    case "SUBSCRIBED":
    case "DID_RENEW":
    case "REFUND_REVERSED":
      if (!expiresDate) return { kind: "noop" };
      return { kind: "activate", expiresDate };
    case "DID_FAIL_TO_RENEW":
      return subtype === "GRACE_PERIOD" ? { kind: "in_grace" } : { kind: "on_hold_keep_entitlement" };
    case "EXPIRED":
    case "GRACE_PERIOD_EXPIRED":
      return { kind: "expire" };
    case "REFUND":
    case "REVOKE":
      return { kind: "revoke" };
    case "DID_CHANGE_RENEWAL_STATUS":
      return subtype === "AUTO_RENEW_DISABLED" ? { kind: "cancel_keep_entitlement" } : { kind: "noop" };
    case "DID_CHANGE_RENEWAL_PREF":
    case "OFFER_REDEEMED":
    case "PRICE_INCREASE":
    case "RENEWAL_EXTENDED":
    case "REFUND_DECLINED":
    case "CONSUMPTION_REQUEST":
    case "ONE_TIME_CHARGE":
      return { kind: "noop" };
    case "TEST":
      return { kind: "noop" }; // unreachable (TEST handled earlier)
  }
}
```

- [ ] **Step 2.2: Failing tests**

Create `apps/server/src/features/billing/app-store.decoder.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { decodeAppStoreNotification, DecoderError, type DecodedAppStoreEvent } from "./app-store.decoder";

function makeJws(payload: object): string {
  // header.payload.signature — only the middle segment is used.
  const header = Buffer.from(JSON.stringify({ alg: "ES256", x5c: ["fake"] })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

function buildEnvelope(opts: {
  notificationType: string;
  subtype?: string;
  notificationUUID?: string;
  expiresDate?: number;
  originalTransactionId?: string;
  productId?: string;
  omitData?: boolean;
  omitSignedTransaction?: boolean;
}) {
  const tx = {
    originalTransactionId: opts.originalTransactionId ?? "200000000000001",
    productId: opts.productId ?? "pruvi_ultra_monthly",
    expiresDate: opts.expiresDate ?? Date.now() + 30 * 24 * 60 * 60 * 1000,
    environment: "Production",
  };
  const data = opts.omitSignedTransaction
    ? { environment: "Production" }
    : { signedTransactionInfo: makeJws(tx), environment: "Production" };
  const outer: Record<string, unknown> = {
    notificationUUID: opts.notificationUUID ?? "uuid-1",
    notificationType: opts.notificationType,
    version: "2.0",
    signedDate: Date.now(),
  };
  if (opts.subtype) outer.subtype = opts.subtype;
  if (!opts.omitData) outer.data = data;
  return { signedPayload: makeJws(outer) };
}

describe("decodeAppStoreNotification", () => {
  it("decodes SUBSCRIBED:INITIAL_BUY → activate", () => {
    const env = buildEnvelope({ notificationType: "SUBSCRIBED", subtype: "INITIAL_BUY" });
    const d = decodeAppStoreNotification(env);
    expect(d.kind).toBe("subscription");
    if (d.kind === "subscription") {
      expect(d.notificationType).toBe("SUBSCRIBED");
      expect(d.mappedAction.kind).toBe("activate");
    }
  });

  it("decodes DID_RENEW → activate with expiresDate", () => {
    const futureMs = Date.now() + 30 * 86400000;
    const env = buildEnvelope({ notificationType: "DID_RENEW", expiresDate: futureMs });
    const d = decodeAppStoreNotification(env);
    expect(d.kind).toBe("subscription");
    if (d.kind === "subscription" && d.mappedAction.kind === "activate") {
      expect(Math.abs(d.mappedAction.expiresDate.getTime() - futureMs)).toBeLessThan(1000);
    }
  });

  it("decodes DID_FAIL_TO_RENEW:GRACE_PERIOD → in_grace", () => {
    const env = buildEnvelope({ notificationType: "DID_FAIL_TO_RENEW", subtype: "GRACE_PERIOD" });
    const d = decodeAppStoreNotification(env);
    expect(d.kind === "subscription" && d.mappedAction.kind).toBe("in_grace");
  });

  it("decodes DID_FAIL_TO_RENEW (no subtype) → on_hold_keep_entitlement", () => {
    const env = buildEnvelope({ notificationType: "DID_FAIL_TO_RENEW" });
    const d = decodeAppStoreNotification(env);
    expect(d.kind === "subscription" && d.mappedAction.kind).toBe("on_hold_keep_entitlement");
  });

  it("decodes EXPIRED → expire", () => {
    const env = buildEnvelope({ notificationType: "EXPIRED" });
    const d = decodeAppStoreNotification(env);
    expect(d.kind === "subscription" && d.mappedAction.kind).toBe("expire");
  });

  it("decodes REFUND → revoke", () => {
    const env = buildEnvelope({ notificationType: "REFUND" });
    const d = decodeAppStoreNotification(env);
    expect(d.kind === "subscription" && d.mappedAction.kind).toBe("revoke");
  });

  it("decodes DID_CHANGE_RENEWAL_STATUS:AUTO_RENEW_DISABLED → cancel_keep_entitlement", () => {
    const env = buildEnvelope({ notificationType: "DID_CHANGE_RENEWAL_STATUS", subtype: "AUTO_RENEW_DISABLED" });
    const d = decodeAppStoreNotification(env);
    expect(d.kind === "subscription" && d.mappedAction.kind).toBe("cancel_keep_entitlement");
  });

  it("decodes DID_CHANGE_RENEWAL_STATUS:AUTO_RENEW_ENABLED → noop", () => {
    const env = buildEnvelope({ notificationType: "DID_CHANGE_RENEWAL_STATUS", subtype: "AUTO_RENEW_ENABLED" });
    const d = decodeAppStoreNotification(env);
    expect(d.kind === "subscription" && d.mappedAction.kind).toBe("noop");
  });

  it("decodes REFUND_REVERSED with future expiry → activate", () => {
    const future = Date.now() + 30 * 86400000;
    const env = buildEnvelope({ notificationType: "REFUND_REVERSED", expiresDate: future });
    const d = decodeAppStoreNotification(env);
    expect(d.kind === "subscription" && d.mappedAction.kind).toBe("activate");
  });

  it("REFUND_REVERSED with PAST expiry → downgrades to expire (past-expiry safety)", () => {
    const past = Date.now() - 86400000;
    const env = buildEnvelope({ notificationType: "REFUND_REVERSED", expiresDate: past });
    const d = decodeAppStoreNotification(env);
    expect(d.kind === "subscription" && d.mappedAction.kind).toBe("expire");
  });

  it("decodes ONE_TIME_CHARGE → noop", () => {
    const env = buildEnvelope({ notificationType: "ONE_TIME_CHARGE" });
    const d = decodeAppStoreNotification(env);
    expect(d.kind === "subscription" && d.mappedAction.kind).toBe("noop");
  });

  it("returns kind=test for TEST notification (no data object)", () => {
    const env = { signedPayload: makeJws({ notificationUUID: "uuid-test", notificationType: "TEST", version: "2.0" }) };
    const d = decodeAppStoreNotification(env);
    expect(d.kind).toBe("test");
  });

  it("returns kind=unknown for unrecognized notificationType", () => {
    const env = buildEnvelope({ notificationType: "FUTURE_FANCY_TYPE" });
    const d = decodeAppStoreNotification(env);
    expect(d.kind).toBe("unknown");
    if (d.kind === "unknown") expect(d.notificationType).toBe("FUTURE_FANCY_TYPE");
  });

  it("returns kind=unknown when data.signedTransactionInfo is missing", () => {
    const env = buildEnvelope({ notificationType: "DID_CHANGE_RENEWAL_PREF", omitSignedTransaction: true });
    const d = decodeAppStoreNotification(env);
    expect(d.kind).toBe("unknown");
  });

  it("throws on missing signedPayload", () => {
    expect(() => decodeAppStoreNotification({})).toThrow(DecoderError);
  });

  it("throws on JWS that doesn't have 3 segments", () => {
    expect(() => decodeAppStoreNotification({ signedPayload: "a.b" })).toThrow(DecoderError);
  });

  it("throws on invalid JSON in JWS payload", () => {
    expect(() => decodeAppStoreNotification({ signedPayload: "header.!notvalidbase64json!.sig" })).toThrow(DecoderError);
  });
});
```

- [ ] **Step 2.3: Run + commit**

```bash
cd apps/server && bun test src/features/billing/app-store.decoder.test.ts
```

Expected: 17 pass.

```bash
git add apps/server/src/features/billing/app-store.decoder.ts apps/server/src/features/billing/app-store.decoder.test.ts
git commit -m "feat(billing): app store JWS decoder — pure parser + state-machine mapping"
```

---

## Task 3 — Service: `applyAppStoreEvent`, `processAppStoreEnvelope`, `linkAppStorePurchase`

**Files:**
- Modify: `apps/server/src/features/billing/billing.service.ts`
- Modify: `apps/server/src/features/billing/billing.service.test.ts`

- [ ] **Step 3.1: Implement the new service methods**

Add imports at the top of `billing.service.ts`:

```ts
import type { DecodedAppStoreEvent } from "./app-store.decoder";
import { decodeAppStoreNotification } from "./app-store.decoder";
```

Add inside the `BillingService` class (alongside the existing Google methods):

```ts
/** Apple webhook entry point. Same orchestration as processGooglePlayEnvelope:
 *  decode → dedup → state machine → queue post-commit ultra effect. */
async processAppStoreEnvelope(envelope: unknown): Promise<Result<{ notificationUUID: string; kind: string }, AppError>> {
  let decoded: DecodedAppStoreEvent;
  try {
    decoded = decodeAppStoreNotification(envelope);
  } catch (e) {
    return err(new AppError(`MALFORMED_ENVELOPE: ${(e as Error).message}`, 200, "MALFORMED_ENVELOPE"));
  }

  if (decoded.kind === "test") {
    await this.repo.insertEvent(this.db, {
      provider: "app_store",
      messageId: decoded.notificationUUID,
      eventType: "TEST",
      purchaseToken: null,
      payload: { kind: "test" },
    });
    return ok({ notificationUUID: decoded.notificationUUID, kind: "test" });
  }

  const effect = await this.db.transaction(async (tx) => {
    const eventType = decoded.kind === "subscription" ? decoded.notificationType : `UNKNOWN_${decoded.notificationType}`;
    const purchaseToken = decoded.kind === "subscription" ? decoded.originalTransactionId : decoded.originalTransactionId;
    const inserted = await this.repo.insertEvent(tx, {
      provider: "app_store",
      messageId: decoded.notificationUUID,
      eventType,
      purchaseToken,
      payload: decoded as unknown as Record<string, unknown>,
    });
    if (!inserted) {
      return { kind: "none" } as PostCommitUltraEffect;
    }

    if (decoded.kind === "unknown") {
      await this.repo.markEventProcessed(tx, inserted.id);
      return { kind: "none" } as PostCommitUltraEffect;
    }

    let sub = await this.repo.findSubscriptionByToken(tx, "app_store", decoded.originalTransactionId);
    if (!sub) {
      sub = await this.repo.createOrphanSubscription(tx, "app_store", decoded.originalTransactionId);
    }

    const { newStatus, newPeriodEnd, ultraEffect } = this.applyAppStoreEvent(decoded, sub);
    await this.repo.updateSubscriptionState(tx, sub.id, { status: newStatus, currentPeriodEnd: newPeriodEnd });

    if (sub.userId === null) {
      return { kind: "none" } as PostCommitUltraEffect;
    }
    await this.repo.markEventProcessed(tx, inserted.id);
    return ultraEffect;
  });

  await this.applyUltraEffect(effect);
  return ok({ notificationUUID: decoded.notificationUUID, kind: decoded.kind });
}

/** Pure state-machine for App Store events. Mirror of the Google `applyDecodedEvent`. */
applyAppStoreEvent(
  decoded: DecodedAppStoreEvent,
  sub: SubscriptionRow,
): { newStatus: SubscriptionStatus; newPeriodEnd: Date | null; ultraEffect: PostCommitUltraEffect } {
  if (decoded.kind !== "subscription") {
    return { newStatus: sub.status, newPeriodEnd: sub.currentPeriodEnd, ultraEffect: { kind: "none" } };
  }
  const grant = (end: Date): PostCommitUltraEffect =>
    sub.userId !== null
      ? { kind: "grant", userId: sub.userId, expiresAt: end, excludeSubscriptionId: sub.id }
      : { kind: "none" };
  const revoke = (): PostCommitUltraEffect =>
    sub.userId !== null
      ? { kind: "revoke_if_no_other_active", userId: sub.userId, excludeSubscriptionId: sub.id }
      : { kind: "none" };

  switch (decoded.mappedAction.kind) {
    case "activate":
      return {
        newStatus: "active",
        newPeriodEnd: decoded.mappedAction.expiresDate,
        ultraEffect: grant(decoded.mappedAction.expiresDate),
      };
    case "in_grace":
      return { newStatus: "in_grace", newPeriodEnd: sub.currentPeriodEnd, ultraEffect: { kind: "none" } };
    case "cancel_keep_entitlement":
      return { newStatus: "canceled", newPeriodEnd: sub.currentPeriodEnd, ultraEffect: { kind: "none" } };
    case "on_hold_keep_entitlement":
      return { newStatus: "on_hold", newPeriodEnd: sub.currentPeriodEnd, ultraEffect: { kind: "none" } };
    case "expire":
      return { newStatus: "expired", newPeriodEnd: sub.currentPeriodEnd, ultraEffect: revoke() };
    case "revoke":
      return { newStatus: "revoked", newPeriodEnd: sub.currentPeriodEnd, ultraEffect: revoke() };
    case "noop":
      return { newStatus: sub.status, newPeriodEnd: sub.currentPeriodEnd, ultraEffect: { kind: "none" } };
  }
}

async linkAppStorePurchase(
  userId: string,
  body: { originalTransactionId: string; productId: string },
): Promise<Result<GooglePlayLinkResponse, AppError>> {
  const effects: PostCommitUltraEffect[] = [];
  const finalRow = await this.db.transaction(async (tx) => {
    const existing = await this.repo.findSubscriptionByToken(tx, "app_store", body.originalTransactionId);
    let sub: SubscriptionRow;
    if (!existing) {
      const created = await this.repo.upsertLinkedSubscription(tx, {
        userId, provider: "app_store", productId: body.productId, token: body.originalTransactionId,
      });
      sub = created.subscription;
    } else if (existing.userId !== null && existing.userId !== userId) {
      throw new ConflictError("PURCHASE_TOKEN_OWNED_BY_OTHER_USER");
    } else if (existing.userId === userId) {
      sub = existing;
    } else {
      sub = await this.repo.claimOrphanSubscription(tx, existing.id, userId, body.productId);
    }

    const parked = await this.repo.listUnprocessedEventsForToken(tx, "app_store", body.originalTransactionId);
    for (const event of parked) {
      const decoded = event.payload as unknown as DecodedAppStoreEvent;
      if (decoded.kind !== "subscription") {
        await this.repo.markEventProcessed(tx, event.id);
        continue;
      }
      const fresh = await this.repo.findSubscriptionByToken(tx, "app_store", body.originalTransactionId);
      if (!fresh) throw new Error("replay: subscription disappeared mid-transaction");
      sub = fresh;
      const { newStatus, newPeriodEnd, ultraEffect } = this.applyAppStoreEvent(decoded, sub);
      await this.repo.updateSubscriptionState(tx, sub.id, { status: newStatus, currentPeriodEnd: newPeriodEnd });
      await this.repo.markEventProcessed(tx, event.id);
      effects.push(ultraEffect);
    }
    const final = await this.repo.findSubscriptionByToken(tx, "app_store", body.originalTransactionId);
    if (!final) throw new Error("link: subscription disappeared mid-transaction");
    return final;
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
```

(`GooglePlayLinkResponse` is already imported in the file from Phase 2E.4. If not, add the import.)

- [ ] **Step 3.2: Add service tests**

Extend `billing.service.test.ts` with a new `describe("BillingService — App Store", ...)` block (after the existing block). Use the same `buildSut` harness from Task 5 of Phase 2E.4 — it's already provider-agnostic since it mocks repo methods by name.

Required cases (minimum 8):

1. **SUBSCRIBED with linked sub** → state=active, currentPeriodEnd=expiresDate (NOT now+30d), ultra.grant called with expiresDate.
2. **DID_RENEW** → active, ultra.grant with new expiresDate.
3. **DID_FAIL_TO_RENEW (no subtype)** → status=on_hold, no Ultra change.
4. **DID_FAIL_TO_RENEW:GRACE_PERIOD** → status=in_grace, no Ultra change.
5. **EXPIRED with no other active** → revoke called.
6. **EXPIRED with other active sub** → revoke NOT called (multi-sub guard reused).
7. **REFUND_REVERSED future expiry** → active, ultra.grant.
8. **Duplicate notificationUUID** → no state change, no Ultra call.
9. **TEST** → audit insert with eventType="TEST", no other action.
10. **Link with conflict (other user owns token)** → ConflictError thrown.
11. **Bonus: multi-sub GRANT guard with App Store** — another active sub with LATER end → ultra.grant uses MAX.

The cases follow the exact same shape as the Google Play tests. The mock harness's `buildSut` needs only minor extension: add a builder for App Store envelopes:

```ts
function buildAppStoreEnvelope(notificationType: string, opts: { subtype?: string; expiresDate?: number; originalTransactionId?: string; notificationUUID?: string } = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "ES256" })).toString("base64url");
  const tx = {
    originalTransactionId: opts.originalTransactionId ?? "tok",
    productId: "pruvi_ultra_monthly",
    expiresDate: opts.expiresDate ?? Date.now() + 30 * 86400000,
    environment: "Production",
  };
  const innerJws = `${header}.${Buffer.from(JSON.stringify(tx)).toString("base64url")}.sig`;
  const outer: Record<string, unknown> = {
    notificationUUID: opts.notificationUUID ?? "uuid-1",
    notificationType,
    version: "2.0",
    signedDate: Date.now(),
    data: { signedTransactionInfo: innerJws, environment: "Production" },
  };
  if (opts.subtype) outer.subtype = opts.subtype;
  return { signedPayload: `${header}.${Buffer.from(JSON.stringify(outer)).toString("base64url")}.sig` };
}
```

- [ ] **Step 3.3: Run + commit**

```bash
cd apps/server && bun test src/features/billing/
```

Expected: 34 prior + ~12 new = 46 pass. (Decoder tests already at 17 from Task 2 + 11 service Google + 8 repo integration = 36 base; + new App Store service tests.)

```bash
git add apps/server/src/features/billing/billing.service.ts apps/server/src/features/billing/billing.service.test.ts
git commit -m "feat(billing): app store — applyAppStoreEvent state machine, processAppStoreEnvelope, linkAppStorePurchase"
```

---

## Task 4 — Routes: webhook (URL-path token) + link, plus integration tests

**Files:**
- Modify: `apps/server/src/features/billing/billing.route.ts`
- Modify: `apps/server/src/features/billing/billing.repository.integration.test.ts` (add the cross-provider coexistence test from spec A19)

- [ ] **Step 4.1: Add the two routes**

In `billing.route.ts`, alongside the existing Google routes, add:

```ts
import { AppStoreLinkBodySchema, AppStoreLinkResponseSchema } from "@pruvi/shared";
// ...

async function appStorePathGuard(request: FastifyRequest) {
  if (!env.APP_STORE_WEBHOOK_TOKEN) {
    throw new AppError("WEBHOOK_DISABLED", 503, "WEBHOOK_DISABLED");
  }
  const { token } = request.params as { token: string };
  if (typeof token !== "string") {
    throw new NotFoundError("Not Found");
  }
  const a = Buffer.from(token);
  const b = Buffer.from(env.APP_STORE_WEBHOOK_TOKEN);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new NotFoundError("Not Found"); // 404 to keep endpoint URL-obscure
  }
}

// Inside billingRoutes:
fastify.post(
  "/webhooks/app-store/:token",
  {
    schema: {
      params: z.object({ token: z.string() }),
      body: z.unknown(),
      response: {
        200: z.object({
          success: z.literal(true),
          data: z.object({ received: z.boolean(), notificationUUID: z.string().optional(), kind: z.string().optional(), error: z.string().optional() }),
        }),
      },
    },
    preHandler: [appStorePathGuard],
  },
  async (request) => {
    const result = await service.processAppStoreEnvelope(request.body);
    if (result.isErr()) {
      const error = result.error;
      if (error.code === "MALFORMED_ENVELOPE") {
        fastify.log.warn({ err: error.message }, "app-store webhook malformed envelope");
        return successResponse({ received: false, error: "MALFORMED_ENVELOPE" });
      }
      fastify.log.error({ err: error.message }, "app-store webhook processing failed");
      return successResponse({ received: false, error: "PROCESSING_FAILED" });
    }
    return successResponse({ received: true, notificationUUID: result.value.notificationUUID, kind: result.value.kind });
  },
);

fastify.post(
  "/billing/app-store/link",
  {
    preHandler: [fastify.authenticate],
    schema: {
      body: AppStoreLinkBodySchema,
      response: { 200: z.object({ success: z.literal(true), data: AppStoreLinkResponseSchema }) },
    },
  },
  async (request) => {
    const data = unwrapResult(await service.linkAppStorePurchase(request.userId, request.body)).data;
    return successResponse(data);
  },
);
```

Also import `NotFoundError` from `../../utils/errors` if it isn't already imported (verify with the existing imports).

- [ ] **Step 4.2: Add cross-provider repo integration test (A19)**

Append to `billing.repository.integration.test.ts`, inside the existing top-level `describe`, before the closing `});`:

```ts
it("cross-provider: same message_id string for google_play and app_store coexist (composite UNIQUE)", async () => {
  const a = await repo.insertEvent(db, { provider: "google_play", messageId: "shared-id", eventType: "PURCHASED", purchaseToken: "tA", payload: {} });
  const b = await repo.insertEvent(db, { provider: "app_store", messageId: "shared-id", eventType: "SUBSCRIBED", purchaseToken: "tB", payload: {} });
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  expect(a!.id).not.toBe(b!.id);
});

it("cross-provider: same purchase_token string for google_play and app_store coexist", async () => {
  const a = await repo.createOrphanSubscription(db, "google_play", "shared-token");
  const b = await repo.createOrphanSubscription(db, "app_store", "shared-token");
  expect(a.id).not.toBe(b.id);
  expect(a.provider).toBe("google_play");
  expect(b.provider).toBe("app_store");
});
```

- [ ] **Step 4.3: Run + commit**

```bash
cd /Users/cesarcamillo/dev/pruvi/apps/server
bun test src/features/billing/
pnpm check-types 2>&1 | grep -E "billing" | head
```

Expected: tests green; no NEW type errors in billing/ files.

```bash
git add apps/server/src/features/billing/billing.route.ts apps/server/src/features/billing/billing.repository.integration.test.ts
git commit -m "feat(billing): app store routes — POST /webhooks/app-store/:token (url-path auth), POST /billing/app-store/link; cross-provider repo tests"
```

---

## Task 5 — Final typecheck, push, PR

- [ ] **Step 5.1: Full repo typecheck**

```bash
cd /Users/cesarcamillo/dev/pruvi && pnpm check-types 2>&1 | tail -30
```

If new billing errors surface (unused vars, type narrowing), fix surgically. Pre-existing errors in unrelated files (questions, reviews tests) are not this phase's concern.

- [ ] **Step 5.2: Final test sweep**

```bash
cd /Users/cesarcamillo/dev/pruvi/apps/server && bun test src/features/billing/
cd /Users/cesarcamillo/dev/pruvi/packages/shared && bun test src/billing.test.ts
```

- [ ] **Step 5.3: Push + PR**

```bash
git push -u origin feature/phase-2e5-app-store-webhooks
gh pr create --title "feat: phase 2e.5 — app store server notifications v2 (ultra entitlement, ios parity)" --body "$(cat <<'EOF'
## Summary
- Apple ASSN V2 adapter wired into the existing billing module from 2E.4
- Reuses `subscription`/`billing_event` tables and `applyUltraEffect` (multi-sub guards) unchanged
- Separate Apple decoder + state machine (`applyAppStoreEvent`) sibling to the Google one
- **URL-path token auth** (Apple cannot inject custom headers): `POST /webhooks/app-store/:token` against `env.APP_STORE_WEBHOOK_TOKEN` (min 32 chars)
- Real `expiresDate` from `signedTransactionInfo` — strict improvement over Google's 30-day default
- DID_FAIL_TO_RENEW (no grace) maps to `on_hold` (billing failure, not user choice)
- REFUND_REVERSED with past `expiresDate` → safe downgrade to `expire`
- Renamed `processWebhookEnvelope` → `processGooglePlayEnvelope` for symmetry
- App Store JWS signature verification deferred (production hardening)

## Workflow gates
- ✅ Gate A — spec self-review (2 blockers fixed: header→URL-path token, dedicated state machine + rename + ONE_TIME_CHARGE/on_hold/decoder ordering)
- ✅ Gate B — plan self-review
- ✅ Gate C — per-task review after every commit
- ✅ Gate D — final spec-coverage review

## Test plan
- [ ] Decoder unit tests: 17 cases (all major notification types, past-expiry safety, TEST, unknown, malformed JWS)
- [ ] Service unit tests: 11+ new cases for App Store paths
- [ ] Repository integration: cross-provider message_id and purchase_token coexistence
- [ ] Manual: POST /webhooks/app-store/<token> with valid signedPayload → 200 + subscription state updated; POST with bad token → 404
EOF
)"
```

---

## Self-review checklist (post Gate B)

1. **Spec coverage A1–A19:** A1/A2 → T4 (path-token guard); A3 → T3 (dedup via insertEvent); A4 → T3/T4; A5 → T3 (same-user idempotent); A6 → T3 (ConflictError); A7/A8 → T3 (activate path); A9 → T3 (expire path); A10 → T3 (cancel_keep_entitlement); A11 → T3 (REFUND_REVERSED activate); A12 → T3 (orphan + replay); A13/A14 → applyUltraEffect reuse (verified by reuse, not rewritten); A15 → T3 reuse; A16 → T1 env; A17 → T2 decoder (16 mapped types + ONE_TIME_CHARGE); A18 → fastify.log; A19 → T4 cross-provider test.
2. **Placeholder scan:** none.
3. **Type consistency:** `DecodedAppStoreEvent.mappedAction.kind` matches the switch in `applyAppStoreEvent`. The `on_hold_keep_entitlement` action is new (in addition to `cancel_keep_entitlement`); verify both exist in the spec table and the decoder mapping.
4. **No raw SQL where Drizzle helpers exist:** repo unchanged from 2E.4.
5. **Migration safety:** none required (schema accepts `app_store` from 2E.4).
