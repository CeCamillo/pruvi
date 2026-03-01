import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useEffect, useReducer } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { quizReducer, initialQuizState } from "@/src/features/quiz/quiz.reducer";
import { useSessionStore } from "@/src/stores/session-store";
import { api } from "@/src/services/api";

const OPTION_LABELS = ["A", "B", "C", "D"];

export default function QuizScreen() {
  const router = useRouter();
  const { sessionId, questions, clearSession } = useSessionStore();
  const [state, dispatch] = useReducer(quizReducer, {
    ...initialQuizState,
    questions,
  });

  const progress = useSharedValue(0);

  useEffect(() => {
    if (questions.length > 0) {
      progress.value = withTiming((state.currentIndex + 1) / questions.length, { duration: 400 });
    }
  }, [state.currentIndex, questions.length, progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${(progress.value * 100).toString()}%`,
  }));

  // Submit answer when entering checking phase (state machine prevents double-dispatch)
  useEffect(() => {
    if (state.phase !== "checking" || state.selectedIndex === null) return;
    const question = questions[state.currentIndex];

    void api
      .answerQuestion(question.id, { selectedOptionIndex: state.selectedIndex })
      .then((result) => {
        dispatch({ type: "SUBMIT_ANSWER", correctOptionIndex: result.correctOptionIndex });
      })
      .catch(() => {
        dispatch({ type: "SUBMIT_ANSWER", correctOptionIndex: -1 });
      });
  }, [state.phase, state.selectedIndex, state.currentIndex, questions]);

  // Complete session when quiz is done
  useEffect(() => {
    if (state.phase !== "complete" || !sessionId) return;
    void api
      .completeSession(sessionId, {
        questionsAnswered: state.answeredCount,
        questionsCorrect: state.correctCount,
      })
      .then(() => {
        clearSession();
        router.replace("/completion");
      })
      .catch(() => {
        router.replace("/completion");
      });
  }, [state.phase, sessionId, state.answeredCount, state.correctCount, clearSession, router]);

  if (questions.length === 0) {
    router.replace("/");
    return null;
  }

  const currentQuestion = questions[state.currentIndex];

  return (
    <View className="flex-1 bg-background pt-12 px-6">
      {/* Progress bar */}
      <View className="h-2 bg-content2 rounded-full mb-8">
        <Animated.View className="h-full bg-primary rounded-full" style={progressStyle} />
      </View>

      <Text className="text-default-400 text-sm mb-2">
        Questão {state.currentIndex + 1} de {questions.length}
      </Text>
      <Text className="text-foreground text-lg font-medium mb-8">{currentQuestion.body}</Text>

      {/* Options */}
      <View className="gap-3">
        {currentQuestion.options.map((option, index) => {
          const isSelected = state.selectedIndex === index;
          const isChecking = state.phase === "checking";
          const isFeedback = state.phase === "feedback";
          const isCorrectOption = isFeedback && state.lastAnswerCorrect === true && isSelected;
          const isWrongOption = isFeedback && state.lastAnswerCorrect === false && isSelected;

          let borderColor = "border-content3";
          if (isSelected && isChecking) borderColor = "border-primary";
          if (isCorrectOption) borderColor = "border-success";
          if (isWrongOption) borderColor = "border-danger";

          return (
            <Pressable
              key={index}
              onPress={() => {
                if (state.phase !== "answering") return;
                dispatch({ type: "SELECT_ANSWER", selectedIndex: index });
              }}
              className={`flex-row items-center border-2 ${borderColor} rounded-2xl p-4`}
            >
              <View className="w-8 h-8 rounded-full bg-content2 items-center justify-center mr-3">
                <Text className="text-foreground font-bold">{OPTION_LABELS[index]}</Text>
              </View>
              <Text className="flex-1 text-foreground">{option}</Text>
              {isSelected && isChecking && <ActivityIndicator size="small" className="ml-2" />}
            </Pressable>
          );
        })}
      </View>

      {/* Continuar button */}
      {state.phase === "feedback" && (
        <Pressable
          onPress={() => {
            dispatch({ type: "NEXT_QUESTION" });
          }}
          className="mt-8 bg-primary rounded-2xl py-4 items-center"
        >
          <Text className="text-white font-semibold text-lg">Continuar</Text>
        </Pressable>
      )}
    </View>
  );
}
