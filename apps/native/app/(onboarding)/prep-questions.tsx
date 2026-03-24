import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OnboardingHeader } from "./components/onboarding-header";
import { PrimaryButton } from "./components/primary-button";
import { RadioOption } from "./components/radio-option";

const OPTIONS = [
  { id: "3m", label: "Até 3 meses" },
  { id: "3-6m", label: "3 a 6 meses" },
  { id: "6-12m", label: "6 a 12 meses" },
  { id: "preparing", label: "Ainda me preparando" },
] as const;

export default function PrepQuestionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState("3m");

  return (
    <View style={styles.screen}>
      <OnboardingHeader step={2} totalSteps={6} title="Cronograma" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>QUANDO É SUA PROVA?</Text>
          <Text style={styles.subtitle}>Isso define a intensidade da sua trilha.</Text>
        </View>

        {/* Options */}
        <View style={styles.optionsSection}>
          {OPTIONS.map((option) => (
            <RadioOption
              key={option.id}
              label={option.label}
              selected={selected === option.id}
              onPress={() => setSelected(option.id)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Bottom Section */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
        <PrimaryButton label="PRÓXIMO" onPress={() => router.push("/(onboarding)/difficulty-questions")} />
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
