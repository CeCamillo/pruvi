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
    this.pendingFetch = this.doRefresh().finally(() => {
      this.pendingFetch = null;
    });
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
