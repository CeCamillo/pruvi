# Phase 2E.10 — Google Pub/Sub OIDC verification for Google Play webhooks (design spec)

**Date:** 2026-05-12
**Branch:** `feature/phase-2e10-google-pubsub-oidc-verification`
**Depends on:** Phase 2E.4 (Google Play billing webhook), Phase 2E.8 (Google service-account infra reuses RSA primitives).

## 1. Problem

Today the `POST /webhooks/google-play` endpoint authenticates via a shared-secret header `X-Pruvi-Webhook-Token` (`billing.route.ts:23-34`). This is meaningfully better than no auth, but:

- The secret is configured as plain env, ends up in logs, CI vars, secret managers — any leak fully compromises the endpoint.
- It is not the model Google actually documents. Pub/Sub push subscriptions can attach an OIDC token: Google signs a short-lived JWT with the configured service-account identity; the receiver verifies the signature against Google's published JWKs.
- We just shipped JWS verification for App Store (2E.9). Google's RTDN webhooks should have the equivalent signature-based defense — otherwise an attacker who learns the header token can forge billing state transitions.

## 2. Goal

Verify the OIDC token Google attaches to every Pub/Sub push delivery, replacing the shared-header secret as the primary authentication mechanism.

Concretely:

1. Read `Authorization: Bearer <jwt>` from inbound `/webhooks/google-play` requests.
2. Parse the JWT header to extract `kid`.
3. Look up the matching RSA public key in Google's signing-key set (cached in-memory).
4. Verify the RS256 signature over `${header}.${payload}`.
5. Validate claims: `iss` ∈ allowed Google issuers, `aud` matches the audience we configured on the Pub/Sub subscription, `email` matches the publisher service-account, `exp > now`, `iat <= now + 60s`.
6. On any failure, return 401 (rejected — not 200/MALFORMED like the App Store path, because Google **DOES** retry on 4xx for Pub/Sub deliveries and we want forgeries to keep retrying-and-failing — they're never accepted).

## 3. Scope decisions

**Keep the shared-header secret as a fallback during migration.** New env var `GOOGLE_PLAY_VERIFY_OIDC: z.coerce.boolean().default(false)`. When false, the existing header guard runs as today. When true, OIDC verification is the only path and the header check is removed from the preHandler. This lets us deploy the verifier without breaking the existing Pub/Sub subscription configuration, then flip the flag once Pub/Sub is reconfigured to send OIDC tokens.

**Deferred:** retiring `GOOGLE_PLAY_WEBHOOK_TOKEN` entirely. That's a config-only follow-up.

## 4. Architecture

### 4.1 Module layout

- `apps/server/src/features/billing/google-oidc.jwks-cache.ts` — **new**. In-memory cache of Google's OIDC signing keys.
  - `class GoogleJwksCache` with `getKey(kid: string): Promise<KeyObject | null>`.
  - Fetches `https://www.googleapis.com/oauth2/v3/certs` lazily on first call.
  - Caches the parsed `KeyObject` map indexed by `kid` until the response's `Cache-Control: max-age` expires. Default fallback: 3600s.
  - On `getKey(unknownKid)`, refreshes once (in case keys rotated) before returning null.
  - Constructor accepts `{ fetchImpl?: typeof fetch; logger?: Logger; now?: () => Date }` for testability.
- `apps/server/src/features/billing/google-oidc.verifier.ts` — **new**.
  - `class GoogleOidcVerifier` with `verify(jwt: string): Promise<{ payload: GoogleOidcPayload }>`.
  - Constructor: `{ jwks: GoogleJwksCache; expectedAudience: string; expectedEmail: string | null; clockSkewSec?: number; now?: () => Date }`.
  - **Constructor MUST throw** `new OidcVerificationError("expectedAudience required")` if `!expectedAudience` (empty string or undefined). Fail at boot, not at first request.
  - Returns the decoded payload on success; throws `OidcVerificationError` on any failure.
  - `expectedEmail = null` means "don't check email" — used in development. Production sets it to the Pub/Sub service-account.
- `apps/server/src/features/billing/google-oidc.*.test.ts` — pure unit tests for both, using mocked `fetchImpl` and a self-generated RSA keypair.
- `packages/env/src/server.ts` — add three optional env vars (use Zod v4 syntax to match the existing `RESEND_FROM_EMAIL: z.email()` pattern):
  - `GOOGLE_PLAY_VERIFY_OIDC: z.coerce.boolean().default(false)` — feature flag.
    - **Operator footgun:** `z.coerce.boolean()` coerces ANY non-empty string (including `"false"`) to `true`. To disable, leave the env var unset OR set it to empty string (which `emptyStringAsUndefined: true` maps to undefined → default(false)). Document this prominently in `.env.example`.
  - `GOOGLE_PLAY_OIDC_AUDIENCE: z.string().optional()` — required at runtime when flag is true.
  - `GOOGLE_PLAY_OIDC_SERVICE_ACCOUNT_EMAIL: z.email().optional()` — required at runtime when flag is true. The publisher SA configured on the Pub/Sub subscription.
- **Cross-field validation**: `@t3-oss/env-core`'s `createEnv` takes a flat schema map and does not support cross-field `superRefine`. Enforce the dependency at **service construction time** in `billing.route.ts`: if `env.GOOGLE_PLAY_VERIFY_OIDC && (!env.GOOGLE_PLAY_OIDC_AUDIENCE || !env.GOOGLE_PLAY_OIDC_SERVICE_ACCOUNT_EMAIL)`, throw `new Error("GOOGLE_PLAY_VERIFY_OIDC requires AUDIENCE and SERVICE_ACCOUNT_EMAIL")` so the server fails to boot with a clear message.
- `apps/server/src/features/billing/billing.route.ts` — replace `webhookGuard` with `oidcGuard` when the flag is set; keep `webhookGuard` for the legacy path. **Both guards MUST throw `UnauthorizedError("UNAUTHORIZED")`** (NOT `reply.code(401).send(...)`) so the project's centralized error handler produces a consistent shape — see the explanatory comment at `billing.route.ts:21-22`.

### 4.2 Data flow

```
POST /webhooks/google-play
  ├─ if env.GOOGLE_PLAY_VERIFY_OIDC === true:
  │     preHandler = oidcGuard
  │     oidcGuard:
  │       ├─ Authorization header present? else 401
  │       ├─ Bearer <jwt> → parse
  │       ├─ verifier.verify(jwt) → throws → 401
  │       └─ attach decoded.payload to request for logging
  ├─ else:
  │     preHandler = webhookGuard (existing shared-header)
  └─ handler unchanged: service.processGooglePlayEnvelope(request.body)
```

### 4.3 JWT verification algorithm

```
verify(jwt):
  [headerB64, payloadB64, sigB64] = jwt.split(".")
  header = JSON.parse(base64url(headerB64))
  if header.alg !== "RS256" throw
  if !header.kid throw

  key = jwks.getKey(header.kid)
  if !key throw "unknown kid"

  // RS256: the JWS signature IS the raw RSA signature — NO DER conversion needed (unlike ES256).
  // The data param of crypto.verify() must be a Buffer, NOT a string. Mirroring the
  // App Store verifier pattern, use createVerify + .update(string) + .verify(key, sig):
  const v = createVerify("RSA-SHA256");
  v.update(`${headerB64}.${payloadB64}`);
  v.end();
  if (!v.verify(key, Buffer.from(sigB64, "base64url"))) throw "signature invalid";

  payload = JSON.parse(base64url(payloadB64))
  now = this.now()
  if payload.exp <= now / 1000 throw "expired"
  if payload.iat > now / 1000 + clockSkewSec throw "iat in the future"
  if payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com" throw "wrong issuer"
  if payload.aud !== this.expectedAudience throw "wrong audience"
  if this.expectedEmail && payload.email !== this.expectedEmail throw "wrong email"
  if this.expectedEmail && payload.email_verified !== true throw "email not verified"

  return { payload }
```

### 4.4 JWKs cache semantics

- First call: HTTP GET to Google's certs endpoint, parse `keys[]`, build `Map<kid, KeyObject>` by converting each JWK via `crypto.createPublicKey({ key: jwk, format: "jwk" })` (Node 16+).
- Google's response includes `Cache-Control: max-age=<seconds>` — we honor it. Default to 3600s if header is missing.
- Cache stores keys until expiry. Calls during the window are served from memory.
- Cache miss on a specific `kid`: trigger a refresh (Google may have rotated). If still missing after refresh, fail the verification with "unknown kid".
- **Concurrent dedup contract:** a single in-flight promise (`pendingFetch: Promise<void> | null`) holds any active refresh. Multiple concurrent callers (whether first-fetch OR cache-miss-refresh) MUST await the same `pendingFetch` rather than spawning new fetches. Only when `pendingFetch === null` does a caller initiate a new HTTP request and assign the resulting promise to `pendingFetch`. Once the fetch resolves (or rejects), set `pendingFetch = null` so future cache misses can refresh again. This prevents thundering-herd on key-rotation events.

### 4.5 Audience claim

The audience is whatever we set when creating the Pub/Sub push subscription. Production posture: set it to a stable string we control, e.g. `https://api.pruvi.app/webhooks/google-play` or a project-scoped identifier. The env var declares what we expect; the verifier rejects mismatches.

**Operator setup (critical):**
- Configure the Pub/Sub subscription with `--push-auth-token-audience=<value>`.
- Set `GOOGLE_PLAY_OIDC_AUDIENCE=<same value>`.
- If `--push-auth-token-audience` is OMITTED on the subscription, Google defaults `aud` to the push endpoint URL. In that case `GOOGLE_PLAY_OIDC_AUDIENCE` MUST equal the push endpoint URL or every legitimate delivery will 401. Document this in the runbook to prevent the most likely misconfiguration (operator configures only one side).

### 4.6 Service-account email

When `expectedEmail` is set, the verifier additionally checks `payload.email === expectedEmail` AND `payload.email_verified === true`. This binds the JWT to a specific publisher SA — even a forged Google-signed token (impossible, but defense-in-depth) cannot pose as another tenant.

## 5. Public surface

No new HTTP routes. Existing `/webhooks/google-play` behaves identically when the flag is off. With the flag on:

- Missing `Authorization` header → 401.
- Bearer JWT fails verification → 401 (Apple-style 200/`MALFORMED_ENVELOPE` is wrong here because Pub/Sub retries on 4xx — we WANT forgeries to fail loudly and keep being retried, then expire).
- All checks pass → handler runs unchanged.

## 6. Failure modes

| Cause | Response | Side effect |
|---|---|---|
| Flag on, no Authorization header | 401 | WARN log |
| Flag on, Authorization not `Bearer <jwt>` | 401 | WARN log |
| JWT not 3 segments / header unparseable | 401 | WARN log |
| `alg` != RS256 or `kid` missing | 401 | WARN log |
| `kid` not in Google's published keys (after one refresh) | 401 | ERROR log (real attacker signal) |
| RS256 signature does not verify | 401 | ERROR log |
| `exp` past, `iat` future (beyond clock skew) | 401 | WARN log |
| `iss` not Google | 401 | ERROR log |
| `aud` does not match `expectedAudience` | 401 | ERROR log |
| `email` does not match `expectedEmail` | 401 | ERROR log |
| All checks pass | 200 | normal flow |

## 7. Race conditions

- **Key rotation mid-burst:** Google rotates daily. The cache miss → refresh → retry pattern handles the rotation window. Once refreshed, subsequent verifications see the new key.
- **Concurrent first-fetch:** `pendingFetch` promise dedup prevents thundering-herd at boot.
- **Stale cache after rotation but before our TTL expires:** `getKey(unknownKid)` triggers an out-of-band refresh. Our TTL is a ceiling on staleness, not the only refresh signal.

## 8. Testing strategy

### 8.1 Unit — `GoogleJwksCache`

- Empty cache + `getKey(kid)` → fetches certs, populates, returns key.
- `getKey(kid)` second call within TTL → no HTTP call.
- TTL expired → next call refreshes.
- `getKey(unknownKid)` → refresh once → still missing → return null.
- Two concurrent first-callers → exactly one HTTP call.
- 5xx response → returns null AND logs error AND does NOT poison the cache.
- Non-JSON response body → returns null AND logs error AND does NOT poison the cache.
- `Cache-Control: max-age=N` parsing happy path + missing → falls back to 3600.

### 8.2 Unit — `GoogleOidcVerifier`

Generate an RSA-2048 keypair via `crypto.generateKeyPairSync` in `beforeAll`. Construct a stub `GoogleJwksCache` that returns the test key for `kid="test-kid"`. Helper `mintJwt(payload, opts?)` signs an RS256 JWT.

Cases:
- Happy path: valid JWT with all claims present → returns payload.
- Missing `Authorization`-extracted JWT → throws (this is the verifier's concern only if we feed it an empty string).
- Wrong segment count → throws.
- `alg` != RS256 → throws.
- Missing `kid` → throws.
- Unknown `kid` (jwks returns null) → throws.
- Signature invalid (tamper bytes) → throws.
- `exp` past → throws.
- `iat` more than `clockSkewSec` in the future → throws.
- `iss` not Google → throws.
- `aud` mismatch → throws.
- `email` mismatch when `expectedEmail` is set → throws.
- `email_verified !== true` when `expectedEmail` is set → throws.
- `expectedEmail = null` → skips email check (happy path even if email field absent).

### 8.3 Route integration

- Flag off → legacy `webhookGuard` path runs (existing tests still pass).
- Flag on, valid OIDC token → handler runs.
- Flag on, missing token → 401.
- Flag on, invalid token → 401.
- Flag on, env vars missing (audience or email) → boot-time validation error from Zod.

### 8.4 Backward compat

All existing webhook tests pass unchanged when the flag is unset.

## 9. Acceptance criteria

- [ ] `GoogleJwksCache` fetches and caches Google's published keys with proper `max-age` honoring.
- [ ] `GoogleOidcVerifier` rejects every documented failure case.
- [ ] Route's `preHandler` selects OIDC guard when `GOOGLE_PLAY_VERIFY_OIDC=true`, else legacy header guard.
- [ ] 401 returned on verification failure (NOT 200/MALFORMED).
- [ ] When flag is on, env validation requires `GOOGLE_PLAY_OIDC_AUDIENCE` and `GOOGLE_PLAY_OIDC_SERVICE_ACCOUNT_EMAIL` to be set.
- [ ] Existing tests still pass (flag defaults to false).
- [ ] Verifier never throws an unhandled error — wraps all internal failures in `OidcVerificationError`.

## 10. Deferred

- **Route-level integration tests** for preHandler selection, 401 response shape, and boot-time cross-field env validation — covered indirectly via unit tests + manual testing; full Fastify-inject coverage is a separate task.
- **ERROR-level logging discrimination** for security-critical OIDC failures (unknown kid, signature invalid, wrong issuer/audience/email). Currently all failures log at WARN. Requires adding a `reason` field to `OidcVerificationError` and branching the route's catch on it. Same pattern as the 2E.9 deferred ERROR-level distinction.
- **Retire `GOOGLE_PLAY_WEBHOOK_TOKEN` completely** — config-only follow-up after OIDC verification is in production for a few weeks.
- **JWKs ETag/304 conditional fetching** — small bandwidth optimization.
- **Refresh-ahead** — proactively refresh keys before TTL expiry; today we refresh lazily on next call.
- **Metrics** — `google_oidc_verify_failures_total{reason}`.
