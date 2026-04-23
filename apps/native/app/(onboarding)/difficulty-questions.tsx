import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from "react-native-svg";

import type { StudyDifficulty } from "@pruvi/shared";
import { useOnboardingActions, useOnboardingStore } from "@/stores/onboardingStore";

import { ExamCard } from "./components/exam-card";
import { OnboardingHeader } from "./components/onboarding-header";
import { PrimaryButton } from "./components/primary-button";

// --- Difficulty Icons ---

function ConsistencyIcon() {
  return (
    <Svg width={24} height={24} viewBox="12 12 20 20" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M22 32c5.523 0 10-4.477 10-10s-4.477-10-10-10-10 4.477-10 10 4.477 10 10 10zm3-10c.552 0 1-.672 1-1.5S25.552 19 25 19s-1 .672-1 1.5.448 1.5 1 1.5zm-5-1.5c0 .828-.448 1.5-1 1.5s-1-.672-1-1.5.448-1.5 1-1.5 1 .672 1 1.5zm-1.603 6.947a.75.75 0 00.493-1.345A3.75 3.75 0 0122 26.75a3.75 3.75 0 012.553.852.75.75 0 10.894-1.204A5.25 5.25 0 0022 25.25a5.25 5.25 0 00-3.447 1.148.75.75 0 00.844 1.049z"
        fill="#6B6B6B"
      />
    </Svg>
  );
}

function EasyErrorsIcon() {
  return (
    <Svg width={24} height={24} viewBox="12 12 20 20" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17.843 13.802C19.872 12.601 20.886 12 22 12s2.128.6 4.157 1.802l.686.406C28.872 15.41 29.886 16.011 30.443 17 31 17.99 31 19.19 31 21.594v.812c0 2.403 0 3.605-.557 4.594-.557.989-1.571 1.59-3.6 2.791l-.686.407C24.128 31.399 23.114 32 22 32s-2.128-.6-4.157-1.802l-.686-.407c-2.029-1.2-3.043-1.802-3.6-2.791C13 26.01 13 24.81 13 22.406v-.812c0-2.404 0-3.605.557-4.594.557-.989 1.571-1.59 3.6-2.792l.686-.406zM23 26a1 1 0 11-2 0 1 1 0 012 0zm-.25-9a.75.75 0 00-1.5 0v6a.75.75 0 001.5 0v-6z"
        fill="#84CC16"
      />
    </Svg>
  );
}

function ReviewIcon() {
  return (
    <Svg width={24} height={24} viewBox="12 12 20 20" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M22.023 12.25c-4.794 0-8.734 3.663-9.118 8.333h-.961a.75.75 0 00-.528 1.283l1.68 1.666a.75.75 0 001.056 0l1.68-1.666a.75.75 0 00-.528-1.283h-.893c.38-3.831 3.638-6.833 7.612-6.833a8.26 8.26 0 016.537 3.643.75.75 0 001.277-.786A9.76 9.76 0 0022.023 12.25z"
        fill="#6B6B6B"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M30.785 20.467a.75.75 0 00-1.054 0l-1.687 1.666a.75.75 0 00.527 1.284h.899c-.382 3.83-3.651 6.833-7.644 6.833a8.27 8.27 0 01-6.565-3.644.75.75 0 00-1.3.788 9.77 9.77 0 007.865 4.356c4.808 0 8.765-3.66 9.15-8.333h.968a.75.75 0 00.527-1.284l-1.686-1.666z"
        fill="#6B6B6B"
      />
    </Svg>
  );
}

function WhereStartIcon() {
  return (
    <Svg width={24} height={24} viewBox="12 12 20 20" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M22 12c-4.418 0-8 4.003-8 8.5 0 4.462 2.553 9.312 6.537 11.174a2.75 2.75 0 002.926 0C27.447 29.812 30 24.962 30 20.5c0-4.497-3.582-8.5-8-8.5zm0 10a2 2 0 100-4 2 2 0 000 4z"
        fill="#6B6B6B"
      />
    </Svg>
  );
}

function TimeMgmtIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke="#6B6B6B" strokeWidth={1.5} />
      <Path d="M12 7v5l3 3" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// --- Data ---

const DIFFICULTIES: { id: StudyDifficulty; label: string; icon: React.ReactElement }[] = [
  { id: "consistency", label: "Falta de constância", icon: <ConsistencyIcon /> },
  { id: "easy-errors", label: "Erro em questões fáceis", icon: <EasyErrorsIcon /> },
  { id: "review", label: "Não sei revisar", icon: <ReviewIcon /> },
  { id: "where-start", label: "Não sei por onde começar", icon: <WhereStartIcon /> },
  { id: "time-mgmt", label: "Gestão de tempo", icon: <TimeMgmtIcon /> },
];

export default function DifficultyQuestionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const stored = useOnboardingStore((s) => s.difficulties);
  const { setDifficulties } = useOnboardingActions();
  const [selected, setSelected] = useState<Set<StudyDifficulty>>(
    new Set(stored.length > 0 ? stored : ["easy-errors"]),
  );

  function toggleDifficulty(id: StudyDifficulty) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <View style={styles.screen}>
      <OnboardingHeader step={4} totalSteps={6} title="Obstáculos" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>QUAL SUA MAIOR DIFICULDADE?</Text>
          <Text style={styles.subtitle}>
            Vamos criar estratégias para você superar isso.
          </Text>
        </View>

        {/* Difficulty Cards */}
        <View style={styles.cardsSection}>
          {DIFFICULTIES.map((item) => (
            <ExamCard
              key={item.id}
              icon={item.icon}
              title={item.label}
              selected={selected.has(item.id)}
              onPress={() => toggleDifficulty(item.id)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Bottom Section */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
        <PrimaryButton
          label="PRÓXIMO"
          onPress={() => {
            setDifficulties(Array.from(selected));
            router.push("/(onboarding)/daily-time");
          }}
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

  // Cards
  cardsSection: {
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
