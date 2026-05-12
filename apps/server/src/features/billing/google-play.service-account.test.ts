import { beforeAll, describe, expect, it } from "vitest";
import {
  parseServiceAccount,
  loadServiceAccountFromEnv,
  mintJwt,
  InvalidServiceAccountError,
  type ServiceAccountCreds,
} from "./google-play.service-account";

const FIXTURE_PRIVATE_KEY = [
  "-----BEGIN PRIVATE KEY-----",
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
