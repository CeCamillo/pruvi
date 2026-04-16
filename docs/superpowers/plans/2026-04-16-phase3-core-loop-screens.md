# Phase 3: Core Loop Screens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the core study loop (Home → Active Session → Session Result) with Reanimated animations, transforming the app from navigation skeleton to working study product.

**Architecture:** Bottom-up — design tokens first (foundation), then components (session + gamification) with Reanimated animations, then screens that compose them. Session data flows through TanStack Query cache (not Zustand) to respect server-state ownership. Zustand only holds ephemeral UI state like selected option index.

**Tech Stack:** Expo Router v4, TanStack Query v5, Zustand v5, Reanimated v3, HeroUI Native, Tailwind/Uniwind, zod

---

### Task 1: Design tokens

**Files:**
- Create: `apps/native/lib/design-tokens.ts`

- [ ] **Step 1: Create the tokens file**

Create `apps/native/lib/design-tokens.ts`:

```typescript
export const colors = {
  primary: "#58CD04",
  primaryLight: "rgba(88, 205, 4, 0.08)",
  primaryGlow: "rgba(88, 205, 4, 0.3)",
  accent: "#FF9600",
  accentLight: "rgba(255, 150, 0, 0.1)",
  danger: "#EF4444",
  dangerLight: "rgba(239, 68, 68, 0.08)",
  warning: "#F59E0B",
  warningLight: "rgba(255, 150, 0, 0.06)",
  text: "#2B2B2B",
  textMuted: "#6B6B6B",
  surface: "#F0F0F0",
  border: "rgba(239, 236, 236, 0.5)",
  selectedBg: "rgba(59, 130, 246, 0.05)",
  selectedBorder: "#3B82F6",
} as const;

export const typography = {
  heading900: { fontWeight: "900" as const, letterSpacing: -0.6 },
  bodyBold700: { fontWeight: "700" as const },
  bodyRegular500: { fontWeight: "500" as const },
  uppercaseLabel: { fontWeight: "900" as const, letterSpacing: 1, textTransform: "uppercase" as const },
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;
```

- [ ] **Step 2: Verify compiles**

Run: `cd apps/native && npx tsc --noEmit 2>&1 | grep design-tokens | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/native/lib/design-tokens.ts
git commit -m "feat(native): add design tokens module (colors, typography, radii)"
```

---

### Task 2: OptionButton component

**Files:**
- Create: `apps/native/components/session/OptionButton.tsx`

- [ ] **Step 1: Create OptionButton with animations**

Create `apps/native/components/session/OptionButton.tsx`:

```typescript
import { memo, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { colors, radii } from "@/lib/design-tokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type OptionButtonState = "idle" | "selected" | "correct" | "wrong";

interface Props {
  letter: string;
  text: string;
  state: OptionButtonState;
  onPress: () => void;
  disabled: boolean;
}

function OptionButtonImpl({ letter, text, state, onPress, disabled }: Props) {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);

  // Correct answer: bounce animation
  useEffect(() => {
    if (state === "correct") {
      scale.value = withSequence(
        withSpring(1.05, { damping: 6, stiffness: 180 }),
        withSpring(1, { damping: 10, stiffness: 180 }),
      );
    }
    if (state === "wrong") {
      translateX.value = withSequence(
        withTiming(-8, { duration: 60, easing: Easing.linear }),
        withTiming(8, { duration: 60, easing: Easing.linear }),
        withTiming(-8, { duration: 60, easing: Easing.linear }),
        withTiming(0, { duration: 60, easing: Easing.linear }),
      );
    }
  }, [state, scale, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: translateX.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.97, { damping: 12, stiffness: 300 });
    }
  };
  const handlePressOut = () => {
    if (!disabled) {
      scale.value = withSpring(1, { damping: 12, stiffness: 300 });
    }
  };

  const containerStyles = getContainerStyles(state);
  const letterStyles = getLetterStyles(state);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 16,
          borderRadius: radii.md,
          borderWidth: 2,
          borderColor: containerStyles.borderColor,
          backgroundColor: containerStyles.bg,
        },
        animatedStyle,
      ]}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radii.sm,
          backgroundColor: letterStyles.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontWeight: "900", fontSize: 14, color: letterStyles.color }}>
          {letter}
        </Text>
      </View>
      <Text
        style={{
          flex: 1,
          fontWeight: state === "selected" ? "900" : "700",
          fontSize: 14,
          lineHeight: 20,
          color: colors.text,
        }}
      >
        {text}
      </Text>
    </AnimatedPressable>
  );
}

function getContainerStyles(state: OptionButtonState) {
  switch (state) {
    case "selected":
      return { bg: colors.selectedBg, borderColor: colors.selectedBorder };
    case "correct":
      return { bg: colors.primaryLight, borderColor: colors.primary };
    case "wrong":
      return { bg: colors.dangerLight, borderColor: colors.danger };
    case "idle":
    default:
      return { bg: "#FFFFFF", borderColor: colors.border };
  }
}

function getLetterStyles(state: OptionButtonState) {
  switch (state) {
    case "selected":
      return { bg: colors.selectedBorder, color: "#FFFFFF" };
    case "correct":
      return { bg: colors.primary, color: "#FFFFFF" };
    case "wrong":
      return { bg: colors.danger, color: "#FFFFFF" };
    case "idle":
    default:
      return { bg: colors.surface, color: colors.textMuted };
  }
}

export const OptionButton = memo(OptionButtonImpl);
```

- [ ] **Step 2: Verify**

Run: `cd apps/native && npx tsc --noEmit 2>&1 | grep OptionButton | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/native/components/session/OptionButton.tsx
git commit -m "feat(native): add OptionButton with idle/selected/correct/wrong animations"
```

---

### Task 3: QuestionCard component

**Files:**
- Create: `apps/native/components/session/QuestionCard.tsx`

- [ ] **Step 1: Create QuestionCard**

Create `apps/native/components/session/QuestionCard.tsx`:

```typescript
import { useCallback } from "react";
import { Text, View } from "react-native";

import type { ClientQuestion } from "@pruvi/shared";

import { colors } from "@/lib/design-tokens";

import { OptionButton, type OptionButtonState } from "./OptionButton";

interface Props {
  question: ClientQuestion;
  selectedIndex: number | null;
  answerState: "idle" | "correct" | "wrong";
  correctIndex: number | null;
  onSelect: (index: number) => void;
}

const LETTERS = ["A", "B", "C", "D"];

export function QuestionCard({
  question,
  selectedIndex,
  answerState,
  correctIndex,
  onSelect,
}: Props) {
  const handleSelect = useCallback((index: number) => onSelect(index), [onSelect]);

  return (
    <View style={{ gap: 24 }}>
      <Text
        style={{
          fontSize: 15,
          lineHeight: 24,
          fontWeight: "500",
          color: colors.text,
        }}
      >
        {question.body}
      </Text>

      <View style={{ gap: 12 }}>
        {question.options.map((optionText, index) => {
          const state = computeOptionState({
            index,
            selectedIndex,
            answerState,
            correctIndex,
          });
          const isDisabled = answerState !== "idle";

          return (
            <OptionButton
              key={index}
              letter={LETTERS[index] ?? String(index + 1)}
              text={optionText}
              state={state}
              onPress={() => handleSelect(index)}
              disabled={isDisabled}
            />
          );
        })}
      </View>
    </View>
  );
}

function computeOptionState({
  index,
  selectedIndex,
  answerState,
  correctIndex,
}: {
  index: number;
  selectedIndex: number | null;
  answerState: "idle" | "correct" | "wrong";
  correctIndex: number | null;
}): OptionButtonState {
  // After answer: show correct in green, wrong selection in red
  if (answerState !== "idle") {
    if (correctIndex === index) return "correct";
    if (selectedIndex === index && answerState === "wrong") return "wrong";
    return "idle";
  }
  // Before answer: show selection
  if (selectedIndex === index) return "selected";
  return "idle";
}
```

- [ ] **Step 2: Verify**

Run: `cd apps/native && npx tsc --noEmit 2>&1 | grep QuestionCard | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/native/components/session/QuestionCard.tsx
git commit -m "feat(native): add QuestionCard rendering body + 4 OptionButtons"
```

---

### Task 4: LivesBar component

**Files:**
- Create: `apps/native/components/session/LivesBar.tsx`

- [ ] **Step 1: Create LivesBar**

Create `apps/native/components/session/LivesBar.tsx`:

```typescript
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/lib/design-tokens";

interface Props {
  livesRemaining: number;
  maxLives?: number;
}

export function LivesBar({ livesRemaining, maxLives = 5 }: Props) {
  const translateX = useSharedValue(0);
  const previousLives = useRef(livesRemaining);

  useEffect(() => {
    if (livesRemaining < previousLives.current) {
      translateX.value = withSequence(
        withTiming(-8, { duration: 60, easing: Easing.linear }),
        withTiming(8, { duration: 60, easing: Easing.linear }),
        withTiming(-8, { duration: 60, easing: Easing.linear }),
        withTiming(0, { duration: 60, easing: Easing.linear }),
      );
    }
    previousLives.current = livesRemaining;
  }, [livesRemaining, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View
      style={[
        { flexDirection: "row", gap: 4, alignItems: "center" },
        animatedStyle,
      ]}
    >
      {Array.from({ length: maxLives }, (_, i) => {
        const filled = i < livesRemaining;
        return (
          <Ionicons
            key={i}
            name={filled ? "heart" : "heart-outline"}
            size={20}
            color={filled ? colors.accent : colors.surface}
          />
        );
      })}
    </Animated.View>
  );
}
```

- [ ] **Step 2: Verify**

Run: `cd apps/native && npx tsc --noEmit 2>&1 | grep LivesBar | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/native/components/session/LivesBar.tsx
git commit -m "feat(native): add LivesBar with shake animation on life lost"
```

---

### Task 5: ProgressBar component

**Files:**
- Create: `apps/native/components/session/ProgressBar.tsx`

- [ ] **Step 1: Create ProgressBar**

Create `apps/native/components/session/ProgressBar.tsx`:

```typescript
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

import { colors } from "@/lib/design-tokens";

interface Props {
  total: number;
  completed: number;
}

export function ProgressBar({ total, completed }: Props) {
  return (
    <View style={{ flex: 1, flexDirection: "row", gap: 6, alignItems: "center" }}>
      {Array.from({ length: total }, (_, i) => (
        <Segment key={i} isComplete={i < completed} />
      ))}
    </View>
  );
}

function Segment({ isComplete }: { isComplete: boolean }) {
  const progress = useSharedValue(isComplete ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isComplete ? 1 : 0, { duration: 300 });
  }, [isComplete, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: progress.value > 0.5 ? colors.primary : colors.surface,
  }));

  return (
    <Animated.View
      style={[
        { flex: 1, height: 6, borderRadius: 3 },
        animatedStyle,
      ]}
    />
  );
}
```

- [ ] **Step 2: Verify**

Run: `cd apps/native && npx tsc --noEmit 2>&1 | grep ProgressBar | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/native/components/session/ProgressBar.tsx
git commit -m "feat(native): add segmented ProgressBar with animated fills"
```

---

### Task 6: XPCounter component

**Files:**
- Create: `apps/native/components/gamification/XPCounter.tsx`

- [ ] **Step 1: Create XPCounter**

Create `apps/native/components/gamification/XPCounter.tsx`:

```typescript
import { useEffect, useState } from "react";
import { Text } from "react-native";
import {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/lib/design-tokens";

interface Props {
  earnedXP: number;
  durationMs?: number;
}

export function XPCounter({ earnedXP, durationMs = 1200 }: Props) {
  const value = useSharedValue(0);
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    value.value = withTiming(earnedXP, {
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [earnedXP, durationMs, value]);

  useAnimatedReaction(
    () => value.value,
    (current) => {
      runOnJS(setDisplayed)(Math.round(current));
    },
  );

  return (
    <Text style={{ fontSize: 48, fontWeight: "900", color: colors.primary }}>
      +{displayed} XP
    </Text>
  );
}
```

- [ ] **Step 2: Verify**

Run: `cd apps/native && npx tsc --noEmit 2>&1 | grep XPCounter | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/native/components/gamification/XPCounter.tsx
git commit -m "feat(native): add animated XPCounter using useAnimatedReaction"
```

---

### Task 7: StreakBadge component

**Files:**
- Create: `apps/native/components/gamification/StreakBadge.tsx`

- [ ] **Step 1: Create StreakBadge**

Create `apps/native/components/gamification/StreakBadge.tsx`:

```typescript
import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";

import { colors, radii } from "@/lib/design-tokens";

interface Props {
  count: number;
  animate?: boolean;
}

export function StreakBadge({ count, animate }: Props) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (animate) {
      scale.value = withSequence(
        withSpring(1.2, { damping: 8, stiffness: 180 }),
        withSpring(1, { damping: 10, stiffness: 180 }),
      );
    }
  }, [animate, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          backgroundColor: colors.accentLight,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: radii.sm,
        },
        animatedStyle,
      ]}
    >
      <Ionicons name="flame" size={20} color={colors.accent} />
      <Text style={{ fontWeight: "900", fontSize: 12, color: colors.accent }}>
        {count}
      </Text>
    </Animated.View>
  );
}
```

- [ ] **Step 2: Verify**

Run: `cd apps/native && npx tsc --noEmit 2>&1 | grep StreakBadge | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/native/components/gamification/StreakBadge.tsx
git commit -m "feat(native): add StreakBadge with bounce animation on streak extension"
```

---

### Task 8: CharacterAvatar component

**Files:**
- Create: `apps/native/components/gamification/CharacterAvatar.tsx`

- [ ] **Step 1: Create CharacterAvatar**

Create `apps/native/components/gamification/CharacterAvatar.tsx`:

```typescript
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";

import { colors } from "@/lib/design-tokens";

export type AvatarExpression = "neutral" | "happy" | "sad";

interface Props {
  expression: AvatarExpression;
  size?: number;
}

export function CharacterAvatar({ expression, size = 80 }: Props) {
  const { iconName, color, opacity } = getAvatarAppearance(expression);
  const containerSize = size + 20;

  return (
    <View
      style={{
        width: containerSize,
        height: containerSize,
        borderRadius: containerSize / 2,
        backgroundColor: "#FFFFFF",
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        opacity,
      }}
    >
      <Ionicons name={iconName} size={size} color={color} />
    </View>
  );
}

function getAvatarAppearance(expression: AvatarExpression) {
  switch (expression) {
    case "happy":
      return { iconName: "happy" as const, color: colors.primary, opacity: 1 };
    case "sad":
      return { iconName: "sad-outline" as const, color: colors.textMuted, opacity: 1 };
    case "neutral":
    default:
      return { iconName: "happy" as const, color: colors.text, opacity: 0.7 };
  }
}
```

- [ ] **Step 2: Verify**

Run: `cd apps/native && npx tsc --noEmit 2>&1 | grep CharacterAvatar | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/native/components/gamification/CharacterAvatar.tsx
git commit -m "feat(native): add CharacterAvatar with 3 Ionicons expression states"
```

---

### Task 9: Home screen wiring

**Files:**
- Modify: `apps/native/app/(app)/(tabs)/index.tsx`

- [ ] **Step 1: Replace placeholder with wired home screen**

Replace the entire contents of `apps/native/app/(app)/(tabs)/index.tsx` with:

```typescript
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, Spinner } from "heroui-native";
import { Text, View } from "react-native";

import { authClient } from "@/lib/auth-client";
import { colors } from "@/lib/design-tokens";
import { LivesBar } from "@/components/session/LivesBar";
import { Screen } from "@/components/common/Screen";
import { Skeleton } from "@/components/common/Skeleton";
import { StreakBadge } from "@/components/gamification/StreakBadge";
import {
  useStartSession,
  useTodaySession,
} from "@/hooks/useSessionQuery";
import { useLives } from "@/hooks/useLives";
import { useStreaks } from "@/hooks/useStreaks";
import { useXp } from "@/hooks/useXp";

export default function HomeScreen() {
  const { data: session } = authClient.useSession();
  const todaySession = useTodaySession();
  const lives = useLives();
  const streaks = useStreaks();
  const xp = useXp();
  const startSession = useStartSession();
  const queryClient = useQueryClient();
  const router = useRouter();

  const handleStart = () => {
    startSession.mutate("all", {
      onSuccess: (data) => {
        queryClient.setQueryData(["session", "active", data.session.id], data);
        router.push(`/session/${data.session.id}`);
      },
    });
  };

  const handleResume = (sessionId: number) => {
    router.push(`/session/${sessionId}`);
  };

  const livesData = lives.data;
  const noLives = livesData?.lives === 0;
  const resetsAt = livesData?.resetsAt ? new Date(livesData.resetsAt) : null;
  const livesCountdown = resetsAt ? formatCountdown(resetsAt) : null;

  const activeSession = todaySession.data?.session ?? null;
  const isCompleted = activeSession?.completedAt != null;
  const buttonPending = startSession.isPending;

  return (
    <Screen>
      <View style={{ paddingTop: 16, gap: 32 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {streaks.isLoading ? (
            <Skeleton width={80} height={32} />
          ) : (
            <StreakBadge count={streaks.data?.currentStreak ?? 0} />
          )}
          {lives.isLoading ? (
            <Skeleton width={140} height={24} />
          ) : (
            <LivesBar
              livesRemaining={livesData?.lives ?? 0}
              maxLives={livesData?.maxLives ?? 5}
            />
          )}
        </View>

        {/* Greeting */}
        <View style={{ gap: 4 }}>
          <Text
            style={{
              fontSize: 24,
              fontWeight: "900",
              letterSpacing: -0.6,
              color: colors.text,
            }}
          >
            Olá, {session?.user?.name ?? "estudante"}
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: colors.textMuted,
            }}
          >
            Continue sua jornada
          </Text>
        </View>

        {/* XP / Level card */}
        {xp.isLoading ? (
          <Skeleton width="100%" height={80} />
        ) : xp.data ? (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 24,
              borderWidth: 2,
              borderColor: colors.border,
              padding: 20,
              gap: 8,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>
                Nível {xp.data.currentLevel}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "900", color: colors.primary }}>
                {xp.data.totalXp} XP
              </Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted }}>
              Faltam {xp.data.xpForNextLevel} XP para o próximo nível
            </Text>
          </View>
        ) : null}

        {/* Today's session card */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 32,
            borderWidth: 2,
            borderColor: colors.border,
            padding: 24,
            gap: 12,
          }}
        >
          {todaySession.isLoading ? (
            <Skeleton width="100%" height={100} />
          ) : isCompleted ? (
            <>
              <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>
                Você está em dia!
              </Text>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted }}>
                {activeSession?.questionsCorrect ?? 0}/
                {activeSession?.questionsAnswered ?? 0} corretas hoje. Volte
                amanhã.
              </Text>
            </>
          ) : activeSession ? (
            <>
              <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>
                Sessão em andamento
              </Text>
              <Button
                onPress={() => handleResume(activeSession.id)}
                isDisabled={noLives}
              >
                <Button.Label>Continuar</Button.Label>
              </Button>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>
                Sessão de hoje
              </Text>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted }}>
                10 questões prontas para você
              </Text>
              <Button onPress={handleStart} isDisabled={noLives || buttonPending}>
                {buttonPending ? (
                  <Spinner size="sm" color="default" />
                ) : (
                  <Button.Label>Começar</Button.Label>
                )}
              </Button>
            </>
          )}

          {noLives && livesCountdown && (
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: colors.danger,
                textAlign: "center",
              }}
            >
              Vidas voltam em {livesCountdown}
            </Text>
          )}
        </View>
      </View>
    </Screen>
  );
}

function formatCountdown(resetsAt: Date): string {
  const now = new Date();
  const diffMs = resetsAt.getTime() - now.getTime();
  if (diffMs <= 0) return "0m";

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
```

- [ ] **Step 2: Verify**

Run: `cd apps/native && npx tsc --noEmit 2>&1 | grep -E "\(tabs\)/index|error TS" | grep -v _legacy | head -10`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/native/app/\(app\)/\(tabs\)/index.tsx
git commit -m "feat(native): wire home screen to session/lives/streak/xp queries"
```

---

### Task 10: Active Session screen wiring

**Files:**
- Modify: `apps/native/app/(app)/session/[id].tsx`

- [ ] **Step 1: Replace placeholder with Q&A loop**

Replace the entire contents of `apps/native/app/(app)/session/[id].tsx` with:

```typescript
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Spinner } from "heroui-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import type { StartSessionResponse } from "@pruvi/shared";

import { colors } from "@/lib/design-tokens";
import { LivesBar } from "@/components/session/LivesBar";
import { ProgressBar } from "@/components/session/ProgressBar";
import { QuestionCard } from "@/components/session/QuestionCard";
import { Screen } from "@/components/common/Screen";
import { useAnswerQuestion } from "@/hooks/useSessionQuery";
import { useLives } from "@/hooks/useLives";
import { useGamificationStore } from "@/stores/gamificationStore";
import { useSessionStore } from "@/stores/sessionStore";

const ANSWER_ANIMATION_MS = 1200;

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const router = useRouter();

  // Read the session + questions from TanStack Query cache (populated by Home screen)
  const { data: session } = useQuery<StartSessionResponse>({
    queryKey: ["session", "active", sessionId],
    queryFn: () => {
      throw new Error("Session not loaded — return to home");
    },
    staleTime: Infinity,
    retry: false,
  });

  const lives = useLives();
  const answerQuestion = useAnswerQuestion();

  const currentQuestionIndex = useSessionStore((s) => s.currentQuestionIndex);
  const selectedOptionIndex = useSessionStore((s) => s.selectedOptionIndex);
  const answerState = useSessionStore((s) => s.answerState);
  const livesRemaining = useSessionStore((s) => s.livesRemaining);
  const sessionActions = useSessionStore((s) => s.actions);
  const gamificationActions = useGamificationStore((s) => s.actions);

  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  // Seed the store with current lives on mount; cleanup on unmount
  useEffect(() => {
    if (lives.data) {
      sessionActions.reset(lives.data.lives);
    }
    return () => {
      sessionActions.reset(5);
    };
    // Only run when lives first resolve
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lives.data?.lives]);

  if (!session) {
    return (
      <Screen scrollable={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
          <Text style={{ fontSize: 16, color: colors.text }}>
            Sessão não encontrada.
          </Text>
          <Button onPress={() => router.replace("/(app)/(tabs)")}>
            <Button.Label>Voltar ao início</Button.Label>
          </Button>
        </View>
      </Screen>
    );
  }

  const currentQuestion = session.questions[currentQuestionIndex];
  const totalQuestions = session.questions.length;

  if (!currentQuestion) {
    return (
      <Screen scrollable={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Spinner size="lg" />
        </View>
      </Screen>
    );
  }

  const handleAnswer = () => {
    if (selectedOptionIndex === null) return;

    answerQuestion.mutate(
      { questionId: currentQuestion.id, selectedOptionIndex },
      {
        onSuccess: (res) => {
          setCorrectIndex(res.correctOptionIndex);
          sessionActions.setAnswerState(res.correct ? "correct" : "wrong");
          sessionActions.setLivesRemaining(res.livesRemaining);
          gamificationActions.addXP(res.xpAwarded);
          const nextCorrectCount = correctCount + (res.correct ? 1 : 0);
          if (res.correct) setCorrectCount(nextCorrectCount);

          setTimeout(() => {
            const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
            const noLivesLeft = res.livesRemaining === 0;

            if (isLastQuestion || noLivesLeft) {
              router.replace({
                pathname: "/session/result",
                params: {
                  sessionId: String(sessionId),
                  questionCount: String(currentQuestionIndex + 1),
                  correctCount: String(nextCorrectCount),
                },
              });
            } else {
              setCorrectIndex(null);
              sessionActions.nextQuestion();
            }
          }, ANSWER_ANIMATION_MS);
        },
      },
    );
  };

  const buttonDisabled =
    selectedOptionIndex === null ||
    answerState !== "idle" ||
    answerQuestion.isPending;

  return (
    <Screen>
      <View style={{ gap: 24, paddingVertical: 16 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
          }}
        >
          <ProgressBar total={totalQuestions} completed={currentQuestionIndex} />
          <LivesBar livesRemaining={livesRemaining} />
        </View>

        <QuestionCard
          question={currentQuestion}
          selectedIndex={selectedOptionIndex}
          answerState={answerState}
          correctIndex={correctIndex}
          onSelect={sessionActions.selectOption}
        />

        <Button onPress={handleAnswer} isDisabled={buttonDisabled}>
          {answerQuestion.isPending ? (
            <Spinner size="sm" color="default" />
          ) : (
            <Button.Label>Responder</Button.Label>
          )}
        </Button>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 2: Verify**

Run: `cd apps/native && npx tsc --noEmit 2>&1 | grep -E "session/\[id\]|error TS" | grep -v _legacy | head -10`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/native/app/\(app\)/session/\[id\].tsx
git commit -m "feat(native): wire active session Q&A loop with answer mutation and animations"
```

---

### Task 11: Session Result screen wiring

**Files:**
- Modify: `apps/native/app/(app)/session/result.tsx`

- [ ] **Step 1: Replace placeholder with result screen**

Replace the entire contents of `apps/native/app/(app)/session/result.tsx` with:

```typescript
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Spinner } from "heroui-native";
import { Text, View } from "react-native";

import { CharacterAvatar } from "@/components/gamification/CharacterAvatar";
import { StreakBadge } from "@/components/gamification/StreakBadge";
import { XPCounter } from "@/components/gamification/XPCounter";
import { Screen } from "@/components/common/Screen";
import { colors } from "@/lib/design-tokens";
import { useCompleteSession } from "@/hooks/useSessionQuery";
import { useStreaks } from "@/hooks/useStreaks";
import { useGamificationStore } from "@/stores/gamificationStore";

export default function SessionResultScreen() {
  const { sessionId, questionCount, correctCount } = useLocalSearchParams<{
    sessionId: string;
    questionCount: string;
    correctCount: string;
  }>();

  const qCount = Number(questionCount ?? 0);
  const cCount = Number(correctCount ?? 0);
  const accuracy = qCount > 0 ? Math.round((cCount / qCount) * 100) : 0;

  const pendingXP = useGamificationStore((s) => s.pendingXP);
  const gamificationActions = useGamificationStore((s) => s.actions);
  const streaks = useStreaks();
  const completeSession = useCompleteSession();
  const queryClient = useQueryClient();
  const router = useRouter();

  const expression: "happy" | "neutral" | "sad" =
    accuracy >= 70 ? "happy" : accuracy >= 40 ? "neutral" : "sad";

  const handleContinue = () => {
    completeSession.mutate(
      { id: Number(sessionId), questionCount: qCount, correctCount: cCount },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["session", "today"] });
          queryClient.invalidateQueries({ queryKey: ["streaks"] });
          queryClient.invalidateQueries({ queryKey: ["xp"] });
          queryClient.invalidateQueries({ queryKey: ["lives"] });
          gamificationActions.flush();
          router.replace("/(app)/(tabs)");
        },
      },
    );
  };

  return (
    <Screen>
      <View style={{ alignItems: "center", paddingTop: 40, gap: 24 }}>
        <CharacterAvatar expression={expression} size={80} />

        <XPCounter earnedXP={pendingXP} />

        <View style={{ alignItems: "center", gap: 4 }}>
          <Text
            style={{
              fontSize: 24,
              fontWeight: "900",
              letterSpacing: -0.6,
              color: colors.text,
            }}
          >
            {cCount}/{qCount} corretas
          </Text>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textMuted }}>
            {accuracy}% de acerto
          </Text>
        </View>

        {streaks.data && <StreakBadge count={streaks.data.currentStreak} />}

        <Button
          onPress={handleContinue}
          isDisabled={completeSession.isPending}
          style={{ marginTop: 24, alignSelf: "stretch" }}
        >
          {completeSession.isPending ? (
            <Spinner size="sm" color="default" />
          ) : (
            <Button.Label>Continuar</Button.Label>
          )}
        </Button>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 2: Verify**

Run: `cd apps/native && npx tsc --noEmit 2>&1 | grep -E "session/result|error TS" | grep -v _legacy | head -10`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/native/app/\(app\)/session/result.tsx
git commit -m "feat(native): wire session result screen with XP counter and complete mutation"
```

---

### Task 12: Full verification

- [ ] **Step 1: Full TypeScript check**

Run: `cd apps/native && npx tsc --noEmit 2>&1 | grep -v _legacy | grep -v "app/modal.tsx" | grep -v "\+not-found" | head -20`
Expected: No errors.

- [ ] **Step 2: Verify file structure**

Run: `cd apps/native && find components lib -type f -name "*.ts" -o -name "*.tsx" 2>/dev/null | sort`

Expected output (partial list, should include):
```
components/common/Screen.tsx
components/common/Skeleton.tsx
components/gamification/CharacterAvatar.tsx
components/gamification/StreakBadge.tsx
components/gamification/XPCounter.tsx
components/session/LivesBar.tsx
components/session/OptionButton.tsx
components/session/ProgressBar.tsx
components/session/QuestionCard.tsx
lib/api-client.ts
lib/auth-client.ts
lib/design-tokens.ts
```

- [ ] **Step 3: Verify screens are wired**

Run: `cd apps/native && grep -l "useTodaySession\|useStartSession\|useAnswerQuestion\|useCompleteSession" app/\(app\)/`
Expected: Returns all three screen files (`(tabs)/index.tsx`, `session/[id].tsx`, `session/result.tsx`).

- [ ] **Step 4: Expo metro bundler smoke test**

Run: `cd apps/native && npx expo export --platform web --output-dir /tmp/expo-phase3-test 2>&1 | tail -20`
Expected: Successful export with "Exported" message. (If Expo's web export is too slow, this can be skipped — the TypeScript check is the primary gate.)

- [ ] **Step 5: Document manual test plan**

The following cannot be automated — document for manual QA:

```
Manual QA steps:
1. Login/register — should land on Home with placeholder data
2. Home screen:
   - StreakBadge renders with 0 count (new user)
   - LivesBar shows 5 filled hearts
   - Greeting shows user name
   - XP card shows "Nível 1" and "0 XP"
   - "Sessão de hoje" card shows "Começar" button
3. Tap "Começar" — should navigate to /session/:id
4. Active Session:
   - ProgressBar shows 10 empty segments
   - LivesBar shows 5 hearts
   - Question renders with 4 options (A/B/C/D)
   - Tap an option — it animates scale down on press, becomes blue-bordered
   - Tap "Responder" — the button shows spinner briefly
   - On correct: selected option turns green, bounces, next question appears after ~1.2s
   - On wrong: option turns red, shakes; LivesBar hearts shake; life decrements
5. After 10 questions OR lives = 0 → navigate to result screen
6. Result screen:
   - CharacterAvatar renders (happy/neutral/sad based on accuracy)
   - XPCounter animates from 0 to earned XP
   - Accuracy % renders
   - StreakBadge shows current streak (likely 1 after first session)
   - Tap "Continuar" — navigates back to home with updated stats
7. Kill + reopen app — session persists, land back on home
```

---

### Summary of all files changed

| Task | File | Change |
|------|------|--------|
| 1 | `apps/native/lib/design-tokens.ts` | Create |
| 2 | `apps/native/components/session/OptionButton.tsx` | Create |
| 3 | `apps/native/components/session/QuestionCard.tsx` | Create |
| 4 | `apps/native/components/session/LivesBar.tsx` | Create |
| 5 | `apps/native/components/session/ProgressBar.tsx` | Create |
| 6 | `apps/native/components/gamification/XPCounter.tsx` | Create |
| 7 | `apps/native/components/gamification/StreakBadge.tsx` | Create |
| 8 | `apps/native/components/gamification/CharacterAvatar.tsx` | Create |
| 9 | `apps/native/app/(app)/(tabs)/index.tsx` | Modify (replace placeholder) |
| 10 | `apps/native/app/(app)/session/[id].tsx` | Modify (replace placeholder) |
| 11 | `apps/native/app/(app)/session/result.tsx` | Modify (replace placeholder) |

**11 file changes. 8 new, 3 modified.**
