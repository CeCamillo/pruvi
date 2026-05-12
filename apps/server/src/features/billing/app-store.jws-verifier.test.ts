import "reflect-metadata"; // @peculiar/x509 → tsyringe DI requires this at module load
import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto } from "node:crypto";
import {
  X509CertificateGenerator,
  BasicConstraintsExtension,
  KeyUsagesExtension,
  KeyUsageFlags,
  cryptoProvider,
} from "@peculiar/x509";
import {
  AppStoreJwsVerifier,
  JwsVerificationError,
  NoOpJwsVerifier,
  encodeEcdsaDer,
} from "./app-store.jws-verifier";

cryptoProvider.set(webcrypto as unknown as Crypto);

type Chain = {
  rootPem: string;
  intermediatePem: string;
  leafPem: string;
  x5c: string[]; // [leafB64, intermediateB64, rootB64]
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

async function mintJws(
  payload: object,
  chain: Chain,
  opts?: { tamperedPayload?: object; tamperedSignature?: boolean },
): Promise<string> {
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
    flipped[0]! ^= 0xff;
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
  beforeAll(async () => {
    chain = await makeChain();
  });

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
    const verifier = new AppStoreJwsVerifier({ rootCertPem: otherChain.rootPem }); // trusts otherChain's root
    const jws = await mintJws({ x: 1 }, chain); // but JWS is from chain
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

  it("throws when signature covers a different payload (payload tampered post-signing)", async () => {
    const verifier = new AppStoreJwsVerifier({ rootCertPem: chain.rootPem });
    const jws = await mintJws({ x: 1 }, chain, { tamperedPayload: { x: 99 } });
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
