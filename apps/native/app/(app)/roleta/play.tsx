import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path } from "react-native-svg";

import type { RoletaStartResponse } from "@pruvi/shared";
import { difficultyFromNumber } from "@pruvi/shared";

import { OptionCard, type OptionCardState } from "@/components/session/OptionCard";
import { useAnswerRoleta } from "@/hooks/useRoleta";
import { useRoletaActions, useRoletaStore } from "@/stores/roletaStore";

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;
const ANSWER_ANIMATION_MS = 1200;

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

export default function RoletaPlayScreen() {
  const { spinId } = useLocalSearchParams<{ spinId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const answerQuestion = useAnswerRoleta();

  const { data: spin } = useQuery<RoletaStartResponse>({
    queryKey: ["roleta", "active-spin", spinId],
    queryFn: () => {
      throw new Error("Spin not loaded — return to roleta");
    },
    staleTime: Infinity,
    retry: false,
  });

  const currentIndex = useRoletaStore((s) => s.currentIndex);
  const selectedOptionIndex = useRoletaStore((s) => s.selectedOptionIndex);
  const answerState = useRoletaStore((s) => s.answerState);
  const actions = useRoletaActions();

  const correctIndexRef = useRef<number | null>(null);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current);
        advanceTimeoutRef.current = null;
      }
    };
  }, []);

  if (!spin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Giro não encontrado.</Text>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => router.replace("/roleta")}
        >
          <Text style={styles.primaryBtnText}>VOLTAR</Text>
        </Pressable>
      </View>
    );
  }

  const currentQuestion = spin.questions[currentIndex];
  const total = spin.questions.length;

  if (!currentQuestion) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Carregando…</Text>
      </View>
    );
  }

  const progressPct = ((currentIndex + 1) / total) * 100;

  const handleConfirm = () => {
    if (selectedOptionIndex === null) return;
    answerQuestion.mutate(
      {
        spinId: spin.spinId,
        questionId: currentQuestion.id,
        selectedOptionIndex,
      },
      {
        onSuccess: (res) => {
          correctIndexRef.current = res.correctOptionIndex;
          actions.setAnswerState(res.correct ? "correct" : "wrong");
          actions.recordAnswer(res.correct, res.xpAwarded);
          const store = useRoletaStore.getState();
          const nextCorrect = store.correctCount;
          const nextXp = store.xpEarned;

          advanceTimeoutRef.current = setTimeout(() => {
            advanceTimeoutRef.current = null;
            const isLast = currentIndex === total - 1;
            if (isLast) {
              router.replace(
                `/roleta/result?correct=${nextCorrect}&total=${total}&subject=${encodeURIComponent(
                  spin.subject.name,
                )}&xp=${nextXp}`,
              );
            } else {
              correctIndexRef.current = null;
              actions.nextQuestion();
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
              <Text style={styles.topBarSubject}>{spin.subject.name}</Text>
              <Text style={styles.topBarQuestion}>
                {String(currentIndex + 1).padStart(2, "0")} / {total}
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[styles.progressBarFill, { width: `${progressPct}%` }]}
              />
            </View>
          </View>
          <View style={{ width: 40 }} />
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
              answerState !== "idle" && correctIndexRef.current === index;
            const isWrongSelection =
              answerState === "wrong" &&
              isSelected &&
              correctIndexRef.current !== index;

            const state: OptionCardState = isCorrect
              ? "correct"
              : isWrongSelection
                ? "wrong"
                : isSelected
                  ? "selected"
                  : "idle";

            return (
              <OptionCard
                key={index}
                letter={letter}
                text={optionText}
                state={state}
                onPress={() => {
                  if (answerState === "idle") {
                    actions.selectOption(index);
                  }
                }}
                disabled={answerState !== "idle"}
              />
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
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
  );
}

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
  topBarSubject: {
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
  bottomBar: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderTopWidth: 1,
    borderTopColor: "#EFECEC",
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
    marginHorizontal: 24,
    marginTop: 16,
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
