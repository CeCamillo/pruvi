# Phase 2E.9 — Apple App Store JWS x5c verification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` with Sonnet 4.6 implementers and Opus 4.7 reviewers. Every task ends with both spec-compliance and code-quality reviews. Branch: `feature/phase-2e9-app-store-jws-verification`.

**Goal:** Verify the cryptographic signature of every inbound App Store webhook against Apple's certificate chain, terminating at the bundled Apple Root CA G3. Failures return the existing `MALFORMED_ENVELOPE` shape (200, `received: false`) with ERROR-level logs.

**Architecture:** New `AppStoreJwsVerifier` class (pure node:crypto X509 + ES256). Apple Root CA G3 bundled as a PEM constant. `decodeAppStoreNotification` requires a verifier as a 2nd arg. `BillingService` ctor gains the verifier as a 6th arg. `NoOpJwsVerifier` (test-only) preserves existing fixture-based tests.

**Tech Stack:** `node:crypto.X509Certificate`, `createVerify("SHA256")`, hand-rolled ASN.1 DER for ECDSA r||s → DER conversion. `@peculiar/x509` as a test-only devDependency for chain generation.

**Spec:** `docs/superpowers/specs/2026-05-12-phase-2e9-app-store-jws-verification-design.md`

---

## File map

**Create:**
- `apps/server/src/features/billing/app-store.root-ca.ts` — bundled Apple Root CA G3 PEM constant.
- `apps/server/src/features/billing/app-store.jws-verifier.ts` — `AppStoreJwsVerifier`, `NoOpJwsVerifier`, `JwsVerificationError`, `IJwsVerifier` interface.
- `apps/server/src/features/billing/app-store.jws-verifier.test.ts` — unit, generates a test chain via `@peculiar/x509`.

**Modify:**
- `apps/server/src/features/billing/app-store.decoder.ts` — add required 2nd arg `verifier: IJwsVerifier`; use `verifier.verify(jws)` instead of inline `decodeJwsSegment`.
- `apps/server/src/features/billing/app-store.decoder.test.ts` — pass `new NoOpJwsVerifier()` to every call (**20 sites** — `grep -c "decodeAppStoreNotification(" apps/server/src/features/billing/app-store.decoder.test.ts` confirms). The cleanest pattern: declare a single `const verifier = new NoOpJwsVerifier();` at top of the outer describe block and reuse.
- `apps/server/src/features/billing/billing.service.ts` — `BillingService` ctor gains `jwsVerifier: IJwsVerifier` (6th arg); `processAppStoreEnvelope` passes it to `decodeAppStoreNotification`.
- `apps/server/src/features/billing/billing.service.test.ts` — `buildSut` defaults `jwsVerifier` to `new NoOpJwsVerifier()`.
- `apps/server/src/features/billing/billing.route.ts` — wire `AppStoreJwsVerifier.fromBundledRoot()`.
- `apps/server/src/workers/billing-sweep.worker.ts` — wire `NoOpJwsVerifier` (sweep never decodes ASSN, but ctor signature must be satisfied).
- `apps/server/src/features/billing/billing-sweep.service.test.ts` — 5 `new BillingService(...)` sites → 6 args.
- `apps/server/src/features/billing/billing-sweep.integration.test.ts` — 1 `new BillingService(...)` site → 6 args.
- `apps/server/package.json` — add `@peculiar/x509` to `devDependencies`.

Construction sites enumerated (8 total — none may be missed):
- `billing.route.ts:58` (production — uses real verifier)
- `billing-sweep.worker.ts:24` (production — uses NoOp; sweep doesn't decode ASSN)
- `billing.service.test.ts:48` (inside buildSut — single site, defaults to NoOp)
- `billing-sweep.service.test.ts:43,63,83,104,125` (5 inline sites — all use NoOp)
- `billing-sweep.integration.test.ts:38` (1 site — uses NoOp)

---

### Task 1: Add the Apple Root CA G3 PEM constant

**Files:**
- Create: `apps/server/src/features/billing/app-store.root-ca.ts`

- [ ] **Step 1: Fetch and convert the cert** (one-time setup — the implementer must do this manually):

```bash
# Run this OUTSIDE the codebase to get the PEM bytes
curl -fsS https://www.apple.com/certificateauthority/AppleRootCA-G3.cer -o /tmp/AppleRootCA-G3.cer
openssl x509 -inform DER -in /tmp/AppleRootCA-G3.cer -out /tmp/AppleRootCA-G3.pem
openssl x509 -in /tmp/AppleRootCA-G3.pem -fingerprint -sha256 -noout
# Note the fingerprint output — embed it as a comment in app-store.root-ca.ts.
```

- [ ] **Step 2: Create the file** with the PEM string embedded.

```ts
// apps/server/src/features/billing/app-store.root-ca.ts
// Apple Root CA - G3 (used for App Store Server Notifications V2 signature verification).
// SHA-256 fingerprint (verify after embedding):
//   63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79
// Source: https://www.apple.com/certificateauthority/
// To re-fetch and verify: see Phase 2E.9 plan Task 1.
export const APPLE_ROOT_CA_G3_PEM = `-----BEGIN CERTIFICATE-----
<paste full PEM body here from the openssl output>
-----END CERTIFICATE-----
`;
```

- [ ] **Step 3: Verify the file is valid by parsing it.** Quick smoke test (run once locally, not committed):

```bash
node -e "const { X509Certificate } = require('node:crypto'); const { APPLE_ROOT_CA_G3_PEM } = require('./apps/server/dist/features/billing/app-store.root-ca.js'); const c = new X509Certificate(APPLE_ROOT_CA_G3_PEM); console.log('fingerprint:', c.fingerprint256); console.log('subject:', c.subject); console.log('validTo:', c.validTo);"
```

The fingerprint output MUST match the one in the comment.

- [ ] **Step 4: Commit.**

```bash
git add apps/server/src/features/billing/app-store.root-ca.ts
git commit -m "feat(billing): bundle apple root ca g3 for jws verification"
```

NOTE: If the agentic implementer cannot run `curl`/`openssl` in its sandbox, it must request the PEM contents from the user via NEEDS_CONTEXT (do not invent a PEM).

---

### Task 2: Implement `AppStoreJwsVerifier` + `NoOpJwsVerifier`

**Files:**
- Create: `apps/server/src/features/billing/app-store.jws-verifier.ts`
- Create: `apps/server/src/features/billing/app-store.jws-verifier.test.ts`
- Modify: `apps/server/package.json` (add `@peculiar/x509` to devDependencies)

- [ ] **Step 1: Add `@peculiar/x509` as a test-only devDependency.**

```bash
bun --cwd apps/server add -d @peculiar/x509
```

- [ ] **Step 2: Implement the verifier module.**

```ts
// apps/server/src/features/billing/app-store.jws-verifier.ts
import { X509Certificate, createVerify, type KeyObject } from "node:crypto";
import { APPLE_ROOT_CA_G3_PEM } from "./app-store.root-ca";

export class JwsVerificationError extends Error {
  constructor(msg: string) { super(msg); this.name = "JwsVerificationError"; }
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

  private verifyEs256Signature(headerB64: string, payloadB64: string, sigB64: string, publicKey: KeyObject): void {
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
```

- [ ] **Step 3: Write the unit tests.** This is the biggest file in the phase — generates a real cert chain via `@peculiar/x509`.

```ts
// apps/server/src/features/billing/app-store.jws-verifier.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto, X509Certificate as NodeX509, createSign } from "node:crypto";
import { X509CertificateGenerator, BasicConstraintsExtension, KeyUsagesExtension, KeyUsageFlags, cryptoProvider } from "@peculiar/x509";
import { AppStoreJwsVerifier, JwsVerificationError, NoOpJwsVerifier, encodeEcdsaDer } from "./app-store.jws-verifier";

cryptoProvider.set(webcrypto as unknown as Crypto);

type Chain = {
  rootPem: string;
  intermediatePem: string;
  leafPem: string;
  x5c: string[];           // [leafB64, intermediateB64, rootB64]
  leafPrivateKey: CryptoKey;
  validFrom: Date;
  validTo: Date;
};

async function makeChain(): Promise<Chain> {
  const subtle = webcrypto.subtle;
  const algo = { name: "ECDSA", namedCurve: "P-256" } as const;
  const sigAlg = { name: "ECDSA", hash: "SHA-256" } as const;
  const now = new Date();
  const validFrom = new Date(now.getTime() - 60_000);
  const validTo = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  const rootKeys = await subtle.generateKey(algo, true, ["sign", "verify"]);
  const root = await X509CertificateGenerator.create({
    serialNumber: "01",
    issuer: "CN=Test Apple Root CA",
    subject: "CN=Test Apple Root CA",
    notBefore: validFrom,
    notAfter: validTo,
    signingAlgorithm: sigAlg,
    publicKey: rootKeys.publicKey,
    signingKey: rootKeys.privateKey,
    extensions: [
      new BasicConstraintsExtension(true, undefined, true),
      new KeyUsagesExtension(KeyUsageFlags.keyCertSign | KeyUsageFlags.cRLSign, true),
    ],
  });

  const interKeys = await subtle.generateKey(algo, true, ["sign", "verify"]);
  const intermediate = await X509CertificateGenerator.create({
    serialNumber: "02",
    issuer: root.subject,
    subject: "CN=Test Apple Intermediate CA",
    notBefore: validFrom,
    notAfter: validTo,
    signingAlgorithm: sigAlg,
    publicKey: interKeys.publicKey,
    signingKey: rootKeys.privateKey,
    extensions: [
      new BasicConstraintsExtension(true, 0, true),
      new KeyUsagesExtension(KeyUsageFlags.keyCertSign, true),
    ],
  });

  const leafKeys = await subtle.generateKey(algo, true, ["sign", "verify"]);
  const leaf = await X509CertificateGenerator.create({
    serialNumber: "03",
    issuer: intermediate.subject,
    subject: "CN=Test Apple Leaf",
    notBefore: validFrom,
    notAfter: validTo,
    signingAlgorithm: sigAlg,
    publicKey: leafKeys.publicKey,
    signingKey: interKeys.privateKey,
    extensions: [
      new BasicConstraintsExtension(false),
      new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true),
    ],
  });

  const certToBase64 = (c: typeof root) => Buffer.from(c.rawData).toString("base64");

  return {
    rootPem: root.toString("pem"),
    intermediatePem: intermediate.toString("pem"),
    leafPem: leaf.toString("pem"),
    x5c: [certToBase64(leaf), certToBase64(intermediate), certToBase64(root)],
    leafPrivateKey: leafKeys.privateKey,
    validFrom,
    validTo,
  };
}

async function mintJws(payload: object, chain: Chain, opts?: { tamperedPayload?: object; tamperedSignature?: boolean }): Promise<string> {
  const header = { alg: "ES256", x5c: chain.x5c };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(opts?.tamperedPayload ?? payload)).toString("base64url");
  const signingInput = `${headerB64}.${payloadB64}`;
  const sigRaw = await webcrypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    chain.leafPrivateKey,
    new TextEncoder().encode(signingInput),
  );
  let sigB64 = Buffer.from(sigRaw).toString("base64url");
  if (opts?.tamperedSignature) {
    const flipped = Buffer.from(sigRaw);
    flipped[0] ^= 0xff;
    sigB64 = flipped.toString("base64url");
  }
  // If tamperedPayload is set we re-sign the ORIGINAL payload but encode the tampered one — so signature
  // doesn't match. Achieve this by signing the original, then swapping payload at encode time:
  if (opts?.tamperedPayload && !opts?.tamperedSignature) {
    const origPayloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const origSigningInput = `${headerB64}.${origPayloadB64}`;
    const origSig = await webcrypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      chain.leafPrivateKey,
      new TextEncoder().encode(origSigningInput),
    );
    sigB64 = Buffer.from(origSig).toString("base64url");
    // payloadB64 already encodes the tampered payload — signature mismatches.
  }
  return `${headerB64}.${payloadB64}.${sigB64}`;
}

describe("AppStoreJwsVerifier", () => {
  let chain: Chain;
  beforeAll(async () => { chain = await makeChain(); });

  it("verifies a valid JWS and returns the decoded payload", async () => {
    const verifier = new AppStoreJwsVerifier({ rootCertPem: chain.rootPem });
    const jws = await mintJws({ hello: "world", n: 42 }, chain);
    const out = verifier.verify(jws) as { hello: string; n: number };
    expect(out).toEqual({ hello: "world", n: 42 });
  });

  it("throws when x5c missing", async () => {
    const verifier = new AppStoreJwsVerifier({ rootCertPem: chain.rootPem });
    const header = { alg: "ES256" };
    const jws = `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${Buffer.from("{}").toString("base64url")}.AA`;
    expect(() => verifier.verify(jws)).toThrow(JwsVerificationError);
  });

  it("throws when x5c length != 3", async () => {
    const verifier = new AppStoreJwsVerifier({ rootCertPem: chain.rootPem });
    const header = { alg: "ES256", x5c: ["x", "y"] };
    const jws = `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${Buffer.from("{}").toString("base64url")}.AA`;
    expect(() => verifier.verify(jws)).toThrow(JwsVerificationError);
  });

  it("throws when alg != ES256", async () => {
    const verifier = new AppStoreJwsVerifier({ rootCertPem: chain.rootPem });
    const header = { alg: "RS256", x5c: chain.x5c };
    const jws = `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${Buffer.from("{}").toString("base64url")}.AA`;
    expect(() => verifier.verify(jws)).toThrow(JwsVerificationError);
  });

  it("throws when chain ends at a different root (fingerprint mismatch)", async () => {
    const otherChain = await makeChain();
    const verifier = new AppStoreJwsVerifier({ rootCertPem: otherChain.rootPem });   // trusts otherChain's root
    const jws = await mintJws({ x: 1 }, chain);                                       // but JWS is from chain
    expect(() => verifier.verify(jws)).toThrow(/does not match trusted/);
  });

  it("throws when leaf cert is expired", async () => {
    const expiredChain = await makeChain();
    const verifier = new AppStoreJwsVerifier({
      rootCertPem: expiredChain.rootPem,
      now: () => new Date(expiredChain.validTo.getTime() + 24 * 60 * 60 * 1000),
    });
    const jws = await mintJws({ x: 1 }, expiredChain);
    expect(() => verifier.verify(jws)).toThrow(/validity does not cover/);
  });

  it("throws when leaf cert is not yet valid", async () => {
    const futureChain = await makeChain();
    const verifier = new AppStoreJwsVerifier({
      rootCertPem: futureChain.rootPem,
      now: () => new Date(futureChain.validFrom.getTime() - 24 * 60 * 60 * 1000),
    });
    const jws = await mintJws({ x: 1 }, futureChain);
    expect(() => verifier.verify(jws)).toThrow(/validity does not cover/);
  });

  it("throws when ES256 signature is invalid (tampered)", async () => {
    const verifier = new AppStoreJwsVerifier({ rootCertPem: chain.rootPem });
    const jws = await mintJws({ x: 1 }, chain, { tamperedSignature: true });
    expect(() => verifier.verify(jws)).toThrow(/signature invalid/);
  });

  it("throws when ES256 signature has wrong length", async () => {
    const verifier = new AppStoreJwsVerifier({ rootCertPem: chain.rootPem });
    const header = { alg: "ES256", x5c: chain.x5c };
    const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
    const payloadB64 = Buffer.from("{}").toString("base64url");
    const shortSig = Buffer.alloc(32).toString("base64url");
    expect(() => verifier.verify(`${headerB64}.${payloadB64}.${shortSig}`)).toThrow(/must be 64 bytes/);
  });

  it("throws on JWS with != 3 segments", () => {
    const verifier = new AppStoreJwsVerifier({ rootCertPem: chain.rootPem });
    expect(() => verifier.verify("a.b")).toThrow(/3 segments/);
  });
});

describe("encodeEcdsaDer", () => {
  it("produces a valid DER sequence", () => {
    const r = Buffer.alloc(32, 0x01);
    const s = Buffer.alloc(32, 0x02);
    const der = encodeEcdsaDer(r, s);
    expect(der[0]).toBe(0x30);
    // 2 byte INTEGER tags + lengths + bodies
    expect(der.length).toBe(2 + 2 + 32 + 2 + 32);
  });

  it("prepends a zero byte for high-bit-set values", () => {
    const r = Buffer.alloc(32, 0xff);
    const s = Buffer.alloc(32, 0x01);
    const der = encodeEcdsaDer(r, s);
    // 33-byte r (zero-prefix + 32) + 32-byte s
    expect(der.length).toBe(2 + 2 + 33 + 2 + 32);
  });
});

describe("NoOpJwsVerifier", () => {
  it("returns the parsed middle segment without checking the signature", () => {
    const verifier = new NoOpJwsVerifier();
    const payload = { foo: "bar" };
    const headerB64 = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const out = verifier.verify(`${headerB64}.${payloadB64}.AA`) as typeof payload;
    expect(out).toEqual(payload);
  });

  it("throws on a JWS with wrong segment count", () => {
    const verifier = new NoOpJwsVerifier();
    expect(() => verifier.verify("a.b")).toThrow(JwsVerificationError);
  });
});
```

- [ ] **Step 4: Run tests; expect all to pass.**

Run: `bun test apps/server/src/features/billing/app-store.jws-verifier.test.ts`

- [ ] **Step 5: Typecheck.**

Run: `bun --cwd apps/server check-types`. Pre-existing errors elsewhere are NOT yours; verify no NEW errors in the new files.

- [ ] **Step 6: Commit.**

```bash
git add apps/server/package.json apps/server/src/features/billing/app-store.jws-verifier.ts apps/server/src/features/billing/app-store.jws-verifier.test.ts
git commit -m "feat(billing): add app store jws x5c chain verifier"
```

---

### Task 3: Update `app-store.decoder.ts` to require a verifier

**Files:**
- Modify: `apps/server/src/features/billing/app-store.decoder.ts`
- Modify: `apps/server/src/features/billing/app-store.decoder.test.ts`

- [ ] **Step 1: Update the decoder signature.** Change `decodeAppStoreNotification(raw: unknown)` to `decodeAppStoreNotification(raw: unknown, verifier: IJwsVerifier)`. Replace every call to the local `decodeJwsSegment` with `verifier.verify(...)`.

```ts
// app-store.decoder.ts top
import type { IJwsVerifier } from "./app-store.jws-verifier";

// Remove the SECURITY-deferred comment + decodeJwsSegment helper (no longer needed).

export function decodeAppStoreNotification(raw: unknown, verifier: IJwsVerifier): DecodedAppStoreEvent {
  if (!raw || typeof raw !== "object") throw new DecoderError("Envelope is not an object");
  const env = raw as AppStoreEnvelope;
  if (typeof env.signedPayload !== "string") throw new DecoderError("Missing signedPayload");

  let outer: { ...same shape as before... };
  try {
    outer = verifier.verify(env.signedPayload) as typeof outer;
  } catch (e) {
    throw new DecoderError(`JWS verification failed: ${(e as Error).message}`);
  }

  // ... rest of decoding logic unchanged, EXCEPT:
  // Replace `const inner = decodeJwsSegment(data.signedTransactionInfo) as { ... }` with:
  let inner: { ...same shape... };
  try {
    inner = verifier.verify(data.signedTransactionInfo) as typeof inner;
  } catch (e) {
    throw new DecoderError(`inner JWS verification failed: ${(e as Error).message}`);
  }
}
```

NOTE: Keep `decodeJwsSegment` exported temporarily if any other file imports it (grep first). If unused, delete it.

- [ ] **Step 2: Update the decoder test file.** Add a top-level `import { NoOpJwsVerifier } from "./app-store.jws-verifier";` and pass `new NoOpJwsVerifier()` to every `decodeAppStoreNotification(env)` call (~19 sites). The cleanest pattern: declare a `const verifier = new NoOpJwsVerifier();` at top of the outer `describe(...)` block and reuse it.

Then add ONE NEW positive test that uses the real verifier with a test chain:

```ts
import { AppStoreJwsVerifier } from "./app-store.jws-verifier";
// + the makeChain / mintJws helpers from jws-verifier.test.ts.
// Either extract those helpers into a shared test-helper file, or copy them inline.

it("decodes a fully-signed envelope end-to-end via AppStoreJwsVerifier", async () => {
  const chain = await makeChain();
  const verifier = new AppStoreJwsVerifier({ rootCertPem: chain.rootPem });
  const innerJws = await mintJws({
    originalTransactionId: "txn-123", productId: "ultra_monthly", expiresDate: Date.now() + 86_400_000,
  }, chain);
  const outerJws = await mintJws({
    notificationUUID: "uuid-1", notificationType: "DID_RENEW", subtype: null,
    data: { signedTransactionInfo: innerJws, environment: "Sandbox" }, version: "2.0", signedDate: Date.now(),
  }, chain);
  const decoded = decodeAppStoreNotification({ signedPayload: outerJws }, verifier);
  expect(decoded.kind).toBe("subscription");
});
```

If the `makeChain`/`mintJws` helpers are duplicated, that's acceptable for now — DRY can wait for a refactor pass.

- [ ] **Step 3: Run decoder tests; all should pass (existing 19 + the new integration test).**

Run: `bun test apps/server/src/features/billing/app-store.decoder.test.ts`

- [ ] **Step 4: Commit.**

```bash
git add apps/server/src/features/billing/app-store.decoder.ts apps/server/src/features/billing/app-store.decoder.test.ts
git commit -m "feat(billing): require jws verifier in app store decoder"
```

---

### Task 4: Wire the verifier through `BillingService` + all composition roots

**Files:**
- Modify: `apps/server/src/features/billing/billing.service.ts`
- Modify: `apps/server/src/features/billing/billing.service.test.ts`
- Modify: `apps/server/src/features/billing/billing.route.ts`
- Modify: `apps/server/src/workers/billing-sweep.worker.ts`
- Modify: `apps/server/src/features/billing/billing-sweep.service.test.ts`
- Modify: `apps/server/src/features/billing/billing-sweep.integration.test.ts`

- [ ] **Step 1: `BillingService` ctor — add 6th arg.**

```ts
import type { IJwsVerifier } from "./app-store.jws-verifier";

export class BillingService {
  constructor(
    private db: Db,
    private repo: BillingRepository,
    private ultra: UltraService,
    private apiClient: GooglePlayApiClient,
    private packageNameFallback: string | null,
    private jwsVerifier: IJwsVerifier,   // NEW — 6th arg
  ) {}
}
```

Update `processAppStoreEnvelope` to pass `this.jwsVerifier` as the 2nd arg of `decodeAppStoreNotification`.

- [ ] **Step 2: Update `billing.service.test.ts` `buildSut`** to default `jwsVerifier` to `new NoOpJwsVerifier()`. Add import. Single line addition + extending the `buildSut` opts type.

```ts
import { NoOpJwsVerifier, JwsVerificationError, type IJwsVerifier } from "./app-store.jws-verifier";

function buildSut(opts: { ...existing..., jwsVerifier?: IJwsVerifier } = {}) {
  // ...
  const jwsVerifier = opts.jwsVerifier ?? new NoOpJwsVerifier();
  const service = new BillingService(db, repo as ..., ultra as ..., apiClient, null, jwsVerifier);
  return { service, repo, ultra, db, apiClient, jwsVerifier };
}
```

Add ONE new failure test:

```ts
it("App Store webhook with verifier rejection returns MALFORMED_ENVELOPE", async () => {
  const rejecting: IJwsVerifier = { verify: () => { throw new JwsVerificationError("signature invalid"); } };
  const { service } = buildSut({ jwsVerifier: rejecting });
  const r = await service.processAppStoreEnvelope({ signedPayload: "x.y.z" });
  expect(r.isErr()).toBe(true);
  if (r.isErr()) expect(r.error.code).toBe("MALFORMED_ENVELOPE");
});
```

- [ ] **Step 3: `billing.route.ts`** — wire the real verifier inside the plugin closure (so `fastify.log` could be passed in future):

```ts
import { AppStoreJwsVerifier } from "./app-store.jws-verifier";

// inside billingRoutes plugin closure (next to apiClient construction):
const jwsVerifier = AppStoreJwsVerifier.fromBundledRoot();
const service = new BillingService(db, repo, ultra, apiClient, env.GOOGLE_PLAY_PACKAGE_NAME ?? null, jwsVerifier);
```

- [ ] **Step 4: `billing-sweep.worker.ts`** — wire `NoOpJwsVerifier`:

```ts
import { NoOpJwsVerifier } from "../features/billing/app-store.jws-verifier";

// inside startBillingSweepWorker after apiClient construction:
const jwsVerifier = new NoOpJwsVerifier();
const service = new BillingService(db, repo, ultra, apiClient, env.GOOGLE_PLAY_PACKAGE_NAME ?? null, jwsVerifier);
```

- [ ] **Step 5: `billing-sweep.service.test.ts`** — 5 inline construction sites at lines 43, 63, 83, 104, 125. Each gets a 6th arg. Add `const jwsVerifier = new NoOpJwsVerifier();` once at the top of the `describe(...)` block and reuse, OR add inline at each site.

- [ ] **Step 6: `billing-sweep.integration.test.ts`** — `beforeEach` line 38, add the 6th arg with `new NoOpJwsVerifier()`.

- [ ] **Step 7: Run full billing tests + typecheck.**

```bash
bun --cwd apps/server check-types
bun test apps/server/src/features/billing/
```

No NEW typecheck errors. All billing tests pass.

- [ ] **Step 8: Commit.**

```bash
git add apps/server/src/features/billing/billing.service.ts apps/server/src/features/billing/billing.service.test.ts apps/server/src/features/billing/billing.route.ts apps/server/src/workers/billing-sweep.worker.ts apps/server/src/features/billing/billing-sweep.service.test.ts apps/server/src/features/billing/billing-sweep.integration.test.ts
git commit -m "feat(billing): wire app store jws verifier through service + composition roots"
```

---

## Gate D

After Task 4, dispatch a final Opus 4.7 spec-coverage review against `git diff main..HEAD`:
- All §9 acceptance criteria covered with file:line references.
- §8.1, §8.2, §8.3, §8.4, §8.5 cases all present.
- Production routes use `AppStoreJwsVerifier.fromBundledRoot()`, NOT `NoOpJwsVerifier`. **Exception:** `billing-sweep.worker.ts` uses `NoOpJwsVerifier` by design — the sweep never calls `processAppStoreEnvelope`. Verify the worker file is the only production-side `NoOpJwsVerifier` usage.
- `NoOpJwsVerifier` warn fires once per process.
- Apple Root CA G3 PEM committed with correct fingerprint in comment.
- Both outer + inner JWS verified (check decoder calls `verifier.verify` twice).
