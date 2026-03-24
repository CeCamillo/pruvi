import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnswerOption } from "./components/answer-option";
import { PrimaryButton } from "./components/primary-button";

const QUESTION = {
  number: 1,
  total: 5,
  exam: "ENEM",
  subject: "Geografia",
  context:
    "No Brasil, a baixa incidência de terremotos de grande magnitude é explicada principalmente pela localização do território nacional.",
  question: "Qual fator geológico justifica essa estabilidade?",
  answers: [
    { letter: "A", text: "Presença de cadeias montanhosas recentes." },
    { letter: "B", text: "Localização no centro de uma placa tectônica." },
    { letter: "C", text: "Ausência de vulcões ativos no território." },
    { letter: "D", text: "Estrutura de dobramentos antigos." },
  ],
};

export default function TestQuestionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const progress = (QUESTION.number / QUESTION.total) * 100;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <View style={styles.questionBadge}>
              <Text style={styles.questionBadgeText}>Q.{QUESTION.number}</Text>
            </View>
            <View style={styles.examInfo}>
              <Text style={styles.examTitle}>{QUESTION.exam}</Text>
              <Text style={styles.examSubtitle}>QUESTÃO OFICIAL</Text>
            </View>
          </View>
          <Pressable style={styles.skipPill} onPress={() => router.push("/(drawer)")}>
            <Text style={styles.skipText}>PULAR</Text>
          </Pressable>
        </View>

        <View style={styles.subjectRow}>
          <View style={styles.subjectPill}>
            <Text style={styles.subjectText}>{QUESTION.subject}</Text>
          </View>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>PROGRESSO DA AVALIAÇÃO</Text>
            <Text style={styles.progressCount}>
              {QUESTION.number} DE {QUESTION.total}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      </View>

      {/* Question */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.questionSection}>
          <Text style={styles.contextText}>{QUESTION.context}</Text>
          <Text style={styles.questionText}>{QUESTION.question}</Text>
        </View>

        <View style={styles.answersSection}>
          {QUESTION.answers.map((answer) => (
            <AnswerOption
              key={answer.letter}
              letter={answer.letter}
              text={answer.text}
              selected={selected === answer.letter}
              onPress={() => setSelected(answer.letter)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Bottom */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
        <PrimaryButton
          label="RESPONDER"
          showArrow={false}
          onPress={() => router.push("/(drawer)")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EFECEC",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  questionBadge: {
    backgroundColor: "rgba(163, 230, 53, 0.2)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  questionBadgeText: {
    fontWeight: "900",
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: -0.6,
    textTransform: "uppercase",
    color: "#65A30D",
  },
  examInfo: {
    gap: 2,
  },
  examTitle: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 14,
    letterSpacing: -0.35,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },
  examSubtitle: {
    fontWeight: "700",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(107, 107, 107, 0.7)",
  },
  skipPill: {
    backgroundColor: "rgba(240, 240, 240, 0.4)",
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  skipText: {
    fontWeight: "900",
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "rgba(107, 107, 107, 0.6)",
  },

  // Subject
  subjectRow: {
    marginTop: 16,
  },
  subjectPill: {
    alignSelf: "flex-start",
    backgroundColor: "#F3F4F6",
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  subjectText: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#6B7280",
  },

  // Progress
  progressRow: {
    marginTop: 16,
    gap: 8,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressLabel: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  progressCount: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },
  progressTrack: {
    height: 6,
    borderRadius: 9999,
    backgroundColor: "#F0F0F0",
  },
  progressFill: {
    height: 6,
    borderRadius: 9999,
    backgroundColor: "#84CC16",
    shadowColor: "rgba(132, 204, 22, 0.3)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },

  // Question
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  questionSection: {
    marginTop: 32,
    gap: 24,
  },
  contextText: {
    fontWeight: "500",
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(43, 43, 43, 0.9)",
  },
  questionText: {
    fontWeight: "900",
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.375,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },

  // Answers
  answersSection: {
    marginTop: 32,
    gap: 16,
  },

  // Bottom
  bottomSection: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 32,
    paddingTop: 25,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(239, 236, 236, 0.4)",
  },
});
