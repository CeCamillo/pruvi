# Phase 2E.4 — Billing Webhooks: Google Play (Design Spec)

**Status:** v1
**Date:** 2026-05-12
**Branch:** `feature/phase-2e4-billing-webhooks`
**Product source:** `pruvi-freatures.md` §5.1 (Ultra subscription, "Cobrança via Google Play / App Store billing")

---

## 1. Goal

Wire Google Play Real-Time Developer Notifications (RTDN) to the existing Ultra entitlement so that subscription purchases, renewals, and cancellations grant or revoke Ultra automatically — replacing the current admin-only manual grant path.

## 2. Non-goals

- **App Store Server Notifications V2** integration. Deferred to Phase 2E.5. The data model and abstractions in this phase MUST accommodate a future App Store adapter without schema changes, but the App Store webhook endpoint and decoder are out of scope here.
- **Google Play Developer API "subscriptionsv2.get" verification**. v1 trusts the webhook payload after secret verification. Adding a server-to-server verification call (to confirm the purchase token is real and current) is a deferred hardening step.
- **Google Cloud Pub/Sub push-subscription integration with OIDC authentication**. v1 uses a shared-secret HMAC header (`X-Pruvi-Webhook-Token`) on the receiving endpoint. Real Pub/Sub OIDC auth is deferred to infrastructure ticket.
- **Referral-shield reward** (§4 of product doc — "ganha +100 XP ou 1 escudo de streak"). Existing invitations grant XP only; converting to optional shield grant is deferred to a separate phase.
- **Protect-streak push notification** (§5.3 — "Seu escudo protegeu seu streak de X dias!"). The shield auto-protect already exists; the push hook is deferred.
- **Refund handling.** REVOKED notifications are processed (per §6 state table) but explicit one-time-purchase refunds (vs subscription refund) are not in scope (we have no one-time purchases yet).
- **Price-change consent UX.** PRICE_CHANGE_CONFIRMED is treated as a no-op in v1.
- **Family-share, promo codes, manual extensions.** Out of scope.

## 3. Concepts

- **Provider**: `"google_play"` (v1). The DB schema includes the field so `"app_store"` can be added later without migrations.
- **Purchase token**: opaque string Google issues per (user, productId, subscription period). Stable across renewals for the same subscription instance — Google explicitly recommends using it as the long-term identifier.
- **Linking**: After the client completes a purchase via the Google Play Billing SDK, it MUST call `POST /billing/google-play/link` with the `purchaseToken` and `productId` so the server can associate the token with the authenticated `userId`. Without linking, incoming webhook events for that token are stored as audit rows but cannot grant Ultra (no user attribution).
- **Idempotency**: Each RTDN event arrives via Pub/Sub with a `messageId`. We dedupe on `(provider, message_id)` at the audit log level so retries do not double-process.

## 4. Mechanic

1. User purchases Ultra via the Google Play Billing SDK in the mobile app.
2. Mobile app receives a `purchaseToken` and calls `POST /billing/google-play/link { purchaseToken, productId }`.
3. Server upserts a `subscription` row keyed by `(provider, purchase_token)` with `user_id` set, `status = "pending"`, `product_id` set, `current_period_end = NULL`.
4. Google Play eventually sends an RTDN to our Pub/Sub topic; Pub/Sub push delivery hits our webhook endpoint `POST /webhooks/google-play`.
5. Webhook handler verifies the shared-secret header, decodes the base64 payload, deduplicates by `(provider, message_id)`, parses the `subscriptionNotification`, and dispatches based on `notificationType`.
6. Each handled event records a `billing_event` audit row, optionally updates the `subscription` row, and optionally calls `UltraService.grant` or `UltraService.revoke`.
7. The user's `users.isUltra` and `users.ultraExpiresAt` reflect the current entitlement.

Race-safety: linking before the webhook fires is the expected order; the webhook fires before linking is also possible (especially in a slow-network scenario). The handler MUST store the event regardless of whether a `subscription` row exists; if no row exists yet, the audit row is parked with `user_id = NULL` and the subscription is **created** in `pending` state. When the link call later arrives, the existing `pending` subscription row is updated with the `user_id`, and any unprocessed audit rows for that token are replayed inside the same transaction (best-effort; documented as a known limit if Pub/Sub retries don't naturally redeliver).

## 5. Data model

### 5.1 `subscription`

```sql
CREATE TABLE subscription (
  id                  SERIAL PRIMARY KEY,
  user_id             TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  provider            TEXT NOT NULL CHECK (provider IN ('google_play','app_store')),
  product_id          TEXT NOT NULL,
  purchase_token      TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('pending','active','in_grace','on_hold','paused','canceled','expired','revoked')),
  current_period_end  TIMESTAMP WITH TIME ZONE,
  linked_at           TIMESTAMP WITH TIME ZONE,
  created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT subscription_provider_token_uq UNIQUE (provider, purchase_token)
);
CREATE INDEX subscription_user_idx ON subscription (user_id);
CREATE INDEX subscription_status_idx ON subscription (status);
```

Notes:
- `user_id` is nullable to handle the race where a webhook arrives before linking.
- `ON DELETE SET NULL` so deleting a user (LGPD/right-to-be-forgotten) preserves the audit subscription record without orphan FK errors.
- `status` transitions are validated in `BillingService`; the DB CHECK is a safety net.

### 5.2 `billing_event`

```sql
CREATE TABLE billing_event (
  id            SERIAL PRIMARY KEY,
  provider      TEXT NOT NULL CHECK (provider IN ('google_play','app_store')),
  message_id    TEXT NOT NULL,           -- Pub/Sub message ID (or App Store notificationUUID later)
  event_type    TEXT NOT NULL,           -- e.g. "SUBSCRIPTION_PURCHASED"
  purchase_token TEXT,                   -- nullable: some events don't carry a token (test/init)
  payload       JSONB NOT NULL,
  received_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at  TIMESTAMP WITH TIME ZONE,
  processing_error TEXT,
  CONSTRAINT billing_event_provider_message_uq UNIQUE (provider, message_id)
);
CREATE INDEX billing_event_token_idx ON billing_event (purchase_token);
CREATE INDEX billing_event_unprocessed_idx ON billing_event (processed_at) WHERE processed_at IS NULL;
```

Notes:
- `UNIQUE (provider, message_id)` is the idempotency guard. Duplicate Pub/Sub deliveries are no-ops at the DB level via ON CONFLICT.
- `processing_error` records the error string when a handler fails (so retries can be diagnosed); the row is committed BEFORE any state-mutating logic so a crash mid-process leaves an audit trail.

## 6. Google Play notification → state machine

| `notificationType` | Name | Action on subscription | Action on Ultra |
|---|---|---|---|
| 1 | RECOVERED | status → `active`, currentPeriodEnd from payload (if present; else keep) | grant until currentPeriodEnd |
| 2 | RENEWED | status → `active`, currentPeriodEnd from payload | grant until currentPeriodEnd |
| 3 | CANCELED | status → `canceled` (still entitled until period end) | leave grant in place until expiry |
| 4 | PURCHASED | status → `active`, set currentPeriodEnd from payload | grant until currentPeriodEnd |
| 5 | ON_HOLD | status → `on_hold` | revoke |
| 6 | IN_GRACE_PERIOD | status → `in_grace` | leave grant in place |
| 7 | RESTARTED | status → `active` | grant until currentPeriodEnd |
| 8 | PRICE_CHANGE_CONFIRMED | no-op on status | no-op |
| 9 | DEFERRED | no-op on status (rare; admin-initiated extension) | no-op |
| 10 | PAUSED | status → `paused` | revoke |
| 11 | PAUSE_SCHEDULE_CHANGED | no-op | no-op |
| 12 | REVOKED | status → `revoked` | revoke |
| 13 | EXPIRED | status → `expired` | revoke |

**Rationale notes:**
- "Leave grant in place" for CANCELED matches Google's policy: users who cancel mid-cycle retain benefits until period end. EXPIRED will fire at the period end and trigger revocation.
- ON_HOLD and PAUSED revoke immediately because the user has lost payment method or paused billing; behavior aligns with Google's recommended UX.
- IN_GRACE_PERIOD does NOT revoke (Google's grace allows the user to update payment without losing access).

**Note on payload shape:** the RTDN body wraps a `subscriptionNotification` object with `purchaseToken`, `subscriptionId` (= productId), and `notificationType`. The payload does NOT include `currentPeriodEnd` directly. v1 has a documented gap: without calling Google Play Developer API to fetch the subscription state, we don't know the exact `expiryTimeMillis`. For v1, we set `currentPeriodEnd = now + 30 days` on PURCHASED/RENEWED/RECOVERED/RESTARTED as a conservative default. This is wrong by up to several days but ensures we never grant Ultra past a renewal failure. **Deferred hardening:** call `androidpublisher.purchases.subscriptionsv2.get` to fetch the real expiry.

## 7. Architecture

### 7.1 Module layout

```
apps/server/src/features/billing/
├── billing.repository.ts
├── billing.repository.integration.test.ts
├── billing.service.ts
├── billing.service.test.ts
├── billing.route.ts          # POST /billing/google-play/link
├── google-play.webhook.ts    # POST /webhooks/google-play
├── google-play.decoder.ts    # parse + state-machine helper (pure)
├── google-play.decoder.test.ts
└── index.ts
```

Why split `google-play.decoder.ts` from `billing.service.ts`: the decoder is pure and easy to unit-test against fixture payloads. The service composes the decoder with the repository (which has side effects).

### 7.2 Layering

- **Webhook route** (`google-play.webhook.ts`): verifies shared-secret header, parses Pub/Sub envelope, dispatches to service. Returns 200 even on application-level errors (so Pub/Sub doesn't retry forever); errors are recorded in `billing_event.processing_error`.
- **Link route** (`billing.route.ts`): authenticated; upserts the subscription row.
- **Service** (`billing.service.ts`): orchestrates dedup → audit row insert → state-machine dispatch → subscription update → Ultra grant/revoke. Receives an injected `UltraService` reference.
- **Decoder** (`google-play.decoder.ts`): pure function `decodeGooglePlayPubSubEnvelope(raw)` returning `{ messageId, eventType, purchaseToken, notificationType, productId }`. No DB or HTTP.
- **Repository** (`billing.repository.ts`): Drizzle queries for subscriptions and events. All writes in a single transaction when crossing both tables.

### 7.3 Shared-secret webhook auth

The `/webhooks/google-play` endpoint expects an `X-Pruvi-Webhook-Token` header that matches `env.GOOGLE_PLAY_WEBHOOK_TOKEN`. Constant-time comparison via `timingSafeEqual`. If the token is missing in env, the endpoint returns `503 ADMIN_DISABLED` (matching the existing admin-route pattern). If the token doesn't match, 401.

Real Pub/Sub OIDC auth is deferred. The shared-secret model is acceptable for a non-public infrastructure endpoint behind a known CDN/proxy IP allowlist.

### 7.4 Pub/Sub envelope

Google sends:
```json
{
  "message": {
    "messageId": "1234567890",
    "publishTime": "2026-05-12T10:00:00Z",
    "data": "<base64-encoded JSON>",
    "attributes": { ... }
  },
  "subscription": "projects/PROJECT/subscriptions/SUB"
}
```

The decoder:
1. Reads `message.messageId` → audit dedup key.
2. base64-decodes `message.data` → the inner notification JSON.
3. Reads `subscriptionNotification.purchaseToken`, `subscriptionNotification.notificationType`, `subscriptionNotification.subscriptionId` (productId).
4. Maps `notificationType` integer → enum string (see §6).
5. Returns the structured decoded event.

If the inner payload is a `testNotification` (Google sends test pings to verify the endpoint), the decoder returns `{ kind: "test" }`. The service records the audit row but takes no further action.

### 7.5 Logging

All webhook activity (received, decoded, processed, errors) goes through `fastify.log` (structured). No `console.error`. Audit trail is the `billing_event` table; logs are for ops visibility.

## 8. API surface

### 8.1 `POST /webhooks/google-play`

**Auth:** `X-Pruvi-Webhook-Token` header matches `env.GOOGLE_PLAY_WEBHOOK_TOKEN`.
**Body:** Pub/Sub push envelope (see §7.4).
**Response:**
- `200 { received: true, messageId }` — always returned when the message is accepted (even if processing later failed; processing errors are recorded in the audit row and inspected via ops tooling, NOT signaled back to Pub/Sub).
- `401` — bad token.
- `503` — env token not configured.
- `400` — malformed envelope (NOT a Pub/Sub-recognized retryable shape; signals a real bug, so we DO want Pub/Sub to retry-with-backoff so we get alerted).

### 8.2 `POST /billing/google-play/link`

**Auth:** `fastify.authenticate` (logged-in user).
**Body:**
```ts
GooglePlayLinkBodySchema = z.object({
  purchaseToken: z.string().min(1),
  productId: z.string().min(1),
});
```
**Response:**
```ts
GooglePlayLinkResponseSchema = z.object({
  subscription: z.object({
    id: z.number().int(),
    status: z.enum(["pending","active","in_grace","on_hold","paused","canceled","expired","revoked"]),
    productId: z.string(),
    currentPeriodEnd: z.string().nullable(),
  }),
});
```

Semantics:
- Upserts on `(provider="google_play", purchase_token)`.
- If a row exists with a different `user_id` already set: returns `409 PURCHASE_TOKEN_OWNED_BY_OTHER_USER`. (Defense against a malicious client copying another user's token.)
- If a row exists with no `user_id`: claims it by setting `user_id` and replays any unprocessed `billing_event` rows for that token inside the transaction.
- If no row exists: creates one with `status = "pending"`.
- `linked_at` set to now() on the first time `user_id` is set.

## 9. Migration

`packages/db/src/migrations/0010_<name>.sql` (auto-named by drizzle-kit). Creates `subscription` and `billing_event` per §5. No data backfill.

## 10. Testing strategy

**Unit** (`google-play.decoder.test.ts`):
- Decode each of the 13 `notificationType` values from a fixture envelope; assert eventType + productId + purchaseToken.
- Decode a `testNotification`-shaped envelope; assert `kind === "test"`.
- Decode an unknown notificationType; assert returns `{ kind: "unknown", raw: ... }` (handler will log and audit but not act).
- Malformed base64 / malformed JSON → throws.

**Service unit** (`billing.service.test.ts`, mocked repo + UltraService):
- PURCHASED on a not-yet-linked token → audit row inserted with user_id=null, subscription created pending, NO Ultra grant.
- PURCHASED on a linked token → audit row + subscription→active + Ultra granted with currentPeriodEnd=now+30d.
- RENEWED → currentPeriodEnd advanced; Ultra re-granted.
- CANCELED on active subscription → status→canceled; Ultra grant unchanged (still entitled until expiry).
- EXPIRED → status→expired; Ultra revoked.
- REVOKED → status→revoked; Ultra revoked.
- IN_GRACE_PERIOD → status→in_grace; Ultra unchanged.
- ON_HOLD / PAUSED → revoked.
- Duplicate `messageId` → no-op (audit dedup), returns success.

**Integration** (`billing.repository.integration.test.ts`, real Postgres):
- Audit dedup: inserting two events with the same `(provider, message_id)` produces one row.
- Subscription upsert: link → webhook RENEWED → state visible.
- Pre-link webhook: insert audit row + create pending subscription; subsequent link call associates `user_id` and replays the audit row to grant Ultra.
- Race: link arrives concurrently with the same webhook; the UNIQUE constraint protects.
- Cascade: deleting a user with linked subscriptions sets `user_id = NULL` (ON DELETE SET NULL).

## 11. Acceptance criteria

A1. `POST /webhooks/google-play` with a valid `X-Pruvi-Webhook-Token` header and a well-formed Pub/Sub envelope returns 200.
A2. With a missing/invalid header → 401; with no env token configured → 503.
A3. Duplicate Pub/Sub deliveries (same `messageId`) are stored only once; the second response still returns 200 (Pub/Sub acks).
A4. `POST /billing/google-play/link` with `{ purchaseToken, productId }` creates a `subscription` row in `pending` status owned by the authenticated user.
A5. Re-calling `link` with the same token by the same user is idempotent (no error, returns the existing subscription).
A6. Calling `link` with a token already owned by a different `user_id` returns `409 PURCHASE_TOKEN_OWNED_BY_OTHER_USER`.
A7. Receiving a `PURCHASED` webhook for a linked token: `subscription.status = active`, `current_period_end ≈ now + 30 days`, `user.isUltra = true`, `user.ultraExpiresAt ≈ now + 30d`.
A8. Receiving an `EXPIRED` webhook for an active subscription: `subscription.status = expired`, `user.isUltra = false`.
A9. Receiving a `CANCELED` webhook does NOT revoke Ultra — the user retains entitlement until `current_period_end`.
A10. Receiving a webhook BEFORE the link call: `billing_event` row is inserted with `purchase_token` set but `subscription.user_id` is NULL; no Ultra grant occurs. After the matching `link` call: the pending event is replayed and Ultra is granted (if event type warrants).
A11. The state machine in §6 is enforced — each `notificationType` integer maps to the documented status transition and Ultra effect.
A12. The `billing_event` table has UNIQUE `(provider, message_id)` enforced at the DB layer.
A13. The `subscription` table has UNIQUE `(provider, purchase_token)` enforced at the DB layer.
A14. All errors logged via `fastify.log` (structured). No `console.error` in production paths.

## 12. Deferred items

- App Store Server Notifications V2 receiver and decoder (Phase 2E.5).
- Google Play Developer API `subscriptionsv2.get` verification for exact `expiryTimeMillis` (hardening).
- Real Pub/Sub OIDC auth (infra ticket).
- Refund handling for one-time purchases.
- Referral-shield reward integration.
- Protect-streak push notification.
- Background sweeper that polls the Google Play Developer API for subscriptions whose `current_period_end` is approaching (catches missed RTDN deliveries).

## 13. Open questions resolved during design

- **v1 currentPeriodEnd guess vs. real API call:** We accept the 30-day conservative default in v1 and defer the API call to a hardening phase. Rationale: the API call requires a Google service account in env which infra hasn't provisioned. The 30-day default never grants past a missed-renewal event because RENEWED/EXPIRED webhooks fire on time.
- **Shared-secret vs OIDC:** Shared secret for v1; OIDC is an infra ticket. The webhook endpoint must NOT log the secret.
- **One subscription per user?** No. The schema allows multiple `subscription` rows per user (e.g., re-purchase after cancel). The "current" subscription is the one with `status IN ('active', 'in_grace')`.
- **What if `link` is called but the webhook never arrives?** The subscription stays in `pending` indefinitely. No Ultra grant. Acceptable for v1; a future job could expire `pending` rows after 24 hours.
- **What if the user has Ultra from a previous admin grant and then subscribes via Google Play?** The webhook grants Ultra again with the new expiry. The admin grant's expiry is overwritten — which is the right behavior (the paying user's expiry is the source of truth).
