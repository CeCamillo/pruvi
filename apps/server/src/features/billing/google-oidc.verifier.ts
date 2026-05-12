import { createVerify } from "node:crypto";
import type { GoogleJwksCache } from "./google-oidc.jwks-cache";

export class OidcVerificationError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "OidcVerificationError";
  }
}

export type GoogleOidcPayload = {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  email?: string;
  email_verified?: boolean;
  sub?: string;
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
