import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Spinner } from "heroui-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import type { StartSessionResponse } from "@pruvi/shared";

import { colors } from "@/lib/design-tokens";
import { LivesBar } from "@/components/session/LivesBar";
import { ProgressBar } from "@/components/session/ProgressBar";
import { QuestionCard } from "@/components/session/QuestionCard";
import { Screen } from "@/components/common/Screen";
import { useAnswerQuestion } from "@/hooks/useSessionQuery";
import { useLives } from "@/hooks/useLives";
import { useGamificationStore } from "@/stores/gamificationStore";
import { useSessionStore } from "@/stores/sessionStore";

const ANSWER_ANIMATION_MS = 1200;

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const router = useRouter();

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

  useEffect(() => {
    if (lives.data) {
      sessionActions.reset(lives.data.lives);
    }
    return () => {
      sessionActions.reset(5);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lives.data?.lives]);

  if (!session) {
    return (
      <Screen scrollable={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
          <Text style={{ fontSize: 16, color: colors.text }}>
            Sessão não encontrada.
          </Text>
          <Button onPress={() => router.replace("/(app)/(tabs)")}>
            <Button.Label>Voltar ao início</Button.Label>
          </Button>
        </View>
      </Screen>
    );
  }

  const currentQuestion = session.questions[currentQuestionIndex];
  const totalQuestions = session.questions.length;

  if (!currentQuestion) {
    return (
      <Screen scrollable={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Spinner size="lg" />
        </View>
      </Screen>
    );
  }

  const handleAnswer = () => {
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
          if (res.correct) setCorrectCount(nextCorrectCount);

          setTimeout(() => {
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

  const buttonDisabled =
    selectedOptionIndex === null ||
    answerState !== "idle" ||
    answerQuestion.isPending;

  return (
    <Screen>
      <View style={{ gap: 24, paddingVertical: 16 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
          }}
        >
          <ProgressBar total={totalQuestions} completed={currentQuestionIndex} />
          <LivesBar livesRemaining={livesRemaining} />
        </View>

        <QuestionCard
          question={currentQuestion}
          selectedIndex={selectedOptionIndex}
          answerState={answerState}
          correctIndex={correctIndex}
          onSelect={sessionActions.selectOption}
        />

        <Button onPress={handleAnswer} isDisabled={buttonDisabled}>
          {answerQuestion.isPending ? (
            <Spinner size="sm" color="default" />
          ) : (
            <Button.Label>Responder</Button.Label>
          )}
        </Button>
      </View>
    </Screen>
  );
}
