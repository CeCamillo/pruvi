# Phase 2E.8 — Google Play real `expiryTime` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` with Sonnet 4.6 implementers and Opus 4.7 reviewers. Every task ends with both spec-compliance and code-quality reviews. Branch already created: `feature/phase-2e8-google-play-real-expiry`.

**Goal:** Replace the 30-day default `currentPeriodEnd` for Google Play grant events with the real `expiryTime` from `androidpublisher.purchases.subscriptionsv2.get`. Optional env var; fully backward-compatible when absent.

**Architecture:** New `GooglePlayApiClient` minting OAuth2 JWT-bearer tokens + calling the v2 endpoint. `BillingService.processGooglePlayEnvelope` looks up `realExpiryTime` for grant events BEFORE the per-event TX and passes it as a new optional 3rd arg to `applyDecodedEvent`. Replay path keeps the existing 30-day fallback. All failures are logged + fall back; nothing blocks the webhook.

**Tech Stack:** node:crypto (RS256), global `fetch` (Bun), Fastify pino logger, neverthrow, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-12-phase-2e8-google-play-real-expiry-design.md`

---

## File map

**Create:**
- `apps/server/src/features/billing/google-play.service-account.ts` — JSON parsing + `loadServiceAccountFromEnv`, `mintJwt`.
- `apps/server/src/features/billing/google-play.service-account.test.ts` — pure unit.
- `apps/server/src/features/billing/google-play.api-client.ts` — class with `getSubscription` + token cache.
- `apps/server/src/features/billing/google-play.api-client.test.ts` — mocked-fetch unit.

**Modify:**
- `packages/env/src/server.ts` — add two optional env vars.
- `apps/server/src/features/billing/billing.service.ts` — `BillingService` constructor (adds `apiClient` + `packageNameFallback: string | null`) + `processGooglePlayEnvelope` + `applyDecodedEvent` signature. NOTE: the service does NOT import `env` directly — `packageNameFallback` is injected at the composition root (route + worker) to keep the service env-free, consistent with the existing dependency-injection pattern (db, repo, ultra are all injected, not imported).
- `apps/server/src/features/billing/billing.service.test.ts` — update `buildSut` to pass the new ctor args (stub api client, null fallback); add new cases for the real-expiry path.
- `apps/server/src/features/billing/billing.route.ts` — construct + pass `apiClient` + `env.GOOGLE_PLAY_PACKAGE_NAME ?? null` into `BillingService`.
- `apps/server/src/workers/billing-sweep.worker.ts` — same construction update (5 args: db, repo, ultra, apiClient, packageNameFallback). The sweep worker never calls `processGooglePlayEnvelope`, so it can use `new GooglePlayApiClient(null)` (no-op client) and `null` fallback — but the 4-arg signature must still be satisfied for TypeScript.
- `apps/server/src/features/billing/billing-sweep.service.test.ts` — every inline `new BillingService(fakeDb, repo, ultra)` (5 sites — search the file) becomes the 5-arg form. Use `{ getSubscription: vi.fn() } as unknown as GooglePlayApiClient` and `null` for the new args.
- `apps/server/src/features/billing/billing-sweep.integration.test.ts` — the `beforeEach` construction in this file becomes the 5-arg form. Use `new GooglePlayApiClient(null)` and `null`.

---

### Task 1: Env vars

**Files:**
- Modify: `packages/env/src/server.ts`

- [ ] **Step 1: Add the two optional env vars** after `APP_STORE_WEBHOOK_TOKEN`:

```ts
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: z.string().optional(),
GOOGLE_PLAY_PACKAGE_NAME: z.string().optional(),
```

- [ ] **Step 2: Typecheck.**

Run: `bun --cwd apps/server check-types`. No NEW errors expected — pre-existing errors in `sessions/`, `invitations/`, etc. are not your responsibility.

- [ ] **Step 3: Commit.**

```bash
git add packages/env/src/server.ts
git commit -m "feat(env): add optional google play service-account + package name vars"
```

---

### Task 2: Service-account parser + JWT minter

**Files:**
- Create: `apps/server/src/features/billing/google-play.service-account.ts`
- Create: `apps/server/src/features/billing/google-play.service-account.test.ts`

- [ ] **Step 1: Write failing unit tests.**

```ts
// google-play.service-account.test.ts
import { describe, expect, it } from "vitest";
import {
  parseServiceAccount,
  loadServiceAccountFromEnv,
  mintJwt,
  InvalidServiceAccountError,
  type ServiceAccountCreds,
} from "./google-play.service-account";

const FIXTURE_PRIVATE_KEY = [
  "-----BEGIN PRIVATE KEY-----",
  // a real 2048-bit PKCS#8 RSA key. Generate once locally for the test fixture:
  //   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -outform PEM
  //   then base64-encode for safer embedding here. For this test the actual key bytes
  //   don't matter for parseServiceAccount; only mintJwt cares (it needs RS256-signable PEM).
  // Implementer: use `crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })` in a
  // `beforeAll` instead and inject the resulting PEM into the fixture creds.
  "PLACEHOLDER",
  "-----END PRIVATE KEY-----",
].join("\n");

describe("parseServiceAccount", () => {
  it("parses a valid JSON with embedded newlines in private_key", () => {
    const json = JSON.stringify({
      client_email: "svc@proj.iam.gserviceaccount.com",
      private_key: FIXTURE_PRIVATE_KEY,
      token_uri: "https://oauth2.googleapis.com/token",
    });
    const c = parseServiceAccount(json);
    expect(c.clientEmail).toBe("svc@proj.iam.gserviceaccount.com");
    expect(c.privateKey).toContain("BEGIN PRIVATE KEY");
    expect(c.tokenUri).toBe("https://oauth2.googleapis.com/token");
  });

  it("throws InvalidServiceAccountError on malformed JSON", () => {
    expect(() => parseServiceAccount("not json")).toThrow(InvalidServiceAccountError);
  });

  it("throws when client_email is missing", () => {
    const json = JSON.stringify({ private_key: "x", token_uri: "https://oauth2.googleapis.com/token" });
    expect(() => parseServiceAccount(json)).toThrow(InvalidServiceAccountError);
  });

  it("throws when private_key is missing", () => {
    const json = JSON.stringify({ client_email: "a@b", token_uri: "https://oauth2.googleapis.com/token" });
    expect(() => parseServiceAccount(json)).toThrow(InvalidServiceAccountError);
  });
});

describe("loadServiceAccountFromEnv", () => {
  it("returns null when env var is undefined", () => {
    expect(loadServiceAccountFromEnv({ GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: undefined })).toBeNull();
  });

  it("returns parsed creds when env var is present", () => {
    const json = JSON.stringify({
      client_email: "svc@proj.iam.gserviceaccount.com",
      private_key: FIXTURE_PRIVATE_KEY,
      token_uri: "https://oauth2.googleapis.com/token",
    });
    const c = loadServiceAccountFromEnv({ GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: json });
    expect(c).not.toBeNull();
    expect(c!.clientEmail).toBe("svc@proj.iam.gserviceaccount.com");
  });
});

describe("mintJwt", () => {
  let creds: ServiceAccountCreds;
  beforeAll(async () => {
    const { generateKeyPairSync } = await import("node:crypto");
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    creds = { clientEmail: "a@b.com", privateKey, tokenUri: "https://oauth2.googleapis.com/token" };
  });

  it("produces a 3-segment base64url JWT with RS256 header and expected claims", () => {
    const now = 1747000000;
    const jwt = mintJwt(creds, now);
    const [h, p, s] = jwt.split(".");
    expect(h && p && s).toBeTruthy();
    const header = JSON.parse(Buffer.from(h!, "base64url").toString("utf-8"));
    expect(header).toEqual({ alg: "RS256", typ: "JWT" });
    const payload = JSON.parse(Buffer.from(p!, "base64url").toString("utf-8"));
    expect(payload.iss).toBe("a@b.com");
    expect(payload.scope).toBe("https://www.googleapis.com/auth/androidpublisher");
    expect(payload.aud).toBe("https://oauth2.googleapis.com/token");
    expect(payload.iat).toBe(now);
    expect(payload.exp).toBe(now + 3600);
    expect(Buffer.from(s!, "base64url").length).toBe(256); // RS256 over a 2048-bit key
  });
});
```

NOTE: Replace `FIXTURE_PRIVATE_KEY` with a real PEM generated in a `beforeAll` via `crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } })`. Hardcoding a key into the source tree is fine for tests but generating is cleaner. The `parseServiceAccount` cases that don't actually verify the signature can keep a literal `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"` placeholder string.

- [ ] **Step 2: Run tests to verify they fail.**

Run: `bun test apps/server/src/features/billing/google-play.service-account.test.ts`

- [ ] **Step 3: Implement the module.**

```ts
// google-play.service-account.ts
import { createSign } from "node:crypto";

export class InvalidServiceAccountError extends Error {
  constructor(msg: string) { super(msg); this.name = "InvalidServiceAccountError"; }
}

export type ServiceAccountCreds = {
  clientEmail: string;
  privateKey: string;   // PEM-encoded RSA private key
  tokenUri: string;
};

export function parseServiceAccount(json: string): ServiceAccountCreds {
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch (e) {
    throw new InvalidServiceAccountError(`Invalid JSON: ${(e as Error).message}`);
  }
  if (!obj || typeof obj !== "object") {
    throw new InvalidServiceAccountError("Parsed value is not an object");
  }
  const o = obj as Record<string, unknown>;
  if (typeof o.client_email !== "string" || !o.client_email) {
    throw new InvalidServiceAccountError("Missing client_email");
  }
  if (typeof o.private_key !== "string" || !o.private_key) {
    throw new InvalidServiceAccountError("Missing private_key");
  }
  const tokenUri = typeof o.token_uri === "string" && o.token_uri ? o.token_uri : "https://oauth2.googleapis.com/token";
  return { clientEmail: o.client_email, privateKey: o.private_key, tokenUri };
}

export function loadServiceAccountFromEnv(env: { GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?: string }): ServiceAccountCreds | null {
  if (!env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) return null;
  return parseServiceAccount(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
}

const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Mints an RS256-signed JWT bearer assertion. `nowSeconds` allows deterministic tests. */
export function mintJwt(creds: ServiceAccountCreds, nowSeconds: number = Math.floor(Date.now() / 1000)): string {
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: creds.clientEmail,
    scope: SCOPE,
    aud: creds.tokenUri,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };
  const encHeader = base64url(Buffer.from(JSON.stringify(header), "utf-8"));
  const encPayload = base64url(Buffer.from(JSON.stringify(payload), "utf-8"));
  const signingInput = `${encHeader}.${encPayload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(creds.privateKey);
  return `${signingInput}.${base64url(signature)}`;
}
```

- [ ] **Step 4: Run tests to verify they pass.**

Run: `bun test apps/server/src/features/billing/google-play.service-account.test.ts`

- [ ] **Step 5: Typecheck and commit.**

```bash
bun --cwd apps/server check-types
git add apps/server/src/features/billing/google-play.service-account.ts apps/server/src/features/billing/google-play.service-account.test.ts
git commit -m "feat(billing): add google-play service-account parser + jwt minter"
```

---

### Task 3: `GooglePlayApiClient` with mocked-fetch tests

**Files:**
- Create: `apps/server/src/features/billing/google-play.api-client.ts`
- Create: `apps/server/src/features/billing/google-play.api-client.test.ts`

- [ ] **Step 1: Write failing unit tests** in `google-play.api-client.test.ts`. Mock `fetchImpl` via the constructor — do NOT use `vi.stubGlobal`.

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { GooglePlayApiClient } from "./google-play.api-client";
import type { ServiceAccountCreds } from "./google-play.service-account";
import { generateKeyPairSync } from "node:crypto";

function makeCreds(): ServiceAccountCreds {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { clientEmail: "svc@proj.iam.gserviceaccount.com", privateKey, tokenUri: "https://oauth2.googleapis.com/token" };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function nonJsonResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "text/html" } });
}

describe("GooglePlayApiClient", () => {
  let creds: ServiceAccountCreds;
  let fetchImpl: ReturnType<typeof vi.fn>;
  let logger: { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    creds = makeCreds();
    fetchImpl = vi.fn();
    logger = { warn: vi.fn(), error: vi.fn() };
  });

  it("returns null without HTTP call when creds is null", async () => {
    const client = new GooglePlayApiClient(null, { fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    const r = await client.getSubscription("com.pkg", "tok");
    expect(r).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("happy path: mints token, fetches subscription, returns Date from lineItems[0].expiryTime", async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ access_token: "AT1", expires_in: 3600, token_type: "Bearer" }));
    fetchImpl.mockResolvedValueOnce(jsonResponse({ lineItems: [{ productId: "ultra_monthly", expiryTime: "2026-06-12T15:30:00Z" }] }));
    const client = new GooglePlayApiClient(creds, { fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    const r = await client.getSubscription("com.pkg", "tok-1");
    expect(r).toEqual(new Date("2026-06-12T15:30:00Z"));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    // assert URL shape
    expect(fetchImpl.mock.calls[1]![0]).toBe(
      "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.pkg/purchases/subscriptionsv2/tokens/tok-1",
    );
  });

  it("caches the access token across calls within TTL", async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ access_token: "AT1", expires_in: 3600, token_type: "Bearer" }));
    fetchImpl.mockResolvedValueOnce(jsonResponse({ lineItems: [{ expiryTime: "2026-06-12T00:00:00Z" }] }));
    fetchImpl.mockResolvedValueOnce(jsonResponse({ lineItems: [{ expiryTime: "2026-07-12T00:00:00Z" }] }));
    const client = new GooglePlayApiClient(creds, { fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    await client.getSubscription("com.pkg", "tok-a");
    await client.getSubscription("com.pkg", "tok-b");
    expect(fetchImpl).toHaveBeenCalledTimes(3);   // 1 token + 2 v2 calls (NOT 4)
  });

  it("refreshes token after TTL elapses", async () => {
    const client = new GooglePlayApiClient(creds, { fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    // Mint a token that's already near expiry
    fetchImpl.mockResolvedValueOnce(jsonResponse({ access_token: "AT1", expires_in: 60, token_type: "Bearer" }));
    fetchImpl.mockResolvedValueOnce(jsonResponse({ lineItems: [{ expiryTime: "2026-06-12T00:00:00Z" }] }));
    await client.getSubscription("com.pkg", "tok-a");

    // Advance internal clock past the cached token's TTL minus skew
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 70_000);

    fetchImpl.mockResolvedValueOnce(jsonResponse({ access_token: "AT2", expires_in: 3600, token_type: "Bearer" }));
    fetchImpl.mockResolvedValueOnce(jsonResponse({ lineItems: [{ expiryTime: "2026-07-12T00:00:00Z" }] }));
    await client.getSubscription("com.pkg", "tok-b");

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });

  it("returns null on tokens endpoint 401 AND invalidates cached token", async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ access_token: "AT1", expires_in: 3600, token_type: "Bearer" }));
    fetchImpl.mockResolvedValueOnce(new Response("", { status: 401 }));
    const client = new GooglePlayApiClient(creds, { fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    await client.getSubscription("com.pkg", "tok-a");   // primes cache
    // Now force v2 endpoint to fail with 401 — note: 401 from v2 (not tokens) invalidates the cache.
    expect(logger.error).toHaveBeenCalled();
    // Next call should mint fresh token
    fetchImpl.mockResolvedValueOnce(jsonResponse({ access_token: "AT2", expires_in: 3600, token_type: "Bearer" }));
    fetchImpl.mockResolvedValueOnce(jsonResponse({ lineItems: [{ expiryTime: "2026-07-12T00:00:00Z" }] }));
    const r = await client.getSubscription("com.pkg", "tok-b");
    expect(r).toEqual(new Date("2026-07-12T00:00:00Z"));
    expect(fetchImpl).toHaveBeenCalledTimes(4);   // 2 token mints + 2 v2 calls
  });

  it("returns null when tokens endpoint returns non-JSON body", async () => {
    fetchImpl.mockResolvedValueOnce(nonJsonResponse("<html>proxy error</html>", 200));
    const client = new GooglePlayApiClient(creds, { fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    const r = await client.getSubscription("com.pkg", "tok");
    expect(r).toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });

  it("returns null on v2 404", async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ access_token: "AT1", expires_in: 3600, token_type: "Bearer" }));
    fetchImpl.mockResolvedValueOnce(new Response("", { status: 404 }));
    const client = new GooglePlayApiClient(creds, { fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    const r = await client.getSubscription("com.pkg", "tok");
    expect(r).toBeNull();
  });

  it("returns null on v2 500", async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ access_token: "AT1", expires_in: 3600, token_type: "Bearer" }));
    fetchImpl.mockResolvedValueOnce(new Response("", { status: 500 }));
    const client = new GooglePlayApiClient(creds, { fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    const r = await client.getSubscription("com.pkg", "tok");
    expect(r).toBeNull();
  });

  it("returns null on empty lineItems", async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ access_token: "AT1", expires_in: 3600, token_type: "Bearer" }));
    fetchImpl.mockResolvedValueOnce(jsonResponse({ lineItems: [] }));
    const client = new GooglePlayApiClient(creds, { fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    const r = await client.getSubscription("com.pkg", "tok");
    expect(r).toBeNull();
  });

  it("returns null on missing expiryTime", async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ access_token: "AT1", expires_in: 3600, token_type: "Bearer" }));
    fetchImpl.mockResolvedValueOnce(jsonResponse({ lineItems: [{ productId: "ultra" }] }));
    const client = new GooglePlayApiClient(creds, { fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    const r = await client.getSubscription("com.pkg", "tok");
    expect(r).toBeNull();
  });

  it("returns null on network throw at tokens endpoint", async () => {
    fetchImpl.mockRejectedValueOnce(new Error("ECONNRESET"));
    const client = new GooglePlayApiClient(creds, { fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    const r = await client.getSubscription("com.pkg", "tok");
    expect(r).toBeNull();
  });

  it("returns null on network throw at v2 endpoint", async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ access_token: "AT1", expires_in: 3600, token_type: "Bearer" }));
    fetchImpl.mockRejectedValueOnce(new Error("ECONNRESET"));
    const client = new GooglePlayApiClient(creds, { fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    const r = await client.getSubscription("com.pkg", "tok");
    expect(r).toBeNull();
  });

  it("returns past expiryTime as-is (trust google; sweep reconciles)", async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ access_token: "AT1", expires_in: 3600, token_type: "Bearer" }));
    fetchImpl.mockResolvedValueOnce(jsonResponse({ lineItems: [{ expiryTime: "2020-01-01T00:00:00Z" }] }));
    const client = new GooglePlayApiClient(creds, { fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    const r = await client.getSubscription("com.pkg", "tok");
    expect(r).toEqual(new Date("2020-01-01T00:00:00Z"));   // past, not null
  });
});
```

NOTE on the 401-invalidation test: the spec says **401 from the v2 endpoint** invalidates the cached token (the token might be valid against the auth server but rejected by the resource server — common with rotated keys). A 401 from the **tokens endpoint** is a separate flow that also returns null but where there's nothing to invalidate (no token was ever cached). Implementer: make sure both paths work and the test asserts the cache-invalidation behavior on the v2-401 path specifically.

- [ ] **Step 2: Run tests to verify they fail.**

Run: `bun test apps/server/src/features/billing/google-play.api-client.test.ts`

- [ ] **Step 3: Implement `GooglePlayApiClient`.**

```ts
// google-play.api-client.ts
import { mintJwt, type ServiceAccountCreds } from "./google-play.service-account";

type Logger = { warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

type TokenCache = { token: string; expiresAtMs: number } | null;

const TOKEN_SKEW_MS = 60_000;
const ANDROIDPUBLISHER_BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3";

export class GooglePlayApiClient {
  private tokenCache: TokenCache = null;
  private readonly fetchImpl: typeof fetch;
  private readonly logger: Logger;

  constructor(
    private readonly creds: ServiceAccountCreds | null,
    opts: { fetchImpl?: typeof fetch; logger?: Logger } = {},
  ) {
    this.fetchImpl = opts.fetchImpl ?? ((...args) => globalThis.fetch(...args));
    this.logger = opts.logger ?? { warn: console.warn.bind(console), error: console.error.bind(console) };
  }

  async getSubscription(packageName: string, purchaseToken: string): Promise<Date | null> {
    if (!this.creds) return null;

    const token = await this.getAccessToken();
    if (!token) return null;

    const url = `${ANDROIDPUBLISHER_BASE}/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    } catch (e) {
      this.logger.warn({ err: (e as Error).message, packageName }, "google-play subscriptionsv2.get network error");
      return null;
    }
    if (res.status === 401) {
      this.tokenCache = null;
      this.logger.error({ status: 401, packageName }, "google-play subscriptionsv2.get auth failed — cache invalidated");
      return null;
    }
    if (!res.ok) {
      this.logger.warn({ status: res.status, packageName }, "google-play subscriptionsv2.get non-ok");
      return null;
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch (e) {
      this.logger.warn({ err: (e as Error).message, packageName }, "google-play subscriptionsv2.get non-json body");
      return null;
    }
    const v2 = body as { lineItems?: Array<{ expiryTime?: string }> };
    const expiryTime = v2.lineItems?.[0]?.expiryTime;
    if (typeof expiryTime !== "string" || !expiryTime) {
      this.logger.warn({ packageName }, "google-play subscriptionsv2.get missing expiryTime");
      return null;
    }
    const d = new Date(expiryTime);
    if (isNaN(d.getTime())) {
      this.logger.warn({ expiryTime, packageName }, "google-play subscriptionsv2.get unparseable expiryTime");
      return null;
    }
    return d;
  }

  private async getAccessToken(): Promise<string | null> {
    if (!this.creds) return null;
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAtMs - TOKEN_SKEW_MS > now) {
      return this.tokenCache.token;
    }
    const jwt = mintJwt(this.creds, Math.floor(now / 1000));
    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString();
    let res: Response;
    try {
      res = await this.fetchImpl(this.creds.tokenUri, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch (e) {
      this.logger.warn({ err: (e as Error).message }, "google-play token mint network error");
      return null;
    }
    if (!res.ok) {
      this.logger.error({ status: res.status }, "google-play token mint non-ok");
      return null;
    }
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch (e) {
      this.logger.error({ err: (e as Error).message }, "google-play token mint non-json body");
      return null;
    }
    const r = parsed as { access_token?: string; expires_in?: number };
    if (!r.access_token || typeof r.expires_in !== "number") {
      this.logger.error({ }, "google-play token mint missing access_token/expires_in");
      return null;
    }
    this.tokenCache = { token: r.access_token, expiresAtMs: now + r.expires_in * 1000 };
    return r.access_token;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass.**

Run: `bun test apps/server/src/features/billing/google-play.api-client.test.ts`

- [ ] **Step 5: Typecheck and commit.**

```bash
bun --cwd apps/server check-types
git add apps/server/src/features/billing/google-play.api-client.ts apps/server/src/features/billing/google-play.api-client.test.ts
git commit -m "feat(billing): add google-play api client with oauth2 token cache"
```

---

### Task 4: Service integration — `BillingService` constructor + `applyDecodedEvent` signature + `processGooglePlayEnvelope` wiring

**Files:**
- Modify: `apps/server/src/features/billing/billing.service.ts`
- Modify: `apps/server/src/features/billing/billing.service.test.ts`

- [ ] **Step 1: Update `BillingService.test.ts`** to construct the service with a new 4th arg (a stub api client). This is the failing-test step — read the current test setup at `billing.service.test.ts:30-41` first.

Add at the top of the test file:

```ts
import type { GooglePlayApiClient } from "./google-play.api-client";

function makeStubApiClient(realExpiry: Date | null = null): GooglePlayApiClient {
  return {
    getSubscription: vi.fn().mockResolvedValue(realExpiry),
  } as unknown as GooglePlayApiClient;
}
```

Update `buildSut` to accept an optional `apiClient` override and pass it as the 4th ctor arg:

```ts
function buildSut(opts: { ...existing..., apiClient?: GooglePlayApiClient } = {}) {
  // ... existing ...
  const apiClient = opts.apiClient ?? makeStubApiClient(null);
  const service = new BillingService(db, repo as unknown as BillingRepository, ultra as unknown as UltraService, apiClient);
  return { service, repo, ultra, db, apiClient };
}
```

Add NEW tests after the existing ones:

```ts
describe("real expiryTime override", () => {
  it("RENEWED with apiClient returning a real expiry uses that date for currentPeriodEnd and grant", async () => {
    const realExpiry = new Date("2026-06-12T15:30:00Z");
    const linked: SubscriptionRow = { id: 20, userId: "u2", provider: "google_play", productId: "p", purchaseToken: "tok", status: "active", currentPeriodEnd: null, linkedAt: new Date() };
    const { service, repo, ultra } = buildSut({ findSubscription: linked, apiClient: makeStubApiClient(realExpiry) });
    const r = await service.processGooglePlayEnvelope(buildEnvelope(2));   // RENEWED
    expect(r.isOk()).toBe(true);
    expect(repo.updateSubscriptionState).toHaveBeenCalledWith(expect.anything(), 20, expect.objectContaining({ status: "active", currentPeriodEnd: realExpiry }));
    expect(ultra.grant).toHaveBeenCalledWith("u2", realExpiry);
  });

  it("RENEWED with apiClient returning null falls back to now + 30d", async () => {
    const linked: SubscriptionRow = { id: 21, userId: "u3", provider: "google_play", productId: "p", purchaseToken: "tok", status: "active", currentPeriodEnd: null, linkedAt: new Date() };
    const { service, repo } = buildSut({ findSubscription: linked, apiClient: makeStubApiClient(null) });
    const before = Date.now();
    const r = await service.processGooglePlayEnvelope(buildEnvelope(2));
    expect(r.isOk()).toBe(true);
    const call = repo.updateSubscriptionState.mock.calls[0]!;
    const end = call[2].currentPeriodEnd as Date;
    const expected = before + 30 * 24 * 60 * 60 * 1000;
    expect(end.getTime()).toBeGreaterThanOrEqual(expected - 1000);
    expect(end.getTime()).toBeLessThanOrEqual(expected + 5000);
  });

  it("non-grant events (CANCELED) do NOT call apiClient.getSubscription", async () => {
    const linked: SubscriptionRow = { id: 22, userId: "u4", provider: "google_play", productId: "p", purchaseToken: "tok", status: "active", currentPeriodEnd: new Date("2026-12-01"), linkedAt: new Date() };
    const apiClient = makeStubApiClient(new Date("2026-06-12T00:00:00Z"));
    const { service } = buildSut({ findSubscription: linked, apiClient });
    await service.processGooglePlayEnvelope(buildEnvelope(3));   // CANCELED
    expect(apiClient.getSubscription).not.toHaveBeenCalled();
  });

  it("unknown notificationType does NOT call apiClient.getSubscription", async () => {
    const apiClient = makeStubApiClient(new Date("2026-06-12T00:00:00Z"));
    const { service } = buildSut({ apiClient });
    await service.processGooglePlayEnvelope(buildEnvelope(99));
    expect(apiClient.getSubscription).not.toHaveBeenCalled();
  });
});
```

Also update every existing test that constructs `BillingService` directly (search the file — there may be ad-hoc constructions outside `buildSut`). Apply the same 4-arg form.

- [ ] **Step 2: Run tests to verify the failures and that the new cases also fail (because the service hasn't been updated yet).**

Run: `bun test apps/server/src/features/billing/billing.service.test.ts`

- [ ] **Step 3: Update `BillingService` constructor and `applyDecodedEvent`.**

```ts
// billing.service.ts top section
import type { GooglePlayApiClient } from "./google-play.api-client";

const GRANT_TYPES: ReadonlySet<string> = new Set(["PURCHASED", "RENEWED", "RECOVERED", "RESTARTED"]);

export class BillingService {
  constructor(
    private db: Db,
    private repo: BillingRepository,
    private ultra: UltraService,
    private apiClient: GooglePlayApiClient,   // NEW
    private packageNameFallback: string | null,   // NEW — injected from env at the composition root
  ) {}
```

NOTE: `GRANT_TYPES` is a **module-scope** constant (top of file, outside the class) so the Set is allocated once at module load, not per webhook call. Do NOT redeclare it inside `processGooglePlayEnvelope`.

NOTE: do NOT `import { env } from "@pruvi/env/server"` inside `billing.service.ts`. The service layer must stay env-free. The `packageNameFallback` constructor arg supplies the value at construction time from the composition root.

Then update `applyDecodedEvent` to accept the optional 3rd arg:

```ts
applyDecodedEvent(
  decoded: DecodedGooglePlayEvent,
  sub: SubscriptionRow,
  realExpiryTime?: Date | null,
): { newStatus: SubscriptionStatus; newPeriodEnd: Date | null; ultraEffect: PostCommitUltraEffect } {
  if (decoded.kind !== "subscription") {
    return { newStatus: sub.status, newPeriodEnd: sub.currentPeriodEnd, ultraEffect: { kind: "none" } };
  }
  const now = new Date();
  const defaultEnd = new Date(now.getTime() + DEFAULT_SUBSCRIPTION_PERIOD_MS);
  const grantEnd = realExpiryTime ?? defaultEnd;
  const name = decoded.notificationTypeName;
  const grant = (end: Date): PostCommitUltraEffect =>
    sub.userId !== null
      ? { kind: "grant", userId: sub.userId, expiresAt: end, excludeSubscriptionId: sub.id }
      : { kind: "none" };
  // revoke unchanged ...

  switch (name) {
    case "PURCHASED":
    case "RENEWED":
    case "RECOVERED":
    case "RESTARTED":
      return { newStatus: "active", newPeriodEnd: grantEnd, ultraEffect: grant(grantEnd) };
    // all other cases unchanged
  }
}
```

- [ ] **Step 4: Update `processGooglePlayEnvelope`** to look up `realExpiryTime` BEFORE the TX for grant events.

Insert this block **inside** `processGooglePlayEnvelope`, immediately after the decode + test-branch early return and BEFORE `this.db.transaction(...)`:

```ts
let realExpiryTime: Date | null = null;
if (decoded.kind === "subscription" && GRANT_TYPES.has(decoded.notificationTypeName)) {
  const packageName = decoded.packageName || this.packageNameFallback || null;
  if (!packageName) {
    console.warn({ messageId: decoded.messageId, reason: "no_package_name" }, "google-play real-expiry fallback");
  } else {
    realExpiryTime = await this.apiClient.getSubscription(packageName, decoded.purchaseToken);
  }
}
```

Then update the call to `applyDecodedEvent` inside the TX from `this.applyDecodedEvent(decoded, sub)` to `this.applyDecodedEvent(decoded, sub, realExpiryTime)`. There is exactly ONE such call in `processGooglePlayEnvelope` (around line 79 of current source — verify by reading the file). Leave the replay call in `linkGooglePlayPurchase` (around line 130) UNCHANGED — it correctly defaults to null per spec §4.1.

Add a comment above the replay call:

```ts
// NOTE: replay intentionally omits realExpiryTime (3rd arg) — see spec §4.1.
// Reason: outbound API call inside the link TX would hold row locks for 100ms+
// and could deadlock. The next live webhook reconciles the period end.
const { newStatus, newPeriodEnd, ultraEffect } = this.applyDecodedEvent(decoded, sub);
```

**No `env` import added to `billing.service.ts`.** The package-name fallback is read from `this.packageNameFallback` (constructor arg, set by the route/worker from `env.GOOGLE_PLAY_PACKAGE_NAME ?? null`).

- [ ] **Step 5: Run all billing tests to verify they pass.**

Run: `bun test apps/server/src/features/billing/`

- [ ] **Step 6: Typecheck and commit.**

```bash
bun --cwd apps/server check-types
git add apps/server/src/features/billing/billing.service.ts apps/server/src/features/billing/billing.service.test.ts
git commit -m "feat(billing): wire google play real expiryTime through state machine"
```

---

### Task 5: Wire composition roots — route + sweep worker + sweep tests

**Files:**
- Modify: `apps/server/src/features/billing/billing.route.ts`
- Modify: `apps/server/src/workers/billing-sweep.worker.ts`
- Modify: `apps/server/src/features/billing/billing-sweep.service.test.ts` (5 inline construction sites)
- Modify: `apps/server/src/features/billing/billing-sweep.integration.test.ts` (1 inline construction site)

- [ ] **Step 1: Construct the api client + service-account at module level**, alongside the existing `repo`/`ultra`/`service`. Insert after line 13's imports and the new imports:

```ts
import { loadServiceAccountFromEnv } from "./google-play.service-account";
import { GooglePlayApiClient } from "./google-play.api-client";

// ... existing ...

const creds = loadServiceAccountFromEnv(env);
const apiClient = new GooglePlayApiClient(creds);
// fastify.log is not available at module-init time. The api client uses console as its
// default logger; switching to fastify.log would require moving construction inside the
// plugin function, which we intentionally avoid to keep service construction stable.
```

- [ ] **Step 2: Pass `apiClient` + package-name fallback to the service constructor.**

```ts
const service = new BillingService(db, repo, ultra, apiClient, env.GOOGLE_PLAY_PACKAGE_NAME ?? null);
```

- [ ] **Step 3: Update `billing-sweep.worker.ts` (same composition root pattern).** The sweep worker never processes webhooks, but its `BillingService` instance must still satisfy the 5-arg ctor for TypeScript. Add at the top of the imports:

```ts
import { loadServiceAccountFromEnv } from "../features/billing/google-play.service-account";
import { GooglePlayApiClient } from "../features/billing/google-play.api-client";
import { env } from "@pruvi/env/server";   // verify import path matches the file's existing style
```

Inside `startBillingSweepWorker`, after `const ultra = new UltraService(...)`:

```ts
const apiClient = new GooglePlayApiClient(loadServiceAccountFromEnv(env));
const service = new BillingService(db, repo, ultra, apiClient, env.GOOGLE_PLAY_PACKAGE_NAME ?? null);
```

(Constructing the api client here is harmless: the sweep never calls `processGooglePlayEnvelope`, so `getSubscription` is never invoked. Keeping the construction identical to the route means any future direct sweep-side need for the client is already wired.)

- [ ] **Step 4: Update `billing-sweep.service.test.ts` (5 inline constructions).** Search the file for `new BillingService(` — there are 5 occurrences inside `it(...)` blocks. Each currently reads:

```ts
const svc = new BillingService(fakeDb, repo, ultra);
```

Change each to:

```ts
const apiClient = { getSubscription: vi.fn() } as unknown as GooglePlayApiClient;
const svc = new BillingService(fakeDb, repo, ultra, apiClient, null);
```

Add the import at top of file:

```ts
import type { GooglePlayApiClient } from "./google-play.api-client";
```

These tests assert sweep behavior, not webhook behavior; the `apiClient` stub will never be invoked. The `null` fallback is fine because sweep never reads it.

- [ ] **Step 5: Update `billing-sweep.integration.test.ts` (1 construction site).** Inside `beforeEach`:

```ts
import { GooglePlayApiClient } from "./google-play.api-client";

// existing:
const ultra = new UltraService(new UltraRepository(db));
// add:
const apiClient = new GooglePlayApiClient(null);
// change:
svc = new BillingService(db, repo, ultra, apiClient, null);
```

- [ ] **Step 6: Typecheck and run server tests.**

```bash
bun --cwd apps/server check-types
bun --cwd apps/server test
```

No NEW typecheck errors. All billing tests pass.

- [ ] **Step 7: Commit.**

```bash
git add apps/server/src/features/billing/billing.route.ts apps/server/src/workers/billing-sweep.worker.ts apps/server/src/features/billing/billing-sweep.service.test.ts apps/server/src/features/billing/billing-sweep.integration.test.ts
git commit -m "feat(billing): wire google play api client into route + sweep worker"
```

---

## Gate D

After Task 5, the controller dispatches a final Opus 4.7 spec-coverage review against the full branch diff vs `main`, prompted to find:
- All acceptance criteria (§9) covered.
- §8.1, §8.2, §8.3 test cases present.
- The replay path's intentional non-call clearly commented in code.
- Both env vars wired with the correct fallback semantics.
