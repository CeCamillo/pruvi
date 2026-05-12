import { APP_STORE_NOTIFICATION_TYPES, type AppStoreNotificationType } from "@pruvi/shared";

export type AppStoreMappedAction =
  | { kind: "activate"; expiresDate: Date }
  | { kind: "in_grace" }
  | { kind: "cancel_keep_entitlement" }
  | { kind: "on_hold_keep_entitlement" }
  | { kind: "expire" }
  | { kind: "revoke" }
  | { kind: "noop" };

export type DecodedAppStoreEvent =
  | {
      kind: "subscription";
      notificationUUID: string;
      notificationType: AppStoreNotificationType;
      subtype: string | null;
      mappedAction: AppStoreMappedAction;
      originalTransactionId: string;
      productId: string;
      expiresDate: Date | null;
      environment: "Sandbox" | "Production";
    }
  | { kind: "test"; notificationUUID: string }
  | {
      kind: "unknown";
      notificationUUID: string;
      notificationType: string;
      subtype: string | null;
      originalTransactionId: string | null;
    };

export class DecoderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecoderError";
  }
}

type AppStoreEnvelope = { signedPayload?: unknown };

function decodeJwsSegment(jws: string): unknown {
  const parts = jws.split(".");
  if (parts.length !== 3) throw new DecoderError("JWS must have exactly 3 segments");
  try {
    const decoded = Buffer.from(parts[1]!, "base64url").toString("utf-8");
    return JSON.parse(decoded);
  } catch (_e) {
    throw new DecoderError("JWS middle segment is not valid base64url+JSON");
  }
}

/** SECURITY: deferred — see spec §2 non-goals. v1 trusts the URL-path secret for auth.
 *  Real x5c certificate-chain verification is a hardening ticket. */
export function decodeAppStoreNotification(raw: unknown): DecodedAppStoreEvent {
  if (!raw || typeof raw !== "object") throw new DecoderError("Envelope is not an object");
  const env = raw as AppStoreEnvelope;
  if (typeof env.signedPayload !== "string") throw new DecoderError("Missing signedPayload");

  const outer = decodeJwsSegment(env.signedPayload) as {
    notificationUUID?: string;
    notificationType?: string;
    subtype?: string;
    data?: {
      signedTransactionInfo?: string;
      environment?: string;
    };
    version?: string;
    signedDate?: number;
  };

  const notificationUUID = outer.notificationUUID;
  if (!notificationUUID || typeof notificationUUID !== "string") {
    throw new DecoderError("Missing notificationUUID");
  }
  const notificationType = outer.notificationType;
  if (!notificationType || typeof notificationType !== "string") {
    throw new DecoderError("Missing notificationType");
  }

  // Step 3: TEST notification has no `data` object. Check FIRST.
  if (notificationType === "TEST") {
    return { kind: "test", notificationUUID };
  }

  const subtype = typeof outer.subtype === "string" ? outer.subtype : null;
  const data = outer.data;

  // Some notification types don't carry signedTransactionInfo.
  if (!data || typeof data.signedTransactionInfo !== "string") {
    return {
      kind: "unknown",
      notificationUUID,
      notificationType,
      subtype,
      originalTransactionId: null,
    };
  }

  const inner = decodeJwsSegment(data.signedTransactionInfo) as {
    originalTransactionId?: string;
    productId?: string;
    expiresDate?: number;
    environment?: string;
  };
  const originalTransactionId = inner.originalTransactionId;
  const productId = inner.productId;
  if (!originalTransactionId || typeof originalTransactionId !== "string") {
    throw new DecoderError("Missing originalTransactionId");
  }
  if (!productId || typeof productId !== "string") {
    throw new DecoderError("Missing productId");
  }
  const expiresDate = typeof inner.expiresDate === "number" ? new Date(inner.expiresDate) : null;
  const environment = (data.environment === "Production" ? "Production" : "Sandbox") as "Sandbox" | "Production";

  // Is this a known notification type?
  if (!APP_STORE_NOTIFICATION_TYPES.includes(notificationType as AppStoreNotificationType)) {
    return { kind: "unknown", notificationUUID, notificationType, subtype, originalTransactionId };
  }
  const typedNotificationType = notificationType as AppStoreNotificationType;

  let action = mapNotificationToAction(typedNotificationType, subtype, expiresDate);
  // Past-expiry safety: if "activate" but the date is in the past, downgrade to "expire".
  if (action.kind === "activate" && action.expiresDate.getTime() < Date.now()) {
    action = { kind: "expire" };
  }

  return {
    kind: "subscription",
    notificationUUID,
    notificationType: typedNotificationType,
    subtype,
    mappedAction: action,
    originalTransactionId,
    productId,
    expiresDate,
    environment,
  };
}

function mapNotificationToAction(
  type: AppStoreNotificationType,
  subtype: string | null,
  expiresDate: Date | null,
): AppStoreMappedAction {
  switch (type) {
    case "SUBSCRIBED":
    case "DID_RENEW":
    case "REFUND_REVERSED":
      if (!expiresDate) return { kind: "noop" };
      return { kind: "activate", expiresDate };
    case "DID_FAIL_TO_RENEW":
      return subtype === "GRACE_PERIOD" ? { kind: "in_grace" } : { kind: "on_hold_keep_entitlement" };
    case "EXPIRED":
    case "GRACE_PERIOD_EXPIRED":
      return { kind: "expire" };
    case "REFUND":
    case "REVOKE":
      return { kind: "revoke" };
    case "DID_CHANGE_RENEWAL_STATUS":
      return subtype === "AUTO_RENEW_DISABLED" ? { kind: "cancel_keep_entitlement" } : { kind: "noop" };
    case "DID_CHANGE_RENEWAL_PREF":
    case "OFFER_REDEEMED":
    case "PRICE_INCREASE":
    case "RENEWAL_EXTENDED":
    case "REFUND_DECLINED":
    case "CONSUMPTION_REQUEST":
    case "ONE_TIME_CHARGE":
      return { kind: "noop" };
    case "TEST":
      return { kind: "noop" }; // unreachable (TEST handled earlier)
  }
}
