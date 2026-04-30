import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path } from "react-native-svg";

import { useCompleteSession } from "@/hooks/useSessionQuery";
import { useStreaks } from "@/hooks/useStreaks";
import { useGamificationStore } from "@/stores/gamificationStore";

// ─── Icons ───────────────────────────────────────────────────────────────────

function TrophyIcon() {
  return (
    <Svg width={48} height={48} viewBox="0 0 48 48" fill="none">
      <Path
        d="M32 12V10c0-1.1-.9-2-2-2H18c-1.1 0-2 .9-2 2v2M32 12h6v4c0 4.4-3.6 8-8 8M16 12h-6v4c0 4.4 3.6 8 8 8M24 24c-3.3 0-6-2.7-6-6v-6h12v6c0 3.3-2.7 6-6 6zM24 24v8M18 40h12v-4c0-2.2-1.8-4-4-4h-4c-2.2 0-4 1.8-4 4v4z"
        stroke="#FFFFFF"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SparkleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 1l2 5 5 1.5-5 1.5-2 5-2-5-5-1.5 5-1.5 2-5z"
        fill="#FF9600"
      />
    </Svg>
  );
}

function FireIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2c-.25 1.05-.84 2.9-2 4.15C8.55 7.75 7 8.8 7 11.75c0 3.3 2.25 5.75 5 5.75s5-2.45 5-5.75c0-3.5-2.33-6.15-5-9.75z"
        fill="#FF9600"
      />
    </Svg>
  );
}

function TargetIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx={12} cy={12} r={9} stroke="#6366F1" strokeWidth={2} />
      <SvgCircle cx={12} cy={12} r={5} stroke="#6366F1" strokeWidth={2} />
      <SvgCircle cx={12} cy={12} r={1.5} fill="#6366F1" />
    </Svg>
  );
}

function StarIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l2.09 6.26L20.18 9l-5 4.27L16.82 20 12 16.9 7.18 20l1.64-6.73L3.82 9l6.09-.74L12 2z"
        fill="#58CD04"
      />
    </Svg>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SessionResultScreen() {
  const { sessionId, questionCount, correctCount } = useLocalSearchParams<{
    sessionId: string;
    questionCount: string;
    correctCount: string;
  }>();
  const insets = useSafeAreaInsets();

  const qCount = Number(questionCount ?? 0);
  const cCount = Number(correctCount ?? 0);
  const accuracy = qCount > 0 ? Math.round((cCount / qCount) * 100) : 0;

  const pendingXP = useGamificationStore((s) => s.pendingXP);
  const gamificationActions = useGamificationStore((s) => s.actions);
  const streaks = useStreaks();
  const completeSession = useCompleteSession();
  const queryClient = useQueryClient();
  const router = useRouter();

  // Celebration headline scales with accuracy so the screen feels responsive
  // to the user's performance rather than the same every time.
  const headline =
    accuracy >= 80
      ? "Você arrasou!"
      : accuracy >= 50
        ? "Ótimo trabalho!"
        : "Continue assim!";

  const subline =
    accuracy >= 80
      ? "Impressionante. Sua consistência está fazendo a diferença."
      : accuracy >= 50
        ? "Cada questão te aproxima do seu objetivo."
        : "Aprender também é errar. Amanhã é um novo dia.";

  useEffect(() => {
    return () => {
      gamificationActions.flush();
    };
  }, [gamificationActions]);

  const handleContinue = () => {
    completeSession.mutate(
      { id: Number(sessionId), questionCount: qCount, correctCount: cCount },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["session", "today"] });
          queryClient.invalidateQueries({ queryKey: ["streaks"] });
          queryClient.invalidateQueries({ queryKey: ["xp"] });
          queryClient.invalidateQueries({ queryKey: ["lives"] });
          queryClient.invalidateQueries({ queryKey: ["progress"] });
          queryClient.invalidateQueries({ queryKey: ["calendar"] });
          gamificationActions.flush();
          router.replace("/(app)/(tabs)");
        },
      },
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#58CD04", "#3FAE0A"]}
        style={[styles.hero, { paddingTop: insets.top + 32 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.heroGlow} />
        <View style={styles.trophyCircle}>
          <TrophyIcon />
        </View>
        <Text style={styles.heroTitle}>{headline}</Text>
        <Text style={styles.heroSubtitle}>{subline}</Text>

        <View style={styles.xpBadge}>
          <SparkleIcon />
          <Text style={styles.xpBadgeText}>+{pendingXP} XP conquistados</Text>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <TargetIcon />
            <Text style={styles.statLabel}>Respondidas</Text>
            <Text style={styles.statValue}>{qCount}</Text>
          </View>
          <View style={styles.statCard}>
            <StarIcon />
            <Text style={styles.statLabel}>Acertos</Text>
            <Text style={styles.statValue}>{cCount}</Text>
          </View>
          <View style={styles.statCard}>
            <FireIcon />
            <Text style={styles.statLabel}>Ofensiva</Text>
            <Text style={styles.statValue}>
              {streaks.data?.currentStreak ?? 0}
            </Text>
          </View>
        </View>

        <View style={styles.accuracyCard}>
          <View style={styles.accuracyRow}>
            <Text style={styles.accuracyLabel}>Sua precisão</Text>
            <Text style={styles.accuracyValue}>{accuracy}%</Text>
          </View>
          <View style={styles.accuracyBarBg}>
            <View
              style={[
                styles.accuracyBarFill,
                {
                  width: `${accuracy}%`,
                  backgroundColor:
                    accuracy >= 70
                      ? "#58CD04"
                      : accuracy >= 40
                        ? "#FF9600"
                        : "#EF4444",
                },
              ]}
            />
          </View>
        </View>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.continueBtn,
            completeSession.isPending && styles.continueBtnDisabled,
            pressed && !completeSession.isPending && { opacity: 0.9 },
          ]}
          onPress={handleContinue}
          disabled={completeSession.isPending}
        >
          <Text style={styles.continueBtnText}>
            {completeSession.isPending ? "SALVANDO..." : "CONTINUAR"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: "center",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    top: -80,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  trophyCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  heroTitle: {
    fontWeight: "900",
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.7,
    color: "#FFFFFF",
    textAlign: "center",
  },
  heroSubtitle: {
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255, 255, 255, 0.85)",
    textAlign: "center",
    marginTop: 8,
    maxWidth: 280,
  },
  xpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 24,
  },
  xpBadgeText: {
    fontWeight: "900",
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 20,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.6)",
    padding: 16,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  statLabel: {
    fontWeight: "900",
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  statValue: {
    fontWeight: "900",
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.6,
    color: "#2B2B2B",
  },
  accuracyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.6)",
    padding: 20,
    gap: 12,
  },
  accuracyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accuracyLabel: {
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  accuracyValue: {
    fontWeight: "900",
    fontSize: 20,
    letterSpacing: -0.5,
    color: "#2B2B2B",
  },
  accuracyBarBg: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#F0F0F0",
  },
  accuracyBarFill: {
    height: 12,
    borderRadius: 6,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(239, 236, 236, 0.6)",
    backgroundColor: "#FFFFFF",
  },
  continueBtn: {
    height: 64,
    backgroundColor: "#58CD04",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(88, 205, 4, 0.3)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 25,
    elevation: 8,
  },
  continueBtnDisabled: {
    backgroundColor: "#B8E890",
    shadowOpacity: 0,
    elevation: 0,
  },
  continueBtnText: {
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
});
