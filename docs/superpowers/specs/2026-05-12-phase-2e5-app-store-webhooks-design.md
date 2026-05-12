# Phase 2E.5 — Billing Webhooks: App Store Server Notifications V2 (Design Spec)

**Status:** v3 (post Gate B: on_hold_keep_entitlement variant explicit in AppStoreMappedAction)
**Date:** 2026-05-12
**Branch:** `feature/phase-2e5-app-store-webhooks`
**Builds on:** Phase 2E.4 (Google Play webhooks) — same `subscription`/`billing_event` schema, same `UltraService`, same multi-sub guards.

---

## 1. Goal

Add an App Store Server Notifications V2 adapter to the existing `billing` module so Apple subscription purchases, renewals, refunds, and revocations grant or revoke Ultra automatically — bringing iOS to parity with Google Play.

## 2. Non-goals

- **JWS x5c certificate-chain signature verification.** Apple signs every notification with a JWS containing the certificate chain in the `x5c` header. Production-correct auth requires validating that chain against Apple's root CA. For v1, we use a **URL-path secret** (not a header — see §7.4) backed by `env.APP_STORE_WEBHOOK_TOKEN`. **Apple does not inject custom headers**, so the Google Play `X-Pruvi-Webhook-Token` header model cannot transfer to Apple. The URL-path secret is the v1 alternative: we configure `https://api.pruvi.app/webhooks/app-store/<APP_STORE_WEBHOOK_TOKEN>` in App Store Connect, the server checks the URL param via constant-time compare. **Real JWS signature verification is deferred** to an infra/hardening ticket.
- **App Store Server API `/inApps/v1/subscriptions/{originalTransactionId}` polling.** No server-to-server reconciliation in v1.
- **Sandbox vs Production discrimination.** Apple sends an `environment` field in every notification (`Sandbox` or `Production`). v1 processes both identically. A future hardening pass may route Sandbox notifications to a separate test DB or reject them outright.
- **`signedRenewalInfo`** parsing (it carries renewal price, status, etc.). v1 reads ONLY `signedTransactionInfo` since that has the data we need (originalTransactionId, expiresDate, productId). `signedRenewalInfo` decoding is deferred.
- **Family-share, promo offers, win-back offers, subscription gifting.** Not handled.
- **One-time consumable purchases.** Out of scope.

## 3. Concepts

- **Apple notification envelope:** Apple POSTs `{ "signedPayload": "<JWS>" }` directly to our URL (no Pub/Sub wrapper). The JWS is a `header.payload.signature` string where the middle segment is base64url-encoded JSON.
- **Inner payload:** decoded JSON contains `notificationType`, optional `subtype`, `notificationUUID` (our dedup key), `data.signedTransactionInfo` (another JWS), `version`, `signedDate`, `data.environment`.
- **`signedTransactionInfo`:** another JWS whose decoded payload carries `transactionId`, `originalTransactionId`, `productId`, `expiresDate` (milliseconds), `bundleId`, `environment`, `originalPurchaseDate`, etc.
- **`originalTransactionId`:** the stable long-term identifier for a subscription instance. Across renewals, this stays the same; `transactionId` changes per renewal. We use `originalTransactionId` as the `subscription.purchase_token` value for the `app_store` provider.
- **`notificationUUID`:** unique per notification delivery. Used as `billing_event.message_id` for idempotency.

## 4. Mechanic

1. User purchases Ultra via Apple's StoreKit on iOS.
2. Mobile app receives the purchase result; reads `originalTransactionId` and `productId`.
3. Mobile app calls `POST /billing/app-store/link { originalTransactionId, productId }`.
4. Server upserts a `subscription` row keyed by `(provider='app_store', purchase_token=originalTransactionId)` with `user_id` set, `status='pending'`, `product_id` set.
5. Apple sends a SUBSCRIBED notification to our configured URL.
6. Webhook handler verifies shared-secret header, parses outer JWS (no signature verification in v1), parses inner `signedTransactionInfo` JWS, deduplicates by `(provider='app_store', notificationUUID)`, dispatches the state machine.
7. State machine (see §6) updates `subscription` and queues Ultra grant/revoke effect.
8. Post-commit, `applyUltraEffect` runs the existing multi-sub GRANT/REVOKE guards (reused from 2E.4) and calls `UltraService.grant` / `.revoke`.

Race-safety: identical to 2E.4 — if the webhook arrives before the link call, the orphan subscription is created with `user_id=NULL` and the event is parked; link replays unprocessed events.

## 5. Data model

**No new tables.** The existing `subscription` and `billing_event` tables already accept `provider='app_store'` (CHECK enum + Drizzle enum in Phase 2E.4). No migration in this phase.

## 6. Apple notification → state machine

The table below maps `(notificationType, subtype)` pairs to our subscription state and Ultra effect. `expiresDate` is from `signedTransactionInfo` (real timestamp, not a default).

| notificationType | subtype | Action on subscription | Action on Ultra |
|---|---|---|---|
| `SUBSCRIBED` | `INITIAL_BUY` | status → `active`, currentPeriodEnd = expiresDate | grant until expiresDate |
| `SUBSCRIBED` | `RESUBSCRIBE` | status → `active`, currentPeriodEnd = expiresDate | grant until expiresDate |
| `DID_RENEW` | (any/null) | status → `active`, currentPeriodEnd = expiresDate | grant until expiresDate |
| `DID_FAIL_TO_RENEW` | `GRACE_PERIOD` | status → `in_grace` | no-op (leave grant) |
| `DID_FAIL_TO_RENEW` | (any other) | status → `on_hold` (billing failed, no grace; user retains entitlement until expiresDate; semantic distinction from user-initiated CANCELED — billing problem, not user choice) | no-op (entitled until expiresDate, then EXPIRED fires and triggers revoke) |
| `EXPIRED` | (any) | status → `expired` | revoke (multi-sub guarded) |
| `GRACE_PERIOD_EXPIRED` | (any) | status → `expired` | revoke (multi-sub guarded) |
| `REFUND` | (any) | status → `revoked` | revoke (multi-sub guarded) |
| `REVOKE` | (any) | status → `revoked` | revoke (multi-sub guarded) |
| `DID_CHANGE_RENEWAL_STATUS` | `AUTO_RENEW_DISABLED` | status → `canceled` (user disabled renewal; still entitled) | no-op |
| `DID_CHANGE_RENEWAL_STATUS` | `AUTO_RENEW_ENABLED` | no-op on status | no-op |
| `DID_CHANGE_RENEWAL_PREF` | (any) | no-op | no-op |
| `OFFER_REDEEMED` | (any) | no-op | no-op |
| `PRICE_INCREASE` | (any) | no-op (consent flow handled by Apple) | no-op |
| `RENEWAL_EXTENDED` | (any) | no-op (admin-initiated extension; expiresDate already updated via DID_RENEW) | no-op |
| `REFUND_DECLINED` | (any) | no-op | no-op |
| `REFUND_REVERSED` | (any) | status → `active` (refund was reversed; treat like SUBSCRIBED) | grant until expiresDate |
| `CONSUMPTION_REQUEST` | (any) | no-op | no-op |
| `ONE_TIME_CHARGE` | (any) | no-op (Pruvi has no consumables; future hardening) | no-op |
| `TEST` | n/a | no-op (record audit only) | no-op |

Unknown `notificationType` values → audit row recorded with `eventType = "UNKNOWN_<type>"`, no state mutation, no Ultra effect. Future Apple additions surface in the audit log for ops triage.

**Rationale notes:**
- `DID_CHANGE_RENEWAL_STATUS:AUTO_RENEW_DISABLED` is the Apple equivalent of Google's CANCELED. User retains entitlement until `expiresDate`.
- `REFUND_REVERSED` is a rare but real case — restoring access. Maps to SUBSCRIBED-like grant.
- `RENEWAL_EXTENDED` is intentionally a no-op since the actual entitlement extension comes through a subsequent `DID_RENEW` with the new `expiresDate`.

## 7. Architecture

### 7.1 Module layout

Additions to the existing `billing` module:

```
apps/server/src/features/billing/
├── app-store.decoder.ts             # NEW: pure JWS parsing + state mapping
├── app-store.decoder.test.ts        # NEW: unit tests on fixture payloads
├── billing.repository.ts            # No changes (already provider-agnostic)
├── billing.service.ts               # Extended: new methods `processAppStoreEnvelope` and `linkAppStorePurchase` reusing the shared `applyUltraEffect`
├── billing.service.test.ts          # Extended: new test cases for Apple paths
├── billing.route.ts                 # Extended: 2 new endpoints
└── index.ts                         # Already exports billingRoutes
```

### 7.2 The decoder

`app-store.decoder.ts` exports `decodeAppStoreNotification(envelope: { signedPayload: string })` returning:

```ts
type DecodedAppStoreEvent =
  | {
      kind: "subscription";
      notificationUUID: string;
      notificationType: string;          // raw Apple type
      subtype: string | null;
      mappedAction: AppStoreMappedAction; // discriminant for the state machine
      originalTransactionId: string;
      productId: string;
      expiresDate: Date | null;          // null only for notifications that don't carry signedTransactionInfo
      environment: "Sandbox" | "Production";
    }
  | { kind: "test"; notificationUUID: string }
  | { kind: "unknown"; notificationUUID: string; notificationType: string; subtype: string | null; originalTransactionId: string | null };
```

`AppStoreMappedAction` is a tagged union mirroring the state-machine rows:

```ts
type AppStoreMappedAction =
  | { kind: "activate"; expiresDate: Date }    // SUBSCRIBED, DID_RENEW, REFUND_REVERSED
  | { kind: "in_grace" }                        // DID_FAIL_TO_RENEW + GRACE_PERIOD
  | { kind: "cancel_keep_entitlement" }         // DID_CHANGE_RENEWAL_STATUS:AUTO_RENEW_DISABLED (user-initiated)
  | { kind: "on_hold_keep_entitlement" }        // DID_FAIL_TO_RENEW (no GRACE_PERIOD subtype) — billing failure, not user choice
  | { kind: "expire" }                          // EXPIRED, GRACE_PERIOD_EXPIRED
  | { kind: "revoke" }                          // REFUND, REVOKE
  | { kind: "noop" };
```

The decoder is **pure** (no DB, no HTTP). Steps (order matters — check TEST first because TEST has no `data` object):
1. Split `signedPayload` on `.` → exactly 3 segments. If not 3, throw `DecoderError`.
2. base64url-decode the middle segment (NOT plain base64 — Apple uses URL-safe alphabet). JSON.parse → outer.
3. Read `notificationUUID`, `notificationType`, `subtype` (optional). **If `notificationType === "TEST"`, return `{ kind: "test", notificationUUID }` immediately** (TEST has no `data` object — accessing it would throw).
4. Read `data.environment`. If `data` or `data.signedTransactionInfo` is missing, return `{ kind: "unknown", ... }` rather than throwing — some Apple notification types carry no transaction info (e.g., DID_CHANGE_RENEWAL_PREF for some subtypes); we don't want to throw on a real Apple payload.
5. Decode `data.signedTransactionInfo` JWS the same way (split on `.`, take middle, base64url-decode, JSON.parse).
6. Read `transaction.originalTransactionId`, `productId`, `expiresDate` (ms → Date).
7. Map `(notificationType, subtype)` to `AppStoreMappedAction` via the table in §6. If the pair is not recognized, return `{ kind: "unknown", notificationType, subtype, originalTransactionId, ... }`.
8. **`activate` past-expiry safety:** if the mapped action is `activate` and `expiresDate < now` (which can happen for REFUND_REVERSED after the original expiry has already passed), downgrade the action to `expire` so we don't grant Ultra into the past. Document this in the decoder code.
9. Return.

**No signature verification in v1.** Document this as `// SECURITY: deferred — see spec §2 non-goals`.

**Test fixture note:** unit-test fixtures must use **base64url** encoding (e.g., `Buffer.from(JSON.stringify(payload)).toString("base64url")`), NOT plain base64. The `.` separator is literal. The third "signature" segment can be a dummy string like `"sig"` since v1 doesn't verify signatures.

### 7.3 The service extensions

The existing `BillingService.applyDecodedEvent(decoded: DecodedGooglePlayEvent, sub)` is Google-specific (typed on the Google decoder and uses `DEFAULT_SUBSCRIPTION_PERIOD_MS`). It is NOT refactored to be generic. Instead this phase adds a parallel `applyAppStoreEvent` and renames the Google webhook entry point for symmetry. Concrete changes:

**Mandatory rename (one call site):** `processWebhookEnvelope` → `processGooglePlayEnvelope` in `billing.service.ts` AND in `billing.route.ts` (the `POST /webhooks/google-play` handler). This is the only call site; no external module imports the old name. Done as a single mechanical rename in Task 1 of the plan.

**New methods on `BillingService`:**
- `processAppStoreEnvelope(envelope: unknown)` — analogous to `processGooglePlayEnvelope`. Calls `decodeAppStoreNotification`, dedups via `insertEvent`, dispatches via the new `applyAppStoreEvent`, queues post-commit `PostCommitUltraEffect`.
- `linkAppStorePurchase(userId, { originalTransactionId, productId })` — analogous to `linkGooglePlayPurchase` but for `provider='app_store'`. Same orphan-claim + parked-event replay flow. The replay loop calls `applyAppStoreEvent` for events of provider `app_store` (it inspects the audit row's payload shape; see §7.6 below).
- `applyAppStoreEvent(decoded: DecodedAppStoreEvent, sub: SubscriptionRow)` — **NEW**, sibling to the existing Google-specific `applyDecodedEvent`. Pure (no DB writes). Returns `{ newStatus, newPeriodEnd, ultraEffect }`. Branches on `decoded.mappedAction.kind`:
  - `"activate"` → newStatus = `"active"`, newPeriodEnd = `mappedAction.expiresDate`, `ultraEffect = grant(mappedAction.expiresDate)`.
  - `"in_grace"` → newStatus = `"in_grace"`, keep period end, `ultraEffect = noop`.
  - `"cancel_keep_entitlement"` → newStatus = `"canceled"`, keep period end, `ultraEffect = noop`.
  - `"on_hold_keep_entitlement"` → newStatus = `"on_hold"`, keep period end, `ultraEffect = noop`.
  - `"expire"` → newStatus = `"expired"`, keep period end, `ultraEffect = revoke`.
  - `"revoke"` → newStatus = `"revoked"`, keep period end, `ultraEffect = revoke`.
  - `"noop"` → no state change, `ultraEffect = noop`.

`grant` and `revoke` helpers reuse the existing `PostCommitUltraEffect` type from Google Play, parameterized with `excludeSubscriptionId = sub.id` so the multi-sub guards in `applyUltraEffect` fire identically.

**`applyUltraEffect` is unchanged** — it already handles both grant and revoke variants with the multi-sub guards (revoke skip if `hasOtherActiveSubscription`; grant uses `MAX(effect.expiresAt, otherMax)`). Apple's real `expiresDate` flows through identically; the grant guard MAX now operates on a strict timestamp instead of a 30-day default — a correctness improvement over Google Play.

**`applyDecodedEvent` (the Google-specific state machine) is NOT modified.** It is renamed only if needed to disambiguate; to keep diff small the plan leaves the name `applyDecodedEvent` for the Google function. The new App Store function is named `applyAppStoreEvent`. Clear by signature.

### 7.4 Routes

Two new endpoints in `billing.route.ts`:

#### `POST /webhooks/app-store/:token`
- **Auth via URL path parameter** (Apple cannot inject custom HTTP headers; the Google `X-Pruvi-Webhook-Token` header pattern does NOT work for Apple). The `:token` path param is compared in constant time against `env.APP_STORE_WEBHOOK_TOKEN`. Missing env → 503. Mismatched → 404 (not 401 — returning 404 is more URL-obscurity-friendly; an attacker probing the path gets the same response as a wrong URL).
- The token is required to be `min(32)` characters for sufficient URL-obscurity entropy.
- The full URL configured in App Store Connect is `https://api.pruvi.app/webhooks/app-store/<APP_STORE_WEBHOOK_TOKEN>`. Rotating the token requires updating both env and App Store Connect.
- Body: `z.unknown()` (Apple's envelope is `{ signedPayload: string }` but we validate it inside the service for diagnostics).
- Response shape: same as Google's webhook (`{ received: true, notificationUUID?, kind?, error? }`).
- 200 on malformed envelope (Apple won't retry forever); 200 on processing failure with audit row written.

**Path-token guard sketch:**

```ts
async function appStorePathGuard(request: FastifyRequest) {
  if (!env.APP_STORE_WEBHOOK_TOKEN) {
    throw new AppError("WEBHOOK_DISABLED", 503, "WEBHOOK_DISABLED");
  }
  const { token } = request.params as { token: string };
  const a = Buffer.from(token);
  const b = Buffer.from(env.APP_STORE_WEBHOOK_TOKEN);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new NotFoundError("Not Found"); // 404 to avoid leaking endpoint existence
  }
}
```

#### `POST /billing/app-store/link`
- Auth: `fastify.authenticate`.
- Body: validated by `AppStoreLinkBodySchema` (see §7.5): `{ originalTransactionId, productId }`.
- Response: validated by `AppStoreLinkResponseSchema` which is a **type alias** for `GooglePlayLinkResponseSchema` (identical shape — provider-agnostic). No rename of the Google schema.

### 7.5 Shared module changes

Add to `packages/shared/src/billing.ts`:

```ts
export const APP_STORE_NOTIFICATION_TYPES = [
  "SUBSCRIBED", "DID_RENEW", "DID_FAIL_TO_RENEW", "EXPIRED",
  "GRACE_PERIOD_EXPIRED", "REFUND", "REFUND_DECLINED", "REFUND_REVERSED",
  "REVOKE", "DID_CHANGE_RENEWAL_STATUS", "DID_CHANGE_RENEWAL_PREF",
  "OFFER_REDEEMED", "PRICE_INCREASE", "RENEWAL_EXTENDED",
  "CONSUMPTION_REQUEST", "ONE_TIME_CHARGE", "TEST",
] as const;

export const AppStoreLinkBodySchema = z.object({
  originalTransactionId: z.string().min(1),
  productId: z.string().min(1),
});
export type AppStoreLinkBody = z.infer<typeof AppStoreLinkBodySchema>;

export const AppStoreLinkResponseSchema = GooglePlayLinkResponseSchema; // identical shape; aliased for clarity at call sites
export type AppStoreLinkResponse = z.infer<typeof AppStoreLinkResponseSchema>;
```

### 7.6 Env declaration

`APP_STORE_WEBHOOK_TOKEN: z.string().min(32).optional()` in `packages/env/src/server.ts`. Note: `min(32)` (not 16 like Google) because this token appears in the URL path and acts as the sole auth mechanism — it must have enough entropy to resist URL guessing. Generate as a 32+ char URL-safe random string.

### 7.6 Parked-event replay (link-time)

Identical pattern to Phase 2E.4 §7.6, but the link-time replay loop must call the correct state-machine function based on the audit row's provider. Since each link endpoint is provider-specific (`/billing/app-store/link` vs `/billing/google-play/link`), each link handler queries `listUnprocessedEventsForToken(tx, provider, token)` with its own provider value, and the replay loop calls the corresponding state-machine (`applyAppStoreEvent` for App Store events, `applyDecodedEvent` for Google events). No cross-provider mixing.

### 7.7 Logging

Same pattern as Google Play: `fastify.log.warn` / `fastify.log.error`. No `console.error`. Audit trail in `billing_event`.

## 8. API surface

### 8.1 `POST /webhooks/app-store`
See §7.4.

### 8.2 `POST /billing/app-store/link`
See §7.4. Idempotent on `(provider='app_store', purchase_token=originalTransactionId)`. 409 if token is already owned by another user.

## 9. Migration

**None.** Schema unchanged from 2E.4.

## 10. Testing strategy

**Unit** (`app-store.decoder.test.ts`):
- Each major notificationType+subtype mapping (SUBSCRIBED:INITIAL_BUY, SUBSCRIBED:RESUBSCRIBE, DID_RENEW, DID_FAIL_TO_RENEW:GRACE_PERIOD, DID_FAIL_TO_RENEW:other, EXPIRED, REFUND, REVOKE, DID_CHANGE_RENEWAL_STATUS:AUTO_RENEW_DISABLED, DID_CHANGE_RENEWAL_STATUS:AUTO_RENEW_ENABLED, REFUND_REVERSED, RENEWAL_EXTENDED).
- TEST notification.
- Unknown notificationType → `kind: "unknown"`.
- Malformed JWS (not 3 segments) → throws.
- Malformed base64url → throws.
- Missing `signedTransactionInfo` → throws (unless kind=test).

**Service unit** (extension of `billing.service.test.ts`):
- App Store SUBSCRIBED on linked sub → active + grant with `expiresDate` (NOT now+30d — assert the exact Apple-provided date).
- DID_RENEW with multi-sub guard: another active sub with LATER expiresDate → grant uses MAX.
- EXPIRED with no other active sub → revoke called.
- REFUND_REVERSED → grant.
- AUTO_RENEW_DISABLED → status=canceled, no Ultra change.
- Duplicate notificationUUID → no-op.
- Link path: same-user idempotency, conflict on different user.

**Integration** (extension of `billing.repository.integration.test.ts`): no new repo methods, but add a test confirming a row with `provider='app_store'` can coexist with a `provider='google_play'` row using the same purchase_token string (UNIQUE is on the composite key).

**Shared** (`billing.test.ts`): a single test asserting `APP_STORE_NOTIFICATION_TYPES` contains the expected names; `AppStoreLinkBodySchema` validates inputs.

## 11. Acceptance criteria

A1. `POST /webhooks/app-store/:token` where `:token` matches `env.APP_STORE_WEBHOOK_TOKEN` and a well-formed `{ signedPayload }` body returns 200.
A2. Mismatched `:token` → 404 (returning 404 keeps the endpoint URL-obscure); env token absent → 503 `WEBHOOK_DISABLED`. **Header-based auth is NOT used** — Apple cannot inject custom HTTP headers (this differs from Google Play).
A3. Duplicate `notificationUUID` deliveries are stored only once; subsequent responses still 200.
A4. `POST /billing/app-store/link` with `{ originalTransactionId, productId }` creates a `subscription` row with `provider='app_store'`, `purchase_token=originalTransactionId`, `status='pending'`, owned by the authenticated user.
A5. Re-calling `link` with the same `originalTransactionId` by the same user is idempotent (200, returns current state).
A6. Calling `link` with `originalTransactionId` already owned by a different user returns 409.
A7. `SUBSCRIBED:INITIAL_BUY` on a linked subscription sets `status='active'`, `currentPeriodEnd = signedTransactionInfo.expiresDate`, calls `UltraService.grant(userId, expiresDate)` — **NOT** a 30-day default. (Apple-strict improvement over Google.)
A8. `DID_RENEW` advances `currentPeriodEnd` to the new `expiresDate` and re-grants Ultra.
A9. `EXPIRED` → `status='expired'`, Ultra revoked (multi-sub guarded).
A10. `DID_CHANGE_RENEWAL_STATUS:AUTO_RENEW_DISABLED` → `status='canceled'`; Ultra remains until `expiresDate`.
A11. `REFUND_REVERSED` → `status='active'`, Ultra re-granted.
A12. Pre-link webhook → audit row + orphan subscription; later link replays the event. (Same race-safety as Google Play.)
A13. Multi-subscription REVOKE guard: a user with another active App Store or Google Play subscription does NOT lose Ultra when the EXPIRED for the older row arrives.
A14. Multi-subscription GRANT guard: a renewal with a shorter `expiresDate` does NOT truncate a longer active subscription's expiry — final Ultra expiry is `MAX(this.expiresDate, otherActive.currentPeriodEnd)`.
A15. Shared `applyUltraEffect` (Phase 2E.4) is reused unchanged for App Store grants and revokes. (Verify by code reading; no parallel/duplicate effect-applier.)
A16. `APP_STORE_WEBHOOK_TOKEN` declared in `packages/env/src/server.ts` as `z.string().min(32).optional()` (32+ chars for URL-path obscurity).
A17. Decoder maps all 17 documented notificationType names in §6 (including ONE_TIME_CHARGE as no-op) to the correct `AppStoreMappedAction`. Unknown types route to `kind: "unknown"` with no state mutation.
A18. No `console.error` in production paths. All logs via `fastify.log`.
A19. A `billing_event` row with `provider='app_store'` and `provider='google_play'` can both exist for the same string value of `message_id` (Apple's notificationUUID vs Google's Pub/Sub messageId share namespace via `(provider, message_id)` UNIQUE).

## 12. Deferred items

- JWS x5c certificate-chain signature verification (production-correct webhook auth).
- App Store Server API polling for state reconciliation.
- Sandbox-vs-Production routing to separate DB / behavior.
- `signedRenewalInfo` parsing (renewal price, status changes, offer details).
- Family-share, promo offers, win-back offers, gifting.
- Background sweep job that detects subscriptions whose `currentPeriodEnd` is past but never received `EXPIRED` (catches missed deliveries).

## 13. Open questions resolved during design

- **JWS sig verification — block or defer?** Defer. Same shared-secret model as Google. Apple's contract recommends sig verification; we ship that as hardening.
- **Use `originalTransactionId` or `transactionId` as the long-term key?** `originalTransactionId` — stable across renewals (matches Google's `purchaseToken` semantics).
- **What if the link arrives but the webhook never fires?** Subscription stays `pending` indefinitely; no Ultra grant. Same as Google.
- **Sandbox notifications in production env — accept or reject?** Accept (with a note). v1 treats Sandbox identically; a future hardening pass may reject them in production env.
- **Single decoder for both providers, or separate?** Separate. Google and Apple have meaningfully different envelope shapes; a shared decoder would be more confusing than two focused ones. The `applyDecodedEvent` state-machine function ALSO becomes provider-aware in this phase (or splits into `applyGooglePlayEvent` / `applyAppStoreEvent` — implementation choice deferred to plan).
- **Should we rename `processWebhookEnvelope` to `processGooglePlayEnvelope`?** Yes — for symmetry with the new `processAppStoreEnvelope` and to disambiguate. The link method `linkGooglePlayPurchase` is already provider-specific so it stays.
