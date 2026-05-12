import { describe, it, expect, beforeAll } from "vitest";
import { createSign, createPublicKey, generateKeyPairSync, type KeyObject } from "node:crypto";
import { GoogleOidcVerifier, OidcVerificationError } from "./google-oidc.verifier";

class StubJwks {
  constructor(private readonly map: Map<string, KeyObject>) {}
  async getKey(kid: string) {
    return this.map.get(kid) ?? null;
  }
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
    expect(() => new GoogleOidcVerifier({ jwks: stub as never, expectedAudience: "", expectedEmail: null })).toThrow(
      OidcVerificationError,
    );
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
    const header = { alg: "RS256", typ: "JWT" }; // no kid
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
    parts[2] = base64url(Buffer.alloc(256, 0xff)); // wrong-but-correctly-sized garbage
    await expect(v.verify(parts.join("."))).rejects.toThrow(/signature invalid/);
  });

  it("throws when exp is past", async () => {
    const v = new GoogleOidcVerifier({ jwks: stub as never, expectedAudience: AUD, expectedEmail: null });
    const nowSec = Math.floor(Date.now() / 1000);
    await expect(v.verify(mintJwt(validPayload({ exp: nowSec - 60 })))).rejects.toThrow(/expired/);
  });

  it("throws when iat is in the future beyond clock skew", async () => {
    const v = new GoogleOidcVerifier({
      jwks: stub as never,
      expectedAudience: AUD,
      expectedEmail: null,
      clockSkewSec: 30,
    });
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
