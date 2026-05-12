import { GOOGLE_PLAY_NOTIFICATION_TYPES, type GooglePlayNotificationTypeName } from "@pruvi/shared";

export type DecodedGooglePlayEvent =
  | {
      kind: "subscription";
      messageId: string;
      publishTime: string;
      packageName: string;
      eventTimeMillis: string;
      notificationType: number;
      notificationTypeName: GooglePlayNotificationTypeName;
      purchaseToken: string;
    }
  | { kind: "test"; messageId: string }
  | { kind: "unknown"; messageId: string; notificationType: number; purchaseToken: string };

export class DecoderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecoderError";
  }
}

type PubSubMessage = {
  message?: {
    messageId?: string;
    publishTime?: string;
    data?: string;
  };
};

/** Pure decoder: throws DecoderError on unparseable input. */
export function decodeGooglePlayPubSubEnvelope(raw: unknown): DecodedGooglePlayEvent {
  if (!raw || typeof raw !== "object") {
    throw new DecoderError("Envelope is not an object");
  }
  const env = raw as PubSubMessage;
  const msg = env.message;
  if (!msg || typeof msg !== "object") {
    throw new DecoderError("Missing message field");
  }
  const messageId = msg.messageId;
  if (!messageId || typeof messageId !== "string") {
    throw new DecoderError("Missing message.messageId");
  }
  if (!msg.data || typeof msg.data !== "string") {
    throw new DecoderError("Missing message.data");
  }
  let inner: unknown;
  try {
    const decoded = Buffer.from(msg.data, "base64").toString("utf-8");
    inner = JSON.parse(decoded);
  } catch (_e) {
    throw new DecoderError("message.data is not valid base64+JSON");
  }
  if (!inner || typeof inner !== "object") {
    throw new DecoderError("Decoded payload is not an object");
  }

  const obj = inner as {
    packageName?: string;
    eventTimeMillis?: string;
    testNotification?: unknown;
    subscriptionNotification?: { notificationType?: number; purchaseToken?: string };
  };

  if (obj.testNotification) {
    return { kind: "test", messageId };
  }

  const sub = obj.subscriptionNotification;
  if (!sub || typeof sub !== "object") {
    throw new DecoderError("Missing subscriptionNotification");
  }
  const ntype = sub.notificationType;
  const token = sub.purchaseToken;
  if (typeof ntype !== "number" || !token || typeof token !== "string") {
    throw new DecoderError("Malformed subscriptionNotification");
  }

  const name = GOOGLE_PLAY_NOTIFICATION_TYPES[ntype as keyof typeof GOOGLE_PLAY_NOTIFICATION_TYPES];
  if (!name) {
    return { kind: "unknown", messageId, notificationType: ntype, purchaseToken: token };
  }
  return {
    kind: "subscription",
    messageId,
    publishTime: msg.publishTime ?? "",
    packageName: obj.packageName ?? "",
    eventTimeMillis: obj.eventTimeMillis ?? "",
    notificationType: ntype,
    notificationTypeName: name,
    purchaseToken: token,
  };
}
