# Phase 2E.10 — Google Pub/Sub OIDC verification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` with Sonnet 4.6 implementers and Opus 4.7 reviewers. Branch: `feature/phase-2e10-google-pubsub-oidc-verification`.

**Goal:** Verify the OIDC token Google attaches to every Pub/Sub push delivery. Replaces the shared-header secret as the primary auth on `/webhooks/google-play`. Feature-flagged for safe rollout (default off).

**Architecture:** `GoogleJwksCache` lazily fetches Google's published keys (with concurrent-fetch dedup + max-age honoring). `GoogleOidcVerifier` checks RS256 signature + `iss/aud/email/exp/iat` claims. Route preHandler selects `oidcGuard` when the flag is on, else falls through to the legacy `webhookGuard`. 401 (not 200) on failure so Google retries forgeries until they expire.

**Tech Stack:** `node:crypto.createVerify("RSA-SHA256")` + `createPublicKey({key, format:"jwk"})`. Fastify pino logger.

**Spec:** `docs/superpowers/specs/2026-05-12-phase-2e10-google-pubsub-oidc-design.md`

---

## File map

**Create:**
- `apps/server/src/features/billing/google-oidc.jwks-cache.ts` — JWKs fetcher + cache.
- `apps/server/src/features/billing/google-oidc.jwks-cache.test.ts` — unit, mocked fetch.
- `apps/server/src/features/billing/google-oidc.verifier.ts` — verifier + `OidcVerificationError`.
- `apps/server/src/features/billing/google-oidc.verifier.test.ts` — unit, generates RSA-2048 keypair in `beforeAll`.

**Modify:**
- `packages/env/src/server.ts` — 3 new env vars.
- `apps/server/src/features/billing/billing.route.ts` — construct verifier inside plugin closure; flip preHandler based on flag; cross-field env validation.

---

### Task 1: Env vars

**Files:**
- Modify: `packages/env/src/server.ts`

- [ ] **Step 1: Append** after `GOOGLE_PLAY_PACKAGE_NAME`:

```ts
GOOGLE_PLAY_VERIFY_OIDC: z.coerce.boolean().default(false),
GOOGLE_PLAY_OIDC_AUDIENCE: z.string().optional(),
GOOGLE_PLAY_OIDC_SERVICE_ACCOUNT_EMAIL: z.email().optional(),
```

Use `z.email()` (Zod v4 top-level shorthand) to match the existing `RESEND_FROM_EMAIL: z.email()` convention at line 15.

- [ ] **Step 2: Typecheck.**

```bash
bun --cwd apps/server check-types
```

- [ ] **Step 3: Commit.**

```bash
git add packages/env/src/server.ts
git commit -m "feat(env): add google play pub/sub oidc verification config"
```

---

### Task 2: `GoogleJwksCache`

**Files:**
- Create: `apps/server/src/features/billing/google-oidc.jwks-cache.ts`
- Create: `apps/server/src/features/billing/google-oidc.jwks-cache.test.ts`

- [ ] **Step 1: Write failing tests.**

```ts
// google-oidc.jwks-cache.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoogleJwksCache } from "./google-oidc.jwks-cache";

function jsonResponse(body: unknown, opts?: { status?: number; maxAge?: number }): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts?.maxAge !== undefined) headers["cache-control"] = `public, max-age=${opts.maxAge}`;
  return new Response(JSON.stringify(body), { status: opts?.status ?? 200, headers });
}

const SAMPLE_JWK = {
  kid: "kid-1", kty: "RSA", alg: "RS256", use: "sig",
  // dummy n/e — `createPublicKey({format:"jwk"})` parses these. Implementer: use a real keypair-derived JWK
  // generated once in beforeAll via crypto.generateKeyPairSync + key.export({format:"jwk"}).
  n: "PLACEHOLDER", e: "AQAB",
};

describe("GoogleJwksCache", () => {
  let fetchImpl: ReturnType<typeof vi.fn>;
  let logger: { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let realJwk: any;   // populated in beforeEach with a real JWK

  beforeEach(async () => {
    fetchImpl = vi.fn();
    logger = { warn: vi.fn(), error: vi.fn() };
    // Generate a real keypair once for tests that exercise createPublicKey:
    const { generateKeyPairSync } = await import("node:crypto");
    const { publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const { createPublicKey } = await import("node:crypto");
    const jwk = createPublicKey(publicKey).export({ format: "jwk" }) as any;
    realJwk = { kid: "kid-1", kty: "RSA", alg: "RS256", use: "sig", n: jwk.n, e: jwk.e };
  });

  it("first call fetches certs and returns the key", async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ keys: [realJwk] }, { maxAge: 3600 }));
    const cache = new GoogleJwksCache({ fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    const key = await cache.getKey("kid-1");
    expect(key).not.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("second call within TTL uses cached value (no HTTP)", async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ keys: [realJwk] }, { maxAge: 3600 }));
    const cache = new GoogleJwksCache({ fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    await cache.getKey("kid-1");
    await cache.getKey("kid-1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("getKey(unknownKid) triggers a refresh and returns null if still absent", async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ keys: [realJwk] }, { maxAge: 3600 }));
    fetchImpl.mockResolvedValueOnce(jsonResponse({ keys: [realJwk] }, { maxAge: 3600 }));
    const cache = new GoogleJwksCache({ fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    await cache.getKey("kid-1");
    const key = await cache.getKey("unknown-kid");
    expect(key).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);   // 1 first-fetch + 1 refresh
  });

  it("concurrent first callers dedup to one HTTP call", async () => {
    let resolve: (r: Response) => void;
    const pending = new Promise<Response>((r) => { resolve = r; });
    fetchImpl.mockReturnValueOnce(pending);
    const cache = new GoogleJwksCache({ fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    const a = cache.getKey("kid-1");
    const b = cache.getKey("kid-1");
    resolve!(jsonResponse({ keys: [realJwk] }, { maxAge: 3600 }));
    await Promise.all([a, b]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns null and logs error on 5xx (does not poison cache)", async () => {
    fetchImpl.mockResolvedValueOnce(new Response("", { status: 500 }));
    const cache = new GoogleJwksCache({ fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    const key = await cache.getKey("kid-1");
    expect(key).toBeNull();
    expect(logger.error).toHaveBeenCalled();
    // Second call still attempts to fetch:
    fetchImpl.mockResolvedValueOnce(jsonResponse({ keys: [realJwk] }, { maxAge: 3600 }));
    const key2 = await cache.getKey("kid-1");
    expect(key2).not.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("returns null on non-JSON response body", async () => {
    fetchImpl.mockResolvedValueOnce(new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }));
    const cache = new GoogleJwksCache({ fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    const key = await cache.getKey("kid-1");
    expect(key).toBeNull();
  });

  it("falls back to 3600s TTL when no Cache-Control header", async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ keys: [realJwk] }));   // no maxAge
    const cache = new GoogleJwksCache({ fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    await cache.getKey("kid-1");
    await cache.getKey("kid-1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);   // within fallback TTL
  });
});
```

- [ ] **Step 2: Implement.**

```ts
// google-oidc.jwks-cache.ts
import { createPublicKey, type KeyObject } from "node:crypto";

const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const DEFAULT_TTL_MS = 3600 * 1000;
type Logger = { warn: (...a: unknown[]) => void; error: (...a: unknown[]) => void };

export class GoogleJwksCache {
  private keys: Map<string, KeyObject> = new Map();
  private expiresAtMs = 0;
  private pendingFetch: Promise<void> | null = null;
  private readonly fetchImpl: typeof fetch;
  private readonly logger: Logger;
  private readonly now: () => number;

  constructor(opts: { fetchImpl?: typeof fetch; logger?: Logger; now?: () => number } = {}) {
    this.fetchImpl = opts.fetchImpl ?? ((...a) => globalThis.fetch(...a));
    this.logger = opts.logger ?? { warn: console.warn.bind(console), error: console.error.bind(console) };
    this.now = opts.now ?? (() => Date.now());
  }

  async getKey(kid: string): Promise<KeyObject | null> {
    // 1. If cache is fresh and has the kid, return immediately.
    if (this.now() < this.expiresAtMs) {
      const k = this.keys.get(kid);
      if (k) return k;
    }
    // 2. Otherwise: ensure (and await) a single in-flight refresh, then retry.
    await this.refreshOnce();
    return this.keys.get(kid) ?? null;
  }

  private async refreshOnce(): Promise<void> {
    if (this.pendingFetch) return this.pendingFetch;
    this.pendingFetch = this.doRefresh().finally(() => { this.pendingFetch = null; });
    return this.pendingFetch;
  }

  private async doRefresh(): Promise<void> {
    let res: Response;
    try {
      res = await this.fetchImpl(GOOGLE_CERTS_URL, { headers: { Accept: "application/json" } });
    } catch (e) {
      this.logger.error({ err: (e as Error).message }, "google-oidc jwks fetch network error");
      return;
    }
    if (!res.ok) {
      this.logger.error({ status: res.status }, "google-oidc jwks fetch non-ok");
      return;
    }
    let body: { keys?: Array<Record<string, string>> };
    try {
      body = await res.json();
    } catch (e) {
      this.logger.error({ err: (e as Error).message }, "google-oidc jwks non-json body");
      return;
    }
    if (!body.keys || !Array.isArray(body.keys)) {
      this.logger.error({}, "google-oidc jwks missing keys[]");
      return;
    }
    const next = new Map<string, KeyObject>();
    for (const jwk of body.keys) {
      try {
        const key = createPublicKey({ key: jwk as never, format: "jwk" });
        if (typeof jwk.kid === "string") next.set(jwk.kid, key);
      } catch (e) {
        this.logger.warn({ err: (e as Error).message, kid: jwk.kid }, "google-oidc jwk parse failed");
      }
    }
    this.keys = next;
    const cacheControl = res.headers.get("cache-control");
    const m = cacheControl?.match(/max-age=(\d+)/);
    const ttlMs = m ? parseInt(m[1]!, 10) * 1000 : DEFAULT_TTL_MS;
    this.expiresAtMs = this.now() + ttlMs;
  }
}
```

- [ ] **Step 3: Run tests.**

```bash
bun test apps/server/src/features/billing/google-oidc.jwks-cache.test.ts
```

- [ ] **Step 4: Commit.**

```bash
git add apps/server/src/features/billing/google-oidc.jwks-cache.ts apps/server/src/features/billing/google-oidc.jwks-cache.test.ts
git commit -m "feat(billing): add google jwks cache with rotation-aware refresh"
```

---

### Task 3: `GoogleOidcVerifier`

**Files:**
- Create: `apps/server/src/features/billing/google-oidc.verifier.ts`
- Create: `apps/server/src/features/billing/google-oidc.verifier.test.ts`

- [ ] **Step 1: Implement** with `createVerify("RSA-SHA256")` (NOT `crypto.verify(string, ...)` — that requires a Buffer for the data arg).

```ts
// google-oidc.verifier.ts
import { createVerify, type KeyObject } from "node:crypto";
import type { GoogleJwksCache } from "./google-oidc.jwks-cache";

export class OidcVerificationError extends Error {
  constructor(msg: string) { super(msg); this.name = "OidcVerificationError"; }
}

export type GoogleOidcPayload = {
  iss: string; aud: string; exp: number; iat: number;
  email?: string; email_verified?: boolean; sub?: string;
};

const ALLOWED_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

export class GoogleOidcVerifier {
  private readonly clockSkewSec: number;
  private readonly now: () => Date;

  constructor(
    private readonly opts: {
      jwks: GoogleJwksCache;
      expectedAudience: string;
      expectedEmail: string | null;
      clockSkewSec?: number;
      now?: () => Date;
    },
  ) {
    if (!opts.expectedAudience) throw new OidcVerificationError("expectedAudience required");
    this.clockSkewSec = opts.clockSkewSec ?? 60;
    this.now = opts.now ?? (() => new Date());
  }

  async verify(jwt: string): Promise<{ payload: GoogleOidcPayload }> {
    const parts = jwt.split(".");
    if (parts.length !== 3) throw new OidcVerificationError("JWT must have 3 segments");
    const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

    let header: { alg?: string; kid?: string };
    try {
      header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf-8"));
    } catch {
      throw new OidcVerificationError("header is not base64url+JSON");
    }
    if (header.alg !== "RS256") throw new OidcVerificationError(`unsupported alg: ${header.alg}`);
    if (!header.kid) throw new OidcVerificationError("missing kid");

    const key = await this.opts.jwks.getKey(header.kid);
    if (!key) throw new OidcVerificationError(`unknown kid: ${header.kid}`);

    const v = createVerify("RSA-SHA256");
    v.update(`${headerB64}.${payloadB64}`);
    v.end();
    if (!v.verify(key, Buffer.from(sigB64, "base64url"))) {
      throw new OidcVerificationError("signature invalid");
    }

    let payload: GoogleOidcPayload;
    try {
      payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
    } catch {
      throw new OidcVerificationError("payload is not base64url+JSON");
    }

    const nowSec = Math.floor(this.now().getTime() / 1000);
    if (typeof payload.exp !== "number" || payload.exp <= nowSec) throw new OidcVerificationError("token expired");
    if (typeof payload.iat !== "number" || payload.iat > nowSec + this.clockSkewSec) {
      throw new OidcVerificationError("iat in the future");
    }
    if (!ALLOWED_ISSUERS.has(payload.iss)) throw new OidcVerificationError(`wrong issuer: ${payload.iss}`);
    if (payload.aud !== this.opts.expectedAudience) throw new OidcVerificationError(`wrong audience: ${payload.aud}`);
    if (this.opts.expectedEmail) {
      if (payload.email !== this.opts.expectedEmail) throw new OidcVerificationError(`wrong email: ${payload.email}`);
      if (payload.email_verified !== true) throw new OidcVerificationError("email not verified");
    }

    return { payload };
  }
}
```

- [ ] **Step 2: Write tests.**

```ts
// google-oidc.verifier.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { createSign, createPublicKey, generateKeyPairSync, type KeyObject } from "node:crypto";
import { GoogleOidcVerifier, OidcVerificationError } from "./google-oidc.verifier";

class StubJwks {
  constructor(private readonly map: Map<string, KeyObject>) {}
  async getKey(kid: string) { return this.map.get(kid) ?? null; }
}

const AUD = "https://api.pruvi.example/webhooks/google-play";
const EMAIL = "pubsub-publisher@project.iam.gserviceaccount.com";

let privatePem: string;
let publicKey: KeyObject;
let stub: StubJwks;

beforeAll(() => {
  const { privateKey: priv, publicKey: pub } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  privatePem = priv;
  publicKey = createPublicKey(pub);
  stub = new StubJwks(new Map([["kid-1", publicKey]]));
});

function base64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function mintJwt(payload: Record<string, unknown>, opts?: { kid?: string; alg?: string }): string {
  const header = { alg: opts?.alg ?? "RS256", kid: opts?.kid ?? "kid-1", typ: "JWT" };
  const headerB64 = base64url(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)));
  const signer = createSign("RSA-SHA256");
  signer.update(`${headerB64}.${payloadB64}`);
  signer.end();
  const sig = base64url(signer.sign(privatePem));
  return `${headerB64}.${payloadB64}.${sig}`;
}

function validPayload(overrides: Partial<Record<string, unknown>> = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    iss: "https://accounts.google.com",
    aud: AUD,
    sub: "12345",
    email: EMAIL,
    email_verified: true,
    iat: nowSec - 5,
    exp: nowSec + 3600,
    ...overrides,
  };
}

describe("GoogleOidcVerifier", () => {
  it("constructor throws when expectedAudience is empty", () => {
    expect(() => new GoogleOidcVerifier({ jwks: stub as never, expectedAudience: "", expectedEmail: null }))
      .toThrow(OidcVerificationError);
  });

  it("verifies a valid JWT", async () => {
    const v = new GoogleOidcVerifier({ jwks: stub as never, expectedAudience: AUD, expectedEmail: EMAIL });
    const out = await v.verify(mintJwt(validPayload()));
    expect(out.payload.email).toBe(EMAIL);
  });

  it("throws when alg != RS256", async () => {
    const v = new GoogleOidcVerifier({ jwks: stub as never, expectedAudience: AUD, expectedEmail: null });
    await expect(v.verify(mintJwt(validPayload(), { alg: "HS256" }))).rejects.toThrow(/unsupported alg/);
  });

  it("throws when kid is missing", async () => {
    const v = new GoogleOidcVerifier({ jwks: stub as never, expectedAudience: AUD, expectedEmail: null });
    const header = { alg: "RS256", typ: "JWT" };   // no kid
    const headerB64 = base64url(Buffer.from(JSON.stringify(header)));
    const payloadB64 = base64url(Buffer.from(JSON.stringify(validPayload())));
    const signer = createSign("RSA-SHA256");
    signer.update(`${headerB64}.${payloadB64}`);
    signer.end();
    const sig = base64url(signer.sign(privatePem));
    await expect(v.verify(`${headerB64}.${payloadB64}.${sig}`)).rejects.toThrow(/missing kid/);
  });

  it("throws on unknown kid", async () => {
    const v = new GoogleOidcVerifier({ jwks: stub as never, expectedAudience: AUD, expectedEmail: null });
    await expect(v.verify(mintJwt(validPayload(), { kid: "unknown" }))).rejects.toThrow(/unknown kid/);
  });

  it("throws on tampered signature", async () => {
    const v = new GoogleOidcVerifier({ jwks: stub as never, expectedAudience: AUD, expectedEmail: null });
    const good = mintJwt(validPayload());
    const parts = good.split(".");
    parts[2] = base64url(Buffer.alloc(256, 0xff));   // wrong-but-correctly-sized garbage
    await expect(v.verify(parts.join("."))).rejects.toThrow(/signature invalid/);
  });

  it("throws when exp is past", async () => {
    const v = new GoogleOidcVerifier({ jwks: stub as never, expectedAudience: AUD, expectedEmail: null });
    const nowSec = Math.floor(Date.now() / 1000);
    await expect(v.verify(mintJwt(validPayload({ exp: nowSec - 60 })))).rejects.toThrow(/expired/);
  });

  it("throws when iat is in the future beyond clock skew", async () => {
    const v = new GoogleOidcVerifier({ jwks: stub as never, expectedAudience: AUD, expectedEmail: null, clockSkewSec: 30 });
    const nowSec = Math.floor(Date.now() / 1000);
    await expect(v.verify(mintJwt(validPayload({ iat: nowSec + 120 })))).rejects.toThrow(/iat in the future/);
  });

  it("throws on wrong issuer", async () => {
    const v = new GoogleOidcVerifier({ jwks: stub as never, expectedAudience: AUD, expectedEmail: null });
    await expect(v.verify(mintJwt(validPayload({ iss: "https://evil.example" })))).rejects.toThrow(/wrong issuer/);
  });

  it("throws on wrong audience", async () => {
    const v = new GoogleOidcVerifier({ jwks: stub as never, expectedAudience: AUD, expectedEmail: null });
    await expect(v.verify(mintJwt(validPayload({ aud: "different" })))).rejects.toThrow(/wrong audience/);
  });

  it("throws on wrong email when expectedEmail is set", async () => {
    const v = new GoogleOidcVerifier({ jwks: stub as never, expectedAudience: AUD, expectedEmail: EMAIL });
    await expect(v.verify(mintJwt(validPayload({ email: "other@example.com" })))).rejects.toThrow(/wrong email/);
  });

  it("throws when email_verified is false and expectedEmail is set", async () => {
    const v = new GoogleOidcVerifier({ jwks: stub as never, expectedAudience: AUD, expectedEmail: EMAIL });
    await expect(v.verify(mintJwt(validPayload({ email_verified: false })))).rejects.toThrow(/email not verified/);
  });

  it("skips email check when expectedEmail is null (even if claim is absent)", async () => {
    const v = new GoogleOidcVerifier({ jwks: stub as never, expectedAudience: AUD, expectedEmail: null });
    const { email, email_verified, ...payloadWithoutEmail } = validPayload();
    const out = await v.verify(mintJwt(payloadWithoutEmail));
    expect(out.payload.aud).toBe(AUD);
  });

  it("throws on wrong segment count", async () => {
    const v = new GoogleOidcVerifier({ jwks: stub as never, expectedAudience: AUD, expectedEmail: null });
    await expect(v.verify("a.b")).rejects.toThrow(/3 segments/);
  });
});
```

- [ ] **Step 3: Run tests.**

```bash
bun test apps/server/src/features/billing/google-oidc.verifier.test.ts
```

- [ ] **Step 4: Commit.**

```bash
git add apps/server/src/features/billing/google-oidc.verifier.ts apps/server/src/features/billing/google-oidc.verifier.test.ts
git commit -m "feat(billing): add google oidc verifier with claim validation"
```

---

### Task 4: Route wiring + cross-field env validation

**Files:**
- Modify: `apps/server/src/features/billing/billing.route.ts`

- [ ] **Step 1: Add the new `oidcGuard` and conditional preHandler selection.**

Inside the `billingRoutes` plugin closure (alongside the existing `apiClient` construction), add:

```ts
import { GoogleJwksCache } from "./google-oidc.jwks-cache";
import { GoogleOidcVerifier, OidcVerificationError } from "./google-oidc.verifier";

// inside billingRoutes(fastify):
let googlePreHandler = webhookGuard;
if (env.GOOGLE_PLAY_VERIFY_OIDC) {
  if (!env.GOOGLE_PLAY_OIDC_AUDIENCE || !env.GOOGLE_PLAY_OIDC_SERVICE_ACCOUNT_EMAIL) {
    throw new Error("GOOGLE_PLAY_VERIFY_OIDC requires GOOGLE_PLAY_OIDC_AUDIENCE and GOOGLE_PLAY_OIDC_SERVICE_ACCOUNT_EMAIL");
  }
  const jwks = new GoogleJwksCache({ logger: fastify.log });
  const oidcVerifier = new GoogleOidcVerifier({
    jwks,
    expectedAudience: env.GOOGLE_PLAY_OIDC_AUDIENCE,
    expectedEmail: env.GOOGLE_PLAY_OIDC_SERVICE_ACCOUNT_EMAIL,
  });
  googlePreHandler = async (request: FastifyRequest, _reply: FastifyReply) => {
    const auth = request.headers.authorization;
    if (typeof auth !== "string" || !auth.startsWith("Bearer ")) {
      throw new UnauthorizedError("UNAUTHORIZED");
    }
    const jwt = auth.slice("Bearer ".length).trim();
    try {
      await oidcVerifier.verify(jwt);
    } catch (e) {
      if (e instanceof OidcVerificationError) {
        fastify.log.warn({ err: e.message }, "google-play oidc verification failed");
        throw new UnauthorizedError("UNAUTHORIZED");
      }
      throw e;
    }
  };
}

// Then update the route preHandler:
fastify.post("/webhooks/google-play", { ..., preHandler: [googlePreHandler] }, async (request) => { ... });
```

`googlePreHandler` uses the same 2-arg signature `(request, _reply)` as the existing `webhookGuard`. The `_reply` parameter is unused but keeps the type consistent so `let googlePreHandler = webhookGuard` doesn't widen the inferred type.

- [ ] **Step 2: Typecheck + test.**

```bash
bun --cwd apps/server check-types
bun test apps/server/src/features/billing/
```

All existing billing tests pass (flag defaults to false → `webhookGuard` runs as today). No new failures.

- [ ] **Step 3: Commit.**

```bash
git add apps/server/src/features/billing/billing.route.ts
git commit -m "feat(billing): conditional oidc guard on google play webhook"
```

---

## Gate D

After Task 4, dispatch a final Opus 4.7 spec-coverage review against `git diff main..HEAD`:
- All §9 acceptance criteria covered.
- §8.1 (JWKs cache) + §8.2 (Verifier) test cases present.
- 401 (not 200/MALFORMED) on verification failure.
- Cross-field env validation throws at boot when flag is on without required vars.
- Existing tests pass with flag off.
