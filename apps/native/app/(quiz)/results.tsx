import { StreakResponseSchema } from "@pruvi/shared/auth";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Container } from "@/components/container";
import { apiGet } from "@/lib/api-client";

export default function Results() {
  const params = useLocalSearchParams<{
    sessionId: string;
    questionCount: string;
    correctCount: string;
    totalXpEarned: string;
  }>();
  const router = useRouter();

  const questionCount = Number(params.questionCount);
  const correctCount = Number(params.correctCount);
  const totalXpEarned = Number(params.totalXpEarned);
  const accuracy = questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0;

  const [currentStreak, setCurrentStreak] = useState<number | null>(null);

  useEffect(() => {
    apiGet("/streaks", StreakResponseSchema)
      .then((data) => setCurrentStreak(data.currentStreak))
      .catch(() => setCurrentStreak(0));
  }, []);

  return (
    <View className="flex-1 bg-white justify-center items-center px-6">
      {/* Emoji */}
      <Text className="text-8xl mb-6">🎉</Text>

      <Text className="text-3xl font-extrabold text-yellow-500 mb-2 uppercase tracking-wide">
        Session Complete!
      </Text>
      <Text className="text-slate-400 font-bold text-sm mb-8">
        {accuracy >= 70 ? "Great work!" : accuracy >= 40 ? "Keep practicing!" : "Don't give up!"}
      </Text>

      {/* Stats grid */}
      <View className="flex-row gap-4 w-full mb-4">
        <View className="flex-1 bg-orange-100 rounded-2xl p-4 border-2 border-orange-200 items-center">
          <Text className="text-xs text-orange-600 font-extrabold uppercase tracking-wider">XP Earned</Text>
          <Text className="text-3xl font-extrabold text-orange-500 mt-1">+{totalXpEarned}</Text>
        </View>
        <View className="flex-1 bg-green-100 rounded-2xl p-4 border-2 border-green-200 items-center">
          <Text className="text-xs text-green-600 font-extrabold uppercase tracking-wider">Accuracy</Text>
          <Text className="text-3xl font-extrabold text-green-500 mt-1">{accuracy}%</Text>
        </View>
      </View>

      <View className="flex-row gap-4 w-full mb-10">
        <View className="flex-1 bg-sky-100 rounded-2xl p-4 border-2 border-sky-200 items-center">
          <Text className="text-xs text-sky-600 font-extrabold uppercase tracking-wider">Score</Text>
          <Text className="text-3xl font-extrabold text-sky-500 mt-1">{correctCount}/{questionCount}</Text>
        </View>
        <View className="flex-1 bg-purple-100 rounded-2xl p-4 border-2 border-purple-200 items-center">
          <Text className="text-xs text-purple-600 font-extrabold uppercase tracking-wider">Streak</Text>
          <Text className="text-3xl font-extrabold text-purple-500 mt-1">
            {currentStreak !== null ? `${currentStreak}🔥` : "..."}
          </Text>
        </View>
      </View>

      {/* Buttons */}
      <View className="w-full gap-3">
        <Pressable
          className="bg-green-500 py-4 rounded-2xl items-center active:translate-y-1"
          style={{ shadowColor: "#16a34a", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6 }}
          onPress={() => router.replace("/(drawer)/dashboard")}
        >
          <Text className="text-white font-extrabold text-base uppercase tracking-widest">
            Continue
          </Text>
        </Pressable>

        <Pressable
          className="bg-slate-200 py-3.5 rounded-2xl items-center active:translate-y-1"
          style={{ shadowColor: "#cbd5e1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 }}
          onPress={() => router.replace("/")}
        >
          <Text className="text-slate-500 font-extrabold text-xs uppercase tracking-widest">
            Back to Home
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
