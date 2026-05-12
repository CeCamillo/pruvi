# Phase 2E.7 — Background billing reconciliation sweep (design spec)

**Date:** 2026-05-12
**Branch:** `feature/phase-2e7-billing-reconciliation-sweep`
**Depends on:** Phase 2E.4 (Google Play billing) + 2E.5 (App Store billing). Reuses `subscription` table, `billing_event` table, `BillingRepository`, `BillingService.applyUltraEffect`.

## 1. Problem

Webhook delivery from Google Play Pub/Sub and Apple ASSN V2 is best-effort. Concrete failure modes already observed industry-wide:

- Pub/Sub topic outage / project mis-config drops messages.
- Apple ASSN endpoint returns 5xx — Apple retries up to 24 hours, then gives up.
- A network split between our webhook and the DB commit leaves a row at `status='active'` with `current_period_end` already in the past.

Net effect: the user stays Ultra past actual subscription expiry. Revenue leak + entitlement bug.

## 2. Goal (this phase)

Add a **hourly BullMQ scheduled job** that catches the most common failure: a subscription whose `current_period_end` has clearly passed but is still in an entitlement-granting status. Mark it `expired` and run the existing revoke pipeline.

This phase ships only the **DB-based sweep** — no Google Play / App Store REST calls. Provider-side verification (calling `subscriptionsv2.get` / Apple Server API for ground truth) is a separate, heavier phase (needs service-account credentials, JWT signing, network egress posture, retry/backoff) — **deferred to 2E.8**.

## 3. Out of scope (deferred)

- Provider REST verification (`androidpublisher.purchases.subscriptionsv2.get`, App Store Server `GET /inApps/v1/subscriptions/{transactionId}`).
- Detecting *missed renewals* (a user paid but we never got RENEWED). The DB sweep cannot tell this apart from a true expiry — it conservatively revokes; the next webhook or next app-open with link replays grants.
- Sweeping orphan subscriptions (`user_id IS NULL`) — by definition no entitlement to revoke.
- Re-trying *parked* (`processed_at IS NULL`) events. That's handled by the existing link flow.

## 4. Architecture

Two-tier scope, only tier 1 in this phase:

**Tier 1 (in scope):** DB-only sweep — `current_period_end < now() - GRACE` ⇒ mark `expired` + revoke.

**Tier 2 (deferred):** Provider REST verification before revoke.

### 4.1 Data flow

```
BullMQ repeatable job ("billing-cron" queue, hourly pattern "0 * * * *")
  └─ BillingSweepWorker
       └─ BillingService.runReconciliationSweep({ now })
            ├─ const cutoff = new Date(now.getTime() - GRACE_MS)   // GRACE_MS = 24*60*60*1000, UTC-safe
            ├─ repo.findExpiredCandidates(this.db, cutoff)
            │    → rows where user_id IS NOT NULL
            │            AND status IN ('active','in_grace','canceled')
            │            AND current_period_end IS NOT NULL
            │            AND current_period_end < cutoff
            │    LIMIT 500
            └─ for each candidate row C:
                 effect = await this.db.transaction(async (tx) => {
                   const updated = await repo.expireSubscriptionIfStale(tx, C.id, cutoff)
                     // predicate-in-WHERE: status still in set AND end still < cutoff
                     // returns the row when the UPDATE actually fired, null otherwise
                   if (!updated) return { kind: "none" }
                   const audit = await repo.insertEvent(tx, {
                     provider: updated.provider,            // copied verbatim from swept row (enum-safe)
                     messageId: `sweep:${updated.id}:${cutoff.toISOString()}`,
                     eventType: "SWEEP_EXPIRED",
                     purchaseToken: updated.purchaseToken,
                     payload: { kind: "sweep", subId: updated.id, previousStatus: C.status, currentPeriodEnd: updated.currentPeriodEnd?.toISOString() ?? null, ranAt: now.toISOString() },
                   })
                   if (!audit) return { kind: "none" }      // concurrent worker already wrote it; do not double-count
                   await repo.markEventProcessed(tx, audit.id)
                   return { kind: "revoke_if_no_other_active", userId: updated.userId!, excludeSubscriptionId: updated.id }
                 })
                 await this.applyUltraEffect(effect)         // outside the TX, against this.db — two-phase commit
            return { scanned, expired, revoked }
```

**Ordering is load-bearing:** `expireSubscriptionIfStale` + `insertEvent` + `markEventProcessed` run inside ONE per-row TX so an audit row is never written without its corresponding status flip (and vice versa). The revoke step (`hasOtherActiveSubscription` check + conditional `ultra.revoke`) runs **after** that TX commits, using the bare `this.db` connection — same two-phase commit pattern as `processGooglePlayEnvelope` (`billing.service.ts:53-92`). Calling the revoke inside the TX would re-introduce the race the two-phase pattern was designed to eliminate.

**Note on `applyUltraEffect`:** webhook flows call the shared `BillingService.applyUltraEffect(effect)` helper. The sweep instead **inlines** the `revoke_if_no_other_active` branch (it never emits `grant`, only `revoke_if_no_other_active` or `none`). Reason: the helper is `void`, but the sweep needs to know whether `ultra.revoke` actually fired to maintain the `revoked` counter that this phase reports for observability. The inlined code MUST stay semantically identical to `applyUltraEffect`'s `revoke_if_no_other_active` branch — same guard query (`hasOtherActiveSubscription`), same `excludeSubscriptionId`, same `ultra.revoke` call. If `applyUltraEffect` ever gains new behavior (metrics, guards), update the inlined block in lock-step.

**Why a synthetic messageId on the audit row?** The `(provider, message_id)` UNIQUE constraint plus `ON CONFLICT DO NOTHING` in `insertEvent` (`billing.repository.ts:40-53`) gives natural idempotency: a concurrent worker writing the same `sweep:<subId>:<isoCutoff>` returns null from `insertEvent`. The sweep treats null as "already audited" and exits this row's TX with `{ kind: "none" }` so we do NOT double-revoke and do NOT double-increment the `expired` counter.

**Why one transaction per row, not one big transaction?** A 500-row batch in a single TX would hold locks for seconds and could deadlock against incoming webhooks. Per-row TX is safe and keeps the sweep concurrent with normal traffic. The job is idempotent at the row level via predicate-in-WHERE.

**Why 24h grace?** Apple retries notifications for up to 24h. We want to avoid revoking a user whose RENEWED is en route. The cost of waiting 24h past `current_period_end` to revoke is one extra day of Ultra at most — acceptable.

**The `provider` field on the audit row** MUST be copied from the swept subscription row. `billing_event.provider` is a Drizzle text-enum constrained to `["google_play","app_store"]` (`packages/db/src/schema/billing.ts:29-31` — same enum as `subscription.provider`). A literal like `"sweep"` will fail TypeScript and Postgres alike. Same enum, same value.

**The `excludeSubscriptionId` passed to `applyUltraEffect`** MUST be the swept sub's actual integer `id`. `hasOtherActiveSubscription` (`billing.repository.ts:171-188`) uses `ne(subscription.id, excludeSubscriptionId)` to filter out the row being revoked. Passing the wrong id (or `0`/`undefined`) would leak the sub itself into the "other active" check and break the multi-sub guard.

### 4.2 Module layout

- `apps/server/src/features/billing/billing.repository.ts` — add `findExpiredCandidates`, `expireSubscriptionIfStale`. Both reuse the existing `Db | Tx` parameter pattern.
- `apps/server/src/features/billing/billing.service.ts` — add `runReconciliationSweep({ now, cutoffMs, batchSize })`. Returns `{ scanned, expired, revoked }` for observability.
- `apps/server/src/workers/billing-sweep.worker.ts` — **new**, mirror of `notifications.worker.ts` pattern (BullMQ Worker that constructs `BillingService` once and wires `runReconciliationSweep`). Registered from `apps/server/src/worker.ts`. Listens on the dedicated `billing-cron` queue (see below).
- `apps/server/src/plugins/queue.ts` — add a **new** `billingSweep: Queue<BillingSweepJobData> | null` entry to the `FastifyInstance['queues']` interface (alongside the existing `sessionPrefetch`, `notificationsCron`, `notificationsSend`). Create a new `billing-cron` queue and register the repeatable job `{ kind: "sweep" }` with cron `0 * * * *`. **Do NOT reuse `notifications-cron`** — it is owned exclusively by the notifications worker (`workers/notifications.worker.ts:41`), which processes `Job<{ kind: "sweep" }>` and dispatches streak reminders; any billing job pushed onto it would be silently consumed by that worker and dropped. A separate queue keeps the two cron pipelines independently scalable and independently failable.

No new env vars, no new tables, no migration.

### 4.3 Two-phase commit fits unchanged

Each row's revoke goes through `applyUltraEffect({ kind: "revoke_if_no_other_active", … })` — same code path as a real EXPIRED webhook. The multi-sub guard from §7.2 of 2E.4 still applies: revoke is skipped if the user has another active subscription (e.g., a Google Play sub on top of an expired App Store sub).

## 5. Public surface

**Internal-only.** No HTTP routes added. No env vars. No migrations.

For observability: the worker logs `{scanned, expired, revoked}` per run. Each swept subscription leaves a `billing_event` audit row, so the existing `billing_event` table is the source of truth for "what did the sweep do last hour?".

## 6. State machine semantics

`expireSubscriptionIfStale` is **strictly narrower** than a normal EXPIRED webhook:

| field | normal EXPIRED webhook | sweep expiry |
|---|---|---|
| `status` after | `expired` | `expired` |
| `current_period_end` after | preserved (was already set by RENEWED) | preserved |
| triggers revoke effect | yes | yes |
| writes `billing_event` audit row | yes (real webhook) | yes (synthetic `SWEEP_EXPIRED`) |

So a downstream RENEWED webhook arriving late (after sweep) re-grants correctly via the normal flow — the sweep does NOT poison the row. The state machine accepts `active → expired → active` transitions.

**This re-grant correctness depends on existing state machine behavior:** `applyDecodedEvent` for `PURCHASED/RENEWED/RECOVERED/RESTARTED` (`billing.service.ts:176-180`) and `applyAppStoreEvent` for `activate` (`billing.service.ts:285-289`) both emit a `grant` effect unconditionally, regardless of prior status. If a future change adds a `prior !== 'expired'` guard to either branch, this sweep's correctness guarantee silently breaks — keep that dependency in mind when touching those lines.

## 7. Race conditions

**Concurrent sweep + webhook for same sub:** the predicate-in-WHERE check (`status IN (...) AND current_period_end < cutoff`) is evaluated by Postgres under the row lock obtained by UPDATE. So if a RENEWED webhook lands a microsecond before the sweep, the WHERE no longer matches and the sweep no-ops. Conversely if the sweep wins, the EXPIRED state is committed first; the RENEWED then transitions back to active. Both orderings are consistent.

**Two sweep workers running concurrently:** the predicate-in-WHERE guarantees only one UPDATE fires per row (the loser sees 0 rows affected and skips). The synthetic messageId collides only if both workers process the same sub in the same second, which Postgres rejects via the UNIQUE on `(provider, message_id)` — handled by `insertEvent` already returning null on conflict.

**Sweep racing the link flow:** sweep only touches `user_id IS NOT NULL` rows; link flow either creates a new linked row or claims an orphan and bumps it from `user_id=NULL` — but by then it has `current_period_end` from the replay or stays as-is. Either way the sweep can act on the linked row in subsequent ticks safely.

## 8. Testing strategy

### 8.1 Unit
- `BillingService.runReconciliationSweep` — mock repo, assert orchestration: scans → expires stale → calls `applyUltraEffect` for each → returns counters. No DB.

### 8.2 Integration (real Postgres via `db-helpers`)
- `findExpiredCandidates` returns active rows whose `current_period_end < cutoff` and `user_id IS NOT NULL`; excludes `user_id=NULL` orphans; excludes `status='expired'`; excludes `status='revoked'`; excludes rows with `current_period_end IS NULL` (including a seeded `status='canceled', currentPeriodEnd=NULL` row to prove the NULL-guard is on the period-end column, not just on a particular status); excludes rows whose end is within the cutoff window (a seeded row at `cutoff + 1s` must NOT match).
- `expireSubscriptionIfStale` flips status and `.returning()` the row when predicate matches; returns null when it doesn't (status already moved or end no longer stale).
- End-to-end `runReconciliationSweep` against a seeded DB with a mix: one stale active (should expire+revoke), one stale-but-other-active-exists (should expire+skip revoke per multi-sub guard), one fresh active (untouched), one already expired (untouched), one orphan (untouched).
- Idempotency: run sweep twice in a row — second run reports `expired: 0`.
- Concurrency: simulate sweep + RENEWED arriving in opposite orders → final state always consistent (no double revoke, no stuck `expired` after RENEWED).

### 8.3 Worker smoke
- Worker boots without REDIS_URL → returns null, no crash (mirror of notifications worker).
- Worker boots with REDIS_URL → registers cron, processes job, returns counters.

## 9. Acceptance criteria

- [ ] Hourly cron registered on a **new** `billing-cron` queue (not `notifications-cron` — see §4.2 for why).
- [ ] Stale `active`/`in_grace`/`canceled` subscriptions with `user_id IS NOT NULL` and `current_period_end < now() - 24h` are flipped to `expired`.
- [ ] Each sweep-expired subscription triggers the existing `revoke_if_no_other_active` path through `applyUltraEffect`.
- [ ] One `billing_event` audit row per swept subscription with `eventType='SWEEP_EXPIRED'`.
- [ ] Sweep is idempotent (second run is a no-op).
- [ ] Sweep does not revoke when the user holds another active subscription.
- [ ] Late RENEWED webhook after sweep correctly re-grants (existing state machine handles it).

## 10. Deferred (next-phase candidates)

- **2E.8 Provider REST verification.** Call `subscriptionsv2.get` / Apple Server API before revoke. Removes the missed-RENEWED edge case. Requires service-account JSON + Apple in-app purchase signing key.
- **Sweep metrics.** Emit Prometheus / OTel counters: `billing_sweep_scanned`, `billing_sweep_expired`, `billing_sweep_revoked`.
- **Per-provider grace tuning.** Apple gives 60-day billing grace; Google up to 30. Could lengthen GRACE to 7 days to reduce false-positive revokes at the cost of more days of free Ultra.
