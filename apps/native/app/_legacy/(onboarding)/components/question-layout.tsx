import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnswerOption } from "./answer-option";
import { PrimaryButton } from "./primary-button";

type QuestionData = {
  number: number;
  total: number;
  exam: string;
  subject: string;
  context: string;
  question: string;
  answers: { letter: string; text: string }[];
};

type Props = {
  data: QuestionData;
  onSubmit: (selectedLetter: string) => void;
  onSkip: () => void;
  submitLabel?: string;
  skipLabel?: string;
};

export function QuestionLayout({
  data,
  onSubmit,
  onSkip,
  submitLabel = "RESPONDER",
  skipLabel = "PULAR",
}: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);
  const progress = (data.number / data.total) * 100;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <View style={styles.questionBadge}>
              <Text style={styles.questionBadgeText}>Q.{data.number}</Text>
            </View>
            <View style={styles.examInfo}>
              <Text style={styles.examTitle}>{data.exam}</Text>
              <Text style={styles.examSubtitle}>QUESTÃO OFICIAL</Text>
            </View>
          </View>
          <Pressable style={styles.skipPill} onPress={onSkip}>
            <Text style={styles.skipText}>{skipLabel}</Text>
          </Pressable>
        </View>

        <View style={styles.subjectRow}>
          <View style={styles.subjectPill}>
            <Text style={styles.subjectText}>{data.subject}</Text>
          </View>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>PROGRESSO DA AVALIAÇÃO</Text>
            <Text style={styles.progressCount}>
              {data.number} DE {data.total}
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
          <Text style={styles.contextText}>{data.context}</Text>
          <Text style={styles.questionText}>{data.question}</Text>
        </View>

        <View style={styles.answersSection}>
          {data.answers.map((answer) => (
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
          label={submitLabel}
          showArrow={false}
          onPress={() => {
            if (selected) onSubmit(selected);
          }}
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
  answersSection: {
    marginTop: 32,
    gap: 16,
  },
  bottomSection: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 32,
    paddingTop: 25,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(239, 236, 236, 0.4)",
  },
});
