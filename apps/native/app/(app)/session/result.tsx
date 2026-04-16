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
