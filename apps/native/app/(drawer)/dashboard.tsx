import { Ionicons } from "@expo/vector-icons";
import { LivesResponseSchema } from "@pruvi/shared/lives";
import { TodaySessionResponseSchema } from "@pruvi/shared/sessions";
import { XpResponseSchema } from "@pruvi/shared/xp";
import { StreakResponseSchema } from "@pruvi/shared/auth";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { Container } from "@/components/container";
import { apiGet, apiPostRaw } from "@/lib/api-client";

interface Stats {
  lives: { lives: number; maxLives: number; resetsAt: Date | null };
  xp: { totalXp: number; currentLevel: number; xpForNextLevel: number };
  streaks: { currentStreak: number; longestStreak: number; totalSessions: number };
  todaySession: { session: { status: string; questionCount: number; correctCount: number } | null };
}

export default function Dashboard() {
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [lives, xp, streaks, todaySession] = await Promise.all([
        apiGet("/users/me/lives", LivesResponseSchema),
        apiGet("/users/me/xp", XpResponseSchema),
        apiGet("/streaks", StreakResponseSchema),
        apiGet("/sessions/today", TodaySessionResponseSchema),
      ]);
      setStats({ lives, xp, streaks, todaySession });
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleReset(type: string) {
    setResetting(type);
    try {
      await apiPostRaw(`/dev/reset/${type}`);
      await fetchAll();
    } catch (e) {
      Alert.alert("Reset failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setResetting(null);
    }
  }

  if (loading && !stats) {
    return (
      <Container className="bg-white p-6">
        <Text className="text-slate-400 text-base text-center mt-10 font-bold">Loading dashboard...</Text>
      </Container>
    );
  }

  const livesCount = stats?.lives.lives ?? 0;
  const hearts = Array.from({ length: 5 }, (_, i) => i < livesCount);

  return (
    <Container className="p-5 bg-white">
      {/* Lives */}
      <View
        className="bg-white rounded-2xl border-2 border-slate-200 p-4 mb-3"
        style={{ shadowColor: "#cbd5e1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-slate-700 font-extrabold text-base uppercase tracking-wide">Lives</Text>
          <Pressable
            className="bg-slate-200 px-3 py-1.5 rounded-xl active:translate-y-0.5"
            onPress={() => handleReset("lives")}
            disabled={resetting !== null}
          >
            <Text className="text-slate-500 text-xs font-extrabold uppercase tracking-wider">
              {resetting === "lives" ? "..." : "Reset"}
            </Text>
          </Pressable>
        </View>
        <View className="flex-row items-center gap-2">
          {hearts.map((filled, i) => (
            <Ionicons key={i} name={filled ? "heart" : "heart-outline"} size={30} color="#ef4444" />
          ))}
          <Text className="text-slate-400 font-extrabold text-lg ml-auto">{livesCount}/5</Text>
        </View>
        {stats?.lives.resetsAt && (
          <Text className="text-slate-300 text-xs font-bold mt-2">
            Auto-refill: {new Date(stats.lives.resetsAt).toLocaleTimeString()}
          </Text>
        )}
      </View>

      {/* XP & Level */}
      <View
        className="bg-white rounded-2xl border-2 border-slate-200 p-4 mb-3"
        style={{ shadowColor: "#cbd5e1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-slate-700 font-extrabold text-base uppercase tracking-wide">XP & Level</Text>
          <Pressable
            className="bg-slate-200 px-3 py-1.5 rounded-xl active:translate-y-0.5"
            onPress={() => handleReset("xp")}
            disabled={resetting !== null}
          >
            <Text className="text-slate-500 text-xs font-extrabold uppercase tracking-wider">
              {resetting === "xp" ? "..." : "Reset"}
            </Text>
          </Pressable>
        </View>
        <View className="flex-row items-baseline gap-3 mb-3">
          <Text className="text-slate-700 text-4xl font-extrabold">Lv {stats?.xp.currentLevel ?? 1}</Text>
          <View className="flex-row items-center">
            <Ionicons name="flash" size={18} color="#eab308" />
            <Text className="text-yellow-500 font-extrabold ml-1">{stats?.xp.totalXp ?? 0} XP</Text>
          </View>
        </View>
        <View className="h-4 bg-slate-100 rounded-full overflow-hidden">
          <View
            className="h-full bg-yellow-400 rounded-full"
            style={{
              width: stats?.xp.xpForNextLevel === 0
                ? "100%"
                : `${Math.max(5, 100 - ((stats?.xp.xpForNextLevel ?? 100) / ((stats?.xp.totalXp ?? 0) + (stats?.xp.xpForNextLevel ?? 100))) * 100)}%`,
            }}
          />
        </View>
        <Text className="text-slate-300 text-xs font-bold mt-1.5">
          {stats?.xp.xpForNextLevel ?? 0} XP to next level
        </Text>
      </View>

      {/* Streaks */}
      <View
        className="bg-white rounded-2xl border-2 border-slate-200 p-4 mb-3"
        style={{ shadowColor: "#cbd5e1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 }}
      >
        <Text className="text-slate-700 font-extrabold text-base uppercase tracking-wide mb-3">Streaks</Text>
        <View className="flex-row">
          <View className="flex-1 items-center">
            <Ionicons name="flame" size={26} color="#f97316" />
            <Text className="text-slate-700 text-2xl font-extrabold mt-1">
              {stats?.streaks.currentStreak ?? 0}
            </Text>
            <Text className="text-slate-300 text-xs font-bold uppercase">Current</Text>
          </View>
          <View className="w-0.5 bg-slate-100" />
          <View className="flex-1 items-center">
            <Ionicons name="trophy" size={26} color="#eab308" />
            <Text className="text-slate-700 text-2xl font-extrabold mt-1">
              {stats?.streaks.longestStreak ?? 0}
            </Text>
            <Text className="text-slate-300 text-xs font-bold uppercase">Best</Text>
          </View>
          <View className="w-0.5 bg-slate-100" />
          <View className="flex-1 items-center">
            <Ionicons name="checkmark-done" size={26} color="#22c55e" />
            <Text className="text-slate-700 text-2xl font-extrabold mt-1">
              {stats?.streaks.totalSessions ?? 0}
            </Text>
            <Text className="text-slate-300 text-xs font-bold uppercase">Sessions</Text>
          </View>
        </View>
      </View>

      {/* Today's Session */}
      <View
        className="bg-white rounded-2xl border-2 border-slate-200 p-4 mb-4"
        style={{ shadowColor: "#cbd5e1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 }}
      >
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-slate-700 font-extrabold text-base uppercase tracking-wide">Today</Text>
          <Pressable
            className="bg-slate-200 px-3 py-1.5 rounded-xl active:translate-y-0.5"
            onPress={() => handleReset("sessions")}
            disabled={resetting !== null}
          >
            <Text className="text-slate-500 text-xs font-extrabold uppercase tracking-wider">
              {resetting === "sessions" ? "..." : "Reset"}
            </Text>
          </Pressable>
        </View>
        {stats?.todaySession.session ? (
          <View className="flex-row items-center">
            <View
              className="w-3 h-3 rounded-full mr-2"
              style={{
                backgroundColor: stats.todaySession.session.status === "completed" ? "#22c55e" : "#eab308",
              }}
            />
            <Text className="text-slate-700 font-bold">
              {stats.todaySession.session.status === "completed" ? "Completed" : "In progress"}
            </Text>
            <Text className="text-slate-400 font-extrabold ml-auto">
              {stats.todaySession.session.correctCount}/{stats.todaySession.session.questionCount}
            </Text>
          </View>
        ) : (
          <Text className="text-slate-300 font-bold">No session yet</Text>
        )}
      </View>

      {/* Actions */}
      <View className="gap-3 mt-2">
        <Pressable
          className="bg-green-500 py-4 rounded-2xl flex-row items-center justify-center active:translate-y-1"
          style={{ shadowColor: "#16a34a", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6 }}
          onPress={() => router.push("/(quiz)/mode-select")}
        >
          <Text className="text-white font-extrabold text-sm uppercase tracking-widest">
            Start New Session
          </Text>
        </Pressable>

        <Pressable
          className="border-2 border-rose-300 py-3 rounded-2xl items-center active:translate-y-0.5"
          onPress={() =>
            Alert.alert("Reset Everything?", "Resets lives, XP, sessions, and review history.", [
              { text: "Cancel", style: "cancel" },
              { text: "Reset All", style: "destructive", onPress: () => handleReset("all") },
            ])
          }
          disabled={resetting !== null}
        >
          <Text className="text-rose-500 font-extrabold text-xs uppercase tracking-widest">
            {resetting === "all" ? "Resetting..." : "Reset All Progress"}
          </Text>
        </Pressable>
      </View>
    </Container>
  );
}
