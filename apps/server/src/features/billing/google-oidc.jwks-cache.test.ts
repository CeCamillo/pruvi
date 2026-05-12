import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoogleJwksCache } from "./google-oidc.jwks-cache";

function jsonResponse(body: unknown, opts?: { status?: number; maxAge?: number }): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts?.maxAge !== undefined) headers["cache-control"] = `public, max-age=${opts.maxAge}`;
  return new Response(JSON.stringify(body), { status: opts?.status ?? 200, headers });
}

describe("GoogleJwksCache", () => {
  let fetchImpl: ReturnType<typeof vi.fn>;
  let logger: { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let realJwk: any; // populated in beforeEach with a real JWK

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
    expect(fetchImpl).toHaveBeenCalledTimes(2); // 1 first-fetch + 1 refresh
  });

  it("concurrent first callers dedup to one HTTP call", async () => {
    let resolve: (r: Response) => void;
    const pending = new Promise<Response>((r) => {
      resolve = r;
    });
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
    fetchImpl.mockResolvedValueOnce(
      new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }),
    );
    const cache = new GoogleJwksCache({ fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    const key = await cache.getKey("kid-1");
    expect(key).toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });

  it("re-fetches after TTL elapses", async () => {
    let nowMs = 1_700_000_000_000;
    fetchImpl.mockResolvedValueOnce(jsonResponse({ keys: [realJwk] }, { maxAge: 60 }));
    fetchImpl.mockResolvedValueOnce(jsonResponse({ keys: [realJwk] }, { maxAge: 60 }));
    const cache = new GoogleJwksCache({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      logger,
      now: () => nowMs,
    });
    await cache.getKey("kid-1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    nowMs += 70_000; // past 60s TTL
    await cache.getKey("kid-1");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("falls back to 3600s TTL when no Cache-Control header", async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ keys: [realJwk] })); // no maxAge
    const cache = new GoogleJwksCache({ fetchImpl: fetchImpl as unknown as typeof fetch, logger });
    await cache.getKey("kid-1");
    await cache.getKey("kid-1");
    expect(fetchImpl).toHaveBeenCalledTimes(1); // within fallback TTL
  });
});
