# Phase 2D.1 — Overtaken Push Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fire a push notification to user B when user A's answer-XP-increment causes A's weekly XP to cross above B's.

**Architecture:** Add `findOvertakenFriendIds` to `FriendshipsRepository` (single SQL with HAVING on the weekly-XP sum in `[previousWeeklyXp, newWeeklyXp)`). Add `getWeeklyXp` helper. Add `templates.overtaken` + `dispatcher.sendOvertakenNotification`. Wire as a fire-and-forget hook in `reviews.service.completeAnswer` after a successful `awardXp` when `xpAwarded > 0`.

**Tech Stack:** Drizzle ORM, Vitest, PGlite (integration), neverthrow, BullMQ (existing `notifications-send` queue), Expo SDK.

**Source spec:** `docs/superpowers/specs/2026-05-12-phase-2d1-overtaken-notification-design.md`

---

## File Structure

**Modify:**
- `apps/server/src/features/social/friendships/friendships.repository.ts` — add `findOvertakenFriendIds`, `getWeeklyXp`
- `apps/server/src/features/social/friendships/friendships.repository.integration.test.ts` — add integration tests for the new methods
- `apps/server/src/features/notifications/templates.ts` — add `overtaken(name)` builder
- `apps/server/src/features/notifications/templates.test.ts` — cover the new template
- `apps/server/src/features/notifications/dispatcher.ts` — add `sendOvertakenNotification(overtakenUserId, overtakerName)`
- `apps/server/src/features/notifications/dispatcher.test.ts` — cover prefs-gating + token-load + enqueue
- `apps/server/src/features/reviews/reviews.service.ts` — inject `friendshipsRepo`; add fire-and-forget hook
- `apps/server/src/features/reviews/reviews.service.test.ts` — cover hook invocation on xp > 0, no-op on xp = 0, fire-and-forget swallows errors
- `apps/server/src/features/reviews/reviews.route.ts` — wire `friendshipsRepo` into ReviewsService constructor

---

## Tasks

### Task 1: Repository methods

**Files:**
- Modify: `apps/server/src/features/social/friendships/friendships.repository.ts`
- Modify: `apps/server/src/features/social/friendships/friendships.repository.integration.test.ts`

- [ ] **Step 1: Add `getWeeklyXp` + `findOvertakenFriendIds` methods**

In `friendships.repository.ts`, add:

```typescript
async getWeeklyXp(userId: string, weekStart: Date): Promise<number> {
  const rows = await this.db.execute<{ weekly_xp: number }>(sql`
    SELECT COALESCE(SUM(xp_earned), 0)::int AS weekly_xp
    FROM review_log
    WHERE user_id = ${userId} AND reviewed_at >= ${weekStart}
  `);
  const normalized = Array.isArray(rows) ? rows : (rows as { rows: Array<{ weekly_xp: number }> }).rows;
  return normalized[0]?.weekly_xp ?? 0;
}

async findOvertakenFriendIds(
  userId: string,
  weekStart: Date,
  previousWeeklyXp: number,
  newWeeklyXp: number,
): Promise<Array<{ friendId: string; weeklyXp: number }>> {
  if (newWeeklyXp <= previousWeeklyXp) return [];
  const result = await this.db.execute<{ friend_id: string; weekly_xp: number }>(sql`
    WITH friends AS (
      SELECT CASE WHEN requester_id = ${userId} THEN recipient_id ELSE requester_id END AS friend_id
      FROM friendship
      WHERE (requester_id = ${userId} OR recipient_id = ${userId}) AND status = 'accepted'
    )
    SELECT f.friend_id, COALESCE(SUM(rl.xp_earned), 0)::int AS weekly_xp
    FROM friends f
    LEFT JOIN review_log rl
      ON rl.user_id = f.friend_id AND rl.reviewed_at >= ${weekStart}
    GROUP BY f.friend_id
    HAVING COALESCE(SUM(rl.xp_earned), 0) >= ${previousWeeklyXp}
       AND COALESCE(SUM(rl.xp_earned), 0) < ${newWeeklyXp}
  `);
  const normalized = Array.isArray(result) ? result : (result as { rows: Array<{ friend_id: string; weekly_xp: number }> }).rows;
  return normalized.map((r) => ({ friendId: r.friend_id, weeklyXp: r.weekly_xp }));
}
```

Add appropriate imports (`sql` from drizzle-orm already there for other methods).

- [ ] **Step 2: Integration tests**

Append cases to `friendships.repository.integration.test.ts`:

```typescript
describe("findOvertakenFriendIds", () => {
  // helper to seed a review_log row at a specific reviewedAt with xpEarned
  async function seedReview(userId: string, xp: number, when: Date) {
    // use the test-db helper to insert review_log row with userId, questionId=existing, xp_earned, reviewed_at
    // see existing test patterns
  }

  it("returns friends with weekly XP in [previousWeeklyXp, newWeeklyXp)", async () => {
    // me + 3 friends + 1 non-friend
    // friend-a: 25 XP (in range), friend-b: 50 XP (NOT - upper exclusive),
    // friend-c: 15 XP (NOT - below previous), non-friend: 25 XP (NOT - not a friend)
    // call with previousWeeklyXp=20, newWeeklyXp=50
    // assert [friend-a] only
  });

  it("lower bound is inclusive", async () => {
    // friend at exactly previousWeeklyXp=20 → returned
  });

  it("returns empty array when newWeeklyXp <= previousWeeklyXp", async () => {
    const r = await repo.findOvertakenFriendIds("me", new Date(), 50, 50);
    expect(r).toEqual([]);
  });

  it("returns empty array when user has no friends", async () => {
    const r = await repo.findOvertakenFriendIds("solo", new Date(), 0, 100);
    expect(r).toEqual([]);
  });
});

describe("getWeeklyXp", () => {
  it("sums xp_earned for the user within the week", async () => {
    // seed 30 XP this week, 100 XP last week, on same user
    // assert getWeeklyXp returns 30
  });

  it("returns 0 when user has no reviews", async () => {
    const r = await repo.getWeeklyXp("solo", new Date());
    expect(r).toBe(0);
  });
});
```

NOTE: review_log inserts require a valid `questionId` FK. Check the existing `friendships.repository.integration.test.ts` setup — if there's already a helper for seeding review_log, reuse it. If not, the simplest path is to insert a fixture question once in `beforeAll` and reuse its ID.

- [ ] **Step 3: Run tests + commit**

```bash
pnpm --filter server test:integration friendships.repository.integration.test.ts
git add apps/server/src/features/social/friendships
git commit -m "feat(friendships): findOvertakenFriendIds + getWeeklyXp repository methods"
```

---

### Task 2: Template + dispatcher

**Files:**
- Modify: `apps/server/src/features/notifications/templates.ts`
- Modify: `apps/server/src/features/notifications/templates.test.ts`
- Modify: `apps/server/src/features/notifications/dispatcher.ts`
- Modify: `apps/server/src/features/notifications/dispatcher.test.ts`

- [ ] **Step 1: Add template**

In `templates.ts`:

```typescript
export const overtaken = (overtakerName: string): PushPayload => ({
  title: "Você foi ultrapassado!",
  body: `${overtakerName} acabou de te passar no ranking 🔥`,
});
```

- [ ] **Step 2: Template test**

In `templates.test.ts`, add:

```typescript
describe("overtaken", () => {
  it("includes the overtaker name in the body", () => {
    const p = overtaken("Pedro");
    expect(p.title).toBe("Você foi ultrapassado!");
    expect(p.body).toContain("Pedro");
  });
});
```

- [ ] **Step 3: Dispatcher method**

In `dispatcher.ts`, add a method matching the existing `sendAchievementNotification` pattern. The exact signature:

```typescript
async sendOvertakenNotification(overtakenUserId: string, overtakerName: string): Promise<void>
```

Behavior:
1. Read prefs via `preferencesRepo`. If `achievement_notifications_enabled === false` → return.
2. Load tokens for `overtakenUserId` via `tokensRepo`.
3. If no tokens → return.
4. Build payload via `templates.overtaken(overtakerName)`.
5. Enqueue via `notifications-send` queue (existing helper). Match the exact enqueue shape used by `sendAchievementNotification`.

- [ ] **Step 4: Dispatcher test**

In `dispatcher.test.ts`, add:

```typescript
describe("sendOvertakenNotification", () => {
  it("skips when achievement_notifications_enabled is false", async () => { ... });
  it("skips when user has no tokens", async () => { ... });
  it("enqueues a send job with the overtaken template", async () => { ... });
});
```

Mirror the existing `sendAchievementNotification` test cases for structure.

- [ ] **Step 5: Run tests + commit**

```bash
pnpm --filter server test templates dispatcher
git add apps/server/src/features/notifications
git commit -m "feat(notifications): overtaken template + dispatcher method"
```

---

### Task 3: Reviews-service hook

**Files:**
- Modify: `apps/server/src/features/reviews/reviews.service.ts`
- Modify: `apps/server/src/features/reviews/reviews.service.test.ts`
- Modify: `apps/server/src/features/reviews/reviews.route.ts`

- [ ] **Step 1: Constructor**

Add optional `friendshipsRepo` parameter to `ReviewsService` constructor. Existing optional `dispatcher` is already there.

- [ ] **Step 2: Hook**

After the existing `awardXp` block in `completeAnswer`, add:

```typescript
if (xpAwarded > 0 && this.dispatcher && this.friendshipsRepo) {
  void this.maybeNotifyOvertakenFriends(userId, xpAwarded).catch((e) => {
    this.logger?.error?.({ err: e, userId }, "overtaken notification dispatch failed");
  });
}
```

Where `maybeNotifyOvertakenFriends` is a private async method:

```typescript
private async maybeNotifyOvertakenFriends(userId: string, xpAwarded: number): Promise<void> {
  const weekStart = startOfWeekBrt(new Date());
  const newWeeklyXp = await this.friendshipsRepo!.getWeeklyXp(userId, weekStart);
  const previousWeeklyXp = newWeeklyXp - xpAwarded;
  const overtaken = await this.friendshipsRepo!.findOvertakenFriendIds(userId, weekStart, previousWeeklyXp, newWeeklyXp);
  if (overtaken.length === 0) return;
  const me = await this.repo.findUserName(userId); // see below
  const overtakerName = me?.name ?? "Alguém";
  await Promise.allSettled(
    overtaken.map((f) => this.dispatcher!.sendOvertakenNotification(f.friendId, overtakerName)),
  );
}
```

The `findUserName` method on `ReviewsRepository` — if it doesn't exist, add a simple one:

```typescript
async findUserName(userId: string): Promise<{ name: string } | null> {
  const rows = await this.db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1);
  return rows[0] ?? null;
}
```

Use the canonical `user` import and existing `eq`.

Import `startOfWeekBrt` from `@pruvi/shared`.

- [ ] **Step 3: Route wiring**

In `reviews.route.ts`, where `new ReviewsService(...)` is constructed (currently passes `repo, livesRepo, dispatcher?, streaksService?` — match the actual existing arguments), add `new FriendshipsRepository(db)` as the next argument.

- [ ] **Step 4: Service tests**

Extend `reviews.service.test.ts`:

```typescript
describe("completeAnswer — overtaken notification hook", () => {
  it("invokes dispatcher.sendOvertakenNotification for each overtaken friend on xpAwarded > 0", async () => {
    // mock friendshipsRepo.getWeeklyXp → 50
    // mock friendshipsRepo.findOvertakenFriendIds → [{friendId: 'f1', weeklyXp: 25}, {friendId: 'f2', weeklyXp: 40}]
    // mock dispatcher.sendOvertakenNotification = vi.fn()
    // call completeAnswer with correct=true (so xpAwarded > 0)
    // await microtasks (fire-and-forget!)
    // expect dispatcher.sendOvertakenNotification to have been called with 'f1' and 'f2'
  });

  it("does not invoke dispatcher when xpAwarded === 0 (wrong answer)", async () => { ... });

  it("does not throw if dispatcher.sendOvertakenNotification rejects", async () => {
    // mock dispatcher to throw
    // call completeAnswer
    // expect result.isOk() = true
  });
});
```

For the fire-and-forget await: use `await new Promise(setImmediate)` or `await new Promise((r) => setTimeout(r, 0))` to flush microtasks before asserting.

- [ ] **Step 5: Run tests + commit**

```bash
pnpm --filter server test reviews.service
pnpm --filter server test:integration  # ensure no regression
git add apps/server/src/features/reviews
git commit -m "feat(reviews): fire-and-forget overtaken-notification hook"
```

---

### Task 4: Final verification + push

- [ ] **Step 1: Full sweep**

```bash
pnpm --filter server test
pnpm --filter server test:integration
pnpm --filter @pruvi/shared test
pnpm verify:migration
pnpm --filter server check-types
```

All must pass. Pre-existing test-file strict-null noise is acceptable.

- [ ] **Step 2: Boot worker smoke**

```bash
pnpm dev:worker  # then Ctrl-C after seeing queue-registered log
```

- [ ] **Step 3: Push + PR**

```bash
git push -u origin feature/phase-2d1-overtaken-notification
gh pr create --base main --title "feat: phase 2d.1 — overtaken push notification" --body "..."
```

PR body: summarize the detection model (`[previousWeeklyXp, newWeeklyXp)` half-open interval), the hook placement (post-awardXp, fire-and-forget), reference the spec.

---

## Self-review

- ✅ Detection model in `findOvertakenFriendIds` matches spec (half-open interval, friends-only) → Task 1
- ✅ Template + dispatcher → Task 2
- ✅ Hook invocation, fire-and-forget, xpAwarded gate → Task 3
- ✅ Tests cover edges: lower bound inclusive, upper bound exclusive, no-friends, xpAwarded=0, dispatcher-throw doesn't crash answer
- ✅ Prefs gating via `achievement_notifications_enabled` (no new column needed)
- ✅ No migration in this phase
- ✅ No placeholders ("TBD"/"add appropriate")

Type consistency check:
- `findOvertakenFriendIds` returns `Array<{ friendId: string; weeklyXp: number }>` — matches the consumer's loop in the hook.
- `dispatcher.sendOvertakenNotification(overtakenUserId, overtakerName)` — `overtakerName: string` (no null; service falls back to "Alguém").
- All Date inputs use the same `startOfWeekBrt(now)` convention from Phase 2D.
