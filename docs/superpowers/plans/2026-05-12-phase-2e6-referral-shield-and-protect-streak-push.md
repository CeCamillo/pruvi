# Phase 2E.6 — Referral Shield Reward + Protect-Streak Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Gate C (Opus 4.7) after each task. Final Gate D before PR.

**Goal:** Two small features tying off the shield mechanic from 2E.2 — (1) honor product spec's "+100 XP **or** 1 escudo de streak" by adding an inviter-side preference; (2) send "Seu escudo protegeu seu streak!" push when auto-protect fires.

**Architecture:** Two new columns (`user.invite_reward_preference`, `invitation_acceptance.reward_type`). One new endpoint (`PATCH /users/me/invite-reward-preference`). Repository TX reordered to make the audit row truthful when the shield-cap fallback kicks in. New `Dispatcher.sendStreakProtectedNotification` method (sibling to existing `sendAchievementNotification`). `SessionsService.maybeProtectMissedDay` now inspects `tryUseShield`'s return value and conditionally dispatches the push.

**Tech Stack:** Drizzle ORM, Fastify 5, BullMQ, neverthrow Result, real Postgres for integration tests.

**Authoritative spec:** `docs/superpowers/specs/2026-05-12-phase-2e6-referral-shield-and-protect-streak-push-design.md` (v2 post Gate A).

**Plan revision:** v2 post Gate B — Task 3.4 route handler returns `unwrapResult(result)` bare (no double-wrap); Task 3.3 explicitly ADDs the response schema (it doesn't exist today); Task 3.2 names line 105 of `invitations.service.test.ts` that must be updated; Task 2.2 imports and uses `MAX_STREAK_SHIELDS` constant instead of literal `1`.

---

## Task 1 — DB migration + schema + shared zod schemas

**Files:**
- Modify: `packages/db/src/schema/auth.ts` (add `inviteRewardPreference` column to `user`)
- Modify: `packages/db/src/schema/invitation-acceptance.ts` (add `rewardType` column)
- Create: `packages/db/src/migrations/0011_<generated>.sql`
- Modify: `packages/db/src/migrations/meta/_journal.json` + `0011_snapshot.json`
- Modify: `packages/shared/src/users.ts` (or similar — find the file that already exports user-related schemas)
- Modify: `apps/server/src/test/db-helpers.ts` — no change needed; both tables already in TRUNCATE list.

- [ ] **Step 1.1: Add `inviteRewardPreference` to `user` schema**

In `packages/db/src/schema/auth.ts`, alongside the existing `streakRemindersEnabled` / `achievementNotificationsEnabled` lines, add:

```ts
inviteRewardPreference: text("invite_reward_preference", { enum: ["xp", "shield"] }).notNull().default("xp"),
```

Place it near the other invite-related fields (after `inviteCode`).

- [ ] **Step 1.2: Add `rewardType` to `invitation_acceptance` schema**

First read `packages/db/src/schema/invitation-acceptance.ts` to confirm column ordering. Add:

```ts
rewardType: text("reward_type", { enum: ["xp", "shield"] }).notNull().default("xp"),
```

- [ ] **Step 1.3: Generate migration**

```bash
cd /Users/cesarcamillo/dev/pruvi && pnpm -F db db:generate
```

Verify the generated `0011_*.sql` contains exactly two `ALTER TABLE ... ADD COLUMN` statements with `NOT NULL DEFAULT 'xp'`. No CHECK constraint expected (Drizzle limitation, accepted). If unrelated diffs appear, STOP and report BLOCKED.

- [ ] **Step 1.4: Add shared Zod schema for preference**

Find where existing user PATCH schemas live (likely `packages/shared/src/users.ts`). Add:

```ts
export const InviteRewardPreferenceBodySchema = z.object({
  preference: z.enum(["xp", "shield"]),
});
export type InviteRewardPreferenceBody = z.infer<typeof InviteRewardPreferenceBodySchema>;

export const InviteRewardPreferenceResponseSchema = z.object({
  preference: z.enum(["xp", "shield"]),
});
export type InviteRewardPreferenceResponse = z.infer<typeof InviteRewardPreferenceResponseSchema>;
```

If `users.ts` doesn't exist or is sparse, place them alongside other invite/user schemas — verify the existing pattern.

- [ ] **Step 1.5: Run + commit**

```bash
cd packages/shared && bun test
cd /Users/cesarcamillo/dev/pruvi/apps/server && bun test src/features/social/
```
Expected: all green (existing tests).

```bash
git add packages/db/src/schema/auth.ts packages/db/src/schema/invitation-acceptance.ts packages/db/src/migrations/ packages/shared/src/
git commit -m "feat(db,shared): add invite_reward_preference + invitation_acceptance.reward_type columns + zod schemas"
```

---

## Task 2 — Repository TX reorder (race-safe shield grant + truthful audit row)

**Files:**
- Modify: `apps/server/src/features/social/invitations/invitations.repository.ts`
- Modify: `apps/server/src/features/social/invitations/invitations.repository.integration.test.ts`

- [ ] **Step 2.1: Reorder the `acceptInvitation` TX**

Per spec v2 §5.1. Replace the existing `acceptInvitation` method with the new shape:

```ts
async acceptInvitation(inviterId: string, inviteeId: string): Promise<{ rewardType: "xp" | "shield"; xpAwarded: number; shieldGranted: boolean }> {
  return await this.db.transaction(async (tx) => {
    // 1. Read inviter preference.
    const inviter = await tx
      .select({ pref: user.inviteRewardPreference })
      .from(user)
      .where(eq(user.id, inviterId))
      .limit(1);
    const pref = inviter[0]?.pref ?? "xp";

    // 2. Attempt shield grant FIRST when preferred. Race-safe via predicate-in-WHERE.
    let actualReward: "xp" | "shield" = "xp";
    if (pref === "shield") {
      const updated = await tx
        .update(user)
        .set({ streakShieldsAvailable: sql`${user.streakShieldsAvailable} + 1` })
        .where(and(eq(user.id, inviterId), lt(user.streakShieldsAvailable, MAX_STREAK_SHIELDS)))
        .returning({ id: user.id });
      if (updated.length > 0) actualReward = "shield";
    }

    // 3. XP path (either preferred or fell back from shield-cap).
    if (actualReward === "xp") {
      await tx
        .update(user)
        .set({ totalXp: sql`${user.totalXp} + 100` })
        .where(eq(user.id, inviterId));
    }

    // 4. Audit row with the TRUTH (post-fallback).
    await tx.insert(invitationAcceptance).values({ inviterId, inviteeId, rewardType: actualReward });

    // 5. Friendship (unchanged).
    await tx.insert(friendship).values({ requesterId: inviterId, recipientId: inviteeId, status: "accepted", acceptedAt: new Date() });

    return { rewardType: actualReward, xpAwarded: actualReward === "xp" ? 100 : 0, shieldGranted: actualReward === "shield" };
  });
}
```

Imports to add: `and`, `lt` from `drizzle-orm`; `MAX_STREAK_SHIELDS` from `@pruvi/shared`.

- [ ] **Step 2.2: Update integration tests**

Read the existing `invitations.repository.integration.test.ts` to see the test seed pattern. Append (or update existing) tests:

```ts
describe("acceptInvitation reward semantics (Phase 2E.6)", () => {
  it("preference=xp → +100 XP, reward_type=xp", async () => {
    await insertUser("inv-xp-1");
    await insertUser("invi-xp-1");
    // Default preference is 'xp'.
    const result = await repo.acceptInvitation("inv-xp-1", "invi-xp-1");
    expect(result).toEqual({ rewardType: "xp", xpAwarded: 100, shieldGranted: false });
    const inviter = await db.select({ xp: user.totalXp, shields: user.streakShieldsAvailable })
      .from(user).where(eq(user.id, "inv-xp-1"));
    expect(inviter[0]!.xp).toBe(100);
    expect(inviter[0]!.shields).toBe(0);
    const audit = await db.select({ rt: invitationAcceptance.rewardType })
      .from(invitationAcceptance).where(eq(invitationAcceptance.inviterId, "inv-xp-1"));
    expect(audit[0]!.rt).toBe("xp");
  });

  it("preference=shield + shields=0 → +1 shield, reward_type=shield", async () => {
    await insertUser("inv-sh-1");
    await insertUser("invi-sh-1");
    await db.update(user).set({ inviteRewardPreference: "shield" }).where(eq(user.id, "inv-sh-1"));
    const result = await repo.acceptInvitation("inv-sh-1", "invi-sh-1");
    expect(result).toEqual({ rewardType: "shield", xpAwarded: 0, shieldGranted: true });
    const inviter = await db.select({ xp: user.totalXp, shields: user.streakShieldsAvailable })
      .from(user).where(eq(user.id, "inv-sh-1"));
    expect(inviter[0]!.shields).toBe(1);
    expect(inviter[0]!.xp).toBe(0);
    const audit = await db.select({ rt: invitationAcceptance.rewardType })
      .from(invitationAcceptance).where(eq(invitationAcceptance.inviterId, "inv-sh-1"));
    expect(audit[0]!.rt).toBe("shield");
  });

  it("preference=shield + shields already at MAX → falls back to XP, reward_type=xp", async () => {
    await insertUser("inv-cap-1");
    await insertUser("invi-cap-1");
    await db.update(user)
      .set({ inviteRewardPreference: "shield", streakShieldsAvailable: MAX_STREAK_SHIELDS })
      .where(eq(user.id, "inv-cap-1"));
    const result = await repo.acceptInvitation("inv-cap-1", "invi-cap-1");
    expect(result).toEqual({ rewardType: "xp", xpAwarded: 100, shieldGranted: false });
    const inviter = await db.select({ xp: user.totalXp, shields: user.streakShieldsAvailable })
      .from(user).where(eq(user.id, "inv-cap-1"));
    expect(inviter[0]!.shields).toBe(MAX_STREAK_SHIELDS); // unchanged
    expect(inviter[0]!.xp).toBe(100);
    const audit = await db.select({ rt: invitationAcceptance.rewardType })
      .from(invitationAcceptance).where(eq(invitationAcceptance.inviterId, "inv-cap-1"));
    expect(audit[0]!.rt).toBe("xp");
  });
});
```

Imports the test file needs: `user`, `invitationAcceptance` from the schema; `eq` from `drizzle-orm`; `MAX_STREAK_SHIELDS` from `@pruvi/shared` (use the constant, not the literal `1`, so the test stays correct if `MAX_STREAK_SHIELDS` ever changes).

- [ ] **Step 2.3: Run + commit**

```bash
cd apps/server && bun test src/features/social/invitations/
```

Expected: existing tests still pass (the existing "default behavior = XP" test should still match because default `preference` is `"xp"`); 3 new tests pass.

```bash
git add apps/server/src/features/social/invitations/
git commit -m "feat(invitations): race-safe shield reward with truthful audit row (gate a B4 fix)"
```

---

## Task 3 — Service-layer + route for preference + accept-response shape change

**Files:**
- Modify: `apps/server/src/features/social/invitations/invitations.service.ts`
- Modify: `apps/server/src/features/social/invitations/invitations.service.test.ts`
- Modify: `apps/server/src/features/social/invitations/invitations.route.ts` (response shape)
- Modify: `apps/server/src/features/users/users.route.ts` (add PATCH endpoint)
- Modify: `apps/server/src/features/users/users.service.ts` and `users.repository.ts` if needed

- [ ] **Step 3.1: Update `InvitationsService.acceptInvitation`**

Replace the existing implementation (line 18–55 of `invitations.service.ts`) to capture the repo's return value:

```ts
async acceptInvitation(code: string, userId: string): Promise<Result<{
  inviter: { name: string; username: string | null };
  reward: { type: "xp" | "shield"; xpAwarded: number; shieldGranted: boolean };
  friendshipCreated: true;
}, AppError>> {
  const inviter = await this.repo.findInviterByCode(code);
  if (!inviter) return err(new NotFoundError("Invite code not found"));
  if (inviter.id === userId) return err(new ValidationError("Cannot accept your own invite"));
  if (await this.repo.hasAccepted(userId)) return err(new ValidationError("You have already accepted an invitation"));
  try {
    const reward = await this.repo.acceptInvitation(inviter.id, userId);
    return ok({
      inviter: { name: inviter.name, username: inviter.username },
      reward: { type: reward.rewardType, xpAwarded: reward.xpAwarded, shieldGranted: reward.shieldGranted },
      friendshipCreated: true as const,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("friendship_pair_idx") || msg.includes("invitation_acceptance")) {
      return err(new ValidationError("Invitation already processed"));
    }
    throw e;
  }
}
```

- [ ] **Step 3.2: Update `InvitationsService` tests**

In `invitations.service.test.ts`, the existing accept-invitation success test (around lines 89–110) currently mocks `repo.acceptInvitation` to return `undefined` (void) and asserts `expect(result.value.xpAwarded).toBe(100)` on **line 105** (the assertion that will break after Task 3.1). Required changes:

1. Update the mock: `repo.acceptInvitation: vi.fn().mockResolvedValue({ rewardType: "xp", xpAwarded: 100, shieldGranted: false })` (was `mockResolvedValue(undefined)`).
2. Update line 105 from `expect(result.value.xpAwarded).toBe(100)` to `expect(result.value.reward.xpAwarded).toBe(100)`. Also assert the full reward struct: `expect(result.value.reward).toEqual({ type: "xp", xpAwarded: 100, shieldGranted: false })`.
3. ADD a new test "returns shield reward shape when repo grants a shield": mock the repo to return `{ rewardType: "shield", xpAwarded: 0, shieldGranted: true }`. Assert `result.value.reward` matches that struct and `result.value.reward.type === "shield"`.

- [ ] **Step 3.3: Add accept-invitation response schema**

`invitations.route.ts` currently has NO response schema on the `POST /invitations/accept` route — just a body schema. ADD a response schema for the new shape:

```ts
const AcceptInvitationResponseSchema = z.object({
  inviter: z.object({ name: z.string(), username: z.string().nullable() }),
  reward: z.object({
    type: z.enum(["xp", "shield"]),
    xpAwarded: z.number().int(),
    shieldGranted: z.boolean(),
  }),
  friendshipCreated: z.literal(true),
});
```

Wire it into the route's `schema` block: `schema: { body: AcceptInvitationBodySchema, response: { 200: z.object({ success: z.literal(true), data: AcceptInvitationResponseSchema }) } }`. The handler stays the same shape: `return unwrapResult(result);`

- [ ] **Step 3.4: Add `PATCH /users/me/invite-reward-preference` route**

First read `apps/server/src/features/users/users.route.ts` to find the existing PATCH pattern. Then add a new endpoint:

```ts
fastify.patch(
  "/users/me/invite-reward-preference",
  {
    preHandler: [fastify.authenticate],
    schema: {
      body: InviteRewardPreferenceBodySchema,
      response: { 200: z.object({ success: z.literal(true), data: InviteRewardPreferenceResponseSchema }) },
    },
  },
  async (request) => {
    const { preference } = request.body;
    const result = await service.updateInviteRewardPreference(request.userId, preference);
    return unwrapResult(result); // returns { success: true, data: { preference } }
  },
);
```

Matches the existing PATCH pattern in `users.route.ts` (line 25–38 of the existing file). Do NOT wrap with `successResponse(unwrapResult(result).data)` — that double-wraps the envelope.

Add the corresponding service method `updateInviteRewardPreference(userId, preference)` and repository update method. Style: match `UsersService`'s existing PATCH methods.

- [ ] **Step 3.5: Run + commit**

```bash
cd apps/server && bun test src/features/social/ src/features/users/
```

```bash
git add apps/server/src/features/social/invitations/ apps/server/src/features/users/
git commit -m "feat(invitations,users): accept response includes reward struct; patch invite-reward-preference endpoint"
```

---

## Task 4 — Dispatcher `sendStreakProtectedNotification` + template + sessions hook

**Files:**
- Modify: `apps/server/src/features/notifications/templates.ts`
- Modify: `apps/server/src/features/notifications/templates.test.ts`
- Modify: `apps/server/src/features/notifications/dispatcher.ts`
- Modify: `apps/server/src/features/notifications/dispatcher.test.ts`
- Modify: `apps/server/src/features/sessions/sessions.service.ts`
- Modify: `apps/server/src/features/sessions/sessions.service.test.ts`

- [ ] **Step 4.1: Add the template**

In `templates.ts`, append:

```ts
export function streakProtected(days: number): PushPayload {
  return {
    title: "Seu escudo protegeu seu streak!",
    body: `Seu streak de ${days} dias foi salvo. Continue amanhã 💛`,
  };
}
```

Add a test in `templates.test.ts`:

```ts
it("streakProtected returns pt-BR copy with the day count", () => {
  const p = streakProtected(7);
  expect(p.title).toBe("Seu escudo protegeu seu streak!");
  expect(p.body).toContain("7 dias");
});
```

- [ ] **Step 4.2: Add `Dispatcher.sendStreakProtectedNotification`**

In `dispatcher.ts`, alongside `sendOvertakenNotification`, add:

```ts
async sendStreakProtectedNotification(userId: string, streakDays: number): Promise<void> {
  if (streakDays < 1) return;

  const prefs = await this.deps.prefsRepo.get(userId);
  // Reuse streakRemindersEnabled — same opt-out semantics as streak reminders.
  if (!prefs?.streakRemindersEnabled) return;

  const tokens = await this.deps.tokensService.listTokensForUser(userId);
  if (tokens.length === 0) return;

  const payload = streakProtected(streakDays);
  for (let i = 0; i < tokens.length; i += EXPO_BATCH_SIZE) {
    const chunk = tokens.slice(i, i + EXPO_BATCH_SIZE);
    await this.deps.sendQueue.add("send", {
      tokens: chunk,
      title: payload.title,
      body: payload.body,
      data: { kind: "streak_protected" },
    });
  }
}
```

Import `streakProtected` from `./templates`.

- [ ] **Step 4.3: Test the dispatcher method**

In `dispatcher.test.ts`, follow the pattern of the existing `sendOvertakenNotification` test. Add cases:

1. Happy path: prefs.streakRemindersEnabled=true, tokens present → sendQueue.add called with the right payload and data.kind="streak_protected".
2. Opt-out: prefs.streakRemindersEnabled=false → sendQueue.add NOT called.
3. No tokens: tokens=[] → sendQueue.add NOT called.
4. `days < 1`: returns immediately, no prefs/tokens calls (verify by inspecting mock).

- [ ] **Step 4.4: Update `SessionsService.maybeProtectMissedDay`**

Replace the existing line that fires-and-forgets `tryUseShield`:

```ts
// BEFORE:
await this.shieldsService!.tryUseShield(userId, yesterdayStr);

// AFTER:
const result = await this.shieldsService!.tryUseShield(userId, yesterdayStr);
if (result.used && this.dispatcher && this.streaksService) {
  void this.enqueueProtectedStreakPush(userId).catch((e) => {
    this.logger?.error?.({ err: e, userId }, "protect-streak push enqueue failed");
  });
}
```

Add the helper method to `SessionsService`:

```ts
private async enqueueProtectedStreakPush(userId: string): Promise<void> {
  const streaksResult = await this.streaksService!.getStreaks(userId);
  if (streaksResult.isErr()) return;
  const days = streaksResult.value.currentStreak;
  if (days < 1) return;
  await this.dispatcher!.sendStreakProtectedNotification(userId, days);
}
```

- [ ] **Step 4.5: Test the sessions hook**

In `sessions.service.test.ts`, find the existing maybeProtect tests. Add cases:

1. `tryUseShield` returns `{ used: true }` AND streaks.currentStreak > 0 → `dispatcher.sendStreakProtectedNotification` called once with the right args.
2. `tryUseShield` returns `{ used: false }` → dispatcher NOT called.
3. `tryUseShield` returns `{ used: true }` but `streaksService.getStreaks` returns 0 → dispatcher NOT called (days<1 guard).
4. `tryUseShield` returns `{ used: true }` but dispatcher is null → no error thrown.

- [ ] **Step 4.6: Run + commit**

```bash
cd apps/server && bun test src/features/notifications/ src/features/sessions/
```

```bash
git add apps/server/src/features/notifications/templates.ts apps/server/src/features/notifications/templates.test.ts apps/server/src/features/notifications/dispatcher.ts apps/server/src/features/notifications/dispatcher.test.ts apps/server/src/features/sessions/sessions.service.ts apps/server/src/features/sessions/sessions.service.test.ts
git commit -m "feat(notifications,sessions): streakProtected template + dispatcher method + sessions hook (gate a B1/B5 fix)"
```

---

## Task 5 — Final typecheck, push, PR

- [ ] **Step 5.1: Full repo typecheck**

```bash
cd /Users/cesarcamillo/dev/pruvi && pnpm check-types 2>&1 | grep -E "invitations|notifications|sessions|users|2e6" | head -20
```

Fix any NEW type errors in the affected files (don't worry about pre-existing errors in unrelated tests).

- [ ] **Step 5.2: Test sweep**

```bash
cd /Users/cesarcamillo/dev/pruvi/apps/server && bun test src/features/social/ src/features/notifications/ src/features/sessions/ src/features/users/
```

- [ ] **Step 5.3: Push + PR**

```bash
git push -u origin feature/phase-2e6-referral-shield-and-protect-streak-push
gh pr create --title "feat: phase 2e.6 — referral shield reward + protect-streak push" --body "$(cat <<'EOF'
## Summary
- Inviter can opt for "+1 escudo de streak" instead of "+100 XP" via PATCH /users/me/invite-reward-preference; default remains XP for backward compat
- Auto-protect shield now triggers "Seu escudo protegeu seu streak!" push via existing dispatcher (reuses streakRemindersEnabled opt-out)
- Race-safe shield grant in acceptInvitation: predicate-in-WHERE update + .returning() to confirm; falls back to XP if at MAX
- TX order fixed so invitation_acceptance.reward_type ALWAYS reflects the delivered reward (audit-honest)
- Two new columns (NOT NULL DEFAULT 'xp'): `user.invite_reward_preference`, `invitation_acceptance.reward_type`
- Accept-invitation response shape changed: top-level `xpAwarded` removed; new `reward: { type, xpAwarded, shieldGranted }` object (no production clients yet)

## Workflow gates
- ✅ Gate A — spec self-review (5 blockers fixed: real Dispatcher API, existing prefs flag, service-layer wiring, TX reorder, real getStreaks API)
- ✅ Gate B — plan self-review
- ✅ Gate C — per-task review (Opus 4.7)
- ✅ Gate D — final spec-coverage review

## Test plan
- [ ] Repository integration: preference=xp/shield/shield-at-cap → correct reward + audit row
- [ ] Dispatcher unit: streak_protected enqueued only when enabled + tokens + days>=1
- [ ] Sessions hook: tryUseShield used=true → push enqueued; used=false → no push
- [ ] Manual: PATCH endpoint accepts xp/shield/invalid
EOF
)"
```

---

## Self-review checklist (post Gate B)

1. **Spec coverage A1–A15:** A1/A2 → T1; A3 → T3.4; A4/A5/A6 → T2.2; A7 → T2.1 + T2.2; A8/A9 → T4.5; A10 → T4.3; A11 → T4.1; A12 → T3.1 + T3.3; A13 → T4.4 logger usage; A14 → T4.2 + T4.5; A15 → T2.1 + T2.2.
2. **Placeholder scan:** none.
3. **Migration safety:** both columns are NOT NULL DEFAULT 'xp' — Postgres applies default to existing rows immediately, no backfill job.
4. **No DB CHECK constraints** — accepted Drizzle limitation; application-layer Zod enum is the guard.
5. **Backwards-incompatible response shape:** documented in PR body as a breaking change. Justified by pre-production project status.
