# Phase 2B — Push Notifications (Design Spec)

**Date:** 2026-05-10
**Phase:** 2B
**Source spec:** `pruvi-freatures.md` §3.4 (Streak diário — push às 19h), §6.1 (Notificações push), §6.3 (configurações — horário editável)

## Goal

Ship the push-notification pipeline for streak reminders and achievement notifications. Two scheduled streak reminders (19h + 21h BRT for users who haven't trained today), plus event-triggered notifications for 7d/30d streak milestones and "quase mestre" mastery transitions. Per-type opt-out via user preferences. Expo Push API as the delivery backend.

## Non-goals

- Frontend UI for notification preferences (frontend rebuild owns this; the API + storage ship here).
- A/B testing of message copy.
- Delivery analytics dashboard (logs are sufficient for MVP — Expo's receipts API gives 24h of delivery data on demand).
- Per-user IANA timezones (single timezone — America/Sao_Paulo — for MVP per audience targeting).
- Quiet hours / Do Not Disturb integration.
- Editable `notification_hour` from the settings UI (column ready; UI wires later).

## Data Model

### New table

```
push_token
  id            serial PK
  user_id       text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
  token         text NOT NULL UNIQUE
  platform      text NOT NULL  CHECK (platform IN ('ios','android'))
  last_used_at  timestamp NOT NULL DEFAULT now()
  created_at    timestamp NOT NULL DEFAULT now()
  INDEX (user_id)
```

**Why `UNIQUE (token)` not `(user_id, token)`:** Expo tokens uniquely identify a device installation. If a device's user changes (sign-out then sign-in as another account), the `ON CONFLICT (token) DO UPDATE` upsert at the register endpoint reassigns the row's `user_id` cleanly. A compound key would leave a dangling token under the old account.

### Extensions on `user`

```
+ notification_hour                   integer NOT NULL DEFAULT 19
+ streak_reminders_enabled            boolean NOT NULL DEFAULT true
+ achievement_notifications_enabled   boolean NOT NULL DEFAULT true
+ CHECK CONSTRAINT user_notification_hour_chk: notification_hour BETWEEN 0 AND 23
```

Flat columns (not a side table) follow the established `selectedExam`/`difficulties` pattern. Prefs are always co-fetched with the user; a separate table adds a JOIN with no isolation benefit.

## Architecture

### Feature module

```
apps/server/src/features/notifications/
  index.ts                  # tokensRoutes + preferencesRoutes exports
  push.client.ts            # Wrapper over expo-server-sdk: sendBatch(messages[])
  templates.ts              # Pure PT-BR string builders per notification kind
  dispatcher.ts             # buildAndSendStreakReminders(brtHour, variant), sendAchievementNotification(userId, kind, vars)
  tokens.repository.ts
  tokens.service.ts
  tokens.route.ts
  preferences.repository.ts
  preferences.service.ts
  preferences.route.ts
  tokens.service.test.ts
  preferences.service.test.ts
  dispatcher.test.ts
  templates.test.ts
  push.client.test.ts
  tokens.repository.integration.test.ts
  notifications.sweep.integration.test.ts
```

### Queue & worker

- `apps/server/src/plugins/queue.ts` registers two queues:
  - `notifications-cron` — repeatable job at `pattern: '0 * * * *'` (top of each UTC hour). Job data: `{ kind: 'sweep' }`.
  - `notifications-send` — fan-out queue for batched sends. Job data: `{ tokens: string[], title, body, data? }`.
- `apps/server/src/workers/notifications.worker.ts` (new) subscribes to both queues. Started from the existing worker entrypoint alongside `session-prefetch.worker.ts`. Single worker process (`PROCESS_TYPE=worker`).

### Event hooks for achievements (in-process, fire-and-forget)

- `streaks.service` — after streak update, if `newStreak === 7 || newStreak === 30`:
  ```typescript
  dispatcher.sendAchievementNotification(userId, `${newStreak}-day-streak`)
    .catch((e) => log.error({ err: e }, "achievement push failed"));
  ```
- `sessions.service.completeSession` — before returning, for each upward transition where `to === 'quase_mestre'`:
  ```typescript
  dispatcher.sendAchievementNotification(userId, 'quase-mestre', { subtopicName: t.name })
    .catch((e) => log.error({ err: e }, "mastery push failed"));
  ```

Fire-and-forget is deliberate: a missed push is a UX nick; a 500 on `complete` is a regression. The dispatcher reads opt-in prefs, loads tokens, builds the payload, and enqueues a `notifications-send` job — never blocking on Expo's HTTP round-trip.

## API Surface

All endpoints require auth and return the standard `{ success: true, data: ... }` envelope.

### `POST /users/me/push-tokens`

Body:
```json
{ "token": "ExponentPushToken[...]", "platform": "ios" }
```

Behavior: `ON CONFLICT (token) DO UPDATE` — sets `user_id = request.userId`, refreshes `last_used_at`.

Response:
```json
{ "id": 42, "token": "ExponentPushToken[...]", "platform": "ios" }
```

Validation: `token` must match `/^Expo(nent)?PushToken\[.+\]$/`. Bogus tokens still get rejected at send time by Expo + pruned via receipt handling.

### `DELETE /users/me/push-tokens/:token`

Deletes only if owned by `request.userId`. Returns 204 either way (no token enumeration). Same defensive pattern as `DELETE /users/me` (LGPD).

### `GET /users/me/notification-preferences`

Response:
```json
{
  "notificationHour": 19,
  "streakRemindersEnabled": true,
  "achievementNotificationsEnabled": true
}
```

Cached: `prefs:notif:{userId}` (60s TTL, invalidated on PUT).

### `PUT /users/me/notification-preferences`

Partial body — any subset of the fields above. Server-side validation:
- `notificationHour`: integer 0–23
- Booleans: standard Zod parse

Response: full prefs after update. Invalidates the cache key.

## Scheduling

### Hourly sweep

`notifications-cron` fires at `0 * * * *` UTC. Handler:

```typescript
const utcHour = new Date().getUTCHours();
const brtHour = (utcHour + 24 - 3) % 24;

await dispatchStreakReminder({ brtHour, variant: 'primary' });
await dispatchStreakReminder({ brtHour, variant: 'late' });
```

### Eligibility query (per variant)

```sql
SELECT u.id, pt.token
FROM "user" u
JOIN push_token pt ON pt.user_id = u.id
WHERE u.streak_reminders_enabled = true
  AND u.notification_hour = $1                                    -- primary: brtHour. late: brtHour - 2 (with mod 24)
  AND NOT EXISTS (
    SELECT 1 FROM daily_session ds
    WHERE ds.user_id = u.id
      AND ds.status = 'completed'
      AND ds.created_at::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
  )
```

Result rows chunked to 100 (Expo batch limit), each chunk enqueued as a `notifications-send` job.

### `notifications-send` handler

1. Call `expo.sendPushNotificationsAsync(chunk)`.
2. Inspect tickets: for any `DeviceNotRegistered` status (or matching error in receipts), delete the offending token row from `push_token`.
3. Log `{ userId, kind, tokenCount, expoTicketIds }` to structured logger.

### Achievement dispatch

`sendAchievementNotification(userId, kind, vars?)`:
1. Read `achievement_notifications_enabled` (cached). If false → return.
2. Load all `push_token.token` for the user.
3. Build payload via `templates.ts`.
4. Enqueue a `notifications-send` job.

## Message Templates (`templates.ts`)

Pure PT-BR string builders, no engine, no DB.

```typescript
export const streakReminderPrimary = (): PushPayload => ({
  title: "A Pruvi te esperou hoje 💛",
  body: "Ainda dá tempo — 5 minutos é o suficiente.",
});

export const streakReminderLate = (): PushPayload => ({
  title: "Seu streak está em risco",
  body: "Uma sessão rápida segura o ritmo.",
});

export const streakMilestone = (days: 7 | 30): PushPayload => ({
  title: `${days} dias de streak! 🔥`,
  body: days === 7
    ? "Uma semana firme. Tá pegando o jeito."
    : "Um mês. Isso é dedicação real.",
});

export const masteryAchievement = (subtopicName: string): PushPayload => ({
  title: "Quase mestre! ⭐",
  body: `Você está dominando ${subtopicName}.`,
});
```

Edits ship via PR review alongside other code changes. If/when A/B testing copy becomes a need, swap in a strategy interface — not today.

## Migration `0004_<name>.sql`

1. `CREATE TABLE push_token` (columns + UNIQUE on token + ON DELETE CASCADE FK on user_id + INDEX on user_id)
2. `ALTER TABLE "user" ADD COLUMN notification_hour integer NOT NULL DEFAULT 19`
3. `ALTER TABLE "user" ADD COLUMN streak_reminders_enabled boolean NOT NULL DEFAULT true`
4. `ALTER TABLE "user" ADD COLUMN achievement_notifications_enabled boolean NOT NULL DEFAULT true`
5. `ALTER TABLE "user" ADD CONSTRAINT user_notification_hour_chk CHECK (notification_hour BETWEEN 0 AND 23)`

Mirror the DDL in `packages/db/src/test-client.ts` in lockstep.

## Shared Schemas (`packages/shared/src/notifications.ts`)

- `RegisterPushTokenBodySchema` — `{ token: z.string().regex(/^Expo(nent)?PushToken\[.+\]$/), platform: z.enum(['ios','android']) }`
- `PushTokenResponseSchema` — `{ id, token, platform }`
- `NotificationPreferencesSchema` — full prefs read response
- `UpdateNotificationPreferencesBodySchema` — partial of prefs

## Env

`packages/env/src/server.ts` adds:
- `EXPO_ACCESS_TOKEN: z.string().optional()` — passed to `Expo` client constructor when present (higher rate limits + receipt fetching).

## Testing Strategy

### Unit (Vitest, Expo client mocked)
- `templates.test.ts` — every template returns non-empty PT-BR title + body
- `dispatcher.test.ts` — bails on prefs-disabled; respects token list; enqueues one job per chunk
- `tokens.service.test.ts` — register upserts; unregister scoped to user; silent on foreign-token delete
- `preferences.service.test.ts` — partial update merges; out-of-range hour rejected
- `push.client.test.ts` — receipt handler prunes `DeviceNotRegistered` tokens
- Sweep handler — stubbed repo, asserts primary-vs-late filter logic

### Integration (PGlite)
- `tokens.repository.integration.test.ts` — upsert by token (re-insert same token under different user → single row, updated user_id)
- `notifications.sweep.integration.test.ts` — seed users with various `notification_hour` values, completed/uncompleted sessions today, prefs disabled; assert eligibility query returns the exact expected set

### Manual smoke (requires one Expo physical device)
- Register a real Expo token via `POST /users/me/push-tokens`
- Force-trigger a sweep via a one-shot dev script
- Confirm push arrives on device

## Acceptance Criteria

- 4 endpoints live, type-safe, integration-tested
- Migration 0004 applies cleanly + `verify:migration` passes
- Hourly cron sweep registered and idempotent (replays don't double-send — Expo dedupes by `id` within batch, plus our query is naturally idempotent within an hour)
- Achievement event hooks fire from streaks + sessions services without blocking HTTP responses
- `DeviceNotRegistered` receipts prune the corresponding `push_token` row
- All unit + integration tests pass
- Worker boots clean with the new queues registered
- Zero non-test typecheck errors

---

*End of spec.*
