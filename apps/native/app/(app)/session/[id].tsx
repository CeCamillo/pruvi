import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path } from "react-native-svg";

import { difficultyFromNumber, type StartSessionResponse } from "@pruvi/shared";

import { useAnswerQuestion } from "@/hooks/useSessionQuery";
import { useLives } from "@/hooks/useLives";
import { useGamificationStore } from "@/stores/gamificationStore";
import { useSessionStore } from "@/stores/sessionStore";

const ANSWER_ANIMATION_MS = 1200;
const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

// ─── Icons ───────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M12 4L4 12M4 4l8 8"
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21s-7-4.35-7-10a5 5 0 0110-1 5 5 0 0110 1c0 5.65-7 10-7 10z"
        fill={filled ? "#FF4D4F" : "#F0F0F0"}
        stroke={filled ? "#FF4D4F" : "#D6D6D6"}
        strokeWidth={1.5}
      />
    </Svg>
  );
}

function CheckBadgeIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <SvgCircle cx={11} cy={11} r={9} fill="rgba(255,255,255,0.3)" />
      <Path
        d="M7 11l2.5 2.5 5.5-5.5"
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Components ──────────────────────────────────────────────────────────────

function LivesPill({
  remaining,
  max,
}: {
  remaining: number;
  max: number;
}) {
  return (
    <View style={styles.livesPill}>
      {Array.from({ length: max }).map((_, i) => (
        <HeartIcon key={i} filled={i < remaining} />
      ))}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: session } = useQuery<StartSessionResponse>({
    queryKey: ["session", "active", sessionId],
    queryFn: () => {
      throw new Error("Session not loaded — return to home");
    },
    staleTime: Infinity,
    retry: false,
  });

  const lives = useLives();
  const answerQuestion = useAnswerQuestion();

  const currentQuestionIndex = useSessionStore((s) => s.currentQuestionIndex);
  const selectedOptionIndex = useSessionStore((s) => s.selectedOptionIndex);
  const answerState = useSessionStore((s) => s.answerState);
  const livesRemaining = useSessionStore((s) => s.livesRemaining);
  const sessionActions = useSessionStore((s) => s.actions);
  const gamificationActions = useGamificationStore((s) => s.actions);

  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (lives.data) {
      sessionActions.reset(lives.data.lives);
    }
    return () => {
      sessionActions.reset(lives.data?.maxLives ?? 5);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lives.data?.lives]);

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current);
        advanceTimeoutRef.current = null;
      }
    };
  }, []);

  if (!session) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Sessão não encontrada.</Text>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => router.replace("/(app)/(tabs)")}
        >
          <Text style={styles.primaryBtnText}>VOLTAR AO INÍCIO</Text>
        </Pressable>
      </View>
    );
  }

  const currentQuestion = session.questions[currentQuestionIndex];
  const totalQuestions = session.questions.length;

  if (!currentQuestion) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Carregando…</Text>
      </View>
    );
  }

  const progressPct = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  const handleConfirm = () => {
    if (selectedOptionIndex === null) return;
    answerQuestion.mutate(
      { questionId: currentQuestion.id, selectedOptionIndex },
      {
        onSuccess: (res) => {
          setCorrectIndex(res.correctOptionIndex);
          sessionActions.setAnswerState(res.correct ? "correct" : "wrong");
          sessionActions.setLivesRemaining(res.livesRemaining);
          gamificationActions.addXP(res.xpAwarded);
          const nextCorrectCount = correctCount + (res.correct ? 1 : 0);
          setCorrectCount(nextCorrectCount);

          advanceTimeoutRef.current = setTimeout(() => {
            advanceTimeoutRef.current = null;
            const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
            const noLivesLeft = res.livesRemaining === 0;

            if (isLastQuestion || noLivesLeft) {
              router.replace({
                pathname: "/session/result",
                params: {
                  sessionId: String(sessionId),
                  questionCount: String(currentQuestionIndex + 1),
                  correctCount: String(nextCorrectCount),
                },
              });
            } else {
              setCorrectIndex(null);
              sessionActions.nextQuestion();
            }
          }, ANSWER_ANIMATION_MS);
        },
      },
    );
  };

  const confirmDisabled =
    selectedOptionIndex === null ||
    answerState !== "idle" ||
    answerQuestion.isPending;

  const maxLives = lives.data?.maxLives ?? 5;

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <View style={styles.topBarContent}>
          <Pressable
            style={styles.closeBtn}
            onPress={() => router.replace("/(app)/(tabs)")}
          >
            <CloseIcon />
          </Pressable>

          <View style={styles.topBarCenter}>
            <View style={styles.topBarTitles}>
              <Text style={styles.topBarExam}>Sessão Diária</Text>
              <Text style={styles.topBarQuestion}>
                Questão {String(currentQuestionIndex + 1).padStart(2, "0")} de{" "}
                {totalQuestions}
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[styles.progressBarFill, { width: `${progressPct}%` }]}
              />
            </View>
          </View>

          <LivesPill remaining={livesRemaining} max={maxLives} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tagsRow}>
          <View style={[styles.tag, { backgroundColor: "#DBEAFE" }]}>
            <Text style={styles.tagText}>
              {difficultyFromNumber(currentQuestion.difficulty)}
            </Text>
          </View>
        </View>

        <Text style={styles.questionBody}>{currentQuestion.body}</Text>

        <View style={styles.optionsList}>
          {currentQuestion.options.map((optionText, index) => {
            const letter = OPTION_LETTERS[index] ?? String(index + 1);
            const isSelected = selectedOptionIndex === index;
            const isCorrect =
              answerState !== "idle" && correctIndex === index;
            const isWrongSelection =
              answerState === "wrong" && isSelected && correctIndex !== index;

            let cardStyle: object = styles.optionCard;
            let letterStyle: object = styles.optionLetter;
            let letterTextStyle: object = styles.optionLetterText;
            let textStyle: object = styles.optionText;

            if (isCorrect) {
              cardStyle = { ...styles.optionCard, ...styles.optionCardCorrect };
              letterStyle = { ...styles.optionLetter, ...styles.optionLetterCorrect };
              letterTextStyle = { ...styles.optionLetterText, ...styles.optionLetterTextSelected };
              textStyle = { ...styles.optionText, ...styles.optionTextSelected };
            } else if (isWrongSelection) {
              cardStyle = { ...styles.optionCard, ...styles.optionCardWrong };
              letterStyle = { ...styles.optionLetter, ...styles.optionLetterWrong };
              letterTextStyle = { ...styles.optionLetterText, ...styles.optionLetterTextSelected };
              textStyle = { ...styles.optionText, ...styles.optionTextSelected };
            } else if (isSelected) {
              cardStyle = { ...styles.optionCard, ...styles.optionCardSelected };
              letterStyle = { ...styles.optionLetter, ...styles.optionLetterSelected };
              letterTextStyle = { ...styles.optionLetterText, ...styles.optionLetterTextSelected };
              textStyle = { ...styles.optionText, ...styles.optionTextSelected };
            }

            return (
              <Pressable
                key={index}
                style={cardStyle}
                onPress={() => {
                  if (answerState === "idle") {
                    sessionActions.selectOption(index);
                  }
                }}
                disabled={answerState !== "idle"}
              >
                <View style={letterStyle}>
                  <Text style={letterTextStyle}>{letter}</Text>
                </View>
                <Text style={textStyle}>{optionText}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.bottomBarContent}>
          <Pressable
            style={({ pressed }) => [
              styles.confirmBtn,
              confirmDisabled && styles.confirmBtnDisabled,
              pressed && !confirmDisabled && { opacity: 0.9 },
            ]}
            onPress={handleConfirm}
            disabled={confirmDisabled}
          >
            <Text style={styles.confirmBtnText}>
              {answerQuestion.isPending ? "ENVIANDO..." : "CONFIRMAR"}
            </Text>
            {!answerQuestion.isPending && <CheckBadgeIcon />}
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
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
    backgroundColor: "#FFFFFF",
  },
  errorTitle: {
    fontSize: 16,
    color: "#2B2B2B",
    fontWeight: "700",
  },
  primaryBtn: {
    backgroundColor: "#58CD04",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  primaryBtnText: {
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
  topBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(239, 236, 236, 0.5)",
  },
  topBarContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 16,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: "#2B2B2B",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarCenter: { flex: 1, gap: 6 },
  topBarTitles: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topBarExam: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.35,
    color: "#58CD04",
  },
  topBarQuestion: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.35,
    color: "#6B6B6B",
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F0F0F0",
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#58CD04",
  },
  livesPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(240, 240, 240, 0.5)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tagsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 24,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  tag: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tagText: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },
  questionBody: {
    fontWeight: "500",
    fontSize: 16,
    lineHeight: 26,
    color: "#2B2B2B",
    marginBottom: 24,
  },
  optionsList: { gap: 12 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.4)",
    paddingHorizontal: 20,
    minHeight: 68,
    paddingVertical: 14,
    gap: 16,
  },
  optionCardSelected: {
    backgroundColor: "rgba(88, 205, 4, 0.05)",
    borderColor: "#58CD04",
  },
  optionCardCorrect: {
    backgroundColor: "rgba(88, 205, 4, 0.15)",
    borderColor: "#58CD04",
  },
  optionCardWrong: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "#EF4444",
  },
  optionLetter: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  optionLetterSelected: {
    backgroundColor: "#58CD04",
  },
  optionLetterCorrect: {
    backgroundColor: "#58CD04",
  },
  optionLetterWrong: {
    backgroundColor: "#EF4444",
  },
  optionLetterText: {
    fontWeight: "900",
    fontSize: 13,
    color: "#6B6B6B",
  },
  optionLetterTextSelected: {
    color: "#FFFFFF",
  },
  optionText: {
    flex: 1,
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 22,
    color: "#2B2B2B",
  },
  optionTextSelected: {
    fontWeight: "900",
  },
  bottomBar: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderTopWidth: 1,
    borderTopColor: "#EFECEC",
  },
  bottomBarContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  confirmBtn: {
    flex: 1,
    height: 64,
    backgroundColor: "#58CD04",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "rgba(88, 205, 4, 0.2)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 25,
    elevation: 8,
  },
  confirmBtnDisabled: {
    backgroundColor: "#B8E890",
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmBtnText: {
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
});
