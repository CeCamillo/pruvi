import { describe, it, expect } from "vitest";
import { decodeGooglePlayPubSubEnvelope, DecoderError } from "./google-play.decoder";

function buildEnvelope(inner: object, messageId = "msg-1") {
  return {
    message: {
      messageId,
      publishTime: "2026-05-12T10:00:00Z",
      data: Buffer.from(JSON.stringify(inner)).toString("base64"),
    },
  };
}

describe("decodeGooglePlayPubSubEnvelope", () => {
  it("decodes PURCHASED (type 4)", () => {
    const env = buildEnvelope({
      version: "1.0",
      packageName: "com.pruvi.app",
      eventTimeMillis: "1747044000000",
      subscriptionNotification: { version: "1.0", notificationType: 4, purchaseToken: "tok-A" },
    });
    const decoded = decodeGooglePlayPubSubEnvelope(env);
    expect(decoded.kind).toBe("subscription");
    if (decoded.kind === "subscription") {
      expect(decoded.notificationType).toBe(4);
      expect(decoded.notificationTypeName).toBe("PURCHASED");
      expect(decoded.purchaseToken).toBe("tok-A");
      expect(decoded.messageId).toBe("msg-1");
    }
  });

  it("decodes RENEWED (type 2)", () => {
    const env = buildEnvelope({
      subscriptionNotification: { notificationType: 2, purchaseToken: "tok-B" },
    });
    const decoded = decodeGooglePlayPubSubEnvelope(env);
    expect(decoded.kind === "subscription" && decoded.notificationTypeName).toBe("RENEWED");
  });

  it("decodes EXPIRED (type 13)", () => {
    const env = buildEnvelope({
      subscriptionNotification: { notificationType: 13, purchaseToken: "tok-C" },
    });
    const decoded = decodeGooglePlayPubSubEnvelope(env);
    expect(decoded.kind === "subscription" && decoded.notificationTypeName).toBe("EXPIRED");
  });

  it("decodes CANCELLATION_SCHEDULED (type 18)", () => {
    const env = buildEnvelope({
      subscriptionNotification: { notificationType: 18, purchaseToken: "tok-D" },
    });
    const decoded = decodeGooglePlayPubSubEnvelope(env);
    expect(decoded.kind === "subscription" && decoded.notificationTypeName).toBe("CANCELLATION_SCHEDULED");
  });

  it("returns kind=unknown for unrecognized notificationType", () => {
    const env = buildEnvelope({
      subscriptionNotification: { notificationType: 99, purchaseToken: "tok-E" },
    });
    const decoded = decodeGooglePlayPubSubEnvelope(env);
    expect(decoded.kind).toBe("unknown");
    if (decoded.kind === "unknown") {
      expect(decoded.notificationType).toBe(99);
      expect(decoded.purchaseToken).toBe("tok-E");
    }
  });

  it("returns kind=test for testNotification envelopes", () => {
    const env = buildEnvelope({ testNotification: { version: "1.0" } });
    const decoded = decodeGooglePlayPubSubEnvelope(env);
    expect(decoded.kind).toBe("test");
  });

  it("throws on missing messageId", () => {
    expect(() =>
      decodeGooglePlayPubSubEnvelope({ message: { data: Buffer.from("{}").toString("base64") } }),
    ).toThrow(DecoderError);
  });

  it("throws on missing message.data", () => {
    expect(() => decodeGooglePlayPubSubEnvelope({ message: { messageId: "x" } })).toThrow(DecoderError);
  });

  it("throws on malformed base64", () => {
    expect(() => decodeGooglePlayPubSubEnvelope({ message: { messageId: "x", data: "!!!notbase64!!!" } })).toThrow(DecoderError);
  });

  it("throws on missing subscriptionNotification", () => {
    const env = buildEnvelope({ packageName: "x" });
    expect(() => decodeGooglePlayPubSubEnvelope(env)).toThrow(DecoderError);
  });

  it("throws on malformed subscriptionNotification (missing purchaseToken)", () => {
    const env = buildEnvelope({ subscriptionNotification: { notificationType: 4 } });
    expect(() => decodeGooglePlayPubSubEnvelope(env)).toThrow(DecoderError);
  });
});
