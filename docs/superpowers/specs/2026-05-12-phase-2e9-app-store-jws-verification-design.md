# Phase 2E.9 — Apple App Store JWS x5c chain verification (design spec)

**Date:** 2026-05-12
**Branch:** `feature/phase-2e9-app-store-jws-verification`
**Depends on:** Phase 2E.5 (App Store billing webhook). Modifies the decoder and the service wiring.

## 1. Problem

Apple App Store Server Notifications V2 arrive as JWS-signed envelopes. The current implementation (2E.5) decodes the middle base64url segment without verifying the signature — `app-store.decoder.ts:53` carries an explicit `SECURITY: deferred` comment.

Auth today rests entirely on URL-path obscurity (`POST /webhooks/app-store/:token` checked against `APP_STORE_WEBHOOK_TOKEN`, see `billing.route.ts:38-51`). Any party that learns the path token can deliver forged notifications and:

- Grant Ultra entitlements to arbitrary user accounts (linked via `originalTransactionId` orphan-claim).
- Revoke entitlements by forging an EXPIRED notification.
- Cause arbitrary state-machine transitions on the `subscription` table.

URL-path obscurity is meaningfully weaker than cryptographic verification: tokens leak through logs, CDNs, mobile screenshots, browser histories, and proxy caches. Apple's documented production posture is JWS signature + x5c chain verification against Apple's root CA. This phase closes that gap.

## 2. Goal

Verify every inbound App Store webhook JWS:

1. Parse the JWS header `{alg, x5c}` — `alg` must be `ES256`, `x5c` must be a 3-element array of base64-encoded X.509 DER certs.
2. Validate the certificate chain: leaf → intermediate → root, with the root matching Apple's published Root CA (`AppleRootCA-G3`). Each link verified by Node's `X509Certificate.verify(publicKey)`.
3. Check certificate validity dates (`notBefore <= signedDate <= notAfter`) at the notification's signed time (`signedDate` field in the outer payload).
4. Verify the JWS signature: ES256 over `${header}.${payload}` using the leaf cert's public key (derived via `node:crypto`'s `X509Certificate.publicKey`).
5. The same verifier is applied to the nested `data.signedTransactionInfo` JWS (each App Store notification has two JWS payloads: outer and inner).

If any step fails, the decoder throws `DecoderError`. The service returns the existing `MALFORMED_ENVELOPE` shape (200 OK, `received: false`) — Apple does not retry on 4xx, so 200 keeps the existing behavior; the audit trail is the WARN log.

## 3. Out of scope (deferred)

- Apple's certificate revocation (CRL/OCSP) check. Apple's certs rotate; revocation is an edge case. v1 trusts the chain if it terminates at the known root.
- Caching the parsed cert chain across notifications. Apple uses the same leaf cert for many notifications within a key rotation window; caching would speed up verification. v1 verifies on every call (sub-millisecond on Bun for ECDSA P-256).
- Sandbox vs Production environment-aware root selection. Apple uses the same root CA for both environments per their documentation.
- Verification of the OAuth-style JWT we'd send to Apple's Server API (different flow — not relevant to ASSN V2).
- Google Pub/Sub OIDC verification (the equivalent for Google Play) — that's a separate phase.

## 4. Architecture

### 4.1 Module layout

- `apps/server/src/features/billing/app-store.jws-verifier.ts` — **new**. Pure-crypto verifier:
  - `class AppStoreJwsVerifier` with constructor `(opts: { rootCertPem: string; now?: () => Date })`. (Clock-skew tolerance is not implemented in v1 — cert validity uses strict bounds.)
  - `verify(jws: string): VerifiedJws` — returns the decoded payload object on success; throws `JwsVerificationError` on any failure (subclass of `Error` distinct from `DecoderError`).
  - `static fromBundledRoot()` — constructs the verifier using the bundled Apple Root CA G3 PEM.
- `apps/server/src/features/billing/app-store.root-ca.ts` — **new**. Exports the Apple Root CA G3 as a PEM string constant. Bundled at build time. (We do NOT fetch from Apple's CDN at boot — adds startup fragility for a value that changes once per ~25 years.)
- `apps/server/src/features/billing/app-store.decoder.ts` — modified. `decodeAppStoreNotification(raw, verifier)` now takes a verifier as a required 2nd arg. The current single-arg signature is removed; all callers must thread a verifier through. (Internal API; one production call site in `billing.service.ts`, plus tests.)
- `apps/server/src/features/billing/billing.service.ts` — modified. `BillingService` constructor gains a 6th arg: `jwsVerifier: AppStoreJwsVerifier`. `processAppStoreEnvelope` passes it to `decodeAppStoreNotification`.
- `apps/server/src/features/billing/billing.route.ts` — wires `AppStoreJwsVerifier.fromBundledRoot()` into service construction.
- `apps/server/src/workers/billing-sweep.worker.ts` — same wiring (sweep never decodes ASSN, but the constructor signature must be satisfied).

No new env vars. The verifier is always on in production. Tests construct an in-fixture verifier (see §8).

### 4.2 Data flow

```
processAppStoreEnvelope(envelope)
  ├─ decoded = decodeAppStoreNotification(envelope, this.jwsVerifier)
  │     ├─ envelope.signedPayload :: string
  │     ├─ outerPayload = jwsVerifier.verify(signedPayload)
  │     │      ├─ split into [header, payload, signature]
  │     │      ├─ parse header → { alg: "ES256", x5c: [leafB64, midB64, rootB64] }
  │     │      ├─ parse certs, verify chain ends at AppleRootCA-G3
  │     │      ├─ check signedDate ∈ each cert's validity window
  │     │      ├─ verify ES256(`${header}.${payload}`) using leaf.publicKey
  │     │      └─ return parsed payload object
  │     ├─ if notificationType === "TEST" → return { kind: "test", notificationUUID }
  │     ├─ innerPayload = jwsVerifier.verify(data.signedTransactionInfo)
  │     └─ assemble DecodedAppStoreEvent
  └─ ...existing state-machine flow unchanged...
```

The verifier is applied to BOTH the outer envelope and the inner `signedTransactionInfo`. Apple uses the same chain for both — we cannot trust only the outer.

### 4.3 X.509 chain validation algorithm

```
function verifyChain(x5c: string[], rootCert: X509Certificate, atDate: Date) {
  if (x5c.length !== 3) throw new JwsVerificationError("expected 3-cert chain");

  const certs = x5c.map((b64) => new X509Certificate(Buffer.from(b64, "base64")));
  const [leaf, intermediate, root] = certs;

  // 1. Each cert's validity window includes `atDate`.
  for (const c of certs) {
    if (new Date(c.validFrom) > atDate || new Date(c.validTo) < atDate) {
      throw new JwsVerificationError(`cert expired or not yet valid: subject=${c.subject}`);
    }
  }

  // 2. Leaf signed by intermediate, intermediate signed by root.
  if (!leaf.verify(intermediate.publicKey)) {
    throw new JwsVerificationError("leaf cert signature does not match intermediate");
  }
  if (!intermediate.verify(root.publicKey)) {
    throw new JwsVerificationError("intermediate cert signature does not match root");
  }

  // 3. Provided root matches our trusted root (by DER fingerprint).
  if (root.fingerprint256 !== rootCert.fingerprint256) {
    throw new JwsVerificationError("root cert does not match trusted Apple Root CA G3");
  }

  return leaf.publicKey;
}
```

Compare fingerprints over the DER (not the PEM) to avoid whitespace/encoding pitfalls. `X509Certificate.fingerprint256` is the SHA-256 of the cert's DER bytes — stable.

### 4.4 JWS signature verification (ES256)

```
function verifyEs256Signature(jws: string, publicKey: KeyObject) {
  const [headerB64, payloadB64, sigB64] = jws.split(".");
  const signingInput = `${headerB64}.${payloadB64}`;
  const raw = Buffer.from(sigB64, "base64url");

  // JWS ES256 signature is the concatenation of r || s (each 32 bytes).
  // Node's createVerify requires DER-encoded ECDSA signatures, so we convert.
  if (raw.length !== 64) throw new JwsVerificationError("ES256 signature must be 64 bytes (r||s)");
  const r = raw.subarray(0, 32);
  const s = raw.subarray(32, 64);
  const derSig = encodeEcdsaDer(r, s);

  const verifier = createVerify("SHA256");
  verifier.update(signingInput);
  verifier.end();
  if (!verifier.verify(publicKey, derSig)) {
    throw new JwsVerificationError("JWS signature invalid");
  }
}
```

`encodeEcdsaDer(r, s)` is ASN.1 DER `SEQUENCE { INTEGER r, INTEGER s }`. Standard encoding; ~30 lines. We implement it inline rather than pulling a JOSE library — keeps the dependency surface minimal and the verification path auditable.

### 4.5 Apple Root CA G3 bundling

The root is published by Apple at `https://www.apple.com/certificateauthority/AppleRootCA-G3.cer`. We download it once, convert to PEM (`openssl x509 -inform DER -in AppleRootCA-G3.cer -out AppleRootCA-G3.pem`), and embed as a TypeScript string constant in `app-store.root-ca.ts`. Add a comment with the SHA-256 fingerprint so future audits can verify the embed:

```ts
// Apple Root CA - G3, SHA-256 fingerprint:
// 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79
// Source: https://www.apple.com/certificateauthority/
export const APPLE_ROOT_CA_G3_PEM = `-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----`;
```

## 5. Public surface

**No external API changes.** Webhook caller behavior is unchanged — invalid signatures still return 200 with `MALFORMED_ENVELOPE` to preserve idempotency at Apple's end.

Internal API change: `decodeAppStoreNotification` now requires a verifier as 2nd arg. All call sites must update.

## 6. Failure modes

**Operational note:** because every failure returns 200 (Apple does not retry on 4xx/5xx for `received: false`), a genuine notification dropped by a bug in OUR verifier (e.g., Apple rotates their intermediate cert and our chain check fails) is **silently and permanently dropped**. The audit trail is the WARN/ERROR log. Operators must:
- Alert on the `app-store-jws-verify` ERROR log pattern.
- Re-check the bundled Apple Root CA G3 against [Apple's published cert](https://www.apple.com/certificateauthority/) on any security advisory.
- Apple's root validity is ~25 years; intermediates rotate more frequently. If the verifier suddenly fails for all notifications, suspect intermediate rotation first.



| Cause | Response | Side effect |
|---|---|---|
| `signedPayload` missing or not a string | 200, `received: false, error: "MALFORMED_ENVELOPE"` | WARN log |
| JWS not 3 segments | same | same |
| Header missing `x5c` or wrong length | same | same |
| Header `alg` not `"ES256"` | same | same |
| Any cert in chain not parseable | same | same |
| Cert validity window does not include `signedDate` | same | same |
| Chain does not terminate at Apple Root CA G3 | same | same — **most likely "real attacker" signal**; log at ERROR not WARN |
| ES256 signature does not verify | same | same — also ERROR-level |
| Inner `signedTransactionInfo` fails any of the above | same | same |
| All checks pass | 200, `received: true, kind, notificationUUID` | normal state-machine flow |

## 7. Existing test compatibility

The current `app-store.decoder.test.ts` (and the App Store cases in `billing.service.test.ts`) construct unsigned envelopes for unit testing. With this change, those tests would all fail signature verification.

Three options:
- (A) Generate a self-signed Apple-root surrogate in `beforeAll`, mint test certs, re-sign every fixture. Most realistic but heavy.
- (B) Add a `verifier: AppStoreJwsVerifier | { skip: true }` test-only escape hatch. Risky — easy to forget in production wiring.
- (C) Inject the verifier as a constructor dependency on `BillingService` (and a function arg on `decodeAppStoreNotification`). Tests pass a `NoOpJwsVerifier` (a class also exported from `app-store.jws-verifier.ts` for test use ONLY). The verifier interface is `{ verify(jws: string): unknown }`. The route wires the real `AppStoreJwsVerifier`; tests pass `new NoOpJwsVerifier()`.

We choose **(C)**. The `NoOpJwsVerifier` decodes the middle segment without checking the signature — i.e., the pre-2E.9 behavior. Production wiring NEVER uses it. The test-only class is clearly named and exported from a dedicated file path:

- `apps/server/src/features/billing/app-store.jws-verifier.ts` — production verifier + interface + `NoOpJwsVerifier`.

To prevent accidental production use of `NoOpJwsVerifier`, the constructor logs a WARN on instantiation: "NoOpJwsVerifier active — DO NOT USE IN PRODUCTION". To avoid spamming test output (the class is instantiated per-test, dozens of times per run), the warn fires **once per process** via a module-level flag (`let warned = false; if (!warned) { console.warn(...); warned = true; }`). This still screams loudly in production logs if it ever fires there.

## 8. Testing strategy

### 8.1 Unit — `app-store.jws-verifier.ts`

**Cert generation library:** Node's `node:crypto.X509Certificate` is **read-only** — it parses but cannot sign new certificates. Use `@peculiar/x509` (test-only devDependency, pure TypeScript, ~50KB) for the cert-chain factory.

In `beforeAll`, generate a self-signed test root + intermediate + leaf chain via `@peculiar/x509`'s `X509CertificateGenerator.create({ ... })`. Each step:

1. Generate P-256 keypair via `crypto.subtle.generateKey` (Web Crypto, available in Node 20+).
2. Build root cert: self-signed, `basicConstraints: cA=true`, `keyUsage: keyCertSign`, 10-year validity. Sign with its own key.
3. Build intermediate: signed by root, `cA=true`, leaf depth 0, validity inside root's window.
4. Build leaf: signed by intermediate, `cA=false`, `keyUsage: digitalSignature`, validity inside intermediate's window.
5. Convert each cert to DER → base64 → push to the `x5c` array (leaf first, then intermediate, then root).
6. Mint a JWS: header `{alg:"ES256", x5c}`; payload (the test object); signature = ECDSA-P-256 over `header.payload` using the leaf's private key, then convert DER → raw r||s for JWS encoding.

The verifier under test is constructed with the test root's PEM (override the bundled Apple root). All happy-path assertions use this rig.

Skeleton (implementer fills in):

```ts
import { X509CertificateGenerator, AsnConvert, BasicConstraintsExtension, KeyUsageFlags, KeyUsagesExtension } from "@peculiar/x509";
import { webcrypto, X509Certificate as NodeX509 } from "node:crypto";

async function makeChain() {
  const subtle = webcrypto.subtle;
  const algo = { name: "ECDSA", namedCurve: "P-256" } as const;
  const rootKeys = await subtle.generateKey(algo, true, ["sign", "verify"]);
  // ...build root, intermediate, leaf via X509CertificateGenerator.create({ issuer, subject, ... signingAlgorithm: { name: "ECDSA", hash: "SHA-256" }, signingKey: ..., publicKey: ..., extensions: [...] });
  // serialize: certPem = cert.toString("pem"); certDer = Buffer.from(cert.rawData);
  return { rootPem, leafKeyPair, certs: [leaf, intermediate, root] };
}
```

Cases:
- Happy path: valid 3-cert chain rooted at the test root, valid ES256 signature, validity dates cover `signedDate`. Returns the parsed payload object.
- `x5c` missing → throws.
- `x5c` length != 3 → throws.
- `alg` not `"ES256"` → throws.
- Chain ends at a DIFFERENT self-signed root than the trusted one → throws (fingerprint mismatch).
- Leaf cert expired (`validTo < signedDate`) → throws.
- Leaf cert not yet valid (`validFrom > signedDate`) → throws.
- Intermediate signature does not match root → throws (we tamper with intermediate's signature).
- ES256 signature over a different payload → throws (we modify the payload bytes after signing).
- ES256 signature has wrong length (not 64 bytes) → throws.

### 8.2 Unit — `app-store.decoder.ts` (with `NoOpJwsVerifier`)

All existing decoder tests get updated to pass `new NoOpJwsVerifier()` as the 2nd arg. Behavior should be identical to today — verification is a no-op, decoding logic unchanged.

Add ONE new positive case using the real `AppStoreJwsVerifier` with a test root, to prove the integration: a fully-signed envelope + inner JWS round-trips through the decoder.

### 8.3 Service tests (`billing.service.test.ts`)

Existing `buildSut` is updated to take an optional `jwsVerifier`. Default to `new NoOpJwsVerifier()` so existing tests continue to work without re-signing fixtures.

Add ONE new failing-verification test:
- A service-level test injects a `AppStoreJwsVerifier` with a test root and sends an envelope signed by a DIFFERENT root. Expect `MALFORMED_ENVELOPE` result.

### 8.4 Composition root tests

`billing-sweep.service.test.ts` and `billing-sweep.integration.test.ts`: pass `new NoOpJwsVerifier()` (the sweep does not process webhook envelopes). Already trivial.

### 8.5 Integration smoke

If there's an existing app-store integration test path, ensure it constructs the real verifier with a TEST root that signs its fixtures (not the bundled Apple root — those fixtures would need actual Apple test certs which we don't ship).

## 9. Acceptance criteria

- [ ] A valid App Store JWS signed by Apple's chain verifies and decodes (proven via a self-signed test root + fixture certs).
- [ ] A JWS with a different root fails verification and produces `MALFORMED_ENVELOPE`.
- [ ] A JWS with a tampered payload fails verification.
- [ ] A JWS with an expired leaf cert fails verification.
- [ ] The bundled Apple Root CA G3 is committed to the repo with its SHA-256 fingerprint in a comment.
- [ ] Production routes wire `AppStoreJwsVerifier.fromBundledRoot()` — `NoOpJwsVerifier` is only used in test code.
- [ ] `NoOpJwsVerifier` constructor emits a WARN log on instantiation.
- [ ] Both outer JWS and inner `signedTransactionInfo` JWS are verified.

## 10. Deferred (next-phase candidates)

- **ERROR-level logging for security-critical failures** (root-CA mismatch, signature mismatch). Currently all `MALFORMED_ENVELOPE` paths log at WARN. Requires surfacing the error sub-type from `JwsVerificationError`/`DecoderError` via a code field, then having the route handler branch on it. Operationally important for SIEM alerts; mechanically small.
- **Apple OCSP revocation check** — calls Apple's OCSP responder for each cert. Adds network latency to every webhook; do this lazily with caching.
- **Cert chain caching** — cache parsed `X509Certificate` instances keyed by their fingerprint to avoid re-parsing on hot paths.
- **Google Pub/Sub OIDC verification** — Google's analogue; we already have JWT primitives from 2E.8.
- **Metrics** — `app_store_jws_verify_failures_total{reason}` counter for ops visibility.
