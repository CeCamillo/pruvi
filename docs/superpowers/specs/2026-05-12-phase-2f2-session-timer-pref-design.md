# Phase 2F.2 — Session timer toggle preference (design spec)

**Date:** 2026-05-12
**Branch:** `feature/phase-2f2-session-timer-pref`

## 1. Problem

`pruvi-freatures.md` §6.3 mandates a user setting to enable/disable the session timer. Currently no `show_timer` column or endpoint exists.

## 2. Goal

Add `showTimer: boolean default true` to `user` table; expose via `GET /users/me/session-preferences` and `PUT /users/me/session-preferences`. Cached identical to the notification-prefs pattern.

## 3. Architecture

- Migration `0013_*.sql`: `ALTER TABLE "user" ADD COLUMN "show_timer" boolean NOT NULL DEFAULT true`.
- `packages/db/src/schema/auth.ts`: add `showTimer: boolean("show_timer").notNull().default(true)` next to `notificationHour`.
- `packages/shared/src/users.ts` (or new `session-preferences.ts`): `SessionPreferencesSchema = z.object({ showTimer: z.boolean() })` + `UpdateSessionPreferencesBodySchema`.
- `apps/server/src/features/users/session-preferences.repository.ts` — `get(userId)` + `update(userId, { showTimer })`. Direct Drizzle, no service-layer logic.
- `apps/server/src/features/users/session-preferences.route.ts` — `GET` and `PUT`, caching `prefs:session:${userId}` for 60s with invalidation on PUT. Same shape as `preferences.route.ts`.
- Register the new route in the server bootstrap (alongside `preferencesRoutes`).

## 4. Testing

- Unit test repo `get`/`update`.
- Integration test: PUT → GET reflects new value; cache invalidated.

## 5. Acceptance criteria

- [ ] Migration applied. `user.show_timer` exists with default `true`.
- [ ] `GET /users/me/session-preferences` returns `{ showTimer: boolean }`.
- [ ] `PUT /users/me/session-preferences` accepts `{ showTimer }` and persists.
- [ ] Cache invalidated on PUT.
- [ ] Existing user rows have `showTimer = true` after migration.

## 6. Deferred

- A unified `/users/me/preferences` consolidating notifications + session + future toggles. Out of scope for v1; can refactor later.
