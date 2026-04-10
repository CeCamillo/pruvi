import { type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path } from "react-native-svg";

// ─── Types ───────────────────────────────────────────────────────────────────

export type RoletaOption = {
  letter: string;
  text: string;
};

export type RoletaQuestionData = {
  id: string;
  subject: string;
  tags: string[];
  text: string;
  options: RoletaOption[];
};

export type RoletaQuizProps = {
  questions: RoletaQuestionData[];
  currentIndex: number;
  selectedAnswers: Record<string, string>;
  onSelectAnswer: (questionId: string, letter: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onSubmit: () => void;
  onClose: () => void;
};

// ─── Icons ───────────────────────────────────────────────────────────────────

function ChallengeIcon() {
  return (
    <View style={styles.challengeIcon}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" />
      </Svg>
    </View>
  );
}

function BookmarkIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M5 3h10a1 1 0 011 1v13.5l-5.5-3.5L5 17.5V4a1 1 0 011-1z"
        stroke="#6B6B6B"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChevronLeftIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke="#2B2B2B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronRightIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke="#2B2B2B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M5 10l3.5 3.5 6.5-6.5" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function StarIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path d="M9 1.5l2 5.5h6l-5 3.5 2 6L9 13l-5 3.5 2-6-5-3.5h6L9 1.5z" fill="white" />
    </Svg>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RoletaQuestionScreen({
  questions,
  currentIndex,
  selectedAnswers,
  onSelectAnswer,
  onNext,
  onPrevious,
  onSubmit,
  onClose,
}: RoletaQuizProps) {
  const insets = useSafeAreaInsets();
  const question = questions[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === questions.length - 1;
  const selectedLetter = selectedAnswers[question.id] ?? null;

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <View style={styles.topBarContent}>
          <ChallengeIcon />
          <View style={styles.topBarCenter}>
            <Text style={styles.topBarTitle}>Desafio da Roleta</Text>
            <Text style={styles.topBarMeta}>
              {question.subject.toUpperCase()} • QUESTÃO {currentIndex + 1} DE {questions.length}
            </Text>
          </View>
          <Pressable onPress={onClose}>
            <BookmarkIcon />
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Tags */}
        <View style={styles.tagsRow}>
          {question.tags.map((tag, i) => (
            <View key={tag} style={[styles.tag, i === 0 ? styles.tagPrimary : styles.tagSecondary]}>
              <Text style={[styles.tagText, i === 0 ? styles.tagTextPrimary : styles.tagTextSecondary]}>{tag}</Text>
            </View>
          ))}
        </View>

        {/* Progress bar */}
        <View style={styles.progressRow}>
          {questions.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressSegment,
                i <= currentIndex ? styles.progressActive : styles.progressInactive,
              ]}
            />
          ))}
        </View>

        {/* Question text */}
        <Text style={styles.questionText}>{question.text}</Text>

        {/* Options */}
        <View style={styles.optionsList}>
          {question.options.map((opt) => {
            const isSelected = selectedLetter === opt.letter;
            return (
              <Pressable
                key={opt.letter}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                onPress={() => onSelectAnswer(question.id, opt.letter)}
              >
                <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
                <View style={[styles.optionLetterBox, isSelected && styles.optionLetterBoxSelected]}>
                  <Text style={[styles.optionLetter, isSelected && styles.optionLetterSelected]}>
                    {opt.letter}
                  </Text>
                </View>
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {opt.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.bottomBarContent}>
          {/* Navigation */}
          <View style={styles.navButtons}>
            <Pressable
              style={[styles.navBtn, isFirst && styles.navBtnDisabled]}
              onPress={onPrevious}
              disabled={isFirst}
            >
              <ChevronLeftIcon />
            </Pressable>
            <Text style={styles.navLabel}>{isFirst ? "" : "Anterior"}</Text>
          </View>

          <View style={styles.navButtons}>
            <Pressable
              style={[styles.navBtn, isLast && styles.navBtnDisabled]}
              onPress={onNext}
              disabled={isLast}
            >
              <ChevronRightIcon />
            </Pressable>
            <Text style={styles.navLabel}>{isLast ? "" : "Próxima"}</Text>
          </View>

          {/* Submit button */}
          <Pressable
            style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.9 }]}
            onPress={isLast ? onSubmit : onNext}
          >
            {isLast ? <StarIcon /> : <CheckIcon />}
            <Text style={styles.submitBtnText}>
              {isLast ? "FINALIZAR" : "RESPONDER"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 24 },

  // ─── Top Bar ──────────────────────────────────────────────────────────────
  topBar: { backgroundColor: "#FFFFFF" },
  topBarContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 12,
  },
  challengeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#58CD04",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarCenter: { flex: 1 },
  topBarTitle: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.35,
    color: "#2B2B2B",
  },
  topBarMeta: {
    fontWeight: "700",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.5,
    color: "#6B6B6B",
    textTransform: "uppercase",
  },

  // ─── Tags ─────────────────────────────────────────────────────────────────
  tagsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    marginBottom: 12,
  },
  tag: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  tagPrimary: {
    backgroundColor: "rgba(88, 205, 4, 0.1)",
  },
  tagSecondary: {
    backgroundColor: "#F0F0F0",
  },
  tagText: {
    fontWeight: "900",
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 0.55,
  },
  tagTextPrimary: { color: "#58CD04" },
  tagTextSecondary: { color: "#6B6B6B" },

  // ─── Progress ─────────────────────────────────────────────────────────────
  progressRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 24,
  },
  progressSegment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  progressActive: { backgroundColor: "#58CD04" },
  progressInactive: { backgroundColor: "#F0F0F0" },

  // ─── Question ─────────────────────────────────────────────────────────────
  questionText: {
    fontWeight: "500",
    fontSize: 15,
    lineHeight: 24,
    color: "#2B2B2B",
    marginBottom: 24,
  },

  // ─── Options ──────────────────────────────────────────────────────────────
  optionsList: { gap: 12 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.4)",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  optionCardSelected: {
    backgroundColor: "rgba(59, 130, 246, 0.05)",
    borderColor: "#3B82F6",
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#EFECEC",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: {
    borderColor: "#3B82F6",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#3B82F6",
  },
  optionLetterBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  optionLetterBoxSelected: {
    backgroundColor: "#3B82F6",
  },
  optionLetter: {
    fontWeight: "900",
    fontSize: 13,
    lineHeight: 13,
    color: "#6B6B6B",
  },
  optionLetterSelected: {
    color: "#FFFFFF",
  },
  optionText: {
    flex: 1,
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 20,
    color: "#2B2B2B",
  },
  optionTextSelected: {
    fontWeight: "900",
  },

  // ─── Bottom Bar ───────────────────────────────────────────────────────────
  bottomBar: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderTopWidth: 1,
    borderTopColor: "#EFECEC",
  },
  bottomBarContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
  },
  navButtons: {
    alignItems: "center",
    gap: 4,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  navLabel: {
    fontWeight: "700",
    fontSize: 9,
    lineHeight: 14,
    color: "#6B6B6B",
    textAlign: "center",
  },
  submitBtn: {
    flex: 1,
    height: 56,
    backgroundColor: "#58CD04",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "rgba(88, 205, 4, 0.2)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 5,
  },
  submitBtnText: {
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
});
