import { ok, err, type Result } from "neverthrow";
import { AppError, ValidationError } from "../../utils/errors";
import { LIVES_PACK_SKUS, type LivesPackSku, type LivesPackRedeemResponse } from "@pruvi/shared";
import type { LivesPacksRepository } from "./lives-packs.repository";
import type { GooglePlayApiClient } from "./google-play.api-client";
import type { db as DbClient } from "@pruvi/db";

type Db = typeof DbClient;
type CacheInvalidator = (userId: string) => Promise<void>;
type CriticalLogger = { error: (obj: Record<string, unknown>, msg: string) => void };

export class LivesPacksService {
  private readonly logger: CriticalLogger;

  constructor(
    private db: Db,
    private repo: LivesPacksRepository,
    private apiClient: GooglePlayApiClient,
    private packageName: string | null,
    private invalidateLivesCache: CacheInvalidator,
    logger?: CriticalLogger,
  ) {
    this.logger = logger ?? {
      error: (obj, msg) => console.error(msg, obj),
    };
  }

  async redeemGooglePlay(
    userId: string,
    body: { purchaseToken: string; productId: LivesPackSku },
  ): Promise<Result<LivesPackRedeemResponse, AppError>> {
    if (!this.packageName) {
      return err(new AppError("BILLING_NOT_CONFIGURED", 503, "BILLING_NOT_CONFIGURED"));
    }

    // Idempotency check — if already credited, return no-op success
    const existing = await this.repo.findByTxn(this.db, "google_play", body.purchaseToken);
    if (existing) {
      const current = await this.repo.incrementBonusLives(this.db, userId, 0);
      return ok({ bonusLivesAdded: 0, bonusLivesAfter: current ?? 0 });
    }

    // Validate with Google Play
    const state = await this.apiClient.getOneTimeProduct(this.packageName, body.productId, body.purchaseToken);
    if (!state) {
      return err(new AppError("VALIDATION_FAILED", 422, "VALIDATION_FAILED"));
    }
    if (state.purchaseState !== 0) {
      return err(new ValidationError("purchase not in purchased state"));
    }
    if (state.consumptionState === 1) {
      return err(new ValidationError("purchase already consumed"));
    }

    // Acknowledge BEFORE crediting — preserves "no credit without ack"
    const acked = await this.apiClient.acknowledgeOneTimeProduct(this.packageName, body.productId, body.purchaseToken);
    if (!acked) {
      return err(new AppError("ACK_FAILED", 422, "ACK_FAILED"));
    }

    const livesGranted = LIVES_PACK_SKUS[body.productId].lives;

    // Critical-section TX: insert audit row + increment bonus_lives.
    // If THIS TX fails after ack succeeded, log CRITICAL — user is acked-but-uncredited.
    try {
      const result = await this.db.transaction(async (tx) => {
        const inserted = await this.repo.insertPurchase(tx, {
          userId,
          provider: "google_play",
          transactionId: body.purchaseToken,
          productId: body.productId,
          livesGranted,
          acknowledgedAt: new Date(),
        });
        if (!inserted) {
          // Concurrent redeem won the race — already credited
          const current = await this.repo.incrementBonusLives(tx, userId, 0);
          return { bonusLivesAdded: 0, bonusLivesAfter: current ?? 0 };
        }
        const after = await this.repo.incrementBonusLives(tx, userId, livesGranted);
        if (after === null) {
          throw new Error(`user not found for credit: ${userId}`); // forces rollback
        }
        return { bonusLivesAdded: livesGranted, bonusLivesAfter: after };
      });
      // Post-commit: invalidate cache
      await this.invalidateLivesCache(userId);
      return ok(result);
    } catch (e) {
      // CRITICAL: ack succeeded but TX failed. User was charged + acked but got no lives.
      // Alert pattern: `app-store-acked-but-uncredited` — manual operator recovery required.
      this.logger.error(
        { userId, purchaseToken: body.purchaseToken, productId: body.productId, livesGranted, err: (e as Error).message },
        "app-store-acked-but-uncredited",
      );
      return err(new AppError("CREDIT_TX_FAILED", 500, "CREDIT_TX_FAILED"));
    }
  }
}
