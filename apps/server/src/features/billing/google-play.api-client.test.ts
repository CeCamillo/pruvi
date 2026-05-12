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
    // Mint a token with expires_in=60. TOKEN_SKEW_MS is 60s, so expiresAtMs - TOKEN_SKEW_MS == now,
    // meaning the cache check (expiresAtMs - TOKEN_SKEW_MS > now) is false immediately on next call.
    fetchImpl.mockResolvedValueOnce(jsonResponse({ access_token: "AT1", expires_in: 60, token_type: "Bearer" }));
    fetchImpl.mockResolvedValueOnce(jsonResponse({ lineItems: [{ expiryTime: "2026-06-12T00:00:00Z" }] }));
    await client.getSubscription("com.pkg", "tok-a");

    // The token is already past its skew window, so a second call re-mints.
    fetchImpl.mockResolvedValueOnce(jsonResponse({ access_token: "AT2", expires_in: 3600, token_type: "Bearer" }));
    fetchImpl.mockResolvedValueOnce(jsonResponse({ lineItems: [{ expiryTime: "2026-07-12T00:00:00Z" }] }));
    await client.getSubscription("com.pkg", "tok-b");

    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("returns null on v2 endpoint 401 AND invalidates cached token (next call re-mints)", async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ access_token: "AT1", expires_in: 3600, token_type: "Bearer" }));
    fetchImpl.mockResolvedValueOnce(new Response("", { status: 401 }));
    const client = new GooglePlayApiClient(creds, { fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    await client.getSubscription("com.pkg", "tok-a");   // primes cache, then v2 returns 401 invalidating it
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
