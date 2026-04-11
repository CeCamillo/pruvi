# Phase 1: Frontend Foundation

> Design spec for restructuring the native app to the target architecture before wiring any screens to real data.

## Context

Phase 0 (PR #2) stabilized `@pruvi/shared` schemas. The native app (`apps/native`) currently has 20+ pixel-perfect screens with 100% mock data, using `(onboarding)/` + `(drawer)/` flat navigation, `@tanstack/react-form`, HeroUI Native as the component library, and no data fetching or state management libraries.

Phase 1 transforms this into the target architecture from `native_architecture.md`: proper navigation groups, auth guard, providers, and placeholder screens ready for Phase 2+ wiring.

## Scope

- Swap dependencies (add TanStack Query, Zustand, FlashList, react-hook-form; remove @tanstack/react-form)
- Archive existing screens to `_legacy/`
- Create target navigation structure: `(auth)/` + `(app)/(tabs)/` + `session/` + `subject/`
- Rewrite root layout with auth guard + QueryClientProvider
- Create `Screen` and `Skeleton` common components
- Rewrite auth screens with react-hook-form + zod + auth service layer
- NOT touching: backend, `@pruvi/shared`, any data fetching, Zustand stores, real screen implementations

## Design Decisions

1. **Existing screens:** Archive to `app/_legacy/` (Expo Router ignores `_` prefix). Preserves frontend team's work as copy-paste reference for later phases.
2. **Common components:** Only create `Screen` (SafeAreaView wrapper) and `Skeleton` (loading pulse). HeroUI's `Button` is already used everywhere — no custom wrapper needed.
3. **Auth forms:** Rewrite with react-hook-form during Phase 1, not later. Forms are small (~80 lines each), and having two form libraries simultaneously creates confusion.
4. **Auth guard:** Use Better Auth's `useSession()` hook + loading state while SecureStore resolves + `Redirect` to `/(auth)/login` when no session. QueryClientProvider wraps everything (auth + app screens).

## Changes

### 1. Dependencies

**Install:**
- `@tanstack/react-query` v5
- `zustand` v5
- `@shopify/flash-list` v1
- `react-hook-form` + `@hookform/resolvers`

**Remove:**
- `@tanstack/react-form`

**Unchanged:** HeroUI Native, Better Auth, Tailwind + Uniwind, Reanimated, expo-router, all Expo packages.

### 2. Archive Existing Screens

Move into `app/_legacy/` (Expo Router ignores `_` prefix):
- `app/(onboarding)/` → `app/_legacy/(onboarding)/`
- `app/(drawer)/` → `app/_legacy/(drawer)/`
- Modal screens (`materias.tsx`, `permissao-contatos.tsx`, `mais.tsx`, `filtro-assuntos.tsx`, `compartilhar-perfil.tsx`) → `app/_legacy/modals/`

Keep in place: `+not-found.tsx`, `modal.tsx`.

### 3. Navigation Structure

```
app/
├── _layout.tsx              ← Rewrite: auth guard + QueryClientProvider + providers
├── _legacy/                 ← Archived screens (ignored by Expo Router)
│   ├── (onboarding)/
│   ├── (drawer)/
│   └── modals/
├── (auth)/
│   ├── _layout.tsx          ← Stack, no header, slide_from_right
│   ├── login.tsx            ← react-hook-form + zod + authService.login()
│   └── register.tsx         ← react-hook-form + zod + authService.register()
├── (app)/
│   ├── _layout.tsx          ← Drawer with no visible items (swipe disabled, only renders children)
│   ├── (tabs)/
│   │   ├── _layout.tsx      ← Bottom tab bar: Home, Progress, Profile
│   │   ├── index.tsx        ← Placeholder
│   │   ├── progress.tsx     ← Placeholder
│   │   └── profile.tsx      ← Placeholder
│   ├── session/
│   │   ├── [id].tsx         ← Placeholder
│   │   └── result.tsx       ← Placeholder
│   └── subject/
│       └── [slug].tsx       ← Placeholder
├── +not-found.tsx
└── modal.tsx
```

### 4. Root Layout — Provider Stack + Auth Gate

```
GestureHandlerRootView
  └── KeyboardProvider
      └── QueryClientProvider
          └── AppThemeProvider
              └── HeroUINativeProvider
                  └── Auth Gate
                      ├── isPending → LoadingScreen (Spinner)
                      ├── No session → Redirect to /(auth)/login
                      └── Valid session → Redirect to /(app)/(tabs)
```

**QueryClient defaults:**
- `staleTime: 5 * 60 * 1000` (5 minutes)
- `retry: 2`

**Auth gate:** Uses `authClient.useSession()`. While `isPending`, shows a loading screen (Spinner on theme background). Once resolved, redirects based on session state.

### 5. Common Components

**`components/common/Screen.tsx`** — evolve from existing `container.tsx`:

```typescript
interface ScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;  // default true
  padded?: boolean;      // default true
}
```

- `SafeAreaView` from `react-native-safe-area-context`
- Conditional `ScrollView` wrapper
- `bg-background` from theme
- Delete `container.tsx` after migration

**`components/common/Skeleton.tsx`** — new loading placeholder:

```typescript
interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  rounded?: boolean;  // circular for avatars
}
```

- Reanimated opacity pulse: `withRepeat(withTiming(0.5), -1, true)`
- Background: `bg-default-200` (HeroUI muted surface)

**No custom Button.** HeroUI's `Button` with existing variants is already used across the codebase.

### 6. Auth Service + Screens

**`services/auth.service.ts`** — thin wrapper, first file in `services/`:

```typescript
export const authService = {
  login: (email, password) => authClient.signIn.email({ email, password }),
  register: (name, email, password) => authClient.signUp.email({ name, email, password }),
  logout: () => authClient.signOut(),
};
```

**`(auth)/login.tsx`:**
- `react-hook-form` + `zodResolver` (email + password min 8)
- HeroUI visual components (TextField, Input, Label, Button)
- Calls `authService.login()` on submit
- Toast on error
- Link to `/(auth)/register`
- Wrapped in `Screen`

**`(auth)/register.tsx`:**
- Same pattern, adds name field
- Calls `authService.register()`
- Link to `/(auth)/login`

**`(auth)/_layout.tsx`:**
- Stack navigator, no header, `slide_from_right` animation

### 7. Placeholder Screens

6 placeholder screens in `(app)/`:
- `(tabs)/index.tsx` — "Home"
- `(tabs)/progress.tsx` — "Progress"
- `(tabs)/profile.tsx` — "Profile"
- `session/[id].tsx` — "Session"
- `session/result.tsx` — "Result"
- `subject/[slug].tsx` — "Subject"

Each renders `Screen` with centered title text. They verify navigation works end-to-end. Wired to real data in Phases 3-4.

## Exit Criteria

1. App launches → loading spinner while session resolves from SecureStore
2. No session → redirects to `(auth)/login`
3. Register → creates account → redirects to `(app)/(tabs)/`
4. Login → validates credentials → redirects to `(app)/(tabs)/`
5. Tab bar renders with 3 tabs (Home, Progress, Profile) showing placeholders
6. `session/[id]` and `subject/[slug]` routes navigable
7. Kill + reopen app → session persists → skips login
8. `@tanstack/react-form` removed from `package.json`
9. All archived screens in `app/_legacy/`, not in navigation

## Files Changed

| File | Change |
|------|--------|
| `apps/native/package.json` | Add TanStack Query, Zustand, FlashList, react-hook-form. Remove @tanstack/react-form. |
| `apps/native/app/_layout.tsx` | Rewrite: QueryClientProvider + auth gate |
| `apps/native/app/(onboarding)/` | Move to `_legacy/` |
| `apps/native/app/(drawer)/` | Move to `_legacy/` |
| `apps/native/app/materias.tsx` + 4 modals | Move to `_legacy/modals/` |
| `apps/native/app/(auth)/_layout.tsx` | New: Stack navigator |
| `apps/native/app/(auth)/login.tsx` | New: react-hook-form sign in |
| `apps/native/app/(auth)/register.tsx` | New: react-hook-form sign up |
| `apps/native/app/(app)/_layout.tsx` | New: Drawer layout |
| `apps/native/app/(app)/(tabs)/_layout.tsx` | New: Bottom tab bar |
| `apps/native/app/(app)/(tabs)/index.tsx` | New: Placeholder home |
| `apps/native/app/(app)/(tabs)/progress.tsx` | New: Placeholder progress |
| `apps/native/app/(app)/(tabs)/profile.tsx` | New: Placeholder profile |
| `apps/native/app/(app)/session/[id].tsx` | New: Placeholder session |
| `apps/native/app/(app)/session/result.tsx` | New: Placeholder result |
| `apps/native/app/(app)/subject/[slug].tsx` | New: Placeholder subject |
| `apps/native/services/auth.service.ts` | New: Auth service wrapper |
| `apps/native/components/common/Screen.tsx` | New: SafeAreaView wrapper (evolve from container.tsx) |
| `apps/native/components/common/Skeleton.tsx` | New: Loading placeholder |
| `apps/native/components/container.tsx` | Delete (replaced by Screen) |
| `apps/native/components/sign-in.tsx` | Delete (replaced by (auth)/login.tsx) |
| `apps/native/components/sign-up.tsx` | Delete (replaced by (auth)/register.tsx) |
