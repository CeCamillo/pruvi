import { describe, it, expect } from "vitest";
import { decodeAppStoreNotification, DecoderError } from "./app-store.decoder";

function makeJws(payload: object): string {
  // header.payload.signature — only the middle segment is used.
  const header = Buffer.from(JSON.stringify({ alg: "ES256", x5c: ["fake"] })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

function buildEnvelope(opts: {
  notificationType: string;
  subtype?: string;
  notificationUUID?: string;
  expiresDate?: number;
  originalTransactionId?: string;
  productId?: string;
  omitData?: boolean;
  omitSignedTransaction?: boolean;
}) {
  const tx = {
    originalTransactionId: opts.originalTransactionId ?? "200000000000001",
    productId: opts.productId ?? "pruvi_ultra_monthly",
    expiresDate: opts.expiresDate ?? Date.now() + 30 * 24 * 60 * 60 * 1000,
    environment: "Production",
  };
  const data = opts.omitSignedTransaction
    ? { environment: "Production" }
    : { signedTransactionInfo: makeJws(tx), environment: "Production" };
  const outer: Record<string, unknown> = {
    notificationUUID: opts.notificationUUID ?? "uuid-1",
    notificationType: opts.notificationType,
    version: "2.0",
    signedDate: Date.now(),
  };
  if (opts.subtype) outer.subtype = opts.subtype;
  if (!opts.omitData) outer.data = data;
  return { signedPayload: makeJws(outer) };
}

describe("decodeAppStoreNotification", () => {
  it("decodes SUBSCRIBED:INITIAL_BUY → activate", () => {
    const env = buildEnvelope({ notificationType: "SUBSCRIBED", subtype: "INITIAL_BUY" });
    const d = decodeAppStoreNotification(env);
    expect(d.kind).toBe("subscription");
    if (d.kind === "subscription") {
      expect(d.notificationType).toBe("SUBSCRIBED");
      expect(d.mappedAction.kind).toBe("activate");
    }
  });

  it("decodes SUBSCRIBED:RESUBSCRIBE → activate", () => {
    const env = buildEnvelope({ notificationType: "SUBSCRIBED", subtype: "RESUBSCRIBE" });
    const d = decodeAppStoreNotification(env);
    expect(d.kind === "subscription" && d.mappedAction.kind).toBe("activate");
  });

  it("decodes DID_RENEW → activate with expiresDate", () => {
    const futureMs = Date.now() + 30 * 86400000;
    const env = buildEnvelope({ notificationType: "DID_RENEW", expiresDate: futureMs });
    const d = decodeAppStoreNotification(env);
    expect(d.kind).toBe("subscription");
    if (d.kind === "subscription" && d.mappedAction.kind === "activate") {
      expect(Math.abs(d.mappedAction.expiresDate.getTime() - futureMs)).toBeLessThan(1000);
    }
  });

  it("decodes DID_FAIL_TO_RENEW:GRACE_PERIOD → in_grace", () => {
    const env = buildEnvelope({ notificationType: "DID_FAIL_TO_RENEW", subtype: "GRACE_PERIOD" });
    const d = decodeAppStoreNotification(env);
    expect(d.kind === "subscription" && d.mappedAction.kind).toBe("in_grace");
  });

  it("decodes DID_FAIL_TO_RENEW (no subtype) → on_hold_keep_entitlement", () => {
    const env = buildEnvelope({ notificationType: "DID_FAIL_TO_RENEW" });
    const d = decodeAppStoreNotification(env);
    expect(d.kind === "subscription" && d.mappedAction.kind).toBe("on_hold_keep_entitlement");
  });

  it("decodes EXPIRED → expire", () => {
    const env = buildEnvelope({ notificationType: "EXPIRED" });
    const d = decodeAppStoreNotification(env);
    expect(d.kind === "subscription" && d.mappedAction.kind).toBe("expire");
  });

  it("decodes REFUND → revoke", () => {
    const env = buildEnvelope({ notificationType: "REFUND" });
    const d = decodeAppStoreNotification(env);
    expect(d.kind === "subscription" && d.mappedAction.kind).toBe("revoke");
  });

  it("decodes REVOKE → revoke", () => {
    const env = buildEnvelope({ notificationType: "REVOKE" });
    const d = decodeAppStoreNotification(env);
    expect(d.kind === "subscription" && d.mappedAction.kind).toBe("revoke");
  });

  it("decodes DID_CHANGE_RENEWAL_STATUS:AUTO_RENEW_DISABLED → cancel_keep_entitlement", () => {
    const env = buildEnvelope({ notificationType: "DID_CHANGE_RENEWAL_STATUS", subtype: "AUTO_RENEW_DISABLED" });
    const d = decodeAppStoreNotification(env);
    expect(d.kind === "subscription" && d.mappedAction.kind).toBe("cancel_keep_entitlement");
  });

  it("decodes DID_CHANGE_RENEWAL_STATUS:AUTO_RENEW_ENABLED → noop", () => {
    const env = buildEnvelope({ notificationType: "DID_CHANGE_RENEWAL_STATUS", subtype: "AUTO_RENEW_ENABLED" });
    const d = decodeAppStoreNotification(env);
    expect(d.kind === "subscription" && d.mappedAction.kind).toBe("noop");
  });

  it("decodes REFUND_REVERSED with future expiry → activate", () => {
    const future = Date.now() + 30 * 86400000;
    const env = buildEnvelope({ notificationType: "REFUND_REVERSED", expiresDate: future });
    const d = decodeAppStoreNotification(env);
    expect(d.kind === "subscription" && d.mappedAction.kind).toBe("activate");
  });

  it("REFUND_REVERSED with PAST expiry → downgrades to expire (past-expiry safety)", () => {
    const past = Date.now() - 86400000;
    const env = buildEnvelope({ notificationType: "REFUND_REVERSED", expiresDate: past });
    const d = decodeAppStoreNotification(env);
    expect(d.kind === "subscription" && d.mappedAction.kind).toBe("expire");
  });

  it("decodes ONE_TIME_CHARGE → noop", () => {
    const env = buildEnvelope({ notificationType: "ONE_TIME_CHARGE" });
    const d = decodeAppStoreNotification(env);
    expect(d.kind === "subscription" && d.mappedAction.kind).toBe("noop");
  });

  it("returns kind=test for TEST notification (no data object)", () => {
    const env = { signedPayload: makeJws({ notificationUUID: "uuid-test", notificationType: "TEST", version: "2.0" }) };
    const d = decodeAppStoreNotification(env);
    expect(d.kind).toBe("test");
  });

  it("returns kind=unknown for unrecognized notificationType", () => {
    const env = buildEnvelope({ notificationType: "FUTURE_FANCY_TYPE" });
    const d = decodeAppStoreNotification(env);
    expect(d.kind).toBe("unknown");
    if (d.kind === "unknown") expect(d.notificationType).toBe("FUTURE_FANCY_TYPE");
  });

  it("returns kind=unknown when data.signedTransactionInfo is missing", () => {
    const env = buildEnvelope({ notificationType: "DID_CHANGE_RENEWAL_PREF", omitSignedTransaction: true });
    const d = decodeAppStoreNotification(env);
    expect(d.kind).toBe("unknown");
  });

  it("throws on missing signedPayload", () => {
    expect(() => decodeAppStoreNotification({})).toThrow(DecoderError);
  });

  it("throws on JWS that doesn't have 3 segments", () => {
    expect(() => decodeAppStoreNotification({ signedPayload: "a.b" })).toThrow(DecoderError);
  });

  it("throws on invalid JSON in JWS payload", () => {
    expect(() => decodeAppStoreNotification({ signedPayload: "header.!notvalidbase64json!.sig" })).toThrow(DecoderError);
  });
});
