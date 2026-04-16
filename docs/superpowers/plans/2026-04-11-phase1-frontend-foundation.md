# Phase 1: Frontend Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the native app from mock-data flat navigation to the target architecture with auth guard, providers, and placeholder screens.

**Architecture:** Archive existing 20+ screens to `_legacy/`, create `(auth)/` + `(app)/` route groups, rewrite root layout with auth guard + QueryClientProvider, build common `Screen` and `Skeleton` components, rewrite auth forms with react-hook-form.

**Tech Stack:** Expo Router v4, TanStack Query v5, Zustand v5, react-hook-form, HeroUI Native, Better Auth, Reanimated

---

### Task 1: Swap dependencies

**Files:**
- Modify: `apps/native/package.json`

- [ ] **Step 1: Install new dependencies**

Run from `apps/native/`:

```bash
cd apps/native && pnpm add @tanstack/react-query@^5 zustand@^5 @shopify/flash-list@^1 react-hook-form @hookform/resolvers
```

- [ ] **Step 2: Remove @tanstack/react-form**

```bash
cd apps/native && pnpm remove @tanstack/react-form
```

- [ ] **Step 3: Verify package.json**

Run: `cd apps/native && cat package.json | grep -E "react-query|zustand|flash-list|react-hook-form|hookform|tanstack/react-form"`

Expected output should show the 5 new packages and NOT show `@tanstack/react-form`.

- [ ] **Step 4: Install and verify**

```bash
cd /Users/cesarcamillo/dev/pruvi && pnpm install
```

Expected: Clean install, no peer dependency errors for the new packages.

- [ ] **Step 5: Commit**

```bash
git add apps/native/package.json pnpm-lock.yaml
git commit -m "feat(native): swap dependencies — add TanStack Query, Zustand, FlashList, react-hook-form; remove @tanstack/react-form"
```

---

### Task 2: Archive existing screens to `_legacy/`

**Files:**
- Move: `apps/native/app/(onboarding)/` → `apps/native/app/_legacy/(onboarding)/`
- Move: `apps/native/app/(drawer)/` → `apps/native/app/_legacy/(drawer)/`
- Move: 5 modal files → `apps/native/app/_legacy/modals/`
- Delete: `apps/native/components/sign-in.tsx` (replaced in Task 6)
- Delete: `apps/native/components/sign-up.tsx` (replaced in Task 6)

- [ ] **Step 1: Create `_legacy` directory and move route groups**

```bash
cd apps/native/app
mkdir -p _legacy/modals
mv "(onboarding)" _legacy/
mv "(drawer)" _legacy/
```

- [ ] **Step 2: Move modal screens**

```bash
cd apps/native/app
mv materias.tsx _legacy/modals/
mv permissao-contatos.tsx _legacy/modals/
mv mais.tsx _legacy/modals/
mv filtro-assuntos.tsx _legacy/modals/
mv compartilhar-perfil.tsx _legacy/modals/
```

- [ ] **Step 3: Delete old auth form components**

```bash
rm apps/native/components/sign-in.tsx
rm apps/native/components/sign-up.tsx
```

These are replaced by `(auth)/login.tsx` and `(auth)/register.tsx` in Task 6.

- [ ] **Step 4: Verify Expo Router ignores `_legacy/`**

The `_` prefix is an Expo Router convention — files and directories starting with `_` are not treated as routes. Verify by listing what Expo Router would see:

```bash
ls apps/native/app/ | grep -v "^_"
```

Expected: Only `_layout.tsx`, `+not-found.tsx`, `modal.tsx` remain as route files (plus the new `(auth)/` and `(app)/` groups created in later tasks).

- [ ] **Step 5: Commit**

```bash
cd /Users/cesarcamillo/dev/pruvi
git add -A apps/native/app/_legacy/
git add apps/native/app/materias.tsx apps/native/app/permissao-contatos.tsx apps/native/app/mais.tsx apps/native/app/filtro-assuntos.tsx apps/native/app/compartilhar-perfil.tsx
git add apps/native/components/sign-in.tsx apps/native/components/sign-up.tsx
git commit -m "refactor(native): archive existing screens to _legacy/, remove old auth components"
```

---

### Task 3: Create common components — Screen and Skeleton

**Files:**
- Create: `apps/native/components/common/Screen.tsx`
- Create: `apps/native/components/common/Skeleton.tsx`
- Delete: `apps/native/components/container.tsx`

- [ ] **Step 1: Create `Screen` component**

Create `apps/native/components/common/Screen.tsx`:

```typescript
import { cn } from "heroui-native";
import { type PropsWithChildren } from "react";
import { ScrollView, View, type ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  padded?: boolean;
  className?: string;
  scrollViewProps?: Omit<ScrollViewProps, "contentContainerStyle">;
}

export function Screen({
  children,
  scrollable = true,
  padded = true,
  className,
  scrollViewProps,
}: PropsWithChildren<ScreenProps>) {
  return (
    <SafeAreaView className={cn("flex-1 bg-background", className)}>
      {scrollable ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          {...scrollViewProps}
        >
          <View className={cn("flex-1", padded && "px-4")}>
            {children}
          </View>
        </ScrollView>
      ) : (
        <View className={cn("flex-1", padded && "px-4")}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Create `Skeleton` component**

Create `apps/native/components/common/Skeleton.tsx`:

```typescript
import { cn } from "heroui-native";
import { type ViewProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

interface SkeletonProps extends ViewProps {
  width?: number | string;
  height?: number | string;
  rounded?: boolean;
}

export function Skeleton({
  width,
  height = 16,
  rounded = false,
  className,
  style,
  ...props
}: SkeletonProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.5, { duration: 800 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className={cn("bg-default-200", rounded && "rounded-full", className)}
      style={[
        {
          width: width as number | undefined,
          height: height as number | undefined,
          borderRadius: rounded ? undefined : 8,
        },
        animatedStyle,
        style,
      ]}
      {...props}
    />
  );
}
```

- [ ] **Step 3: Delete old `container.tsx`**

```bash
rm apps/native/components/container.tsx
```

- [ ] **Step 4: Commit**

```bash
git add apps/native/components/common/Screen.tsx apps/native/components/common/Skeleton.tsx
git add apps/native/components/container.tsx
git commit -m "feat(native): add Screen and Skeleton common components, delete old container"
```

---

### Task 4: Create auth service

**Files:**
- Create: `apps/native/services/auth.service.ts`

- [ ] **Step 1: Create auth service**

Create `apps/native/services/auth.service.ts`:

```typescript
import { authClient } from "@/lib/auth-client";

export const authService = {
  login: (email: string, password: string) =>
    authClient.signIn.email({ email, password }),

  register: (name: string, email: string, password: string) =>
    authClient.signUp.email({ name, email, password }),

  logout: () => authClient.signOut(),
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/native/services/auth.service.ts
git commit -m "feat(native): add auth service layer wrapping Better Auth client"
```

---

### Task 5: Create navigation structure — layouts and placeholders

**Files:**
- Create: `apps/native/app/(auth)/_layout.tsx`
- Create: `apps/native/app/(app)/_layout.tsx`
- Create: `apps/native/app/(app)/(tabs)/_layout.tsx`
- Create: `apps/native/app/(app)/(tabs)/index.tsx`
- Create: `apps/native/app/(app)/(tabs)/progress.tsx`
- Create: `apps/native/app/(app)/(tabs)/profile.tsx`
- Create: `apps/native/app/(app)/session/[id].tsx`
- Create: `apps/native/app/(app)/session/result.tsx`
- Create: `apps/native/app/(app)/subject/[slug].tsx`

- [ ] **Step 1: Create `(auth)/_layout.tsx`**

Create `apps/native/app/(auth)/_layout.tsx`:

```typescript
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
  );
}
```

- [ ] **Step 2: Create `(app)/_layout.tsx`**

Create `apps/native/app/(app)/_layout.tsx`:

```typescript
import { Drawer } from "expo-router/drawer";

export default function AppLayout() {
  return (
    <Drawer
      screenOptions={{
        headerShown: false,
        swipeEnabled: false,
        drawerItemStyle: { display: "none" },
      }}
    />
  );
}
```

This is a minimal drawer with no visible items and swipe disabled. The drawer exists because the architecture doc specifies it — drawer menu items get added as features are built in later phases. The primary navigation is the bottom tab bar.

- [ ] **Step 3: Create `(app)/(tabs)/_layout.tsx`**

Create `apps/native/app/(app)/(tabs)/_layout.tsx`:

```typescript
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useThemeColor } from "heroui-native";

export default function TabsLayout() {
  const foreground = useThemeColor("foreground");
  const background = useThemeColor("background");

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: background },
        tabBarActiveTintColor: foreground,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progress",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 4: Create placeholder tab screens**

Create `apps/native/app/(app)/(tabs)/index.tsx`:

```typescript
import { Text } from "react-native";
import { Screen } from "@/components/common/Screen";

export default function HomeScreen() {
  return (
    <Screen scrollable={false}>
      <Text className="text-foreground text-xl font-semibold text-center mt-20">
        Home
      </Text>
      <Text className="text-default-500 text-center mt-2">
        Session entry point — wired in Phase 3
      </Text>
    </Screen>
  );
}
```

Create `apps/native/app/(app)/(tabs)/progress.tsx`:

```typescript
import { Text } from "react-native";
import { Screen } from "@/components/common/Screen";

export default function ProgressScreen() {
  return (
    <Screen scrollable={false}>
      <Text className="text-foreground text-xl font-semibold text-center mt-20">
        Progress
      </Text>
      <Text className="text-default-500 text-center mt-2">
        Stats & subject history — wired in Phase 4
      </Text>
    </Screen>
  );
}
```

Create `apps/native/app/(app)/(tabs)/profile.tsx`:

```typescript
import { Text } from "react-native";
import { Screen } from "@/components/common/Screen";

export default function ProfileScreen() {
  return (
    <Screen scrollable={false}>
      <Text className="text-foreground text-xl font-semibold text-center mt-20">
        Profile
      </Text>
      <Text className="text-default-500 text-center mt-2">
        User profile + settings — wired in Phase 4
      </Text>
    </Screen>
  );
}
```

- [ ] **Step 5: Create placeholder session screens**

Create `apps/native/app/(app)/session/[id].tsx`:

```typescript
import { Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/common/Screen";

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen scrollable={false}>
      <Text className="text-foreground text-xl font-semibold text-center mt-20">
        Session {id}
      </Text>
      <Text className="text-default-500 text-center mt-2">
        Active Q&A loop — wired in Phase 3
      </Text>
    </Screen>
  );
}
```

Create `apps/native/app/(app)/session/result.tsx`:

```typescript
import { Text } from "react-native";
import { Screen } from "@/components/common/Screen";

export default function SessionResultScreen() {
  return (
    <Screen scrollable={false}>
      <Text className="text-foreground text-xl font-semibold text-center mt-20">
        Session Result
      </Text>
      <Text className="text-default-500 text-center mt-2">
        XP breakdown — wired in Phase 3
      </Text>
    </Screen>
  );
}
```

- [ ] **Step 6: Create placeholder subject screen**

Create `apps/native/app/(app)/subject/[slug].tsx`:

```typescript
import { Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/common/Screen";

export default function SubjectScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  return (
    <Screen scrollable={false}>
      <Text className="text-foreground text-xl font-semibold text-center mt-20">
        Subject: {slug}
      </Text>
      <Text className="text-default-500 text-center mt-2">
        Review history — wired in Phase 4
      </Text>
    </Screen>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/native/app/\(auth\)/ apps/native/app/\(app\)/
git commit -m "feat(native): create target navigation structure with layouts and placeholder screens"
```

---

### Task 6: Create auth screens — login and register

**Files:**
- Create: `apps/native/app/(auth)/login.tsx`
- Create: `apps/native/app/(auth)/register.tsx`

- [ ] **Step 1: Create login screen**

Create `apps/native/app/(auth)/login.tsx`:

```typescript
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  FieldError,
  Input,
  Label,
  Spinner,
  Surface,
  TextField,
  useToast,
} from "heroui-native";
import { useRef } from "react";
import { Text, TextInput, View } from "react-native";
import { Link } from "expo-router";
import { z } from "zod";

import { Screen } from "@/components/common/Screen";
import { authService } from "@/services/auth.service";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required").min(8, "Use at least 8 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const passwordRef = useRef<TextInput>(null);
  const { toast } = useToast();

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    const result = await authService.login(data.email.trim(), data.password);

    if (result.error) {
      toast.show({
        variant: "danger",
        label: result.error.message || "Failed to sign in",
      });
    } else {
      reset();
      toast.show({ variant: "success", label: "Signed in successfully" });
    }
  };

  return (
    <Screen>
      <View className="flex-1 justify-center">
        <Surface variant="secondary" className="p-4 rounded-lg">
          <Text className="text-foreground font-medium mb-4">Sign In</Text>

          <View className="gap-3">
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField isInvalid={!!errors.email}>
                  <Label>Email</Label>
                  <Input
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="email@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                  <FieldError>{errors.email?.message}</FieldError>
                </TextField>
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField isInvalid={!!errors.password}>
                  <Label>Password</Label>
                  <Input
                    ref={passwordRef}
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="••••••••"
                    secureTextEntry
                    autoComplete="password"
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={handleSubmit(onSubmit)}
                  />
                  <FieldError>{errors.password?.message}</FieldError>
                </TextField>
              )}
            />

            <Button onPress={handleSubmit(onSubmit)} isDisabled={isSubmitting} className="mt-1">
              {isSubmitting ? (
                <Spinner size="sm" color="default" />
              ) : (
                <Button.Label>Sign In</Button.Label>
              )}
            </Button>
          </View>

          <Link href="/(auth)/register" asChild>
            <Text className="text-primary text-center mt-4">
              Don't have an account? Sign Up
            </Text>
          </Link>
        </Surface>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 2: Create register screen**

Create `apps/native/app/(auth)/register.tsx`:

```typescript
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  FieldError,
  Input,
  Label,
  Spinner,
  Surface,
  TextField,
  useToast,
} from "heroui-native";
import { useRef } from "react";
import { Text, TextInput, View } from "react-native";
import { Link } from "expo-router";
import { z } from "zod";

import { Screen } from "@/components/common/Screen";
import { authService } from "@/services/auth.service";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").min(2, "Name must be at least 2 characters"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required").min(8, "Use at least 8 characters"),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const { toast } = useToast();

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = async (data: RegisterForm) => {
    const result = await authService.register(
      data.name.trim(),
      data.email.trim(),
      data.password,
    );

    if (result.error) {
      toast.show({
        variant: "danger",
        label: result.error.message || "Failed to sign up",
      });
    } else {
      reset();
      toast.show({ variant: "success", label: "Account created successfully" });
    }
  };

  return (
    <Screen>
      <View className="flex-1 justify-center">
        <Surface variant="secondary" className="p-4 rounded-lg">
          <Text className="text-foreground font-medium mb-4">Create Account</Text>

          <View className="gap-3">
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField isInvalid={!!errors.name}>
                  <Label>Name</Label>
                  <Input
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="John Doe"
                    autoComplete="name"
                    textContentType="name"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                  <FieldError>{errors.name?.message}</FieldError>
                </TextField>
              )}
            />

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField isInvalid={!!errors.email}>
                  <Label>Email</Label>
                  <Input
                    ref={emailRef}
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="email@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                  <FieldError>{errors.email?.message}</FieldError>
                </TextField>
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField isInvalid={!!errors.password}>
                  <Label>Password</Label>
                  <Input
                    ref={passwordRef}
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="••••••••"
                    secureTextEntry
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="go"
                    onSubmitEditing={handleSubmit(onSubmit)}
                  />
                  <FieldError>{errors.password?.message}</FieldError>
                </TextField>
              )}
            />

            <Button onPress={handleSubmit(onSubmit)} isDisabled={isSubmitting} className="mt-1">
              {isSubmitting ? (
                <Spinner size="sm" color="default" />
              ) : (
                <Button.Label>Create Account</Button.Label>
              )}
            </Button>
          </View>

          <Link href="/(auth)/login" asChild>
            <Text className="text-primary text-center mt-4">
              Already have an account? Sign In
            </Text>
          </Link>
        </Surface>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/native/app/\(auth\)/login.tsx apps/native/app/\(auth\)/register.tsx
git commit -m "feat(native): add login and register screens with react-hook-form + zod"
```

---

### Task 7: Rewrite root layout with auth guard + QueryClientProvider

**Files:**
- Modify: `apps/native/app/_layout.tsx`

- [ ] **Step 1: Rewrite root layout**

Replace the entire contents of `apps/native/app/_layout.tsx` with:

```typescript
import "@/global.css";
import { Slot, useRouter, useSegments } from "expo-router";
import { HeroUINativeProvider, Spinner } from "heroui-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useEffect } from "react";
import { View } from "react-native";

import { AppThemeProvider } from "@/contexts/app-theme-context";
import { authClient } from "@/lib/auth-client";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

function AuthGate() {
  const { data: session, isPending } = authClient.useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(app)/(tabs)");
    }
  }, [session, isPending, segments, router]);

  if (isPending) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Spinner size="lg" />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <AppThemeProvider>
            <HeroUINativeProvider>
              <AuthGate />
            </HeroUINativeProvider>
          </AppThemeProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
```

Key changes from the old layout:
- Removed `unstable_settings` with `initialRouteName: "(onboarding)"` — no longer needed
- Removed all `Stack.Screen` definitions for archived modal screens
- Added `QueryClientProvider` wrapping everything
- Added `AuthGate` component that checks Better Auth session:
  - `isPending` → loading spinner
  - No session + not in `(auth)` group → redirect to login
  - Has session + in `(auth)` group → redirect to app
- Uses `Slot` instead of `Stack` — Expo Router renders the correct route group based on redirects

- [ ] **Step 2: Verify the app compiles**

Run: `cd apps/native && npx expo export --platform ios --output-dir /tmp/expo-check 2>&1 | tail -10`

Or for a quicker check (TypeScript only):

Run: `cd apps/native && npx tsc --noEmit 2>&1 | head -30`

Expected: No import errors for the new dependencies or route structure.

- [ ] **Step 3: Commit**

```bash
git add apps/native/app/_layout.tsx
git commit -m "feat(native): rewrite root layout with auth guard and QueryClientProvider"
```

---

### Task 8: Manual verification

This task has no code changes — it verifies the full exit criteria.

- [ ] **Step 1: Start the dev server**

Run: `cd apps/native && pnpm dev`

Open the app on a simulator or device.

- [ ] **Step 2: Verify auth flow**

1. App launches → should show loading spinner briefly, then redirect to login screen
2. Tap "Don't have an account? Sign Up" → navigates to register screen
3. Fill in name, email, password → tap "Create Account" → should create account and redirect to `(app)/(tabs)/` showing the Home placeholder with bottom tab bar
4. Kill and reopen the app → should skip login and go straight to Home (session persisted)

- [ ] **Step 3: Verify navigation structure**

1. Bottom tab bar shows 3 tabs: Home, Progress, Profile
2. Tap each tab → correct placeholder text appears
3. `_legacy/` screens are NOT accessible through any navigation

- [ ] **Step 4: Verify archived screens**

```bash
ls apps/native/app/_legacy/
```

Expected: `(onboarding)/`, `(drawer)/`, `modals/` directories exist with all original files.

- [ ] **Step 5: Verify dependency cleanup**

```bash
cd apps/native && cat package.json | grep "tanstack/react-form"
```

Expected: No output (dependency removed).

```bash
cd apps/native && cat package.json | grep -E "react-query|zustand|flash-list|react-hook-form"
```

Expected: All 4 new packages listed.

---

### Summary of all files changed

| Task | File | Change |
|------|------|--------|
| 1 | `apps/native/package.json` | Add 5 deps, remove 1 |
| 2 | `apps/native/app/(onboarding)/` | Move to `_legacy/` |
| 2 | `apps/native/app/(drawer)/` | Move to `_legacy/` |
| 2 | `apps/native/app/{5 modals}` | Move to `_legacy/modals/` |
| 2 | `apps/native/components/sign-in.tsx` | Delete |
| 2 | `apps/native/components/sign-up.tsx` | Delete |
| 3 | `apps/native/components/common/Screen.tsx` | Create |
| 3 | `apps/native/components/common/Skeleton.tsx` | Create |
| 3 | `apps/native/components/container.tsx` | Delete |
| 4 | `apps/native/services/auth.service.ts` | Create |
| 5 | `apps/native/app/(auth)/_layout.tsx` | Create |
| 5 | `apps/native/app/(app)/_layout.tsx` | Create |
| 5 | `apps/native/app/(app)/(tabs)/_layout.tsx` | Create |
| 5 | `apps/native/app/(app)/(tabs)/index.tsx` | Create |
| 5 | `apps/native/app/(app)/(tabs)/progress.tsx` | Create |
| 5 | `apps/native/app/(app)/(tabs)/profile.tsx` | Create |
| 5 | `apps/native/app/(app)/session/[id].tsx` | Create |
| 5 | `apps/native/app/(app)/session/result.tsx` | Create |
| 5 | `apps/native/app/(app)/subject/[slug].tsx` | Create |
| 6 | `apps/native/app/(auth)/login.tsx` | Create |
| 6 | `apps/native/app/(auth)/register.tsx` | Create |
| 7 | `apps/native/app/_layout.tsx` | Rewrite |
