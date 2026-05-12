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
    this.fetchImpl = opts.fetchImpl ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
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
      this.logger.error({}, "google-play token mint missing access_token/expires_in");
      return null;
    }
    this.tokenCache = { token: r.access_token, expiresAtMs: now + r.expires_in * 1000 };
    return r.access_token;
  }
}
