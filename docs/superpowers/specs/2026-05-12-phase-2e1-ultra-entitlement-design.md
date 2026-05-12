# Phase 2E.1 — Ultra Entitlement Scaffolding (Design Spec)

**Date:** 2026-05-12
**Phase:** 2E.1 (first slice of the Ultra/monetization phase)
**Source spec:** `pruvi-freatures.md` §5.1 (Pruvi Ultra: vidas ilimitadas, badge Ultra, billing via Google Play / App Store)

## Goal

Ship the server-side scaffolding for "is this user Ultra?": the column, the entitlement helper, the unlimited-lives perk, and the `isUltra` flag in the ranking response so the frontend can render the badge. Make it easy to grant/revoke Ultra in QA without a billing platform wired up.

## Non-goals (deferred to 2E.2 / 2E.3 / 2E.4)

- **Streak shield mechanics** (2E.2): monthly refill cron, auto-use on streak break.
- **Simulado semanal** (2E.3): new question-selection path, simulado table, performance comparison.
- **Google Play RTDN / App Store Server Notifications V2 webhooks** (2E.4): real billing integration. Out of scope here because Apple Developer credentials aren't available yet (open product item) and Google credentials need their own setup.
- **Ad-removal logic** — there are no ads in the codebase yet.
- **Receipt validation / cryptographic verification of billing platform tokens.**
- **Rate-limited grant/revoke UI** for admin operations.
- **Ultra-tier price changes** — the column doesn't track plan or price; just `is_ultra` + `ultra_expires_at`.

## Data Model

### `user` extensions

```sql
+ is_ultra            boolean NOT NULL DEFAULT false
+ ultra_expires_at    timestamp                              -- NULL = lifetime, but in practice always set when is_ultra=true
+ CHECK (ultra_expires_at IS NULL OR is_ultra = true)        -- can't have an expiry without being Ultra
```

**Why two fields:** `is_ultra` is the read-fast boolean for hot-path gating (every answer / every ranking entry). `ultra_expires_at` lets us schedule expiry without a cron — the entitlement helper compares `now() < ultra_expires_at` and treats expired-but-flagged users as non-Ultra (defensive). The DB also gets a daily cleanup job in 2E.4 to flip `is_ultra=false` once `ultra_expires_at < now()`, but reads don't depend on that cleanup running on time.

**Why not a separate `subscription` table:** for MVP, Ultra is binary (you have it or you don't). When we add tier variants (e.g. annual vs monthly, family plan), a `subscription` table makes sense. Premature now.

## Architecture

### Feature module

```
apps/server/src/features/ultra/
  ultra.repository.ts        # get(userId), grant(userId, expiresAt), revoke(userId)
  ultra.service.ts           # isUltra(userId), grantUltra(...), revokeUltra(...)
  ultra.route.ts             # admin grant/revoke endpoints (token-gated for QA)
  ultra.service.test.ts
  ultra.repository.integration.test.ts
```

### `UltraService.isUltra(userId)` semantics

```typescript
async isUltra(userId: string): Promise<boolean> {
  const row = await this.repo.get(userId);
  if (!row?.isUltra) return false;
  if (row.ultraExpiresAt && row.ultraExpiresAt < new Date()) return false;
  return true;
}
```

The expiry check is defensive — even if `is_ultra=true` lingers after expiry, reads treat the user as non-Ultra. This decouples correctness from the daily cleanup job.

## Hot-path integration

### Lives bypass

Ultra users have unlimited lives — wrong answers do not decrement.

`LivesService.getLives` and `reviews.service.completeAnswer` both need to short-circuit for Ultra.

**Approach: read `is_ultra` alongside lives** in `LivesRepository.materializeRegen` and `getUserLives`. Single SELECT, no extra round-trip.

```typescript
// LivesRepository
async getUserLives(userId: string) {
  const rows = await this.db
    .select({
      lives: user.lives,
      livesLastRegenAt: user.livesLastRegenAt,
      isUltra: user.isUltra,
      ultraExpiresAt: user.ultraExpiresAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return rows[0] ?? null;
}
```

`materializeRegen` becomes:

```typescript
async materializeRegen(userId, now) {
  const row = await this.getUserLives(userId);
  if (!row) return { lives: MAX_LIVES, lastRegenAt: null, isUltra: false };
  const ultra = row.isUltra && (!row.ultraExpiresAt || row.ultraExpiresAt > now);
  if (ultra) return { lives: MAX_LIVES, lastRegenAt: null, isUltra: true };
  // ... existing regen logic ...
  return { lives: snap.lives, lastRegenAt: snap.lastRegenAt, isUltra: false };
}
```

`tryDecrement` likewise:

```typescript
async tryDecrement(userId, now): Promise<{ ok: true; livesAfter: number; lastRegenAt: Date | null; isUltra: boolean } | { ok: false }> {
  // Check Ultra status first; if Ultra, return ok with sentinel lives = MAX
  const row = await this.getUserLives(userId);
  if (row?.isUltra && (!row.ultraExpiresAt || row.ultraExpiresAt > now)) {
    return { ok: true, livesAfter: MAX_LIVES, lastRegenAt: null, isUltra: true };
  }
  // ... existing atomic UPDATE ...
}
```

**Why not gate at service layer:** keeping the gate in the repository ensures every caller of `tryDecrement` is consistent. A future call site won't accidentally bypass the gate.

**Race window:** there's a microsecond window where `is_ultra` flips false between the read and the atomic UPDATE. Worst case: Ultra-user loses a life right after their subscription ends. Acceptable.

### `LivesService.getLives` response

Add `unlimited: boolean` to the response shape:

```typescript
{ lives: number, maxLives: number, resetsAt: Date | null, unlimited: boolean }
```

Ultra users get `unlimited: true, lives: 5 (sentinel), maxLives: 5, resetsAt: null`. Frontend renders ∞ when `unlimited` is true.

### Ranking response

`RankingEntrySchema` gets `isUltra: z.boolean()`. The ranking SQL already groups by user fields — add `u.is_ultra` to the select + group-by clauses. Service maps the SQL field to the response.

```typescript
// In ranking.repository.ts SQL:
SELECT u.id AS user_id, u.name, u.username, u.image, u.is_ultra,
       COALESCE(SUM(rl.xp_earned), 0)::int AS weekly_xp
...
GROUP BY u.id, u.name, u.username, u.image, u.is_ultra
```

`RankingEntry.isUltra` reflects the column as-is (no expiry check) — the daily cleanup keeps it accurate. The ranking is cached 60s so a recently-expired Ultra would briefly show the badge; acceptable.

## API surface

### Admin grant / revoke (QA-only for MVP)

Gated by env-based admin token (`X-Admin-Token` header matches `ADMIN_API_TOKEN` env var). Returns 401 if missing or mismatched.

**`POST /admin/users/:userId/ultra`** body `{ expiresAt: ISO-string }`

Grants Ultra. Sets `is_ultra=true, ultra_expires_at=...`. Idempotent: re-granting extends/replaces the expiry.

**`DELETE /admin/users/:userId/ultra`**

Revokes Ultra. Sets `is_ultra=false, ultra_expires_at=NULL`.

These let QA flip users without a billing platform. The real billing-webhook endpoint (Phase 2E.4) will call the same service methods internally.

### User-facing entitlement check

**`GET /users/me/ultra`**

```json
{ "isUltra": true, "expiresAt": "2026-06-12T00:00:00Z" }
```

Cached `ultra:{userId}` 60s. Invalidated on grant/revoke. Frontend uses this for the profile-screen Ultra badge / "subscribe" CTA.

## Migration `0007_<name>.sql`

```sql
-- Idempotent ADD COLUMN
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_ultra" boolean NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ultra_expires_at" timestamp;

-- Defensive CHECK: can't have an expiry without being Ultra
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_ultra_expiry_chk') THEN
    ALTER TABLE "user" ADD CONSTRAINT "user_ultra_expiry_chk"
      CHECK ("ultra_expires_at" IS NULL OR "is_ultra" = true);
  END IF;
END $$;

-- Index for the future daily-cleanup query (Phase 2E.4): WHERE is_ultra = true AND ultra_expires_at < now()
CREATE INDEX IF NOT EXISTS "user_ultra_expiry_idx" ON "user" ("ultra_expires_at") WHERE "is_ultra" = true;
```

Mirror DDL in `packages/db/src/test-client.ts`.

## Shared schemas (`packages/shared/src/ultra.ts`)

```typescript
export const UltraStatusSchema = z.object({
  isUltra: z.boolean(),
  expiresAt: z.string().datetime().nullable(),
});

export const GrantUltraBodySchema = z.object({
  expiresAt: z.string().datetime(),
});
```

Extend `LivesResponseSchema` to add `unlimited: z.boolean()`.
Extend `RankingEntrySchema` to add `isUltra: z.boolean()`.

## Env

`packages/env/src/server.ts` adds:
- `ADMIN_API_TOKEN: z.string().min(16).optional()` — when present, admin endpoints are enabled. When absent (e.g. prod with no admin tooling yet), the routes return 503 to avoid an accidental open backdoor.

## Testing strategy

### Unit (Vitest)

- `ultra.service.test.ts` — `isUltra` returns true for non-expired Ultra, false for expired-but-flagged, false for never-Ultra, false for null user; grant/revoke delegate to repo.
- `lives.service.test.ts` — extend: Ultra user receives `{ lives: MAX, unlimited: true, resetsAt: null }`.
- `reviews.service.test.ts` — extend: Ultra user gets `tryDecrement` success path even on wrong answer (no decrement actually happens but service treats result as ok).
- `ranking.service.test.ts` — extend: assert `isUltra` on each entry reflects the seeded value.

### Integration (PGlite)

- `ultra.repository.integration.test.ts` — grant sets columns, revoke clears, get returns expected shape.
- `lives.repository.integration.test.ts` — extend: Ultra user `tryDecrement` returns ok without UPDATE actually decrementing `lives` column.
- `ranking.repository.integration.test.ts` — extend: ranking includes Ultra flag.
- `user CHECK constraint`: setting `ultra_expires_at` without `is_ultra=true` throws.

## Acceptance criteria

- Migration `0007` applies cleanly + `verify:migration` passes
- `is_ultra` + `ultra_expires_at` columns on user with CHECK constraint
- `UltraService.isUltra(userId)` ships, tested with expiry edge cases
- `LivesService.getLives` returns `unlimited: true` for Ultra
- `LivesRepository.tryDecrement` no-ops for Ultra users (no actual decrement)
- Ranking response includes `isUltra` per entry
- Admin grant/revoke endpoints work when `ADMIN_API_TOKEN` is set; return 503 when not
- `GET /users/me/ultra` returns current entitlement
- All existing tests + new tests pass
- Worker boots clean

## Deferred (followed up in subsequent phases)

- **Streak shield (§5.3)** → Phase 2E.2: monthly refill, auto-use logic.
- **Simulado semanal (§5.2)** → Phase 2E.3: question-selection variant, simulado table, performance comparison.
- **Real billing webhooks (Google Play RTDN, App Store SS Notifications V2)** → Phase 2E.4: depends on Apple/Google credentials.
- **Ultra-badge UI in profile screen** → frontend rebuild owns.
- **Plan tier variants (annual, family)** → out of scope, requires `subscription` table.
- **Receipt re-verification cron** → 2E.4.

---

*End of spec.*
