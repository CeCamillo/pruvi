# Auth UX Completion — Design Spec

**Sub-project:** Tier 1 #1 of the post-inventory implementation roadmap (`docs/feature-inventory.md`).
**Date:** 2026-04-30
**Status:** Approved by user 2026-04-30, pending implementation plan.
**Goal:** Make the app reachable for unauthenticated users by mounting the existing Better-Auth sign-in/up forms into routes, putting a single redirect gate at the root, wiring logout, and hardening the server URL env var.

---

## Context

The native app (`apps/native`) ships two real Better-Auth callers — `components/sign-in.tsx` and `components/sign-up.tsx` — that **no route mounts**. There is no auth route group on the merged-UI branch. The phase4 branch (`feature/phase4-progress-subject`) already implements a working `AuthGate` and `(auth)/` route group; this spec captures the **end-state** so the implementation plan can reconcile both branches.

This is the smallest-blast-radius unblocker in the roadmap. It must ship before any other sub-project, because nothing else is reachable from a fresh device install.

---

## Architectural Approach

**Chosen: Root-layout gating.** A single `AuthGate` component in `app/_layout.tsx` reads `authClient.useSession()` and `usePreferences()` (with `enabled: !!session`), then renders `<Slot />` if the user is on the right route group, or `<Redirect>` to push them there.

Rejected approaches:
- *Per-group `_layout.tsx` guards* — distributes the same check across three layouts; redundant; easy to forget one.
- *`<Redirect>` in route files* — causes flash of wrong content on cold start.

---

## Route Structure (end state)

```
app/
  _layout.tsx               # Hosts AuthGate; AuthGate decides Slot vs Redirect
  (auth)/
    _layout.tsx             # Stack { headerShown: false }
    login.tsx               # mounts <SignIn />
    register.tsx            # mounts <SignUp />
  (onboarding)/             # already exists in both branches
    _layout.tsx
    start.tsx
    ...
  (app)/
    _layout.tsx             # post-auth shell
    (drawer)/               # from merged UI (drawer + tabs)
      _layout.tsx
      (tabs)/
        _layout.tsx
        index.tsx
      profile.tsx
      progresso.tsx
      ...
    mais.tsx                # transparent modal — Sair lives here
    modal.tsx
```

Login and register are separate routes (not a single tabbed screen). Cleaner URLs, simpler back-stack, the existing components map 1:1.

---

## Redirect Rules (single source of truth)

`AuthGate` consumes three signals: `session` (from `useSession`), `prefs` (from `usePreferences`, only enabled when session exists), and `segments` (from `useSegments`).

| Session | Prefs.onboardingCompleted | Current segment | Render |
|---|---|---|---|
| `isPending` | — | — | `<LoadingScreen />` |
| `error` | — | — | `<ErrorScreen retry />` |
| `null` | — | `(auth)` | `<Slot />` |
| `null` | — | anywhere else | `<Redirect href="/(auth)/login" />` |
| present | `isPending` | — | `<LoadingScreen />` |
| present | `false` | `(onboarding)` | `<Slot />` |
| present | `false` | anywhere else | `<Redirect href="/(onboarding)/start" />` |
| present | `true` | `(auth)` or `(onboarding)` | `<Redirect href="/(app)" />` |
| present | `true` | `(app)` | `<Slot />` |

**Implementation note:** the rules table will be extracted as a pure function `getAuthRedirectTarget(session, prefs, segments) → "loading" | "error" | "stay" | { redirect: Href }` for unit-testability. The `AuthGate` component is a thin renderer over this function.

---

## Logout Flow

Sair item in `mais.tsx`:
```tsx
onPress: async () => {
  const ok = await confirmDestructiveAction("Sair da conta?");
  if (!ok) return;
  await authClient.signOut();
  queryClient.clear();
  // AuthGate auto-redirects on next render — no explicit navigate
}
```

`queryClient.clear()` (not `invalidateQueries`) — removes all cached private data; avoids 401-spam during cookie rotation.

`confirmDestructiveAction` is a tiny wrapper over `Alert.alert` that returns a Promise<boolean>. Lives in `lib/ui/confirm.ts`.

---

## Sign-in / Sign-up Screens

Each route file is a thin wrapper:

```tsx
// app/(auth)/login.tsx
import { SignIn } from "@/components/sign-in";
export default function LoginRoute() {
  return <SignIn />;
}
```

The existing components own form state, validation, submit. Cross-link buttons inside each component navigate via `router.replace` (not `push`) to keep the back-stack clean.

**Refactor in scope:** `getErrorMessage` is duplicated verbatim in both `sign-in.tsx` and `sign-up.tsx`. Extract to `lib/auth-errors.ts` as a single function that maps Better-Auth error codes to Portuguese copy. Both components import from there.

---

## Environment Hardening

`packages/env/src/native.ts`: change `EXPO_PUBLIC_SERVER_URL` from `.optional()` to `z.string().url()` (required, must parse as URL).

Rationale: Better-Auth's client uses this as `baseURL`. A missing value silently fails at first network call. Failing at app startup is louder, faster, and impossible to deploy past CI.

---

## Loading State

`<LoadingScreen />` = full-screen spinner over `bg-background`. Used for both session check and preferences check phases. Typical duration on signed-in cold start: 200–800ms.

No skeleton screens. The flash of skeleton-then-real-content is worse UX than a clean centered spinner for sub-second waits.

---

## Error UX

Three failure modes, three treatments:

1. **Session check error** (network failure during `useSession`): full-screen `<ErrorScreen />` with retry button (`refetch()`). Portuguese copy: "Não foi possível verificar sua sessão. Verifique sua conexão e tente novamente."
2. **Sign-in / sign-up failure**: existing components render `getErrorMessage(error.code)` inline below the form. No spec change.
3. **Logout failure**: silently retried once; if still fails, alert "Não foi possível sair. Tente novamente." (rare — `signOut` is fire-and-forget on a local cookie).

---

## Testing Strategy

- **Unit (native):** `getAuthRedirectTarget(session, prefs, segments)` covers all 9 rows of the redirect table. `getErrorMessage(code)` covers the Better-Auth error code mapping.
- **Integration (server):** existing `/users/me/preferences` tests stay green — no BE changes in this sub-project.
- **No E2E**: redirect logic is well-covered by the unit table; an E2E "sign in → land on drawer" test is high-cost low-value at this stage.

---

## Pre-existing Assets (informational)

When the implementation plan reconciles branches, these phase4 artifacts can be re-used:
- `apps/native/app/_layout.tsx` — current `AuthGate` implementation. Adopt as-is, then update the post-auth redirect target from `/(app)/(tabs)` to `/(app)` (since the merged UI uses a drawer over tabs).
- `apps/native/app/(auth)/_layout.tsx`, `login.tsx`, `register.tsx` — already exist on phase4. Confirm they import the components as specified above; otherwise, port.
- `apps/native/hooks/useOnboarding.ts` — `usePreferences()` already exists; reuse.

---

## Acceptance Criteria

A device-fresh user opens the app and:

1. Sees a spinner briefly, then the login screen. ✓
2. Tapping "Criar conta" navigates to register; back-button-on-register returns to login (not to a blank screen). ✓
3. Submitting valid signup → onboarding/start. Submitting valid signin (already-onboarded user) → drawer home. ✓
4. Force-quit during onboarding, reopen → AuthGate sees session + `onboardingCompleted: false` → routes to `(onboarding)/start`. (Step-level resume is out of scope; funnel state is local-only.) ✓
5. After completing onboarding, force-quit, reopen → drawer home. ✓
6. Tapping Sair in Mais → confirmation alert → signed out → login screen. ✓
7. Build with `EXPO_PUBLIC_SERVER_URL` unset → fails at startup with a clear error, NOT at first network call. ✓
8. `getErrorMessage` exists once, in `lib/auth-errors.ts`. Imports from both sign-in and sign-up resolve to it. ✓

---

## Out of Scope (Deferred to Future Sub-projects)

- **Forgot password** — Better-Auth supports `requestPasswordReset` + `resetPassword`; needs email transport (Resend or similar), 2 new screens, env keys. Spinoff sub-project.
- **Email verification** — Better-Auth supports it; same email-transport dependency. Spinoff sub-project.
- **Google / Apple OAuth** — additional env config + sign-in button. Spinoff sub-project.
- **Account deletion / data export** — privacy/GDPR compliance work. Spinoff later.
- **Avatar upload** — sub-project #2 adds the `avatarUrl` field on the user; the upload pipeline (camera/gallery picker, S3/Cloudinary, signed-URL flow) is a later sub-project.

---

## Risks & Open Questions

1. **Branch reconciliation order.** The mocked-UI branch (`feature/onboarding-screens`) and the phase4 branch are both ahead of main and both have edits that would conflict. Implementation plan must specify which branches to merge in what order before applying this spec's diff.
2. **`(app)` vs `(app)/(tabs)` post-auth target.** Phase4 redirects to `/(app)/(tabs)`; the merged UI uses a drawer that contains tabs. Final target should be `/(app)` (drawer's root), but this depends on how `(app)/_layout.tsx` is structured after merge.
3. **`useSegments` cold-start race.** On Expo Router v4 cold start, `useSegments()` can return `[]` for one render before the URL is known. The redirect function must handle empty segments as "stay" rather than "wrong group" to avoid spurious redirects.
