# Phase 2D.1 — Overtaken Push Notification (Design Spec)

**Date:** 2026-05-12
**Phase:** 2D.1 (follow-up to Phase 2D)
**Source spec:** `pruvi-freatures.md` §4.1: *"Notificação quando alguém te ultrapassa: 'O Pedro acabou de te passar no ranking!'"*

## Goal

Fire a push notification to user B when user A's weekly XP increment causes them to cross over B's weekly XP in the ranking. Closes the explicit deferred item from Phase 2D.

## Non-goals

- Streak/rank-summary digest notifications.
- Notification when *I* overtake someone (only the overtaken party gets notified — per spec).
- A separate `overtaken_notifications_enabled` preference column (use the existing `achievement_notifications_enabled` for MVP; split later if user research demands).
- Frontend UI for opt-out (frontend rebuild handles).
- Cohort-wide / non-friend overtake detection.
- Sub-minute coalescing (rapid back-and-forth answers may fire multiple pushes — acceptable for MVP).

## Detection model

**The signal:** user A earns `xpAwarded` (> 0) on an answer, transitioning from `previousWeeklyXp` to `newWeeklyXp = previousWeeklyXp + xpAwarded`. Any friend B whose weekly XP falls in the half-open interval `[previousWeeklyXp, newWeeklyXp)` was just overtaken by A.

**Why a half-open interval:**
- Lower bound inclusive (`>= previousWeeklyXp`): if B was tied with A before, A's increment puts A ahead → B was overtaken.
- Upper bound exclusive (`< newWeeklyXp`): if B has weekly XP exactly equal to A's new value, they're tied — not overtaken.

**Atomicity caveat:** between the `awardXp` UPDATE and the friend-weekly-XP SELECT, B may have answered too. We accept this race: the worst outcome is a phantom or missed notification on a millisecond-scale tie. The query reads B's current state, which is by definition correct.

## Architecture

### New repository method on `FriendshipsRepository`

```typescript
async findOvertakenFriendIds(
  userId: string,
  weekStart: Date,
  previousWeeklyXp: number,
  newWeeklyXp: number,
): Promise<Array<{ friendId: string; weeklyXp: number }>>
```

Single SQL:

```sql
WITH friends AS (
  SELECT CASE WHEN requester_id = $userId THEN recipient_id ELSE requester_id END AS friend_id
  FROM friendship
  WHERE (requester_id = $userId OR recipient_id = $userId) AND status = 'accepted'
)
SELECT f.friend_id, COALESCE(SUM(rl.xp_earned), 0)::int AS weekly_xp
FROM friends f
LEFT JOIN review_log rl
  ON rl.user_id = f.friend_id AND rl.reviewed_at >= $weekStart
GROUP BY f.friend_id
HAVING COALESCE(SUM(rl.xp_earned), 0) >= $previousWeeklyXp
   AND COALESCE(SUM(rl.xp_earned), 0) < $newWeeklyXp
```

### Hook in `reviews.service.completeAnswer`

After `awardXp` succeeds AND `xpAwarded > 0`, fire-and-forget:

```typescript
if (xpAwarded > 0 && this.dispatcher) {
  const weekStart = startOfWeekBrt(new Date());
  void this.maybeNotifyOvertakenFriends(userId, weekStart, xpAwarded).catch((e) =>
    logger.error({ err: e }, "overtaken notification dispatch failed"),
  );
}
```

The internal helper:

1. Computes `newWeeklyXp` by querying current sum (or, optimization: read the `user.total_xp` delta — but weekly XP is its own SUM, not derivable from `total_xp`, so a query is needed).
2. `previousWeeklyXp = newWeeklyXp - xpAwarded`.
3. Calls `friendshipsRepo.findOvertakenFriendIds(...)`.
4. For each result, requests `dispatcher.sendOvertakenNotification(friendId, overtakerName)`.

The "user's current name" is loaded once per answer (or cached on `req.user` if available). The dispatcher reads the friend's prefs and tokens.

### Dispatcher addition

`Dispatcher.sendOvertakenNotification(overtakenUserId: string, overtakerName: string)`:
1. Read `achievement_notifications_enabled` for `overtakenUserId`. If false → skip.
2. Load tokens.
3. Build payload via `templates.overtaken(overtakerName)`.
4. Enqueue `notifications-send` job.

### Template

`templates.ts`:

```typescript
export const overtaken = (overtakerName: string): PushPayload => ({
  title: "Você foi ultrapassado!",
  body: `${overtakerName} acabou de te passar no ranking 🔥`,
});
```

Matches spec voice. PT-BR. No spam — fires only on the precise crossover moment.

### Reviews-service constructor

`ReviewsService` already accepts an optional `dispatcher` and `streaksService` (Phase 2B). Add an optional `friendshipsRepo` constructor arg. When absent (older tests), the hook is a no-op.

### `getCurrentWeeklyXp` helper

A small repository method on `FriendshipsRepository` (or a new `WeeklyXpRepository`):

```typescript
async getWeeklyXp(userId: string, weekStart: Date): Promise<number>
```

Simple SUM. Used by the service for `newWeeklyXp`.

Actually — let's avoid an extra round-trip. The hook can compute previous + new from a single query that also includes the user's own row, but the cleanest factoring is to query once for the user's new weekly XP and once for the overtaken friends. Two SELECTs total, both fast (indexed).

## Push notification preferences

The dispatcher gates on `achievement_notifications_enabled` (existing column). No new pref column for MVP. Spec §4.1 implies the notification is "essencial", so default-on is correct.

## Testing strategy

### Unit (Vitest)

- `templates.test.ts` — `overtaken("Pedro")` returns title + PT-BR body containing "Pedro".
- `dispatcher.test.ts` — `sendOvertakenNotification` bails when prefs disabled; loads tokens; enqueues one send job.
- `reviews.service.test.ts` — extend existing tests:
  - With `dispatcher + friendshipsRepo` injected: on correct answer, `xpAwarded > 0`, the overtaken-notification path is invoked.
  - When `xpAwarded === 0` (wrong answer), the path is NOT invoked.
  - Fire-and-forget: if the path throws, `completeAnswer` still returns ok.

### Integration (PGlite)

- `friendships.repository.integration.test.ts` — extend with `findOvertakenFriendIds` cases:
  - User has 3 friends; previous=20, new=50; friend at 25 is returned; friend at 50 is NOT (upper bound exclusive); friend at 15 is NOT.
  - Edge case: previous=0, new=10 → matches friend at 0 (lower bound inclusive).
  - Non-friend with weekly_xp in range is excluded.

## Acceptance criteria

- `findOvertakenFriendIds` repository method shipped + unit + integration tests
- `dispatcher.sendOvertakenNotification` shipped + unit test
- `templates.overtaken` shipped + unit test
- `reviews.service.completeAnswer` invokes the hook fire-and-forget on `xpAwarded > 0`
- `achievement_notifications_enabled` correctly gates dispatch
- All existing tests still pass
- `pnpm check-types` clean for production code
- `pnpm verify:migration` clean (no migration in this phase)

## Open questions (resolved)

- **Should we de-duplicate overtake notifications within a session?** No. Each genuine crossover is a discrete moment. If A passes B, falls back, passes again — that's two events worth notifying. Spam concern is theoretical; per-answer XP is bounded (3-12 XP), so multi-crossover within one answer would only happen across a tightly-packed leaderboard.
- **Display name source?** Use `user.name` (already populated by better-auth). If null, fall back to "Alguém". Both unlikely-edge handled in the dispatcher.

---

*End of spec.*
