import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { DailyStudyTime } from "@pruvi/shared";
import { useCompleteOnboarding } from "@/hooks/useOnboarding";
import { useOnboardingActions, useOnboardingStore } from "@/stores/onboardingStore";

import { OnboardingHeader } from "./components/onboarding-header";
import { PrimaryButton } from "./components/primary-button";
import { TimeOption } from "./components/time-option";

const OPTIONS: { id: DailyStudyTime; label: string; tag: string }[] = [
  { id: "30min", label: "30 minutos / dia", tag: "Casual" },
  { id: "1h", label: "1 hora / dia", tag: "Regular" },
  { id: "2h", label: "2 horas / dia", tag: "Intensa" },
  { id: "3h+", label: "3+ horas / dia", tag: "Puxada" },
];

export default function DailyTimeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const stored = useOnboardingStore((s) => s.dailyStudyTime);
  const selectedExam = useOnboardingStore((s) => s.selectedExam);
  const prepTimeline = useOnboardingStore((s) => s.prepTimeline);
  const difficulties = useOnboardingStore((s) => s.difficulties);
  const { setDailyStudyTime, reset } = useOnboardingActions();
  const [selected, setSelected] = useState<DailyStudyTime>(stored ?? "1h");
  const completeMutation = useCompleteOnboarding();

  async function handleFinish() {
    if (!selectedExam || !prepTimeline || difficulties.length === 0) {
      // Defensive: the user somehow reached this screen without completing
      // an earlier step. Send them back to the beginning rather than
      // shipping an incomplete payload.
      router.replace("/(onboarding)/start");
      return;
    }
    setDailyStudyTime(selected);
    try {
      await completeMutation.mutateAsync({
        selectedExam,
        prepTimeline,
        difficulties,
        dailyStudyTime: selected,
      });
      reset();
      router.replace("/(app)/(tabs)");
    } catch (error) {
      Alert.alert(
        "Não foi possível finalizar",
        "Verifique sua conexão e tente novamente.",
      );
    }
  }

  return (
    <View style={styles.screen}>
      <OnboardingHeader step={5} totalSteps={6} title="Rotina" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>QUANTO TEMPO VOCÊ PODE ESTUDAR POR DIA?</Text>
          <Text style={styles.subtitle}>Sua meta diária será adaptada à sua rotina.</Text>
        </View>

        {/* Options */}
        <View style={styles.optionsSection}>
          {OPTIONS.map((option) => (
            <TimeOption
              key={option.id}
              label={option.label}
              tag={option.tag}
              selected={selected === option.id}
              onPress={() => setSelected(option.id)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Bottom Section */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
        <PrimaryButton
          label={completeMutation.isPending ? "SALVANDO..." : "VOU CUMPRIR A META"}
          showArrow={false}
          disabled={completeMutation.isPending}
          onPress={handleFinish}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FAFBFC",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 32,
    paddingBottom: 24,
  },

  // Title
  titleSection: {
    marginTop: 40,
    gap: 12,
  },
  title: {
    fontWeight: "900",
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: -0.7,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },
  subtitle: {
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 23,
    color: "rgba(107, 107, 107, 0.7)",
  },

  // Options
  optionsSection: {
    marginTop: 40,
    gap: 16,
  },

  // Bottom
  bottomSection: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 32,
    paddingTop: 33,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(239, 236, 236, 0.4)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.03,
    shadowRadius: 40,
    elevation: 4,
  },
});
