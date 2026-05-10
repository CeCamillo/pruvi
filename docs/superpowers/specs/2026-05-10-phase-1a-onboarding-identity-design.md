# Phase 1A — Onboarding & Identity

**Date:** 2026-05-10
**Author:** brainstorming session
**Status:** Draft → pending user review
**Depends on:** Phase 0 schema drift (`phase-0-schema-drift` branch / PR #10)

---

## Context

Backend audit (`docs/backend-audit-main.md`) identified that the largest gaps blocking a frontend rebuild are in identity/onboarding: no onboarding columns on `user`, only email/password auth (no Google or Apple), no profile or account-deletion endpoints. This phase closes those gaps end-to-end so the frontend can ship screens 1–3 (onboarding flow), the signup/login flow with social auth, and the settings/profile screens.

Per Phase 1 decomposition decision, this is the first of three sub-phases:
- **1A (this spec):** onboarding columns + endpoints, profile/delete endpoints, Google/Apple OAuth, email verification (background)
- **1B (future):** GET /subjects, question `explanation` column, question bank expansion
- **1C (future):** progress endpoints + activity calendar

Guest/anonymous flow is **deferred**. Frontend caches onboarding answers locally until user signs in, then POSTs to `/onboarding/complete`.

---

## Goals

After this phase ships, the frontend can:
- Ask all three onboarding questions and persist answers atomically at completion
- Sign users in via Google OAuth, Apple Sign-In (iOS-conditional), or email/password
- Send verification emails in the background (non-blocking)
- Show a profile screen where users edit name and avatar
- Honor LGPD account deletion requests

This is a non-disruptive additive change. No existing endpoints break.

---

## Scope

### In scope

1. **User schema additions** — 5 onboarding columns + new migration
2. **Onboarding feature** — `GET /users/me/preferences`, `PUT /users/me/preferences`, `POST /onboarding/complete`
3. **Profile feature** — `PUT /users/me/profile`
4. **Account deletion** — `DELETE /users/me`
5. **Google OAuth** — Better Auth `socialProviders.google`
6. **Apple Sign-In** — Better Auth `socialProviders.apple` (conditionally registered)
7. **Email verification (background)** — Resend transport, non-blocking
8. **Env validation extensions** — 7 new env vars (4 required, 3 optional for Apple)

### Explicitly out of scope

- Anonymous/guest sessions (cached client-side until signup)
- Anything in Phase 1B (subjects endpoint, explanations, content expansion)
- Anything in Phase 1C (progress, calendar)
- Username field (deferred to social/ranking phase)
- Avatar upload pipeline (just store URL string)
- Email change flow (Better Auth has it; not exposed in this phase)
- Apple credential rotation tooling (ops concern; spec flags it)

---

## Schema Additions

In `packages/db/src/schema/auth.ts`, extend the `user` table with 5 columns:

```typescript
selectedExam: text("selected_exam", {
  enum: ["fuvest", "unicamp", "enem", "usp_sp", "outras"],
}),
examDate: date("exam_date"),
difficulties: text("difficulties").array().notNull().default(sql`'{}'::text[]`),
dailyStudyTimeMinutes: integer("daily_study_time_minutes"),
onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
```

| Column | Type | Nullable | Default | Rationale |
|---|---|---|---|---|
| `selected_exam` | text enum | yes | null | Drizzle enum gives TS safety; DB stays plain text |
| `exam_date` | date | yes | null | Single date; spec's "month/year" maps cleanly |
| `difficulties` | text[] | no | `{}` | Postgres native array; queryable with GIN if needed later |
| `daily_study_time_minutes` | int | yes | null | Minutes; no migration needed when ranges change |
| `onboarding_completed` | bool | no | false | The gate; only flipped to true by `/onboarding/complete` |

**Invariant:** `onboarding_completed` can only transition from `false` to `true`. Enforced in service layer; never written by `PUT /users/me/preferences`.

Running `pnpm db:generate` after the edit produces a new additive migration (e.g., `0001_*.sql`) alongside Phase 0's `0000_needy_king_bedlam.sql`.

---

## Endpoints

### Onboarding feature (`apps/server/src/features/onboarding/`)

New module: `onboarding.repository.ts`, `onboarding.service.ts`, `onboarding.route.ts`, tests.

#### `GET /users/me/preferences`

Read current onboarding state. Cached 60s in Redis (`prefs:{userId}`).

Response:
```typescript
{
  selectedExam: "fuvest" | "unicamp" | "enem" | "usp_sp" | "outras" | null,
  examDate: string | null,        // ISO date "YYYY-MM-DD"
  difficulties: string[],          // subject slugs
  dailyStudyTimeMinutes: number | null,
  onboardingCompleted: boolean,
}
```

#### `PUT /users/me/preferences`

Partial update for post-onboarding settings edits. Validates `difficulties[]` entries against `subject.slug` (cached subject list, 5min TTL). Never touches `onboardingCompleted`. Invalidates the prefs cache.

Body (all optional):
```typescript
{
  selectedExam?: "fuvest" | "unicamp" | "enem" | "usp_sp" | "outras",
  examDate?: string,
  difficulties?: string[],
  dailyStudyTimeMinutes?: number,
}
```

Response: same shape as GET.

#### `POST /onboarding/complete`

Atomic save + flip the gate. Returns `409 Conflict` if `onboardingCompleted` is already true (idempotency guard; client treats 409 as success). Single transaction writes all 4 preference fields and sets `onboardingCompleted = true`. Invalidates the prefs cache.

Body (all required):
```typescript
{
  selectedExam: "fuvest" | "unicamp" | "enem" | "usp_sp" | "outras",
  examDate: string,
  difficulties: string[],
  dailyStudyTimeMinutes: number,
}
```

Response: same shape as GET (with `onboardingCompleted: true`).

### Users feature (`apps/server/src/features/users/`)

New module: `users.repository.ts`, `users.service.ts`, `users.route.ts`, tests.

#### `PUT /users/me/profile`

Body:
```typescript
{
  name?: string,           // min 1, max 80
  image?: string | null,   // URL or null to clear
}
```

Response:
```typescript
{ id, name, email, image }
```

`email` is read-only.

#### `DELETE /users/me`

Cascades via existing FK `ON DELETE CASCADE` on `session`, `account`, `daily_session`, `review_log`. Returns `204 No Content`. Frontend handles local-state cleanup and reroute.

---

## Auth Wiring

### Better Auth config (`packages/auth/src/index.ts`)

```typescript
import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
import { Resend } from "resend";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "@pruvi/env/server";
import { db } from "@pruvi/db";

const resend = new Resend(env.RESEND_API_KEY);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,  // non-blocking per spec
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: user.email,
        subject: "Verifique seu e-mail no Pruvi",
        html: `<p>Olá ${user.name}, confirme seu e-mail: <a href="${url}">${url}</a></p>`,
      });
    },
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    ...(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET
      ? {
          apple: {
            clientId: env.APPLE_CLIENT_ID,
            clientSecret: env.APPLE_CLIENT_SECRET,
            appBundleIdentifier: env.APPLE_BUNDLE_ID,
          },
        }
      : {}),
  },
  plugins: [expo()],
});
```

### Env vars (`packages/env/src/server.ts`)

| Var | Type | Required | Purpose |
|---|---|---|---|
| `RESEND_API_KEY` | string min 1 | yes | Resend SDK auth |
| `RESEND_FROM_EMAIL` | email | yes | Verified sender |
| `GOOGLE_CLIENT_ID` | string min 1 | yes | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | string min 1 | yes | Google OAuth |
| `APPLE_CLIENT_ID` | string | no | Apple Service ID |
| `APPLE_CLIENT_SECRET` | string | no | Apple signed JWT |
| `APPLE_BUNDLE_ID` | string | no | iOS bundle ID |

Apple vars are optional in env validation. If any are missing, the `socialProviders.apple` block is omitted at runtime — server boots cleanly without Apple Developer setup.

### Email verification UX

- `requireEmailVerification: false` — users can use the app immediately
- `sendOnSignUp: true` — verification email auto-sends on email signup
- `autoSignInAfterVerification: true` — clicking the link verifies + signs in (useful for cross-device)
- Frontend may surface a soft banner ("Verifique seu e-mail") but does not gate any feature

### External setup checklist

Developer must configure before this ships:
1. Resend account → API key, verified sending domain → `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
2. GCP Console → OAuth 2.0 client with redirect URI `{BETTER_AUTH_URL}/api/auth/callback/google` → `GOOGLE_CLIENT_ID/SECRET`
3. (Optional, iOS-only) Apple Developer → Service ID + key → Apple env vars

---

## Testing

| Layer | What | How |
|---|---|---|
| Unit | `OnboardingService.completeOnboarding` gates on flag, validates difficulties, atomic | Vitest + mocked repo |
| Unit | `OnboardingService.updatePreferences` partial update, never flips flag | Vitest + mocked repo |
| Unit | `UsersService.updateProfile` name length validation | Vitest + mocked repo |
| Unit | `UsersService.deleteAccount` calls repo | Vitest + mocked repo |
| Integration | Onboarding round-trip: POST → GET shows completed=true | Vitest + PGlite |
| Integration | Account delete cascades | Vitest + PGlite |
| Integration | Email verification sends via mocked transport | Mock `resend.emails.send` |
| Manual | Google OAuth round-trip from native app | Dev server + native client |
| Manual | Apple Sign-In (if creds configured) | Dev server + iOS native |

No tests for Better Auth internals, the Resend SDK itself, or enum exhaustiveness (TS catches).

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Drizzle `text().array()` default value quirks | Use `sql\`'{}'::text[]\``; smoke test catches |
| Resend domain verification takes hours (DNS) | Dev can use Resend's test sender; document in spec |
| GCP OAuth redirect URI mismatch | Document exact URI in spec |
| 409 on already-completed onboarding too strict on retries | Client treats 409 as success; idempotency simpler than upsert semantics |
| Apple Sign-In secret expires every 6 months | Out of scope; flagged as ops concern in spec |
| Empty `difficulties: []` ambiguity | Treat as valid input; "skipped" is frontend semantics |
| Pre-prod users get re-onboarded after migration | Acceptable per Phase 0 (no prod data) |
| `dailyStudyTimeMinutes` lacks bounds at DB layer | Validate `min: 1, max: 240` at Zod layer (4-hour ceiling) |

---

## Rollout

**Stacked branching off `phase-0-schema-drift`.** This phase depends on Phase 0 schema fixes; branching off the unmerged Phase 0 branch lets us proceed without waiting for code review. Rebase risk is low because Phase 0 is a clean refactor. If Phase 0 review surfaces material changes, rebase Phase 1A on top.

**Single PR per phase.** Each sub-phase (1A, 1B, 1C) is one PR.

### Definition of Done

- [ ] 5 columns added to `user` table; new migration generated
- [ ] 5 new endpoints work correctly per spec
- [ ] Better Auth config has Google (always) and Apple (conditional)
- [ ] Resend transport wired; verification email sends in dev
- [ ] `pnpm -r test` passes
- [ ] `pnpm verify:migration` passes
- [ ] New env vars documented in `apps/server/.env.example` or README
- [ ] DELETE /users/me cascade verified by integration test
- [ ] No regression in existing endpoints

---

## Open Items for Implementer

- `dailyStudyTimeMinutes` validation bounds (Zod): `min: 1, max: 240` (4h ceiling). Rejected at request layer.
- The verification email template is intentionally plain HTML in the spec. Use brand voice/Pruvi visual identity if available; otherwise keep it minimal.
- The prefs cache key: `prefs:{userId}` with 60s TTL. Subject list cache: `subjects:slugs` with 5min TTL.
- Drizzle adapter for Better Auth: `drizzleAdapter(db, { provider: "pg" })`. The schema tables Better Auth expects (`user`, `session`, `account`, `verification`) are already there from Phase 0.

---

## Out-of-Band Notes

After Phase 1A lands, Phase 1B (subjects + content) and Phase 1C (progress endpoints) become the next priorities. They can run in parallel since they touch different domains.

Apple Sign-In may need its own Phase 1A.1 if the Apple Developer account isn't ready when this phase begins. Spec is structured so that omitting Apple vars is a graceful no-op.
