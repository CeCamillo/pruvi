import { createSign } from "node:crypto";

export class InvalidServiceAccountError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "InvalidServiceAccountError";
  }
}

export type ServiceAccountCreds = {
  clientEmail: string;
  privateKey: string; // PEM-encoded RSA private key
  tokenUri: string;
};

export function parseServiceAccount(json: string): ServiceAccountCreds {
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch (e) {
    throw new InvalidServiceAccountError(`Invalid JSON: ${(e as Error).message}`);
  }
  if (!obj || typeof obj !== "object") {
    throw new InvalidServiceAccountError("Parsed value is not an object");
  }
  const o = obj as Record<string, unknown>;
  if (typeof o.client_email !== "string" || !o.client_email) {
    throw new InvalidServiceAccountError("Missing client_email");
  }
  if (typeof o.private_key !== "string" || !o.private_key) {
    throw new InvalidServiceAccountError("Missing private_key");
  }
  const tokenUri =
    typeof o.token_uri === "string" && o.token_uri
      ? o.token_uri
      : "https://oauth2.googleapis.com/token";
  return { clientEmail: o.client_email, privateKey: o.private_key, tokenUri };
}

export function loadServiceAccountFromEnv(env: {
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?: string;
}): ServiceAccountCreds | null {
  if (!env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) return null;
  return parseServiceAccount(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
}

const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Mints an RS256-signed JWT bearer assertion. `nowSeconds` allows deterministic tests. */
export function mintJwt(
  creds: ServiceAccountCreds,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: creds.clientEmail,
    scope: SCOPE,
    aud: creds.tokenUri,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };
  const encHeader = base64url(Buffer.from(JSON.stringify(header), "utf-8"));
  const encPayload = base64url(Buffer.from(JSON.stringify(payload), "utf-8"));
  const signingInput = `${encHeader}.${encPayload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(creds.privateKey);
  return `${signingInput}.${base64url(signature)}`;
}
