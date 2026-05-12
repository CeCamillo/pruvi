# Phase 2E.8 — Real `expiryTime` lookup via Google Play `subscriptionsv2.get` (design spec)

**Date:** 2026-05-12
**Branch:** `feature/phase-2e8-google-play-real-expiry`
**Depends on:** Phase 2E.4 (Google Play billing webhook). Reuses `subscription`, `BillingRepository`, `applyDecodedEvent`.

## 1. Problem

`applyDecodedEvent` for grant events (PURCHASED/RENEWED/RECOVERED/RESTARTED) currently sets `currentPeriodEnd = now + 30 days` via `DEFAULT_SUBSCRIPTION_PERIOD_MS` (`billing.service.ts:164`, `:180`). This is conservative — it never under-grants — but:

- Webhooks fire on `eventTimeMillis`, NOT at the exact moment of renewal. The 30-day clock starts at our webhook receipt, not at Google's renewal anchor. Over many renewals the user's `current_period_end` drifts later than reality.
- Monthly-plan users renewing on day 28 (Google's renewal anchor) see ~3 days of free Ultra each cycle.
- The reconciliation sweep (2E.7) uses `current_period_end < cutoff` as its trigger. A drifted-late `current_period_end` keeps a truly-expired sub in the candidate-blind zone for days past real expiry, exactly the gap the sweep was meant to close.

## 2. Goal (this phase)

Call `androidpublisher.purchases.subscriptionsv2.get(packageName, purchaseToken)` to fetch the real `expiryTime` (ISO 8601) for grant events. Use that timestamp as `currentPeriodEnd` and `grant.expiresAt`. Fall back to the 30-day default when the API call fails or service-account is not configured.

## 3. Out of scope (deferred)

- Apple side — `signedTransactionInfo.expiresDate` is already used (2E.5). No work needed.
- Google Pub/Sub OIDC verification — separate phase (would reuse the same service-account JWT signer foundation).
- Voided purchases API / refund detection — different endpoint.
- One-time IAP `purchases.products.get` (lives packs §5.4) — separate phase.
- Caching the access token across processes — in-process LRU only this phase.

## 4. Architecture

### 4.1 Module layout

- `apps/server/src/features/billing/google-play.api-client.ts` — **new**. Thin client that:
  - Holds the parsed service-account credentials (or `null` if not configured).
  - Constructor accepts `(creds, opts?: { fetchImpl?: typeof fetch; logger?: { warn: (...a: unknown[]) => void; error: (...a: unknown[]) => void } })`. `fetchImpl` defaults to `globalThis.fetch`. `logger` defaults to a `console`-backed shim. Tests inject both.
  - Mints a Google OAuth 2.0 access token via RS256-signed JWT assertion (single audience: `https://oauth2.googleapis.com/token`, scope: `https://www.googleapis.com/auth/androidpublisher`). Caches the token in-memory until 60 seconds before its `expires_in` deadline.
  - Exposes `getSubscription(packageName, purchaseToken): Promise<Date | null>` reading `lineItems[0].expiryTime` from the v2 response. On any error returns `null` (caller decides fallback) — never throws. Past expiry timestamps are returned as-is (trust Google; the sweep will reconcile).
- `apps/server/src/features/billing/google-play.service-account.ts` — **new**. Parses + validates the service-account JSON: `client_email`, `private_key`, `token_uri`. Pure functions. Throws `InvalidServiceAccountError` on malformed JSON; returns `null` from a `loadFromEnv()` helper when the env var is absent.
- `apps/server/src/features/billing/billing.service.ts` — modify `processGooglePlayEnvelope`:
  - Before opening the per-event TX, for `kind === "subscription"` events whose `notificationTypeName` is a grant type (PURCHASED/RENEWED/RECOVERED/RESTARTED): resolve `packageName = decoded.packageName || env.GOOGLE_PLAY_PACKAGE_NAME || null`. If null, log WARN with `{ messageId, reason: "no_package_name" }`, skip the API call, set `realExpiryTime = null`. Otherwise call `apiClient.getSubscription(packageName, decoded.purchaseToken)` → `realExpiryTime: Date | null`.
  - Pass that override into `applyDecodedEvent` via a new optional 3rd argument.
  - All other event types skip the API call.
  - **Replay path (`linkGooglePlayPurchase`, `billing.service.ts:130`) intentionally does NOT call the API.** It re-applies parked events via `applyDecodedEvent(decoded, sub)` (no 3rd arg) so the optional param defaults to `null` and the state machine uses the 30-day fallback. Reason: an outbound network call inside the link TX would hold row locks for hundreds of ms and could deadlock under contention; the next live webhook for the same subscription will reconcile the period end. This is a deliberate trade-off — call it out in code with a comment that references this spec section.
- `apps/server/src/features/billing/billing.service.ts` — modify `applyDecodedEvent` signature:
  - New optional 3rd param `realExpiryTime: Date | null`.
  - For the grant cases, use `realExpiryTime ?? defaultEnd`. All other branches unchanged.
- `apps/server/src/features/billing/billing.route.ts:17` — actual construction site. Update from `new BillingService(db, repo, ultra)` to `new BillingService(db, repo, ultra, apiClient)`. The `apiClient` is constructed in the same route file from `loadServiceAccountFromEnv(env)` + `fastify.log` (pino-compatible logger interface). `index.ts` only re-exports the route; no change there.
- `packages/env/src/server.ts` — add `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: z.string().optional()` and `GOOGLE_PLAY_PACKAGE_NAME: z.string().optional()` (the latter is consulted as a fallback when the envelope's `packageName` field is missing/empty; we trust the envelope first since it tells us which app fired).

### 4.2 Data flow (grant event)

```
processGooglePlayEnvelope(envelope)
  ├─ decode → DecodedGooglePlayEvent { kind: "subscription", notificationTypeName: "RENEWED", packageName, purchaseToken, ... }
  ├─ if isGrantType(name):
  │     const packageName = decoded.packageName || env.GOOGLE_PLAY_PACKAGE_NAME || null;
  │     if (!packageName) {
  │       logger.warn({ messageId: decoded.messageId, reason: "no_package_name" }, "real-expiry fallback");
  │       realExpiryTime = null;
  │     } else {
  │       realExpiryTime = await apiClient.getSubscription(packageName, decoded.purchaseToken);
  │       // → Date | null. apiClient handles its own logging on failure.
  │     }
  ├─ this.db.transaction(...):
  │     insertEvent → updateSubscriptionState(sub.id, applyDecodedEvent(decoded, sub, realExpiryTime))
  └─ applyUltraEffect(effect)  // effect already carries realExpiryTime via grant.expiresAt
```

For NON-grant events (CANCELED/EXPIRED/etc.) and for `kind !== "subscription"` events, the API call is skipped entirely — `realExpiryTime` stays `undefined` and `applyDecodedEvent` ignores it.

### 4.3 Fallback strategy

`realExpiryTime = null` (the API said no, threw, or credentials are absent) ⇒ `applyDecodedEvent` uses `defaultEnd = now + 30 days`. Identical to current behavior. The sweep job (2E.7) plus future webhooks will reconcile if the real expiry comes in later. This means:

- Boot-time absence of `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` is a fully supported config — server boots, webhooks process with the old default.
- Transient API outages do NOT block webhook processing.
- We MUST log every fallback at WARN with `{ packageName, purchaseToken, reason }` so a sudden surge of fallbacks (credential rotation, scope misconfiguration) is observable.

### 4.4 In-process token cache

The access token Google returns has `expires_in: 3600` (1 hour). We cache it under a single class-instance field `{ token: string, expiresAt: number /* ms epoch */ }`. Before each `getSubscription` call:

- If `expiresAt - 60_000 > Date.now()`, reuse the cached token.
- Otherwise, mint a fresh JWT, exchange for a token, store the new pair.

No external cache (Redis, etc.). The `BillingService` is constructed once per process, so the `GooglePlayApiClient` instance lives for the process lifetime — typically minutes-to-hours across thousands of requests.

### 4.5 JWT minting (no `googleapis` SDK)

Pure Node `crypto.createSign("RSA-SHA256")` over a header+payload base64url string. Avoids pulling the full Google SDK. Payload shape:

```json
{
  "iss": "<service_account.client_email>",
  "scope": "https://www.googleapis.com/auth/androidpublisher",
  "aud": "https://oauth2.googleapis.com/token",
  "iat": <now seconds>,
  "exp": <now + 3600 seconds>
}
```

POST to `https://oauth2.googleapis.com/token` with `application/x-www-form-urlencoded`:
`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=<jwt>`.

Response: `{ access_token, expires_in, token_type: "Bearer" }`.

### 4.6 Subscription fetch

```
GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{packageName}/purchases/subscriptionsv2/tokens/{purchaseToken}
Authorization: Bearer <access_token>
Accept: application/json
```

Response (excerpt — we only consume two fields):

```json
{
  "kind": "androidpublisher#subscriptionPurchaseV2",
  "subscriptionState": "SUBSCRIPTION_STATE_ACTIVE",
  "lineItems": [
    { "productId": "ultra_monthly", "expiryTime": "2026-06-12T15:30:00Z", "autoRenewingPlan": {...} }
  ]
}
```

We read `lineItems[0].expiryTime` as the new `currentPeriodEnd`. If `lineItems` is empty or missing the field, return `null`.

Non-200: log WARN with status code, return `null`. Network errors: same. 401: log ERROR (credentials issue), return `null` and **invalidate the cached access token** so the next call retries minting.

## 5. Public surface

**Internal only.** No new HTTP routes. Webhook semantics unchanged from client perspective — same 200/400 responses, same idempotency.

New env vars (both optional — server boots without them and falls back to old behavior):

- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` — full JSON contents (NOT a path). Production deploys can use Render's secret-file feature and read the file in then set the env var, or use a multi-line env var directly. `Zod` validation is `z.string().optional()` only at the env layer; the actual parse + validate happens at service construction.
- `GOOGLE_PLAY_PACKAGE_NAME` — fallback if envelope's `packageName` is empty (defensive). Optional.

## 6. State machine semantics

Grant events (PURCHASED/RENEWED/RECOVERED/RESTARTED) now resolve to:

```
newPeriodEnd = realExpiryTime ?? (now + 30d)
ultraEffect = grant(newPeriodEnd)
```

All other branches unchanged. No state-machine table change visible to the multi-sub guards (they consume `currentPeriodEnd` as an opaque timestamp).

## 7. Race conditions and edge cases

**Stale lookup vs. fresh webhook**: We call `subscriptionsv2.get` BEFORE the per-event TX. If between that call and the TX commit, the user upgrades/downgrades the plan, the freshly-fetched `expiryTime` is for the OLD plan. The next webhook (Google fires one for every state change) reconciles. We accept this; the alternative (fetch inside TX) holds the row lock during a 200ms+ network call — far worse.

**Concurrent webhooks for same purchaseToken**: Each webhook independently calls `getSubscription` and races on the row lock. Both writes are idempotent under the predicate-in-WHERE pattern that's standard in this codebase. Idempotency on `(provider, message_id)` further guarantees only one of two identical retries reaches the state machine.

**API returns 404**: indicates the purchase token is invalid or the subscription is gone. Return `null` ⇒ fallback to 30-day default. The state machine still moves the row to `active` via the webhook — this is correct: Google fired the webhook because Google thinks the sub exists, so we trust Google. A future EXPIRED webhook or sweep will clean up if needed.

**Service-account credentials rotation**: If a rotated key starts returning 401, fallback engages and logs. Operator updates env var, restart process. No data loss.

**Empty `lineItems`**: per Google docs this should not happen for active subscriptions but if it does, return `null` and fallback. Log at WARN.

## 8. Testing strategy

### 8.1 Pure unit (no I/O)

- `parseServiceAccount(json)` — happy path including a realistic PEM `private_key` with embedded `\n` newlines (the JSON-encoded form Google issues); malformed JSON throws `InvalidServiceAccountError`; missing `client_email` throws; missing `private_key` throws.
- `loadServiceAccountFromEnv(env)` — returns null when env var absent, returns parsed creds when present.
- `mintJwt(creds, now)` — produces a 3-segment base64url string; header decodes to `{ alg: "RS256", typ: "JWT" }`; payload decodes to expected `{ iss, scope, aud, iat, exp }`; signature length matches RS256.

### 8.2 `GooglePlayApiClient` with mocked `fetch`

- `getAccessToken()` first call hits token endpoint, returns access token. Second call within TTL reuses without hitting the endpoint.
- `getAccessToken()` after expiry mints again.
- `getSubscription(pkg, token)` happy path: tokens endpoint then v2 endpoint, returns `expiryTime` as `Date`.
- `getSubscription` returns `null` on:
  - tokens endpoint 401 (and invalidates the cached token).
  - tokens endpoint returns 200 with a non-JSON body (e.g., HTML error page from a proxy).
  - v2 endpoint 404.
  - v2 endpoint 500.
  - v2 endpoint empty `lineItems`.
  - v2 endpoint missing `expiryTime`.
  - Network throw on either endpoint.
- `getSubscription` returns the parsed `Date` AS-IS when `expiryTime` is in the past (trust Google; downstream sweep handles reconciliation). One test asserts: returned `Date` matches input ISO even when input < now.
- Constructor with `null` credentials: `getSubscription` returns `null` without making any HTTP call (early exit).

### 8.3 Service integration

- `processGooglePlayEnvelope` for a RENEWED event with a stubbed `apiClient.getSubscription` returning `2026-06-12T15:30:00Z`:
  - `updateSubscriptionState` called with `currentPeriodEnd` matching the stubbed date.
  - `ultra.grant` called with the same date.
- Same flow with `apiClient.getSubscription` returning `null`:
  - `currentPeriodEnd` matches `now + 30d` (fallback to existing default).
  - `ultra.grant` called with the same fallback date.
- `processGooglePlayEnvelope` for a non-grant event (e.g., CANCELED): `apiClient.getSubscription` is NOT called.
- `processGooglePlayEnvelope` for a `kind: "unknown"` event: `apiClient.getSubscription` is NOT called.

### 8.4 Backwards-compatibility regression

- All existing `billing.service.test.ts` Google Play cases still pass with the new optional 3rd param defaulting to `null`. No behavior change when `apiClient` is the no-op stub.

## 9. Acceptance criteria

- [ ] Grant events use Google's `expiryTime` when `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` is configured.
- [ ] Grant events fall back to `now + 30 days` when env is absent OR API call fails.
- [ ] Service boots and webhooks process correctly without the env var set.
- [ ] Non-grant events do NOT make Google API calls.
- [ ] Access token cached in-process across calls; refreshed only past TTL.
- [ ] 401 invalidates the cache so next call mints fresh.
- [ ] No new throws bubble out of webhook processing on API failures — always log + fall back.

## 10. Deferred (next-phase candidates)

- **Voided purchases scan** — `purchases.voidedpurchases.list` to detect refunds.
- **Google Pub/Sub OIDC verification** — reuse the JWT verification primitives plus Google's JWKs endpoint to replace the shared-header webhook secret.
- **Multi-app support** — currently assumes a single `packageName` per deploy; multi-tenant would need the credentials selected by package name.
- **Background token refresh** — proactively refresh tokens before they expire; today we refresh lazily on next call.
