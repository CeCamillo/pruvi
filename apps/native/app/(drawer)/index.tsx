import { Ionicons } from "@expo/vector-icons";
import { TodaySessionResponseSchema } from "@pruvi/shared/sessions";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { Container } from "@/components/container";
import { apiGet } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

function AuthForms() {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setStatus(null);
    setLoading(true);
    try {
      const result = await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setStatus({ type: "error", message: result.error.message ?? "Sign in failed" });
      } else {
        setStatus({ type: "success", message: "Signed in!" });
        setEmail("");
        setPassword("");
      }
    } catch (e) {
      setStatus({ type: "error", message: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    setStatus(null);
    setLoading(true);
    try {
      const result = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      if (result.error) {
        setStatus({ type: "error", message: result.error.message ?? "Sign up failed" });
      } else {
        setStatus({ type: "success", message: "Account created & signed in!" });
        setName("");
        setEmail("");
        setPassword("");
      }
    } catch (e) {
      setStatus({ type: "error", message: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="bg-white rounded-2xl border-2 border-slate-200 p-5" style={{ shadowColor: "#cbd5e1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 }}>
      {/* Tab Switcher */}
      <View className="flex-row mb-5 rounded-xl overflow-hidden border-2 border-slate-200">
        <Pressable
          className={`flex-1 py-3 items-center ${tab === "signin" ? "bg-sky-500" : "bg-white"}`}
          onPress={() => { setTab("signin"); setStatus(null); }}
        >
          <Text className={`font-extrabold text-xs uppercase tracking-widest ${tab === "signin" ? "text-white" : "text-slate-400"}`}>
            Sign In
          </Text>
        </Pressable>
        <Pressable
          className={`flex-1 py-3 items-center ${tab === "signup" ? "bg-sky-500" : "bg-white"}`}
          onPress={() => { setTab("signup"); setStatus(null); }}
        >
          <Text className={`font-extrabold text-xs uppercase tracking-widest ${tab === "signup" ? "text-white" : "text-slate-400"}`}>
            Sign Up
          </Text>
        </Pressable>
      </View>

      {/* Status */}
      {status && (
        <View
          className="rounded-2xl p-3 mb-4 border-2"
          style={{
            backgroundColor: status.type === "success" ? "#dcfce7" : "#fee2e2",
            borderColor: status.type === "success" ? "#86efac" : "#fca5a5",
          }}
        >
          <Text className="text-sm font-bold" style={{ color: status.type === "success" ? "#16a34a" : "#dc2626" }}>
            {status.message}
          </Text>
        </View>
      )}

      {/* Fields */}
      <View className="gap-3">
        {tab === "signup" && (
          <TextInput
            className="border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-700 text-base font-bold bg-slate-50"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCapitalize="words"
            placeholderTextColor="#94a3b8"
          />
        )}
        <TextInput
          className="border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-700 text-base font-bold bg-slate-50"
          value={email}
          onChangeText={setEmail}
          placeholder="email@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#94a3b8"
        />
        <TextInput
          className="border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-700 text-base font-bold bg-slate-50"
          value={password}
          onChangeText={setPassword}
          placeholder="Password (8+ chars)"
          secureTextEntry
          placeholderTextColor="#94a3b8"
        />

        <Pressable
          className="bg-green-500 py-4 rounded-2xl items-center mt-1 active:translate-y-1"
          style={{ shadowColor: "#16a34a", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 }}
          onPress={tab === "signin" ? handleSignIn : handleSignUp}
          disabled={loading}
        >
          <Text className="text-white font-extrabold text-sm uppercase tracking-widest">
            {loading ? "Loading..." : tab === "signin" ? "Sign In" : "Create Account"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function Home() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  const [todaySession, setTodaySession] = useState<string | null>(null);
  const [todayLoading, setTodayLoading] = useState(false);

  async function checkTodaySession() {
    try {
      setTodayLoading(true);
      const data = await apiGet("/sessions/today", TodaySessionResponseSchema);
      if (data.session) {
        setTodaySession(
          `${data.session.status === "completed" ? "Completed" : "Active"} — ${data.session.correctCount}/${data.session.questionCount}`
        );
      } else {
        setTodaySession("No session today");
      }
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setTodayLoading(false);
    }
  }

  return (
    <Container className="p-5 bg-white">
      {/* Auth status */}
      <View
        className="rounded-2xl p-3 mb-6 flex-row items-center border-2"
        style={{
          backgroundColor: isPending ? "#fef3c7" : session?.user ? "#dcfce7" : "#fee2e2",
          borderColor: isPending ? "#fcd34d" : session?.user ? "#86efac" : "#fca5a5",
        }}
      >
        <Ionicons
          name={isPending ? "hourglass-outline" : session?.user ? "checkmark-circle" : "close-circle"}
          size={20}
          color={isPending ? "#d97706" : session?.user ? "#16a34a" : "#dc2626"}
        />
        <Text
          className="ml-2 font-bold text-sm flex-1"
          style={{ color: isPending ? "#d97706" : session?.user ? "#16a34a" : "#dc2626" }}
        >
          {isPending ? "Checking..." : session?.user ? `Signed in as ${session.user.email}` : "Not signed in"}
        </Text>
      </View>

      {session?.user ? (
        <>
          {/* Hero card */}
          <View
            className="bg-indigo-600 rounded-3xl p-6 mb-6 overflow-hidden"
            style={{ shadowColor: "#4338ca", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6 }}
          >
            <Text className="text-white text-2xl font-extrabold mb-2">
              Welcome back, {session.user.name}! 🚀
            </Text>
            <Text className="text-indigo-200 text-sm font-bold mb-5">
              Ready to study for the vestibular?
            </Text>
            <Pressable
              className="bg-green-500 py-4 rounded-2xl items-center active:translate-y-1"
              style={{ shadowColor: "#16a34a", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 }}
              onPress={() => router.push("/(quiz)/mode-select")}
            >
              <Text className="text-white font-extrabold text-sm uppercase tracking-widest">
                Start Session
              </Text>
            </Pressable>
          </View>

          {/* Today's session check */}
          <Pressable
            className="bg-white rounded-2xl border-2 border-slate-200 p-4 mb-4 flex-row items-center active:translate-y-0.5"
            style={{ shadowColor: "#cbd5e1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 }}
            onPress={checkTodaySession}
            disabled={todayLoading}
          >
            <Ionicons name="calendar-outline" size={22} color="#64748b" />
            <Text className="text-slate-700 font-bold text-base ml-3 flex-1">
              {todayLoading ? "Checking..." : "Today's Session"}
            </Text>
            {todaySession ? (
              <Text className="text-slate-400 font-bold text-sm">{todaySession}</Text>
            ) : (
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            )}
          </Pressable>

          {/* Sign out */}
          <Pressable
            className="bg-slate-200 py-3 rounded-2xl items-center mt-2 active:translate-y-1"
            style={{ shadowColor: "#cbd5e1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 }}
            onPress={() => authClient.signOut()}
          >
            <Text className="text-slate-500 font-extrabold text-xs uppercase tracking-widest">
              Sign Out
            </Text>
          </Pressable>
        </>
      ) : !isPending ? (
        <AuthForms />
      ) : null}
    </Container>
  );
}
