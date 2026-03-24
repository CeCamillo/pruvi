import { Ionicons } from "@expo/vector-icons";
import { AnswerQuestionResponseSchema } from "@pruvi/shared/auth";
import { CompleteSessionResponseSchema } from "@pruvi/shared/sessions";
import type { Question } from "@pruvi/shared/questions";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { Container } from "@/components/container";
import { apiPost } from "@/lib/api-client";
import { getQuestions } from "@/lib/quiz-store";

interface Feedback {
  correct: boolean;
  correctOptionIndex: number;
  xpAwarded: number;
  livesRemaining: number;
}

export default function Quiz() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalXpEarned, setTotalXpEarned] = useState(0);
  const [hearts, setHearts] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = getQuestions();
    if (stored.length === 0) {
      Alert.alert("Error", "No questions found");
      router.back();
      return;
    }
    setQuestions(stored);
  }, []);

  if (questions.length === 0) {
    return (
      <Container className="bg-white p-6">
        <Text className="text-slate-400 text-base text-center mt-10 font-bold">Loading...</Text>
      </Container>
    );
  }

  const question = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const progress = ((currentIndex + (feedback ? 1 : 0)) / questions.length) * 100;

  async function handleCheck() {
    if (selectedOption === null) return;

    if (feedback) {
      // "Continue" pressed — advance to next question or finish
      if (isLast) {
        try {
          setSubmitting(true);
          await apiPost(
            `/sessions/${sessionId}/complete`,
            { questionCount: questions.length, correctCount },
            CompleteSessionResponseSchema
          );
          router.replace({
            pathname: "/(quiz)/results",
            params: {
              sessionId: sessionId ?? "",
              questionCount: String(questions.length),
              correctCount: String(correctCount),
              totalXpEarned: String(totalXpEarned),
            },
          });
        } catch (e) {
          Alert.alert("Error", e instanceof Error ? e.message : "Unknown error");
          setSubmitting(false);
        }
      } else {
        setCurrentIndex((i) => i + 1);
        setSelectedOption(null);
        setFeedback(null);
      }
    } else {
      // "Check" pressed — submit answer
      setSubmitting(true);
      try {
        const data = await apiPost(
          `/questions/${question.id}/answer`,
          { selectedOptionIndex: selectedOption },
          AnswerQuestionResponseSchema
        );
        setFeedback({
          correct: data.correct,
          correctOptionIndex: data.correctOptionIndex,
          xpAwarded: data.xpAwarded,
          livesRemaining: data.livesRemaining,
        });
        setHearts(data.livesRemaining);
        if (data.correct) setCorrectCount((c) => c + 1);
        setTotalXpEarned((xp) => xp + data.xpAwarded);
      } catch (e) {
        Alert.alert("Error", e instanceof Error ? e.message : "Unknown error");
      } finally {
        setSubmitting(false);
      }
    }
  }

  function getOptionStyle(index: number) {
    const base = "p-4 rounded-2xl border-2 border-b-4";
    if (feedback) {
      if (index === feedback.correctOptionIndex)
        return `${base} bg-green-100 border-green-500`;
      if (index === selectedOption && !feedback.correct)
        return `${base} bg-red-100 border-red-500`;
      return `${base} border-slate-200 bg-white opacity-40`;
    }
    if (index === selectedOption)
      return `${base} border-sky-500 bg-sky-100`;
    return `${base} border-slate-200 bg-white`;
  }

  return (
    <View className="flex-1 bg-white">
      {/* Header: X button, progress bar, hearts */}
      <View className="px-4 py-5 flex-row items-center gap-4">
        <Pressable onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#94a3b8" />
        </Pressable>
        <View className="flex-1 h-4 bg-slate-200 rounded-full overflow-hidden">
          <View
            className="h-full bg-green-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons name="heart" size={24} color="#ef4444" />
          <Text className="text-red-500 font-extrabold text-lg">{hearts}</Text>
        </View>
      </View>

      {/* Question content */}
      <View className="flex-1 px-5 pt-2 pb-40">
        {/* Difficulty badge */}
        <View className="flex-row items-center gap-2 mb-4">
          <View
            className="px-3 py-1.5 rounded-xl"
            style={{
              backgroundColor:
                question.difficulty === "easy" ? "#dcfce7"
                  : question.difficulty === "medium" ? "#fef3c7"
                    : "#fee2e2",
            }}
          >
            <Text
              className="text-xs font-extrabold uppercase tracking-wider"
              style={{
                color:
                  question.difficulty === "easy" ? "#16a34a"
                    : question.difficulty === "medium" ? "#d97706"
                      : "#dc2626",
              }}
            >
              {question.difficulty}
            </Text>
          </View>
          {question.source && (
            <Text className="text-slate-300 text-xs font-bold">{question.source}</Text>
          )}
        </View>

        {/* Question text */}
        <Text className="text-xl font-extrabold text-slate-700 mb-8 leading-8">
          {question.content}
        </Text>

        {/* Options */}
        <View className="gap-3">
          {question.options.map((option, index) => (
            <Pressable
              key={index}
              className={`${getOptionStyle(index)} active:opacity-80`}
              onPress={() => !feedback && setSelectedOption(index)}
              disabled={feedback !== null}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className={`w-8 h-8 rounded-lg border-2 items-center justify-center mr-3 ${
                    feedback
                      ? index === feedback.correctOptionIndex
                        ? "border-green-500"
                        : index === selectedOption && !feedback.correct
                          ? "border-red-500"
                          : "border-slate-200"
                      : index === selectedOption
                        ? "border-sky-500"
                        : "border-slate-200"
                  }`}>
                    <Text className={`text-sm font-extrabold ${
                      feedback
                        ? index === feedback.correctOptionIndex
                          ? "text-green-500"
                          : index === selectedOption && !feedback.correct
                            ? "text-red-500"
                            : "text-slate-300"
                        : index === selectedOption
                          ? "text-sky-500"
                          : "text-slate-300"
                    }`}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text className={`text-base font-bold flex-1 ${
                    feedback
                      ? index === feedback.correctOptionIndex
                        ? "text-green-700"
                        : index === selectedOption && !feedback.correct
                          ? "text-red-700"
                          : "text-slate-700"
                      : index === selectedOption
                        ? "text-sky-600"
                        : "text-slate-700"
                  }`}>
                    {option}
                  </Text>
                </View>
                {feedback && index === feedback.correctOptionIndex && (
                  <Ionicons name="checkmark" size={22} color="#16a34a" />
                )}
                {feedback && index === selectedOption && !feedback.correct && (
                  <Ionicons name="close" size={22} color="#dc2626" />
                )}
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Bottom feedback bar */}
      <View
        className="absolute bottom-0 left-0 right-0 px-5 py-5 border-t-2"
        style={{
          backgroundColor: feedback
            ? feedback.correct ? "#dcfce7" : "#fee2e2"
            : "#ffffff",
          borderTopColor: feedback
            ? feedback.correct ? "#86efac" : "#fca5a5"
            : "#e2e8f0",
        }}
      >
        {feedback && (
          <View className="flex-row items-center mb-4">
            <View
              className="w-12 h-12 rounded-full items-center justify-center bg-white border-2 mr-3"
              style={{ borderColor: feedback.correct ? "#22c55e" : "#ef4444" }}
            >
              <Ionicons
                name={feedback.correct ? "checkmark" : "close"}
                size={28}
                color={feedback.correct ? "#22c55e" : "#ef4444"}
              />
            </View>
            <View>
              <Text className="font-extrabold text-lg" style={{ color: feedback.correct ? "#16a34a" : "#dc2626" }}>
                {feedback.correct ? "Incredible!" : "Correct answer:"}
              </Text>
              {!feedback.correct && (
                <Text className="text-red-800 font-bold text-sm">
                  {question.options[feedback.correctOptionIndex]}
                </Text>
              )}
              {feedback.xpAwarded > 0 && (
                <Text className="text-green-600 font-bold text-sm">+{feedback.xpAwarded} XP</Text>
              )}
            </View>
          </View>
        )}

        <Pressable
          className={`py-4 rounded-2xl items-center active:translate-y-1 ${
            feedback
              ? feedback.correct
                ? "bg-green-500"
                : "bg-rose-500"
              : selectedOption !== null
                ? "bg-green-500"
                : "bg-slate-200"
          }`}
          style={{
            shadowColor: feedback
              ? feedback.correct ? "#16a34a" : "#e11d48"
              : selectedOption !== null ? "#16a34a" : "#cbd5e1",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 1,
            shadowRadius: 0,
            elevation: 4,
          }}
          onPress={handleCheck}
          disabled={selectedOption === null || submitting}
        >
          <Text className={`font-extrabold text-sm uppercase tracking-widest ${
            selectedOption !== null || feedback ? "text-white" : "text-slate-400"
          }`}>
            {submitting
              ? "Loading..."
              : feedback
                ? isLast ? "Finish" : "Continue"
                : "Check"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
