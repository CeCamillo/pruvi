import { z } from "zod";

export const BILLING_PROVIDERS = ["google_play", "app_store"] as const;
export type BillingProvider = (typeof BILLING_PROVIDERS)[number];

export const SUBSCRIPTION_STATUSES = [
  "pending",
  "active",
  "in_grace",
  "on_hold",
  "paused",
  "canceled",
  "expired",
  "revoked",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Conservative default expiry when the webhook payload doesn't carry expiryTimeMillis. */
export const DEFAULT_SUBSCRIPTION_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/** Mapping from Google Play RTDN notificationType integer → name. Values not listed
 *  are decoded as { kind: "unknown" } and result in no state mutation. */
export const GOOGLE_PLAY_NOTIFICATION_TYPES = {
  1: "RECOVERED",
  2: "RENEWED",
  3: "CANCELED",
  4: "PURCHASED",
  5: "ON_HOLD",
  6: "IN_GRACE_PERIOD",
  7: "RESTARTED",
  8: "PRICE_CHANGE_CONFIRMED",
  9: "DEFERRED",
  10: "PAUSED",
  11: "PAUSE_SCHEDULE_CHANGED",
  12: "REVOKED",
  13: "EXPIRED",
  17: "ITEMS_CHANGED",
  18: "CANCELLATION_SCHEDULED",
  19: "PRICE_CHANGE_UPDATED",
  20: "PENDING_PURCHASE_CANCELED",
  22: "PRICE_STEP_UP_CONSENT_UPDATED",
} as const;
export type GooglePlayNotificationTypeName =
  (typeof GOOGLE_PLAY_NOTIFICATION_TYPES)[keyof typeof GOOGLE_PLAY_NOTIFICATION_TYPES];

export const GooglePlayLinkBodySchema = z.object({
  purchaseToken: z.string().min(1),
  productId: z.string().min(1),
});
export type GooglePlayLinkBody = z.infer<typeof GooglePlayLinkBodySchema>;

export const GooglePlayLinkResponseSchema = z.object({
  subscription: z.object({
    id: z.number().int(),
    status: z.enum(SUBSCRIPTION_STATUSES),
    productId: z.string(),
    currentPeriodEnd: z.string().nullable(),
  }),
});
export type GooglePlayLinkResponse = z.infer<typeof GooglePlayLinkResponseSchema>;

export const APP_STORE_NOTIFICATION_TYPES = [
  "SUBSCRIBED",
  "DID_RENEW",
  "DID_FAIL_TO_RENEW",
  "EXPIRED",
  "GRACE_PERIOD_EXPIRED",
  "REFUND",
  "REFUND_DECLINED",
  "REFUND_REVERSED",
  "REVOKE",
  "DID_CHANGE_RENEWAL_STATUS",
  "DID_CHANGE_RENEWAL_PREF",
  "OFFER_REDEEMED",
  "PRICE_INCREASE",
  "RENEWAL_EXTENDED",
  "CONSUMPTION_REQUEST",
  "ONE_TIME_CHARGE",
  "TEST",
] as const;
export type AppStoreNotificationType = (typeof APP_STORE_NOTIFICATION_TYPES)[number];

export const AppStoreLinkBodySchema = z.object({
  originalTransactionId: z.string().min(1),
  productId: z.string().min(1),
});
export type AppStoreLinkBody = z.infer<typeof AppStoreLinkBodySchema>;

/** Type alias — Apple link response shape is identical to Google's (provider-agnostic). */
export const AppStoreLinkResponseSchema = GooglePlayLinkResponseSchema;
export type AppStoreLinkResponse = z.infer<typeof AppStoreLinkResponseSchema>;
