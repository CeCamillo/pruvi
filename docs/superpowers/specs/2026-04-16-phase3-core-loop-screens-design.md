# Phase 3: Core Loop Screens

> Design spec for wiring Home → Active Session → Session Result with Reanimated animations. This phase makes the app a working study product.

## Context

Phases 0-2 complete (PRs #2, #3, #4). The native app has:
- Full service layer + TanStack Query hooks + Zustand stores for session state and gamification signals
- Common components: `Screen`, `Skeleton`
- Placeholder screens at `(app)/(tabs)/index.tsx`, `(app)/session/[id].tsx`, `(app)/session/result.tsx`
- Archived legacy screens in `_legacy/` with rich visual design system (colors, typography, spacing)

Phase 3 replaces the three placeholders with real UI driving the core study loop: user starts a session, answers questions with animated feedback, sees XP earned on the result screen, returns to home with updated stats.

## Scope

- Build 7 components (4 session + 3 gamification) with Reanimated animations
- Wire 3 screens (Home, Active Session, Session Result)
- Extract legacy design tokens (colors, typography, radii) into a shared module
- End-to-end study loop works against real backend

**Not in scope** (deferred to later phases):
- Weekly activity chart, AI analysis card, subject breakdown on home (need Phase 4 backend endpoints)
- Detailed explanations / stats on result screen (need Phase 4+ backend)
- Character mascot illustrations (Ionicons placeholder)
- Pixel-perfect Figma recreation — Phase 3 ships a functional study loop with consistent design tokens; polish in later phases

## Design Decisions

1. **Scope:** Minimal core loop, reuse legacy design tokens only. Phase 3 goal is working study app, not visual perfection.
2. **Question storage:** TanStack Query cache via `queryClient.setQueryData(["session", "active", id], response)`. Respects architecture rule: server state in TanStack Query, not Zustand.
3. **CharacterAvatar:** Ionicons faces (`happy`, `happy-outline`, `sad-outline`) — no illustration work needed.
4. **Design tokens:** New `lib/design-tokens.ts` file exports colors, typography, radii constants extracted from legacy screens. All new components use these — consistent brand, no magic numbers.
5. **Animations:** All animations via Reanimated worklets on UI thread. Zero `setState` in animation callbacks. Use `useSharedValue` + `useAnimatedStyle`. For text counters, use `useAnimatedReaction` + `runOnJS` since Reanimated can't directly interpolate text.

## Changes

### 1. Design Tokens (`lib/design-tokens.ts`)

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
} as const;

export const typography = {
  heading900: { fontWeight: "900" as const, letterSpacing: -0.6 },
  bodyBold700: { fontWeight: "700" as const },
  bodyRegular500: { fontWeight: "500" as const },
  uppercaseLabel: { fontWeight: "900" as const, letterSpacing: 1, textTransform: "uppercase" as const },
} as const;

export const radii = { sm: 10, md: 16, lg: 20, xl: 24, xxl: 32 } as const;
```

### 2. Session Components (`components/session/`)

**`QuestionCard.tsx`** — Dumb component, no animations of its own.

```typescript
interface Props {
  question: ClientQuestion;
  selectedIndex: number | null;
  answerState: "idle" | "correct" | "wrong";
  correctIndex: number | null; // null until answered
  onSelect: (index: number) => void;
}
```

- Renders question body (fontSize 15, fontWeight 500, lineHeight 24, color `colors.text`)
- Maps `question.options` (from Zod schema — `string[]`) to vertical stack of `OptionButton`
- Gap 12px between options
- Letter labels generated: "A", "B", "C", "D"

**`OptionButton.tsx`** — `memo()`'d, Reanimated animations.

```typescript
interface Props {
  letter: string;           // "A" | "B" | "C" | "D"
  text: string;
  state: "idle" | "selected" | "correct" | "wrong";
  onPress: () => void;
  disabled: boolean;
}
```

Visual states (from legacy reference):
- **Idle:** white bg, border `colors.border`, letter box `colors.surface` + `colors.textMuted` text
- **Selected:** bg `rgba(59, 130, 246, 0.05)`, border `#3B82F6`, letter box `#3B82F6` + white text
- **Correct:** bg `colors.primaryLight`, border `colors.primary`, letter box `colors.primary` + white text
- **Wrong:** bg `colors.dangerLight`, border `colors.danger`, letter box `colors.danger` + white text

Animations via `useSharedValue` + `useAnimatedStyle`:
- **Press:** scale `withSpring(0.97)` on press-in, `withSpring(1)` on press-out
- **Correct (state changes to 'correct'):** `withSequence(withSpring(1.05, { damping: 6 }), withSpring(1))`
- **Wrong (state changes to 'wrong'):** translateX `withSequence(withTiming(-8, {duration: 60}), withTiming(8, {duration: 60}), withTiming(-8, {duration: 60}), withTiming(0, {duration: 60}))`

Use `useCallback` on `onPress` in parent so memo works.

**`LivesBar.tsx`** — Row of 5 heart Ionicons.

```typescript
interface Props {
  livesRemaining: number; // 0-5
  maxLives?: number;      // default 5
}
```

- 5 `Ionicons` hearts in a flex row, gap 4px
- Filled hearts: `heart` icon, color `colors.accent`
- Empty hearts: `heart-outline` icon, color `colors.surface`
- On `livesRemaining` decrease (track via `useEffect` + ref of previous value): shake entire bar via `translateX` `withSequence(-8, 8, -8, 0)` over 240ms

**`ProgressBar.tsx`** — Segmented (one bar per question).

```typescript
interface Props {
  total: number;      // total questions
  completed: number;  // questions answered
}
```

- Flex row of `total` segments, gap 6px
- Each segment: height 6px, `borderRadius: 3`, flex 1
- Completed segments: `colors.primary`
- Incomplete: `colors.surface`
- Width transition animated via `useAnimatedStyle` (each segment independently animates background color via `withTiming`)

### 3. Gamification Components (`components/gamification/`)

**`XPCounter.tsx`** — Animated number counter.

```typescript
interface Props {
  earnedXP: number;
  durationMs?: number; // default 1200
}
```

Implementation:
```typescript
const value = useSharedValue(0);
const [displayed, setDisplayed] = useState(0);

useEffect(() => {
  value.value = withTiming(earnedXP, {
    duration: durationMs ?? 1200,
    easing: Easing.out(Easing.cubic),
  });
}, [earnedXP]);

useAnimatedReaction(
  () => value.value,
  (current) => {
    runOnJS(setDisplayed)(Math.round(current));
  },
);

return <Text style={{ fontSize: 48, fontWeight: "900", color: colors.primary }}>+{displayed} XP</Text>;
```

**`StreakBadge.tsx`** — Flame icon + count.

```typescript
interface Props {
  count: number;
  animate?: boolean;  // flip true to trigger bounce
}
```

- Flex row: `<Ionicons name="flame" color={colors.accent} size={20} />` + text
- Background: `colors.accentLight`, `borderRadius: radii.sm`, padding 6/10
- Text: `{count}`, fontWeight 900, fontSize 12, color `colors.accent`
- On `animate` flips true: scale `withSequence(withSpring(1.2), withSpring(1))`

**`CharacterAvatar.tsx`** — Ionicons face.

```typescript
interface Props {
  expression: "neutral" | "happy" | "sad";
  size?: number; // default 80
}
```

- Circular container: `width=height=size+20`, `borderRadius: size`, bg white, border `colors.border`, 2px
- Icon:
  - `happy` → `Ionicons name="happy"`, color `colors.primary`
  - `neutral` → `Ionicons name="happy"` with 70% opacity, color `colors.text`
  - `sad` → `Ionicons name="sad-outline"`, color `colors.textMuted`
- Icon size: `size`

### 4. Home Screen (`app/(app)/(tabs)/index.tsx`)

Replace placeholder with:

```
Layout (top to bottom):
- Header row: StreakBadge (left) + LivesBar (right), padded 16px
- Greeting block: "Olá, {user name from session}"
  - Font: heading900 + fontSize 24
  - Subtitle: "Continue sua jornada" (bodyBold700 + fontSize 13 + colors.textMuted)
- XP/Level card:
  - Shows current level + XP + progress bar to next level
  - From useXp(): { totalXp, currentLevel, xpForNextLevel }
- Today's session state card:
  - If useTodaySession().data.session === null → "Start Session" button
  - If session exists && !completedAt → "Resume Session" button  
  - If session exists && completedAt → "Você está em dia! Volte amanhã" + today's accuracy
- Zero lives state:
  - If useLives().data.lives === 0 → disable Start Session + show countdown "Lives reset in Xh Ym"
  - Compute remaining time from useLives().data.resetsAt
```

Start Session flow:
```typescript
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
```

While queries loading → show `Skeleton` placeholders (from Phase 1 component).

### 5. Active Session (`app/(app)/session/[id].tsx`)

Replace placeholder. Flow:

```typescript
export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);

  // Read session from TanStack Query cache (populated by Home screen)
  const { data: session } = useQuery({
    queryKey: ["session", "active", sessionId],
    queryFn: () => { throw new Error("Session not loaded"); },
    staleTime: Infinity,
    retry: false,
  });

  const lives = useLives();
  const answerQuestion = useAnswerQuestion();

  const {
    currentQuestionIndex,
    selectedOptionIndex,
    answerState,
    livesRemaining,
    actions,
  } = useSessionStore();

  const gamificationActions = useGamificationStore((s) => s.actions);

  // Track correctIndex separately (not in sessionStore — only known after answer)
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  // Initialize lives on mount
  useEffect(() => {
    if (lives.data) {
      actions.reset(lives.data.lives);
    }
    return () => actions.reset(5); // Cleanup on unmount
  }, [lives.data]);

  // Error state: no session in cache
  if (!session) {
    return (
      <Screen scrollable={false}>
        <Text>Session not found. Return to home.</Text>
        <Button onPress={() => router.replace("/(app)/(tabs)")}>Back</Button>
      </Screen>
    );
  }

  const currentQuestion = session.questions[currentQuestionIndex];
  const totalQuestions = session.questions.length;

  const handleAnswer = () => {
    if (selectedOptionIndex === null) return;
    answerQuestion.mutate(
      { questionId: currentQuestion.id, selectedOptionIndex },
      {
        onSuccess: (res) => {
          setCorrectIndex(res.correctOptionIndex);
          actions.setAnswerState(res.correct ? "correct" : "wrong");
          actions.setLivesRemaining(res.livesRemaining);
          gamificationActions.addXP(res.xpAwarded);
          if (res.correct) setCorrectCount((c) => c + 1);

          // After 1200ms animation, advance
          setTimeout(() => {
            const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
            const noLivesLeft = res.livesRemaining === 0;

            if (isLastQuestion || noLivesLeft) {
              router.replace({
                pathname: "/session/result",
                params: {
                  sessionId: String(sessionId),
                  questionCount: String(currentQuestionIndex + 1),
                  correctCount: String(correctCount + (res.correct ? 1 : 0)),
                },
              });
            } else {
              setCorrectIndex(null);
              actions.nextQuestion();
            }
          }, 1200);
        },
      },
    );
  };

  return (
    <Screen scrollable={false}>
      <View style={{ flexDirection: "row", padding: 16, gap: 16 }}>
        <ProgressBar total={totalQuestions} completed={currentQuestionIndex} />
        <LivesBar livesRemaining={livesRemaining} />
      </View>

      <QuestionCard
        question={currentQuestion}
        selectedIndex={selectedOptionIndex}
        answerState={answerState}
        correctIndex={correctIndex}
        onSelect={actions.selectOption}
      />

      <Button
        onPress={handleAnswer}
        isDisabled={selectedOptionIndex === null || answerState !== "idle" || answerQuestion.isPending}
      >
        <Button.Label>Responder</Button.Label>
      </Button>
    </Screen>
  );
}
```

Button disabled while: no selection, already answered (awaiting animation), mutation in flight.

### 6. Session Result (`app/(app)/session/result.tsx`)

Replace placeholder. Flow:

```typescript
export default function SessionResultScreen() {
  const { sessionId, questionCount, correctCount } = useLocalSearchParams<{
    sessionId: string;
    questionCount: string;
    correctCount: string;
  }>();

  const qCount = Number(questionCount);
  const cCount = Number(correctCount);
  const accuracy = qCount > 0 ? Math.round((cCount / qCount) * 100) : 0;

  const pendingXP = useGamificationStore((s) => s.pendingXP);
  const gamificationActions = useGamificationStore((s) => s.actions);
  const streaks = useStreaks();
  const completeSession = useCompleteSession();
  const queryClient = useQueryClient();
  const router = useRouter();

  const expression = accuracy >= 70 ? "happy" : accuracy >= 40 ? "neutral" : "sad";

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

        <Text style={{ fontSize: 24, fontWeight: "900", color: colors.text }}>
          {cCount}/{qCount} corretas
        </Text>

        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textMuted }}>
          {accuracy}% de acerto
        </Text>

        {streaks.data && (
          <StreakBadge count={streaks.data.currentStreak} />
        )}

        <Button
          onPress={handleContinue}
          isDisabled={completeSession.isPending}
          style={{ marginTop: 24 }}
        >
          <Button.Label>Continuar</Button.Label>
        </Button>
      </View>
    </Screen>
  );
}
```

Use `router.replace` (not `push`) so back button doesn't return to the finished result.

## Exit Criteria

1. `npx tsc --noEmit` passes (outside `_legacy/` files)
2. Full flow works against backend: sign in → home → start session → answer questions → see result → back to home with updated stats
3. Wrong answer triggers `OptionButton` shake + `LivesBar` shake simultaneously
4. Correct answer triggers `OptionButton` green bounce
5. XP counter animates from 0 to earned value on result screen
6. Lives countdown displays when `lives === 0` on home
7. Session state resets on screen unmount (no state bleed if user navigates away mid-session)
8. All animations run on UI thread (no jank, verified by interaction feel)

## Files Changed

**New (8):**
| File | Purpose |
|------|---------|
| `apps/native/lib/design-tokens.ts` | Shared colors/typography/radii |
| `apps/native/components/session/QuestionCard.tsx` | Question text + 4 OptionButtons |
| `apps/native/components/session/OptionButton.tsx` | Animated option with 4 states |
| `apps/native/components/session/LivesBar.tsx` | Heart icons with shake on loss |
| `apps/native/components/session/ProgressBar.tsx` | Segmented progress |
| `apps/native/components/gamification/XPCounter.tsx` | Animated number counter |
| `apps/native/components/gamification/StreakBadge.tsx` | Flame + count with bounce |
| `apps/native/components/gamification/CharacterAvatar.tsx` | Ionicons face with 3 expressions |

**Modified (3):**
| File | Change |
|------|--------|
| `apps/native/app/(app)/(tabs)/index.tsx` | Replace placeholder with wired home |
| `apps/native/app/(app)/session/[id].tsx` | Replace placeholder with Q&A loop |
| `apps/native/app/(app)/session/result.tsx` | Replace placeholder with result screen |

**11 files total.**
