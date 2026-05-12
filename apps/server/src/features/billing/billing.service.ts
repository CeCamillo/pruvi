import { ok, err, type Result } from "neverthrow";
import { AppError, ConflictError } from "../../utils/errors";
import { DEFAULT_SUBSCRIPTION_PERIOD_MS, type GooglePlayLinkResponse, type SubscriptionStatus } from "@pruvi/shared";
import type { BillingRepository, SubscriptionRow } from "./billing.repository";
import type { UltraService } from "../ultra/ultra.service";
import type { DecodedGooglePlayEvent } from "./google-play.decoder";
import { decodeGooglePlayPubSubEnvelope } from "./google-play.decoder";
import type { db as DbClient } from "@pruvi/db";

type Db = typeof DbClient;

/** Effect to apply AFTER the transaction commits (two-phase pattern per spec §7.6).
 *  Both `grant` and `revoke` variants carry `excludeSubscriptionId` so the post-commit
 *  step can consult OTHER active subscriptions (the multi-sub guards from §7.2):
 *   - grant: final expiry = MAX(effect.expiresAt, otherActive.currentPeriodEnd) — never truncates a longer plan.
 *   - revoke: revoke only if no other active subscription exists. */
type PostCommitUltraEffect =
  | { kind: "grant"; userId: string; expiresAt: Date; excludeSubscriptionId: number }
  | { kind: "revoke_if_no_other_active"; userId: string; excludeSubscriptionId: number }
  | { kind: "none" };

export class BillingService {
  constructor(
    private db: Db,
    private repo: BillingRepository,
    private ultra: UltraService,
  ) {}

  /** Webhook entry point. Returns the response payload; always 200 on accepted shapes.
   *  Auth + envelope-shape validation happens in the route. */
  async processWebhookEnvelope(envelope: unknown): Promise<Result<{ messageId: string; kind: string }, AppError>> {
    let decoded: DecodedGooglePlayEvent;
    try {
      decoded = decodeGooglePlayPubSubEnvelope(envelope);
    } catch (e) {
      return err(new AppError(`MALFORMED_ENVELOPE: ${(e as Error).message}`, 200, "MALFORMED_ENVELOPE"));
    }

    if (decoded.kind === "test") {
      // Record audit row with no purchase token; idempotent on messageId.
      await this.repo.insertEvent(this.db, {
        provider: "google_play",
        messageId: decoded.messageId,
        eventType: "TEST",
        purchaseToken: null,
        payload: { kind: "test" },
      });
      return ok({ messageId: decoded.messageId, kind: "test" });
    }

    const effect = await this.db.transaction(async (tx) => {
      const eventType =
        decoded.kind === "subscription" ? decoded.notificationTypeName : `UNKNOWN_${decoded.notificationType}`;
      const inserted = await this.repo.insertEvent(tx, {
        provider: "google_play",
        messageId: decoded.messageId,
        eventType,
        purchaseToken: decoded.purchaseToken,
        payload: decoded as unknown as Record<string, unknown>,
      });
      if (!inserted) {
        // Duplicate delivery — already processed (or processed previously). No-op.
        return { kind: "none" } as PostCommitUltraEffect;
      }

      if (decoded.kind === "unknown") {
        await this.repo.markEventProcessed(tx, inserted.id);
        return { kind: "none" } as PostCommitUltraEffect;
      }

      // Find or create subscription row.
      let sub = await this.repo.findSubscriptionByToken(tx, "google_play", decoded.purchaseToken);
      if (!sub) {
        sub = await this.repo.createOrphanSubscription(tx, "google_play", decoded.purchaseToken);
      }

      const { newStatus, newPeriodEnd, ultraEffect } = this.applyDecodedEvent(decoded, sub);
      await this.repo.updateSubscriptionState(tx, sub.id, { status: newStatus, currentPeriodEnd: newPeriodEnd });

      // If subscription has no user yet, leave processed_at = NULL so link can replay.
      if (sub.userId === null) {
        return { kind: "none" } as PostCommitUltraEffect;
      }

      await this.repo.markEventProcessed(tx, inserted.id);
      return ultraEffect;
    });

    await this.applyUltraEffect(effect);
    return ok({ messageId: decoded.messageId, kind: decoded.kind });
  }

  /** Link entry point: associates a purchase token with the authenticated user and replays parked events. */
  async linkGooglePlayPurchase(
    userId: string,
    body: { purchaseToken: string; productId: string },
  ): Promise<Result<GooglePlayLinkResponse, AppError>> {
    const effects: PostCommitUltraEffect[] = [];
    const finalRow = await this.db.transaction(async (tx) => {
      const existing = await this.repo.findSubscriptionByToken(tx, "google_play", body.purchaseToken);
      let sub: SubscriptionRow;
      if (!existing) {
        const created = await this.repo.upsertLinkedSubscription(tx, {
          userId, provider: "google_play", productId: body.productId, token: body.purchaseToken,
        });
        sub = created.subscription;
      } else if (existing.userId !== null && existing.userId !== userId) {
        throw new ConflictError("PURCHASE_TOKEN_OWNED_BY_OTHER_USER");
      } else if (existing.userId === userId) {
        sub = existing;
      } else {
        // Orphan claim
        sub = await this.repo.claimOrphanSubscription(tx, existing.id, userId, body.productId);
      }

      // Replay parked events for this token (only if we just claimed an orphan or first-link).
      const parked = await this.repo.listUnprocessedEventsForToken(tx, "google_play", body.purchaseToken);
      for (const event of parked) {
        // Reconstruct the decoded event from the audit payload.
        const decoded = event.payload as unknown as DecodedGooglePlayEvent;
        if (decoded.kind !== "subscription") {
          await this.repo.markEventProcessed(tx, event.id);
          continue;
        }
        const fresh = await this.repo.findSubscriptionByToken(tx, "google_play", body.purchaseToken);
        if (!fresh) throw new Error("replay: subscription disappeared mid-transaction");
        sub = fresh;
        const { newStatus, newPeriodEnd, ultraEffect } = this.applyDecodedEvent(decoded, sub);
        await this.repo.updateSubscriptionState(tx, sub.id, { status: newStatus, currentPeriodEnd: newPeriodEnd });
        await this.repo.markEventProcessed(tx, event.id);
        effects.push(ultraEffect);
      }
      const final = await this.repo.findSubscriptionByToken(tx, "google_play", body.purchaseToken);
      if (!final) throw new Error("link: subscription disappeared mid-transaction");
      return final;
    }).catch((e) => {
      if (e instanceof ConflictError) throw e;
      throw e;
    });

    for (const e of effects) await this.applyUltraEffect(e);

    return ok({
      subscription: {
        id: finalRow.id,
        status: finalRow.status,
        productId: finalRow.productId,
        currentPeriodEnd: finalRow.currentPeriodEnd?.toISOString() ?? null,
      },
    });
  }

  /** Pure state-machine: maps (event, current subscription) → next state + ultra effect. NO DB writes. */
  applyDecodedEvent(
    decoded: DecodedGooglePlayEvent,
    sub: SubscriptionRow,
  ): { newStatus: SubscriptionStatus; newPeriodEnd: Date | null; ultraEffect: PostCommitUltraEffect } {
    if (decoded.kind !== "subscription") {
      return { newStatus: sub.status, newPeriodEnd: sub.currentPeriodEnd, ultraEffect: { kind: "none" } };
    }
    const now = new Date();
    const defaultEnd = new Date(now.getTime() + DEFAULT_SUBSCRIPTION_PERIOD_MS);
    const name = decoded.notificationTypeName;
    const grant = (end: Date): PostCommitUltraEffect =>
      sub.userId !== null
        ? { kind: "grant", userId: sub.userId, expiresAt: end, excludeSubscriptionId: sub.id }
        : { kind: "none" };
    const revoke = (): PostCommitUltraEffect =>
      sub.userId !== null
        ? { kind: "revoke_if_no_other_active", userId: sub.userId, excludeSubscriptionId: sub.id }
        : { kind: "none" };

    switch (name) {
      case "PURCHASED":
      case "RENEWED":
      case "RECOVERED":
      case "RESTARTED":
        return { newStatus: "active", newPeriodEnd: defaultEnd, ultraEffect: grant(defaultEnd) };
      case "IN_GRACE_PERIOD":
        return { newStatus: "in_grace", newPeriodEnd: sub.currentPeriodEnd, ultraEffect: { kind: "none" } };
      case "CANCELED":
        return { newStatus: "canceled", newPeriodEnd: sub.currentPeriodEnd, ultraEffect: { kind: "none" } };
      case "ON_HOLD":
        return { newStatus: "on_hold", newPeriodEnd: sub.currentPeriodEnd, ultraEffect: revoke() };
      case "PAUSED":
        return { newStatus: "paused", newPeriodEnd: sub.currentPeriodEnd, ultraEffect: revoke() };
      case "EXPIRED":
        return { newStatus: "expired", newPeriodEnd: sub.currentPeriodEnd, ultraEffect: revoke() };
      case "REVOKED":
        return { newStatus: "revoked", newPeriodEnd: sub.currentPeriodEnd, ultraEffect: revoke() };
      case "PRICE_CHANGE_CONFIRMED":
      case "DEFERRED":
      case "PAUSE_SCHEDULE_CHANGED":
      case "ITEMS_CHANGED":
      case "CANCELLATION_SCHEDULED":
      case "PRICE_CHANGE_UPDATED":
      case "PENDING_PURCHASE_CANCELED":
      case "PRICE_STEP_UP_CONSENT_UPDATED":
        return { newStatus: sub.status, newPeriodEnd: sub.currentPeriodEnd, ultraEffect: { kind: "none" } };
    }
  }

  private async applyUltraEffect(effect: PostCommitUltraEffect): Promise<void> {
    if (effect.kind === "grant") {
      // Multi-sub GRANT guard (spec §7.2): the final expiry must be the MAX across this
      // subscription's expiry and the currentPeriodEnd of any other active/in_grace subscriptions
      // for the same user. A renewal of a short plan must NEVER truncate a long active plan.
      const otherMax = await this.repo.getMaxOtherActivePeriodEnd(
        this.db, effect.userId, effect.excludeSubscriptionId,
      );
      const finalEnd = otherMax && otherMax > effect.expiresAt ? otherMax : effect.expiresAt;
      await this.ultra.grant(effect.userId, finalEnd);
    } else if (effect.kind === "revoke_if_no_other_active") {
      const hasOther = await this.repo.hasOtherActiveSubscription(
        this.db, effect.userId, effect.excludeSubscriptionId,
      );
      if (!hasOther) await this.ultra.revoke(effect.userId);
    }
  }
}
