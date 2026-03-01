import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { api } from "@/src/services/api";
import { useSessionStore } from "@/src/stores/session-store";

export default function SubjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const [starting, setStarting] = useState(false);

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: api.getSubjects,
    staleTime: Infinity,
  });

  const subject = subjects.find((s) => String(s.id) === id);

  async function handleStartSession() {
    setStarting(true);
    try {
      const result = await api.startSession(10);
      setSession(result.session, result.questions);
      router.push("/quiz");
    } finally {
      setStarting(false);
    }
  }

  return (
    <View className="flex-1 bg-background pt-12 px-6">
      <Pressable
        onPress={() => {
          router.back();
        }}
        className="mb-6"
      >
        <Text className="text-primary text-base">← Voltar</Text>
      </Pressable>

      <Text className="text-3xl font-bold text-foreground mb-2">{subject?.name ?? "Matéria"}</Text>
      <Text className="text-default-400 mb-10">
        {subject?.questionCount ?? 0} questões disponíveis
      </Text>

      <Pressable
        onPress={() => {
          void handleStartSession();
        }}
        disabled={starting}
        className="bg-primary rounded-2xl py-4 items-center"
      >
        {starting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-semibold text-lg">Começar sessão</Text>
        )}
      </Pressable>
    </View>
  );
}
