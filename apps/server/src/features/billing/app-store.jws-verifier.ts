import { X509Certificate, createVerify, type KeyObject } from "node:crypto";
import { APPLE_ROOT_CA_G3_PEM } from "./app-store.root-ca";

export class JwsVerificationError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "JwsVerificationError";
  }
}

export interface IJwsVerifier {
  verify(jws: string): unknown;
}

export class AppStoreJwsVerifier implements IJwsVerifier {
  private readonly trustedRoot: X509Certificate;
  private readonly now: () => Date;

  constructor(opts: { rootCertPem: string; now?: () => Date }) {
    this.trustedRoot = new X509Certificate(opts.rootCertPem);
    this.now = opts.now ?? (() => new Date());
  }

  static fromBundledRoot(): AppStoreJwsVerifier {
    return new AppStoreJwsVerifier({ rootCertPem: APPLE_ROOT_CA_G3_PEM });
  }

  verify(jws: string): unknown {
    const parts = jws.split(".");
    if (parts.length !== 3) throw new JwsVerificationError("JWS must have 3 segments");
    const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

    const header = this.parseHeader(headerB64);
    if (header.alg !== "ES256") throw new JwsVerificationError(`unsupported alg: ${header.alg}`);
    if (!Array.isArray(header.x5c) || header.x5c.length !== 3) {
      throw new JwsVerificationError("x5c must be a 3-element array");
    }

    // We check cert validity at wall-clock `now()`, not at the payload's `signedDate`.
    // This is intentionally stricter than spec §4.3's `atDate=signedDate` (cert must be
    // valid RIGHT NOW, not just at signing time). The verifier hasn't decoded the payload
    // yet anyway, so `signedDate` isn't available here without breaking layering.
    const leafKey = this.verifyChain(header.x5c, this.now());
    this.verifyEs256Signature(headerB64, payloadB64, sigB64, leafKey);

    return this.parsePayload(payloadB64);
  }

  private parseHeader(b64: string): { alg: string; x5c?: unknown } {
    try {
      return JSON.parse(Buffer.from(b64, "base64url").toString("utf-8"));
    } catch {
      throw new JwsVerificationError("JWS header is not valid base64url+JSON");
    }
  }

  private parsePayload(b64: string): unknown {
    try {
      return JSON.parse(Buffer.from(b64, "base64url").toString("utf-8"));
    } catch {
      throw new JwsVerificationError("JWS payload is not valid base64url+JSON");
    }
  }

  private verifyChain(x5c: unknown[], atDate: Date): KeyObject {
    let certs: X509Certificate[];
    try {
      certs = x5c.map((b64) => {
        if (typeof b64 !== "string") throw new Error("x5c element not a string");
        return new X509Certificate(Buffer.from(b64, "base64"));
      });
    } catch (e) {
      throw new JwsVerificationError(`failed to parse x5c cert: ${(e as Error).message}`);
    }
    const [leaf, intermediate, root] = certs as [X509Certificate, X509Certificate, X509Certificate];

    for (const c of certs) {
      const from = new Date(c.validFrom);
      const to = new Date(c.validTo);
      if (from > atDate || to < atDate) {
        throw new JwsVerificationError(`cert validity does not cover signedDate: subject=${c.subject}`);
      }
    }

    if (!leaf.verify(intermediate.publicKey)) {
      throw new JwsVerificationError("leaf cert signature does not match intermediate");
    }
    if (!intermediate.verify(root.publicKey)) {
      throw new JwsVerificationError("intermediate cert signature does not match root");
    }
    if (root.fingerprint256 !== this.trustedRoot.fingerprint256) {
      throw new JwsVerificationError("root cert does not match trusted Apple Root CA G3");
    }

    return leaf.publicKey;
  }

  private verifyEs256Signature(
    headerB64: string,
    payloadB64: string,
    sigB64: string,
    publicKey: KeyObject,
  ): void {
    const raw = Buffer.from(sigB64, "base64url");
    if (raw.length !== 64) throw new JwsVerificationError(`ES256 signature must be 64 bytes (got ${raw.length})`);
    const r = raw.subarray(0, 32);
    const s = raw.subarray(32, 64);
    const derSig = encodeEcdsaDer(r, s);

    const v = createVerify("SHA256");
    v.update(`${headerB64}.${payloadB64}`);
    v.end();
    if (!v.verify(publicKey, derSig)) {
      throw new JwsVerificationError("JWS signature invalid");
    }
  }
}

// ECDSA raw r||s (64 bytes) → ASN.1 DER SEQUENCE { INTEGER r, INTEGER s }
// Handles the standard quirks: strip leading zeros, prepend a zero byte if the
// high bit is set (so the INTEGER stays positive).
export function encodeEcdsaDer(r: Buffer, s: Buffer): Buffer {
  const encInt = (buf: Buffer): Buffer => {
    let i = 0;
    while (i < buf.length - 1 && buf[i] === 0) i++;
    let body = buf.subarray(i);
    if (body[0]! & 0x80) body = Buffer.concat([Buffer.from([0]), body]);
    return Buffer.concat([Buffer.from([0x02, body.length]), body]);
  };
  const rDer = encInt(r);
  const sDer = encInt(s);
  const seqBody = Buffer.concat([rDer, sDer]);
  return Buffer.concat([Buffer.from([0x30, seqBody.length]), seqBody]);
}

let noOpWarnFired = false;
export class NoOpJwsVerifier implements IJwsVerifier {
  constructor() {
    if (!noOpWarnFired) {
      console.warn("NoOpJwsVerifier active — DO NOT USE IN PRODUCTION");
      noOpWarnFired = true;
    }
  }

  verify(jws: string): unknown {
    const parts = jws.split(".");
    if (parts.length !== 3) throw new JwsVerificationError("JWS must have 3 segments");
    return JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf-8"));
  }
}
