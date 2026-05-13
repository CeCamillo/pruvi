import { eq, and, sql } from "drizzle-orm";
import type { db as DbClient } from "@pruvi/db";
import { user } from "@pruvi/db/schema/auth";
import { livesPurchase } from "@pruvi/db/schema/lives-purchase";

type Db = typeof DbClient;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

export type LivesPurchaseRow = {
  id: number;
  userId: string;
  provider: "google_play" | "app_store";
  transactionId: string;
  productId: string;
  livesGranted: number;
  acknowledgedAt: Date | null;
  createdAt: Date;
};

export class LivesPacksRepository {
  async findByTxn(d: DbOrTx, provider: "google_play" | "app_store", transactionId: string): Promise<LivesPurchaseRow | null> {
    const rows = await d
      .select()
      .from(livesPurchase)
      .where(and(eq(livesPurchase.provider, provider), eq(livesPurchase.transactionId, transactionId)))
      .limit(1);
    return (rows[0] as LivesPurchaseRow | undefined) ?? null;
  }

  async insertPurchase(
    d: DbOrTx,
    args: {
      userId: string;
      provider: "google_play" | "app_store";
      transactionId: string;
      productId: string;
      livesGranted: number;
      acknowledgedAt: Date | null;
    },
  ): Promise<LivesPurchaseRow | null> {
    const rows = await d
      .insert(livesPurchase)
      .values(args)
      .onConflictDoNothing({ target: [livesPurchase.provider, livesPurchase.transactionId] })
      .returning();
    return (rows[0] as LivesPurchaseRow | undefined) ?? null;
  }

  async incrementBonusLives(d: DbOrTx, userId: string, delta: number): Promise<number | null> {
    const rows = await d
      .update(user)
      .set({ bonusLives: sql`${user.bonusLives} + ${delta}` })
      .where(eq(user.id, userId))
      .returning({ bonusLives: user.bonusLives });
    return rows[0]?.bonusLives ?? null;
  }
}
