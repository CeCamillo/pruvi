import { Ionicons } from "@expo/vector-icons";
import { LivesResponseSchema } from "@pruvi/shared/lives";
import { StartSessionResponseSchema } from "@pruvi/shared/sessions";
import { XpResponseSchema } from "@pruvi/shared/xp";
import { StreakResponseSchema } from "@pruvi/shared/auth";
import type { QuestionMode } from "@pruvi/shared/questions";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { Container } from "@/components/container";
import { apiGet, apiPost } from "@/lib/api-client";
import { setQuestions } from "@/lib/quiz-store";

interface Stats {
  lives: number;
  totalXp: number;
  currentLevel: number;
  currentStreak: number;
}

export default function ModeSelect() {
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [lives, xp, streaks] = await Promise.all([
          apiGet("/users/me/lives", LivesResponseSchema),
          apiGet("/users/me/xp", XpResponseSchema),
          apiGet("/streaks", StreakResponseSchema),
        ]);
        setStats({
          lives: lives.lives,
          totalXp: xp.totalXp,
          currentLevel: xp.currentLevel,
          currentStreak: streaks.currentStreak,
        });
      } catch (e) {
        Alert.alert("Error", e instanceof Error ? e.message : "Unknown error");
      }
    }
    fetchStats();
  }, []);

  async function startSession(mode: QuestionMode) {
    setError(null);
    setStarting(true);
    try {
      const data = await apiPost("/sessions/start", { mode }, StartSessionResponseSchema);
      setQuestions(data.questions);
      router.push({
        pathname: "/(quiz)/quiz",
        params: { sessionId: String(data.session.id) },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setStarting(false);
    }
  }

  return (
    <Container className="p-5 bg-white">
      {/* Stats bar */}
      {stats && (
        <View
          className="flex-row justify-between bg-white rounded-2xl border-2 border-slate-200 px-4 py-3 mb-8"
          style={{ shadowColor: "#cbd5e1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 }}
        >
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="heart" size={20} color="#ef4444" />
            <Text className="text-red-500 font-extrabold">{stats.lives}</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="flash" size={20} color="#eab308" />
            <Text className="text-yellow-500 font-extrabold">{stats.totalXp}</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="trophy" size={20} color="#a855f7" />
            <Text className="text-purple-500 font-extrabold">Lv {stats.currentLevel}</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="flame" size={20} color="#f97316" />
            <Text className="text-orange-500 font-extrabold">{stats.currentStreak}</Text>
          </View>
        </View>
      )}

      <Text className="text-2xl font-extrabold text-slate-700 text-center mb-1 uppercase tracking-wide">
        Study Mode
      </Text>
      <Text className="text-slate-400 text-center text-sm font-bold mb-8">
        Choose how you want to practice
      </Text>

      {/* Error */}
      {error && (
        <View className="rounded-2xl bg-red-100 border-2 border-red-200 p-3 mb-4">
          <Text className="text-red-600 text-sm font-bold">{error}</Text>
        </View>
      )}

      {/* Mode: All */}
      <Pressable
        className="bg-white rounded-2xl border-2 border-slate-200 p-5 mb-4 active:translate-y-1"
        style={{ shadowColor: "#cbd5e1", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6 }}
        onPress={() => startSession("all")}
        disabled={starting}
      >
        <View className="flex-row items-center">
          <View className="w-14 h-14 rounded-2xl bg-blue-500 items-center justify-center mr-4">
            <Text className="text-2xl">📐</Text>
          </View>
          <View className="flex-1">
            <Text className="text-slate-700 font-extrabold text-lg uppercase tracking-wide">
              All Questions
            </Text>
            <Text className="text-slate-400 text-sm font-bold mt-0.5">
              All types including calculations
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#cbd5e1" />
        </View>
      </Pressable>

      {/* Mode: Theoretical */}
      <Pressable
        className="bg-white rounded-2xl border-2 border-slate-200 p-5 mb-8 active:translate-y-1"
        style={{ shadowColor: "#cbd5e1", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6 }}
        onPress={() => startSession("theoretical")}
        disabled={starting}
      >
        <View className="flex-row items-center">
          <View className="w-14 h-14 rounded-2xl bg-green-500 items-center justify-center mr-4">
            <Text className="text-2xl">📚</Text>
          </View>
          <View className="flex-1">
            <Text className="text-slate-700 font-extrabold text-lg uppercase tracking-wide">
              Theoretical
            </Text>
            <Text className="text-slate-400 text-sm font-bold mt-0.5">
              Concepts only, no calculations
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#cbd5e1" />
        </View>
      </Pressable>

      {starting && (
        <Text className="text-slate-400 text-center text-sm font-bold mb-4">Starting session...</Text>
      )}

      <Pressable
        className="bg-slate-200 py-3 rounded-2xl items-center active:translate-y-1"
        style={{ shadowColor: "#cbd5e1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 }}
        onPress={() => router.replace("/(drawer)/dashboard")}
      >
        <Text className="text-slate-500 font-extrabold text-xs uppercase tracking-widest">
          Go to Dashboard
        </Text>
      </Pressable>
    </Container>
  );
}
