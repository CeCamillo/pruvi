# Phase 2E.6 — Referral Shield Reward + Protect-Streak Push (Design Spec)

**Status:** v1
**Date:** 2026-05-12
**Branch:** `feature/phase-2e6-referral-shield-and-protect-streak-push`
**Product source:** `pruvi-freatures.md` §4 (referral reward), §5.3 (shield protection notification)

---

## 1. Goal

Wrap up two small loose ends from the shield/notification roadmap:

1. **Referral shield reward**: honor the product doc's "ganha +100 XP **ou** 1 escudo de streak" by letting the inviter choose their reward type via a profile preference. Default behavior (XP) is preserved.
2. **Protect-streak push**: when the auto-use shield protects a missed day, enqueue the notification *"Seu escudo protegeu seu streak de X dias!"* the next time the dispatcher fires.

Both features build on existing infrastructure (`InvitationsRepository`, `ShieldsService.tryUseShield`, `Dispatcher`, `templates.ts`) — no new tables, just one column addition and wiring.

## 2. Non-goals

- **Reward-choice negotiation at accept-time.** The inviter sets the preference on their own profile; the invitee's accept call simply triggers the inviter's chosen reward. No UI on the invitee side.
- **Retroactive reward switching.** Once an invitation is accepted, the reward is final (recorded in `invitation_acceptance.reward_type`). The inviter cannot later swap XP for a shield.
- **Per-invite reward type.** A single user-level preference, not per-invitation. YAGNI for now.
- **Shield-grant cap bypass.** If the inviter already has `streakShieldsAvailable >= MAX_STREAK_SHIELDS = 1`, the shield grant is silently downgraded to XP (the inviter's preference fallback). Spec §5.3 says "Máximo de 1 escudo ativo por vez — não acumula"; this respects that.
- **Cross-feature push notification batching.** The protect-streak push is enqueued individually per shield-use event. Per-user batching is handled by the existing dispatcher.
- **Localization beyond pt-BR.** All notification copy is Brazilian Portuguese, matching existing templates.

## 3. Mechanic

### 3.1 Referral shield reward

- New nullable column on `user`: `invite_reward_preference text default 'xp' check (invite_reward_preference in ('xp','shield'))`.
- New endpoint `PATCH /users/me/invite-reward-preference { preference: "xp" | "shield" }` (authenticated). Updates the column.
- On `acceptInvitation`, the repository reads the inviter's `invite_reward_preference`:
  - `"xp"` → existing behavior (+100 XP to inviter).
  - `"shield"` → if `inviter.streakShieldsAvailable < MAX_STREAK_SHIELDS`, grant the shield (increment to MAX); otherwise fall back to XP. Either way, record the actual reward delivered in `invitation_acceptance.reward_type` so the audit trail is honest.
- The `acceptInvitation` response carries `reward: { type: "xp" | "shield"; xpAwarded: number; shieldGranted: boolean }` so clients can show the right confirmation toast on the invitee side.

### 3.2 Protect-streak push

- The existing `ShieldsService.tryUseShield` returns `{ used: true, balanceAfter: 0 }` on successful protection. Today it's fire-and-forget from `SessionsService.maybeProtectMissedDay` with no notification follow-up.
- When `tryUseShield` returns `used: true`, the service enqueues a notification via the existing `Dispatcher`. The push payload uses the current streak length (queried just before enqueuing).
- The push template is new: `streakProtected(days: number) => { title: "Seu escudo protegeu seu streak!", body: "Seu streak de N dias foi salvo. Continue amanhã 💛" }`.
- Delivery uses the existing `notifications.send` BullMQ queue (consistent with overtaken / streak-reminder notifications). The notification fires immediately — not the next day. **Rationale:** product copy says "Notificação no dia seguinte" but the shield-use happens on day N+1 (the day after the missed day), so "no dia seguinte" relative to the missed day = today, the day the protection runs. We send right away.

## 4. Data model

### 4.1 `user` column addition

```sql
ALTER TABLE "user" ADD COLUMN invite_reward_preference text NOT NULL DEFAULT 'xp';
-- Drizzle text-enum at the application layer enforces ('xp','shield'); no DB CHECK due to drizzle-kit limitation.
```

Default `'xp'` preserves backwards compatibility — existing inviters keep getting XP.

### 4.2 `invitation_acceptance` column addition

```sql
ALTER TABLE invitation_acceptance ADD COLUMN reward_type text NOT NULL DEFAULT 'xp';
-- Records the actually-delivered reward (after the shield-cap fallback). Useful for analytics.
```

Existing rows backfill to `'xp'` (their actual historical behavior).

## 5. Architecture

### 5.1 Invitation reward flow

`InvitationsRepository.acceptInvitation(inviterId, inviteeId)` becomes:

```ts
async acceptInvitation(inviterId: string, inviteeId: string): Promise<{ rewardType: "xp" | "shield"; xpAwarded: number; shieldGranted: boolean }> {
  return await this.db.transaction(async (tx) => {
    // 1. Read inviter preference + current shield balance.
    const inviter = await tx.select({
      pref: user.inviteRewardPreference,
      shields: user.streakShieldsAvailable,
    }).from(user).where(eq(user.id, inviterId)).limit(1);
    const pref = inviter[0]?.pref ?? "xp";
    const currentShields = inviter[0]?.shields ?? 0;

    // 2. Decide actual reward (shield with cap fallback).
    let actualReward: "xp" | "shield" = "xp";
    if (pref === "shield" && currentShields < MAX_STREAK_SHIELDS) {
      actualReward = "shield";
    }

    // 3. Insert acceptance with the actual reward type.
    await tx.insert(invitationAcceptance).values({ inviterId, inviteeId, rewardType: actualReward });

    // 4. Apply reward.
    if (actualReward === "shield") {
      // Conditional UPDATE guards against race between read-then-update.
      await tx.update(user)
        .set({ streakShieldsAvailable: sql`${user.streakShieldsAvailable} + 1` })
        .where(and(eq(user.id, inviterId), lt(user.streakShieldsAvailable, MAX_STREAK_SHIELDS)));
    } else {
      await tx.update(user)
        .set({ totalXp: sql`${user.totalXp} + 100` })
        .where(eq(user.id, inviterId));
    }

    // 5. Friendship (unchanged).
    await tx.insert(friendship).values({ requesterId: inviterId, recipientId: inviteeId, status: "accepted", acceptedAt: new Date() });

    return { rewardType: actualReward, xpAwarded: actualReward === "xp" ? 100 : 0, shieldGranted: actualReward === "shield" };
  });
}
```

`InvitationsService.acceptInvitation` returns the reward info to the route.

### 5.2 Protect-streak push flow

`SessionsService.maybeProtectMissedDay` becomes:

```ts
private async maybeProtectMissedDay(userId: string): Promise<void> {
  // ... existing date-gap logic unchanged ...
  const result = await this.shieldsService!.tryUseShield(userId, yesterdayStr);
  if (result.used) {
    // Fire-and-forget push notification.
    void this.enqueueProtectedStreakPush(userId).catch((e) => {
      this.logger?.error?.({ err: e, userId }, "protect-streak push enqueue failed");
    });
  }
}

private async enqueueProtectedStreakPush(userId: string): Promise<void> {
  if (!this.dispatcher) return;
  const streaks = await this.streaksService!.getStreakStats(userId);
  await this.dispatcher.enqueue(userId, "streak_protected", streakProtected(streaks.currentStreak));
}
```

The `Dispatcher.enqueue(userId, kind, payload)` method already exists for other notification kinds (verify in the implementation — if signature differs, the plan will adapt). The notification kind `streak_protected` is a new value in the existing notification-kind enum and must be added to the preferences-respect filter so a user can opt out.

### 5.3 Notification preferences

Existing user-preference schema has per-kind opt-out flags. The plan adds `streak_protected_enabled: boolean default true` (or whatever existing pattern — verify in plan stage). If the user has opted out, the dispatcher skips the send.

## 6. API surface

### 6.1 `PATCH /users/me/invite-reward-preference`

```ts
InviteRewardPreferenceBodySchema = z.object({
  preference: z.enum(["xp", "shield"]),
});

InviteRewardPreferenceResponseSchema = z.object({
  preference: z.enum(["xp", "shield"]),
});
```

Authenticated. Updates the user's column. Returns the new preference.

### 6.2 Existing `POST /invitations/accept` response shape extended

Existing response:
```ts
{ inviter: { name, username }, xpAwarded: number, friendshipCreated: true }
```

New response:
```ts
{
  inviter: { name, username },
  reward: { type: "xp" | "shield", xpAwarded: number, shieldGranted: boolean },
  friendshipCreated: true,
}
```

**Backwards compatibility:** clients still depending on the top-level `xpAwarded` field can read `reward.xpAwarded`. The old field is removed to keep the contract clean — there are no production clients yet (Phase 0 era). If we later discover real clients, we can re-add the alias.

### 6.3 No new push endpoint

Notifications use the existing `Dispatcher`-backed queue. No new HTTP surface for the protect-streak push.

## 7. Notification template

In `apps/server/src/features/notifications/templates.ts`, add:

```ts
export function streakProtected(days: number): PushPayload {
  return {
    title: "Seu escudo protegeu seu streak!",
    body: `Seu streak de ${days} dias foi salvo. Continue amanhã 💛`,
  };
}
```

For `days === 0` or `days === 1`, the singular form is acceptable as-is — "Seu streak de 0 dias" is admittedly odd but mathematically impossible (the shield is only used when there's an active streak to protect). Defensive: if `days < 1`, the dispatcher skips. The plan must wire this guard.

## 8. Migration

`packages/db/src/migrations/0011_<name>.sql` (drizzle-kit-named). Two ALTER TABLE statements:

```sql
ALTER TABLE "user" ADD COLUMN "invite_reward_preference" text DEFAULT 'xp' NOT NULL;
ALTER TABLE "invitation_acceptance" ADD COLUMN "reward_type" text DEFAULT 'xp' NOT NULL;
```

Both columns are `NOT NULL DEFAULT 'xp'` so the migration is safe on existing data.

## 9. Testing strategy

**Repository unit/integration:**
- `acceptInvitation` with inviter `invite_reward_preference = "xp"` → inviter gets +100 XP, `invitation_acceptance.reward_type = 'xp'`.
- `acceptInvitation` with inviter preference = `"shield"` and `streakShieldsAvailable = 0` → inviter gets +1 shield (now at 1), no XP, `reward_type = 'shield'`.
- `acceptInvitation` with inviter preference = `"shield"` and `streakShieldsAvailable = 1` (at MAX) → silently falls back to XP, +100 XP awarded, `reward_type = 'xp'`.
- Race-safe shield update: a conditional UPDATE `WHERE streakShieldsAvailable < MAX` prevents two concurrent accepts from pushing the inviter over the cap.

**Service unit (`sessions.service.test.ts`):**
- When `tryUseShield` returns `{ used: true, ... }`, the dispatcher is called once with kind `"streak_protected"` and the current streak length.
- When `tryUseShield` returns `{ used: false, ... }`, dispatcher NOT called.
- If `dispatcher` is null, no error; just skip.

**Templates unit (`templates.test.ts`):**
- `streakProtected(7)` returns the expected pt-BR strings.
- `streakProtected(1)` — singular phrasing still acceptable.

**Route unit/integration:**
- `PATCH /users/me/invite-reward-preference { preference: "shield" }` → 200, profile updated.
- `PATCH ... { preference: "invalid" }` → 400 via Zod.
- `POST /invitations/accept` returns the new `reward: { type, xpAwarded, shieldGranted }` shape.

## 10. Acceptance criteria

A1. New column `user.invite_reward_preference` exists with `NOT NULL DEFAULT 'xp'`. Existing users default to `'xp'`.
A2. New column `invitation_acceptance.reward_type` exists with `NOT NULL DEFAULT 'xp'`. Existing rows backfill to `'xp'`.
A3. `PATCH /users/me/invite-reward-preference { preference: "xp" | "shield" }` updates the user's preference; invalid values rejected with 400.
A4. Inviter with preference `"xp"`: an accept call awards +100 XP and writes `reward_type='xp'`.
A5. Inviter with preference `"shield"` and shields < MAX: an accept call grants +1 shield (capped at MAX), no XP, writes `reward_type='shield'`.
A6. Inviter with preference `"shield"` and shields already at MAX: an accept call falls back to +100 XP and writes `reward_type='xp'` (cap respected, audit honest).
A7. The shield update is race-safe: two concurrent accepts on a same-inviter-preference=shield-at-shields=0 do NOT push the inviter to shields=2.
A8. When `ShieldsService.tryUseShield` returns `{ used: true }` from the auto-protect hook in `SessionsService.maybeProtectMissedDay`, a notification of kind `"streak_protected"` is enqueued via the existing dispatcher with the user's current streak length.
A9. When `tryUseShield` returns `{ used: false }`, no notification is enqueued.
A10. If the user has opted out of `streak_protected` notifications (preference flag), the dispatcher skips the send (existing preference-respect mechanism).
A11. The template `streakProtected(days)` returns pt-BR strings matching §7.
A12. The accept-invitation response includes `reward: { type, xpAwarded, shieldGranted }`. The top-level `xpAwarded` field is removed.
A13. All errors logged via `fastify.log`/`logger.error`. No `console.error` in production paths.

## 11. Deferred items

- Per-invite reward override (an invitee-facing UX where the invitee can request a reward type for the inviter).
- Retroactive switching: convert past `'xp'` rewards to `'shield'` on user request.
- A/B testing the default reward type (XP vs shield) for new users.
- Push notification batching for users with multiple shield-use events on the same day (single user, single day → single push is already guaranteed by the auto-use mechanic — but if the rule ever changes, batching becomes relevant).
- Localization for non-pt-BR locales.

## 12. Open questions resolved during design

- **Reward choice UX**: a user-level preference setting (not per-invite) is the simplest implementation honoring product spec's "ou". YAGNI rules out anything fancier.
- **Cap behavior**: silent fallback to XP rather than rejecting the accept. Rejecting would block the invitee for an inviter-state reason, which is bad UX.
- **Push timing**: "no dia seguinte" in the product doc is relative to the missed day, which IS the day the auto-protect runs. Send immediately. No scheduling complexity needed.
- **Streak length source**: `StreaksService.getStreakStats(userId).currentStreak`. After the protection, the streak is intact, so the current value is the correct one to display.
- **`reward_type` on `invitation_acceptance`**: records the **delivered** reward (after fallback), not the **requested** preference. This makes the audit useful for analytics ("how many shield-rewards were actually delivered vs fell back to XP").
- **Backwards compatibility of accept response**: removing top-level `xpAwarded` is acceptable per the project's pre-production status. Documented as a contract change in the PR.
