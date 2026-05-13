# Phase 2E.11 — One-time IAP top-ups for lives packs (design spec)

**Date:** 2026-05-12
**Branch:** `feature/phase-2e11-lives-packs-iap`
**Depends on:** Phase 2E.4 (Google Play billing), Phase 2E.5 (App Store billing), Phase 2E.8 (Google API client + service-account). Reuses the Google OAuth foundation; introduces the first NON-subscription product flow.

## 1. Problem

Lives are capped at `MAX_LIVES = 5` and auto-regen at a fixed cadence (`packages/shared/src/lives.ts:3`). When a non-Ultra user runs out of lives mid-study, they can either wait for regen or convert. We need a third option: **buy a one-time pack of lives** (consumable IAP). This is `5.4 Compra avulsa de vidas` from the product roadmap.

Pack sizes (v1):
- `vidas_pack_5` — +5 lives
- `vidas_pack_20` — +20 lives (better $/life value)

## 2. Goal

Server-side credit lives when a verified one-time **Google Play** purchase completes. Apple App Store consumable IAP is **deferred to Phase 2E.12** — the Apple flow requires non-trivial decoder changes (extract `appAccountToken` + `transactionId`), a separate dispatch path in `processAppStoreEnvelope`, and a UUID-format mapping from our CUID `user.id` to Apple's required `appAccountToken` shape. Shipping Google first keeps this phase tight and unblocks the higher-revenue platform.

**Google Play flow**: client POSTs `{purchaseToken, productId}` after the in-app purchase succeeds. Server calls `androidpublisher.purchases.products.get` to validate state, then `purchases.products.acknowledge` (within 3 days to prevent auto-refund). Lives credit happens **inside the same transaction** as the `lives_purchase` row insert; acknowledge happens **before** that transaction so a DB-rollback can never leave the user with an acknowledged-but-uncredited charge. See §7 for the inverse failure mode (ack OK, DB fails after).

Shared infrastructure (designed for Google now, reused by Apple in 2E.12):
- Idempotency via a new `lives_purchase` table keyed on `(provider, transaction_id)` with `UNIQUE` constraint.
- A `bonus_lives` column on `user` that accumulates above `MAX_LIVES` and is drained before the regen-capped `lives` on each `tryDecrement`.

## 3. Out of scope (deferred)

- **Apple App Store consumable IAP (Phase 2E.12)** — requires decoder changes, `appAccountToken` UUID-to-CUID mapping, and a separate dispatch path. Designed as a separate phase to keep scope tight.
- New SKUs beyond the two packs above.
- Refund detection (Google `voidedpurchases.list`).
- Multiple-tier pricing experimentation.
- Promo/discount codes.
- Backfill of `bonus_lives` field into existing client API responses (frontend phase).

## 4. Architecture

### 4.1 Schema changes

- Add `bonusLives: integer("bonus_lives").notNull().default(0)` to the `user` table. Accumulates unboundedly. Drained before `lives` (the regen-capped pool).
- **New table** `lives_purchase`:
  - `id` serial PK
  - `user_id` text NOT NULL REFERENCES `user(id)` ON DELETE CASCADE
  - `provider` text enum `["google_play", "app_store"]` NOT NULL
  - `transaction_id` text NOT NULL (Google `purchaseToken`, Apple `transactionId`)
  - `product_id` text NOT NULL (e.g., `vidas_pack_5`)
  - `lives_granted` integer NOT NULL
  - `acknowledged_at` timestamptz (Google only; NULL on Apple)
  - `created_at` timestamptz NOT NULL DEFAULT NOW()
  - UNIQUE index on `(provider, transaction_id)` for idempotency
  - Index on `(user_id, created_at DESC)` for audit listing

Migration: `0012_lives_packs.sql` via drizzle-kit.

### 4.2 Module layout

- `packages/shared/src/lives-packs.ts` — **new**. SKU → lives mapping:
  ```ts
  export const LIVES_PACK_SKUS = {
    vidas_pack_5: { lives: 5 },
    vidas_pack_20: { lives: 20 },
  } as const;
  export type LivesPackSku = keyof typeof LIVES_PACK_SKUS;
  export const LivesPackRedeemBodySchema = z.object({
    provider: z.enum(["google_play"]),  // app_store flows in via webhook, not this endpoint
    purchaseToken: z.string().min(1),
    productId: z.enum(["vidas_pack_5", "vidas_pack_20"]),
  });
  export const LivesPackRedeemResponseSchema = z.object({
    bonusLivesAdded: z.number().int().positive(),
    bonusLivesAfter: z.number().int().nonnegative(),
  });
  ```
- `apps/server/src/features/billing/google-play.api-client.ts` — modify: add `getOneTimeProduct(packageName, productId, purchaseToken): Promise<{ purchaseState: number; consumptionState: number; acknowledgementState: number } | null>` and `acknowledgeOneTimeProduct(packageName, productId, purchaseToken): Promise<boolean>`. Both reuse the existing OAuth token cache.
- `apps/server/src/features/billing/lives-packs.repository.ts` — **new**. `findByTxn(provider, txnId)`, `insertPurchase(...)` returning either the newly inserted row or null on conflict. Mirrors `BillingRepository.insertEvent` semantics.
- `apps/server/src/features/billing/lives-packs.service.ts` — **new**. Single entry point:
  - `redeemGooglePlay(userId, { purchaseToken, productId })`: validates via API client, acknowledges, then opens a TX that inserts `lives_purchase` + atomically increments `user.bonus_lives`. Returns `{ bonusLivesAdded, bonusLivesAfter }`.
- `apps/server/src/features/lives/lives.repository.ts` — modify:
  - `tryDecrement` return shape: ADD `bonusLivesAfter: number` to the success variant (callers need this to update display state without a second roundtrip).
  - Atomic UPDATE flow: drain `bonus_lives` first if > 0, else drain `lives`. Predicate-in-WHERE for race-safety. Always returns BOTH `lives` and `bonus_lives` in the success shape.
  - `materializeRegen` reads `bonus_lives` too and includes it in the returned shape; regen logic untouched (`bonus_lives` does NOT regen — it's purchased).
- `apps/server/src/features/lives/lives.service.ts` — modify response to include `bonusLives`.
- `apps/server/src/features/lives/lives.route.ts` — invalidate the existing 30s `lives:${userId}` cache (`lives.route.ts:22-29`) inside `redeemGooglePlay` via a shared cache-invalidation hook. Implementation: `LivesPacksService` accepts a `cacheInvalidator: (userId: string) => Promise<void>` callback injected at route construction; the route wires it to `fastify.cache?.del(...)`.
- `apps/server/src/features/billing/billing.route.ts` — add `POST /billing/lives-pack/redeem` route (auth required). Construct `LivesPacksService` here (after `apiClient` construction); pass the api client + new repo + cache invalidator. **Do NOT add to `billing-sweep.worker.ts`** — sweep never touches consumable purchases. `BillingService` constructor is UNCHANGED this phase.

### 4.3 Google Play redemption flow

```
POST /billing/lives-pack/redeem (auth required)
Body: { provider: "google_play", purchaseToken, productId }
  ├─ Validate productId is a known pack SKU (Zod enum)
  ├─ Idempotency check: lives_purchase row for (google_play, purchaseToken)?
  │     If exists → return { bonusLivesAdded: 0, bonusLivesAfter: <current> } as a no-op success
  ├─ apiClient.getOneTimeProduct(packageName, productId, purchaseToken):
  │     → { purchaseState: 0 (purchased) | 1 (canceled) | 2 (pending),
  │         consumptionState: 0 (yet to be consumed) | 1 (consumed),
  │         acknowledgementState: 0 (yet to be acknowledged) | 1 (acknowledged) }
  │     If !response OR purchaseState !== 0 → 422 "purchase not in purchased state"
  │     If consumptionState === 1 → already consumed (idempotency leak — log + 422)
  ├─ apiClient.acknowledgeOneTimeProduct(...)
  │     200/204 → ok. 4xx → 422.
  ├─ this.db.transaction(async (tx) => {
  │     const inserted = repo.insertPurchase(tx, { userId, provider: "google_play",
  │                                                  transactionId: purchaseToken,
  │                                                  productId, livesGranted: PACK[productId].lives,
  │                                                  acknowledgedAt: new Date() })
  │     if (!inserted) return { bonusLivesAdded: 0, ... } // concurrent race
  │     const after = await tx.update(user)
  │                          .set({ bonusLives: sql`${user.bonusLives} + ${inserted.livesGranted}` })
  │                          .where(eq(user.id, userId))
  │                          .returning({ bonusLives: user.bonusLives })
  │     return { bonusLivesAdded: inserted.livesGranted, bonusLivesAfter: after[0].bonusLives }
  │   })
  └─ Return 200 with shape.
```

### 4.4 App Store ONE_TIME_CHARGE flow — **deferred to Phase 2E.12**

The Apple-side flow is intentionally out of scope for this phase. Phase 2E.12 will handle:
- Extracting `transactionId` (distinct from `originalTransactionId`) and `appAccountToken` from the inner JWS in `app-store.decoder.ts`.
- Introducing a new `DecodedAppStoreEvent` variant `kind: "one_time_charge"` so `processAppStoreEnvelope` can dispatch the consumable path WITHOUT creating an orphan subscription row.
- Choosing the `appAccountToken` ↔ `user.id` mapping strategy (Apple requires UUID format; our `user.id` is CUID — either a new `user.app_account_token uuid DEFAULT gen_random_uuid()` column, or a deterministic UUIDv5 derivation).
- Adding `creditFromAppStoreOneTimeCharge(decoded)` to `LivesPacksService` reusing the shared insert+credit pipeline shipped in this phase.

The current `app-store.decoder.ts:167` already maps `ONE_TIME_CHARGE` to `noop` — that behavior is unchanged this phase. Apple consumable purchases will silently succeed at the platform layer but credit no lives until 2E.12 lands.

### 4.5 Decrement flow (drains bonus first)

`LivesRepository.tryDecrement(userId, now)`:

1. Ultra bypass: unchanged (if Ultra, return ok+max with no DB write).
2. **Atomic UPDATE attempt #1**: try to decrement `bonus_lives` if `bonus_lives > 0`:
   ```sql
   UPDATE "user"
   SET bonus_lives = bonus_lives - 1
   WHERE id = $1 AND bonus_lives > 0
   RETURNING lives, bonus_lives, livesLastRegenAt
   ```
   If a row is returned → ok. Skip to return.
3. **Atomic UPDATE attempt #2** (only if #1 affected 0 rows): existing regen-pool decrement, unchanged.

This makes purchased lives strictly preferred over regen-pool lives. From the user's perspective, the displayed `total = lives + bonusLives` decreases by 1 either way.

### 4.6 GET /users/me/lives response shape

Add `bonusLives: z.number().int().nonnegative()` to `LivesResponseSchema`. The response now returns `{ lives, maxLives, bonusLives, nextRegenAt, isUltra }`. `lives + bonusLives` is what the client displays as the visible counter.

## 5. Public surface

- `POST /billing/lives-pack/redeem` (auth) — body `{ provider: "google_play", purchaseToken, productId }`. Idempotent. Returns `{ bonusLivesAdded, bonusLivesAfter }`.
- `GET /users/me/lives` (existing) — response shape extended with `bonusLives` field.
- Any route that calls `tryDecrement` (e.g., the session-answer route) — response shape extended with `bonusLivesAfter` so clients can update display without a refetch.

## 6. Idempotency and races

- `lives_purchase.(provider, transaction_id)` UNIQUE → second insert returns null, the credit pipeline returns `{ bonusLivesAdded: 0 }`. Both pre-acknowledge and post-acknowledge retries are safe.
- Apple sends `ONE_TIME_CHARGE` once per purchase (Apple's docs); we still defensively dedup on `transactionId`.
- Two clients calling `/redeem` for the same `purchaseToken` concurrently: `insertPurchase` uses `ON CONFLICT DO NOTHING`; only one wins, the other returns null → `{ bonusLivesAdded: 0 }`. The second response is a successful no-op.
- Decrement race: `bonus_lives > 0` predicate-in-WHERE is atomic; two concurrent decrements correctly only decrement once when `bonus_lives = 1`.

## 7. Failure modes

| Cause | Response | Side effect |
|---|---|---|
| Unknown `productId` (not in LIVES_PACK_SKUS) | 400 Zod validation | none |
| Google: `purchaseState !== 0` | 422 | log |
| Google: API auth fails (no creds, 401) | 503 — same as billing-disabled posture | log ERROR |
| Google: `acknowledge` fails | 422 — DO NOT credit lives (user gets refunded by Google after 3 days) | log ERROR |
| Google: ack succeeds but DB credit TX fails (network partition / FK violation) | 500 | **CRITICAL ERROR log** with `{userId, purchaseToken, productId, livesGranted}`. Unrecoverable automatically — operator must manually credit. Add `app-store-acked-but-uncredited` alert pattern to runbook. |
| Duplicate `purchaseToken` | 200, `bonusLivesAdded: 0` | none |
| `creditLivesPack` for FK-violating user id | 500 | log ERROR (CASCADE means user deleted mid-flow; same recovery pattern as above) |

## 8. Testing strategy

### 8.1 Unit

- `lives-packs.service.test.ts`:
  - Google happy path: API validates `purchaseState=0`, ack succeeds, credit succeeds, returns correct shape.
  - Google `purchaseState=1` → 422.
  - Google ack failure → 422 + no credit.
  - Google idempotency: second redeem for same purchaseToken returns `bonusLivesAdded: 0`.
  - Apple `ONE_TIME_CHARGE` happy path → credit.
  - Apple missing `appAccountToken` → no credit, audit-only return.
  - Apple unknown SKU → no credit, audit return.

### 8.2 Integration (real Postgres)

- `lives-packs.repository.integration.test.ts`:
  - `insertPurchase` first call inserts; second with same `(provider, txnId)` returns null.
  - `findByTxn` returns row when exists.
- `lives.repository.integration.test.ts` (extend existing):
  - `tryDecrement` drains `bonus_lives` first when `bonus_lives > 0`.
  - `tryDecrement` falls back to regen-pool when `bonus_lives = 0`.
  - Concurrent decrements with `bonus_lives = 1` race correctly: exactly one wins, the other falls back to regen-pool decrement.

### 8.3 Route integration

- `POST /billing/lives-pack/redeem` returns 401 unauthenticated.
- Returns correct shape on happy path.
- Idempotent (2nd call returns `bonusLivesAdded: 0`).

### 8.4 Cache invalidation

- After successful credit, `GET /users/me/lives` for the same user returns the new `bonusLives` value within the cache window (not the stale pre-purchase value).

## 9. Acceptance criteria

- [ ] `bonus_lives` column added to `user` with default 0.
- [ ] `lives_purchase` table created with UNIQUE on `(provider, transaction_id)`.
- [ ] `POST /billing/lives-pack/redeem` validates purchase via Google API, acknowledges, credits.
- [ ] Redemption is idempotent on retry (duplicate purchaseToken → `bonusLivesAdded: 0`).
- [ ] `tryDecrement` drains `bonus_lives` before regen-pool `lives`.
- [ ] `tryDecrement` returns `bonusLivesAfter` in its success shape.
- [ ] `GET /users/me/lives` exposes `bonusLives`.
- [ ] Failed `acknowledge` does NOT credit (prevents free lives + Google refund).
- [ ] Lives cache invalidated after a successful credit.

## 10. Deferred

- Refund / cancel detection for one-time products (Google `voidedpurchases.list`; Apple sub-only REFUND already handled). Crediting bonus_lives is currently irreversible; a refund flow would deduct.
- `purchases.products.consume` (separate from `acknowledge`) — for "perpetual consumable" model where Google allows re-purchase of same SKU. v1 acks but does not consume; the client purchases a new SKU each time.
- Multi-currency analytics on packs.
- `appAccountToken` ↔ `user.id` mapping table for client-side flexibility (v1 mandates the client embeds user.id directly).
- Promo codes.
