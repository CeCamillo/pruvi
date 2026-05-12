import { describe, it, expect } from "vitest";
import {
  BILLING_PROVIDERS,
  SUBSCRIPTION_STATUSES,
  GOOGLE_PLAY_NOTIFICATION_TYPES,
  GooglePlayLinkBodySchema,
  DEFAULT_SUBSCRIPTION_PERIOD_MS,
  APP_STORE_NOTIFICATION_TYPES,
  AppStoreLinkBodySchema,
} from "./billing";

describe("billing shared module", () => {
  it("declares the v1 providers", () => {
    expect(BILLING_PROVIDERS).toEqual(["google_play", "app_store"]);
  });

  it("declares all 8 subscription statuses", () => {
    expect(SUBSCRIPTION_STATUSES).toHaveLength(8);
    expect(SUBSCRIPTION_STATUSES).toContain("pending");
    expect(SUBSCRIPTION_STATUSES).toContain("active");
    expect(SUBSCRIPTION_STATUSES).toContain("expired");
  });

  it("maps Google Play notificationType integers to enum names", () => {
    expect(GOOGLE_PLAY_NOTIFICATION_TYPES[4]).toBe("PURCHASED");
    expect(GOOGLE_PLAY_NOTIFICATION_TYPES[13]).toBe("EXPIRED");
    expect(GOOGLE_PLAY_NOTIFICATION_TYPES[18]).toBe("CANCELLATION_SCHEDULED");
  });

  it("DEFAULT_SUBSCRIPTION_PERIOD_MS is 30 days", () => {
    expect(DEFAULT_SUBSCRIPTION_PERIOD_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("validates link body shape", () => {
    expect(GooglePlayLinkBodySchema.safeParse({ purchaseToken: "t", productId: "pruvi_ultra_monthly" }).success).toBe(true);
    expect(GooglePlayLinkBodySchema.safeParse({ purchaseToken: "", productId: "x" }).success).toBe(false);
  });

  it("declares all 17 app store notification types", () => {
    expect(APP_STORE_NOTIFICATION_TYPES).toHaveLength(17);
    expect(APP_STORE_NOTIFICATION_TYPES).toContain("SUBSCRIBED");
    expect(APP_STORE_NOTIFICATION_TYPES).toContain("REFUND_REVERSED");
    expect(APP_STORE_NOTIFICATION_TYPES).toContain("ONE_TIME_CHARGE");
  });

  it("validates app store link body shape", () => {
    expect(AppStoreLinkBodySchema.safeParse({ originalTransactionId: "200000000000001", productId: "pruvi_ultra_monthly" }).success).toBe(true);
    expect(AppStoreLinkBodySchema.safeParse({ originalTransactionId: "", productId: "x" }).success).toBe(false);
  });
});
