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
import { XpCard } from "@/components/gamification/XpCard";
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

        {xp.isLoading ? (
          <Skeleton width="100%" height={80} />
        ) : xp.data ? (
          <XpCard xp={xp.data} />
        ) : null}

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
