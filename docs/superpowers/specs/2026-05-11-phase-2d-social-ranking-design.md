# Phase 2D — Social: Friendships, Invitations, Weekly Ranking (Design Spec)

**Date:** 2026-05-11
**Phase:** 2D
**Source spec:** `pruvi-freatures.md` §4.1 (Ranking de amigos — Essencial), §4.2 (Convite de amigos — Importante). §4.3 (Compartilhamento de resultado) is purely client-side and OUT OF SCOPE.

## Goal

Ship the social backend: friendships, friend-search-by-username, personal invite codes with reward-on-acceptance, and a weekly XP ranking limited to a user's friends. All endpoints type-safe, integration-tested, scoped to the user.

## Non-goals

- "Overtaken" push notification (spec 4.1 calls for *"O Pedro acabou de te passar"*). Defer to a follow-up — requires per-XP-event ranking diff, expensive; not blocking the ranking screen itself.
- Result-sharing card (4.3) — client-side canvas.
- Streak shield as invite reward — spec says "+100 XP **or** 1 escudo de streak"; shield doesn't exist yet (Phase 2E+). MVP awards +100 XP only.
- Username editing UI (frontend rebuild owns).
- Block/report flow.
- Global / cohort-wide ranking — explicitly out of spec ("não é ranking global").
- Backfill of invite codes for existing users via a separate job — the migration backfills inline.

## Data Model

### `user` table extensions

```sql
+ username     text NULL UNIQUE                  -- nullable; user sets later
+ invite_code  text NOT NULL UNIQUE              -- backfilled in migration
+ INDEX user_username_lower_idx ON LOWER(username) WHERE username IS NOT NULL  -- case-insensitive search
```

**Username:** nullable for backwards compat with existing users. Frontend prompts users to set one when they first hit the friends screen. Validation: `^[a-z0-9_]{3,20}$` (lowercase + digits + underscore). Stored as lowercase canonical to keep search free of case-folding subtleties.

**Invite code:** 8 lowercase alphanumeric chars (excluding ambiguous `0`, `o`, `1`, `l`, `i`). Generated at user creation (better-auth post-hook or first-touch lazy fill — see "Code generation" below). UNIQUE to allow direct lookup. The shareable URL is constructed client-side as `https://pruvi.app/i/{code}` — the backend only stores the bare code.

### New table: `friendship`

```sql
CREATE TABLE friendship (
  id            serial PRIMARY KEY,
  requester_id  text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  recipient_id  text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  status        text NOT NULL CHECK (status IN ('pending','accepted','declined')),
  created_at    timestamp NOT NULL DEFAULT now(),
  accepted_at   timestamp,
  CHECK (requester_id <> recipient_id)
);
CREATE UNIQUE INDEX friendship_pair_idx
  ON friendship (LEAST(requester_id, recipient_id), GREATEST(requester_id, recipient_id));
CREATE INDEX friendship_requester_idx ON friendship (requester_id);
CREATE INDEX friendship_recipient_idx ON friendship (recipient_id);
```

**Why pair-ordered uniqueness:** stores one row per relationship while preserving direction (`requester_id`). Searches "all friends of X" by `(requester_id = X OR recipient_id = X) AND status = 'accepted'`. A declined request blocks re-requesting the same pair until deleted — that's intentional in MVP (UX redirects to "send again" which DELETEs + INSERTs).

**No `blocked` state in MVP:** keep enum to 3 values. Block is a phase-3 concern.

### New table: `invitation_acceptance`

```sql
CREATE TABLE invitation_acceptance (
  id           serial PRIMARY KEY,
  inviter_id   text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  invitee_id   text NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
  accepted_at  timestamp NOT NULL DEFAULT now()
);
CREATE INDEX invitation_acceptance_inviter_idx ON invitation_acceptance (inviter_id);
```

`invitee_id` UNIQUE — a user can be invited only once (the first signup via a code wins; subsequent code-redemption attempts no-op). `inviter_id` indexed for the "your invitees" screen later.

### `review_log` extension

```sql
+ xp_earned  integer NOT NULL DEFAULT 0
+ CHECK (xp_earned >= 0)
+ INDEX review_log_user_reviewed_idx ON (user_id, reviewed_at)  -- if not already present
```

The existing answer flow calls `calculateXpForAnswer(correct, difficulty)` and adds it to `user.total_xp`. We capture the same value per-row at insert time so we can sum by time window. Old rows default to `0` — they don't count toward weekly XP, which is acceptable (rolling window naturally ages out old data).

The existing index `review_log_user_next_review_idx` is on `(user_id, next_review_at)` — not what we need. Add `(user_id, reviewed_at)` for the weekly-sum query.

## Architecture

### Feature modules

```
apps/server/src/features/social/
  invite-codes/
    generator.ts            # pure: generate(): string (lowercase alnum, ambiguity-free)
    generator.test.ts
  invitations/
    invitations.repository.ts
    invitations.service.ts
    invitations.route.ts    # POST /invitations/accept
    invitations.service.test.ts
    invitations.repository.integration.test.ts
  friendships/
    friendships.repository.ts
    friendships.service.ts
    friendships.route.ts    # /users/me/friends/* CRUD
    friendships.service.test.ts
    friendships.repository.integration.test.ts
  ranking/
    weekly.ts               # pure: startOfWeekBrt(now): Date (Monday 00:00 BRT)
    weekly.test.ts
    ranking.repository.ts
    ranking.service.ts
    ranking.route.ts        # GET /users/me/friends/ranking
    ranking.service.test.ts
    ranking.repository.integration.test.ts
  index.ts                  # aggregates routes
```

### Code generation

`generator.ts` exports a pure `generateInviteCode()` that returns an 8-char string from alphabet `abcdefghjkmnpqrstuvwxyz23456789` (no ambiguity). The service-layer wrapper handles collision: try insert, on UNIQUE-violation regenerate (max 5 tries, then throw).

**When to assign:** on first authenticated request that needs it (lazy). Specifically: the migration backfills existing users; new users get a code via a `users.repository.ensureInviteCode(userId)` helper called by the invite endpoint (and any new sign-up post-hook we add later). For MVP we don't touch better-auth's hooks — laziness is fine because the first user-visible action requiring a code is opening the friends screen.

Actually the cleanest path: migration backfills ALL existing users; we also wire `ensureInviteCode` as the first line of `GET /users/me/invite` so a user without one (shouldn't happen post-migration but defensive) gets one.

### Weekly XP query

`startOfWeekBrt(now: Date): Date` is pure — given any instant, return the Monday-00:00:00 BRT timestamp (as a UTC Date). Used both server-side (to filter `review_log.reviewed_at`) and as the explicit boundary in the ranking response.

```typescript
// pseudocode
const offsetMs = 3 * 3600 * 1000; // BRT = UTC-3
const brt = new Date(now.getTime() - offsetMs);
const dayOfWeek = brt.getUTCDay(); // 0=Sun, 1=Mon, ...
const daysToSubtract = (dayOfWeek + 6) % 7; // back to Monday
brt.setUTCDate(brt.getUTCDate() - daysToSubtract);
brt.setUTCHours(0, 0, 0, 0);
return new Date(brt.getTime() + offsetMs); // back to UTC
```

The ranking query:

```sql
WITH friends AS (
  SELECT CASE WHEN requester_id = $userId THEN recipient_id ELSE requester_id END AS friend_id
  FROM friendship
  WHERE (requester_id = $userId OR recipient_id = $userId) AND status = 'accepted'
)
SELECT
  u.id, u.name, u.username, u.image,
  COALESCE(SUM(rl.xp_earned), 0)::int AS weekly_xp
FROM "user" u
LEFT JOIN review_log rl ON rl.user_id = u.id AND rl.reviewed_at >= $weekStart
WHERE u.id = $userId OR u.id IN (SELECT friend_id FROM friends)
GROUP BY u.id, u.name, u.username, u.image
ORDER BY weekly_xp DESC, u.id ASC;
```

We include the requesting user in the ranking (they see themselves). The "top 10 closest to me" trim happens in the service layer after the SQL: find the requesting user's index, take ±5 neighbors capped at 10 total. If <11 friends total, return all sorted.

**Trim rule:** the screen shows at most 10 ranked entries; the requesting user is one of them; the other 9 are the friends closest in XP (5 above + 4 below, or fewer if at the edges). This matches spec §4.1 "Máximo visível: os 10 amigos mais próximos em XP".

## API surface

All endpoints require auth, return `{ success: true, data: ... }`.

### Invitations

**`GET /users/me/invite`**

```json
{ "code": "ab2k7nqp", "url": "https://pruvi.app/i/ab2k7nqp" }
```

`url` constructed using `INVITE_URL_BASE` env (defaults to `https://pruvi.app/i`). Cached `invite:{userId}` 1h.

**`POST /invitations/accept`** — body `{ code: string }`

Behavior:
1. Resolve `code` → `inviter_id`. 404 if not found.
2. Reject if `inviter_id === request.userId` (self).
3. Reject if `invitation_acceptance.invitee_id = request.userId` exists (already accepted any invite).
4. In a transaction:
   - `INSERT INTO invitation_acceptance (inviter_id, invitee_id) VALUES ($inviter, $invitee)`
   - `UPDATE "user" SET total_xp = total_xp + 100 WHERE id = $inviter`
   - `INSERT INTO friendship (requester_id, recipient_id, status, accepted_at) VALUES ($inviter, $invitee, 'accepted', now()) ON CONFLICT (LEAST(...), GREATEST(...)) DO UPDATE SET status = 'accepted', accepted_at = now()`
5. Response: `{ inviter: { name, username }, xpAwarded: 100, friendshipCreated: true }`.

### Friendships

**`PATCH /users/me/profile`** — body `{ username }`

Sets `user.username` if not already set OR allows changing once (decision: allow one change for MVP — frontend gates the UI; backend accepts any update). Validation: `^[a-z0-9_]{3,20}$`, unique. 409 on collision. (If a profile endpoint already exists in another feature module, extend it instead of creating a new one.)

**`POST /users/me/friends/request`** — body `{ username }`

1. Resolve `username` → target user. 404 if not found.
2. Reject self / already-existing friendship (pending or accepted).
3. INSERT friendship with `status='pending', requester_id = request.userId, recipient_id = target.id`.
4. Response: `{ requestId, recipient: { username, name } }`.

**`GET /users/me/friends/requests`**

Returns incoming pending requests:

```json
{ "incoming": [{ "id": 1, "from": { "id": "u2", "name": "Pedro", "username": "pedro" }, "createdAt": "..." }] }
```

(Outgoing requests are not surfaced in MVP — UX doesn't need them. Decision is reversible later.)

**`PATCH /users/me/friends/requests/:id`** — body `{ action: 'accept' | 'decline' }`

1. Load row, verify `recipient_id = request.userId AND status = 'pending'`. 404 otherwise.
2. UPDATE status accordingly. On accept, set `accepted_at = now()`.
3. Response: `{ status: 'accepted' | 'declined' }`.

**`GET /users/me/friends`**

List of accepted friendships (the other party's `id, name, username, image`).

**`DELETE /users/me/friends/:friendUserId`**

DELETE the friendship row. 204 either way (no enumeration of who-is-friends-with-whom).

### Ranking

**`GET /users/me/friends/ranking`**

```json
{
  "weekStart": "2026-05-11T03:00:00Z",
  "entries": [
    { "userId": "u-self", "name": "...", "username": "...", "image": "...", "weeklyXp": 320, "rank": 1, "isMe": true },
    ...
  ]
}
```

Up to 10 entries, sorted desc by `weeklyXp` then `userId` asc for stable ordering. `weekStart` is the current Monday-00:00 BRT in UTC.

Cached: `ranking:{userId}` 60s. Invalidated when any answer with `xp_earned > 0` is recorded by the user OR by any of their friends — see "Cache invalidation".

## Migration `0006_<name>.sql`

```sql
-- 1. User extensions
ALTER TABLE "user" ADD COLUMN "username" text;
ALTER TABLE "user" ADD COLUMN "invite_code" text;

-- 2. Backfill invite_code for existing users using gen_random_uuid prefix + substring
--    (good-enough randomness for one-time backfill; new users get a generated one).
UPDATE "user"
SET "invite_code" = SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8)
WHERE "invite_code" IS NULL;

-- 3. Enforce NOT NULL + UNIQUE
ALTER TABLE "user" ALTER COLUMN "invite_code" SET NOT NULL;
ALTER TABLE "user" ADD CONSTRAINT "user_invite_code_unique" UNIQUE ("invite_code");
ALTER TABLE "user" ADD CONSTRAINT "user_username_unique" UNIQUE ("username");

-- 4. Username search index (case-insensitive via stored lowercase canonical — but a defensive
--    functional index is cheap and covers any future schema drift)
CREATE INDEX "user_username_lower_idx" ON "user" (LOWER("username"))
  WHERE "username" IS NOT NULL;

-- 5. review_log.xp_earned
ALTER TABLE "review_log" ADD COLUMN "xp_earned" integer NOT NULL DEFAULT 0;
ALTER TABLE "review_log" ADD CONSTRAINT "review_log_xp_earned_chk" CHECK ("xp_earned" >= 0);
CREATE INDEX "review_log_user_reviewed_idx" ON "review_log" ("user_id", "reviewed_at");

-- 6. friendship
CREATE TABLE "friendship" (
  "id" serial PRIMARY KEY,
  "requester_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "recipient_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "status" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "accepted_at" timestamp,
  CONSTRAINT "friendship_status_chk" CHECK ("status" IN ('pending','accepted','declined')),
  CONSTRAINT "friendship_no_self_chk" CHECK ("requester_id" <> "recipient_id")
);
CREATE UNIQUE INDEX "friendship_pair_idx" ON "friendship"
  (LEAST("requester_id", "recipient_id"), GREATEST("requester_id", "recipient_id"));
CREATE INDEX "friendship_requester_idx" ON "friendship" ("requester_id");
CREATE INDEX "friendship_recipient_idx" ON "friendship" ("recipient_id");

-- 7. invitation_acceptance
CREATE TABLE "invitation_acceptance" (
  "id" serial PRIMARY KEY,
  "inviter_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "invitee_id" text NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE CASCADE,
  "accepted_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX "invitation_acceptance_inviter_idx" ON "invitation_acceptance" ("inviter_id");
```

Each `CREATE INDEX` / `ADD CONSTRAINT` wrapped in idempotent DO-blocks (per Phase 2C precedent). Mirror DDL in `packages/db/src/test-client.ts` in lockstep.

## Shared schemas (`packages/shared/src/social.ts`)

- `UsernameSchema = z.string().regex(/^[a-z0-9_]{3,20}$/)`
- `InviteCodeSchema = z.string().regex(/^[a-z0-9]{8}$/)`
- `AcceptInvitationBodySchema`, `RequestFriendBodySchema`, `RespondRequestBodySchema`, `UpdateProfileBodySchema`
- Response schemas: `InviteLinkResponseSchema`, `FriendListResponseSchema`, `RequestListResponseSchema`, `RankingResponseSchema`

## Service-layer integration with reviews

`reviews.service.completeAnswer`:
- Already calls `repo.awardXp(userId, xpAwarded)` to bump `user.total_xp`.
- Add: `xp_earned: xpAwarded` to the `insertReview` payload (existing INSERT to `review_log`).
- Add: fire `cacheInvalidate(['ranking:friends-of:{userId}'])` — see cache section.

No other behavior changes in `reviews.service`. The overtaken-notification hook is deferred.

## Cache invalidation

Ranking is cached `ranking:{userId}` 60s. When user X earns XP, all friends of X must drop their cached ranking too (their ranking includes X). On answer:

```typescript
// fire-and-forget after awardXp
cache.del(`ranking:${userId}`);
const friendIds = await friendshipsRepo.listAcceptedFriendIds(userId);
await Promise.all(friendIds.map(fid => cache.del(`ranking:${fid}`)));
```

If Redis isn't configured (local dev), this is a no-op. Hot-path overhead is one extra SELECT + N DELs per answer — friend lists are tiny in MVP, acceptable.

## Testing strategy

### Unit (Vitest)

- `generator.test.ts` — produces 8 chars, alphabet membership, distribution sanity check (10k samples have no duplicates within sample).
- `weekly.test.ts` — Monday-noon BRT input → returns same Monday 00:00 BRT; Sunday 23:59 BRT → returns 6 days prior; UTC midnight Tuesday → returns the prior Monday 00:00 BRT in UTC.
- `invitations.service.test.ts` — self-invite rejected; already-accepted invitee rejected; transaction wraps invite+XP+friendship; +100 XP applied.
- `friendships.service.test.ts` — self-request rejected; duplicate-pending rejected; accept/decline state transitions; unfriend deletes.
- `ranking.service.test.ts` — trim logic (>10 friends: pick ±5 around me; <11: return all; me-not-in-result is impossible).

### Integration (PGlite via existing `db-helpers`)

- `invitations.repository.integration.test.ts` — invite-code lookup, invitee-once UNIQUE constraint.
- `friendships.repository.integration.test.ts` — pair-uniqueness via LEAST/GREATEST index, no-self-friendship CHECK.
- `ranking.repository.integration.test.ts` — seed users + review_log rows across two weeks; assert weekly query returns only current-week XP for friends-only.
- CHECK-constraint coverage: `friendship_status_chk`, `friendship_no_self_chk`, `review_log_xp_earned_chk`, `user_username_unique`.

## Acceptance criteria

- Migration `0006` applies cleanly + `verify:migration` passes
- 10 endpoints live + type-safe + integration-tested
- Weekly ranking returns correct top-10 trim around the requesting user
- `xp_earned` populated on every `review_log` insert (existing flow)
- All unit + integration tests pass; new tests cover edge cases above
- Zero new typecheck errors (pre-existing `sm2.test.ts` debt remains, untouched)
- Worker boots clean

## Deferred (explicit follow-ups)

- **Overtaken push notification (§4.1):** needs per-XP-event delta + dispatcher hook. Cost: one rank-position diff per answer + a push payload. Defer to Phase 2D.1 or fold into 2E.
- **Outgoing-request visibility:** UX-driven; add when frontend asks.
- **Invite-shield reward:** depends on streak-shield (Ultra phase).
- **Block / report:** phase 3 (post-launch).
- **Username case-folding edge cases:** stored lowercase; the functional index is belt-and-suspenders.

---

*End of spec.*
