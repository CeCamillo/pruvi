import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { useSessionStore } from "@/src/stores/session-store";

const STAGGER_MS = 120;
const DURATION_MS = 400;

function useFadeSlide(delayMs: number) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(24);

  useEffect(() => {
    opacity.value = withDelay(delayMs, withTiming(1, { duration: DURATION_MS }));
    translateY.value = withDelay(delayMs, withTiming(0, { duration: DURATION_MS }));
  }, [delayMs, opacity, translateY]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

export default function CompletionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useSessionStore();

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ["subjects"] });
  }, [queryClient]);

  const answered = session?.questionsAnswered ?? 0;
  const correct = session?.questionsCorrect ?? 0;
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;

  const titleStyle = useFadeSlide(0);
  const statsStyle = useFadeSlide(STAGGER_MS);
  const subtitleStyle = useFadeSlide(STAGGER_MS * 2);
  const buttonStyle = useFadeSlide(STAGGER_MS * 3);

  return (
    <View className="flex-1 bg-background items-center justify-center px-8">
      <Animated.Text
        style={titleStyle}
        className="text-5xl font-bold text-foreground mb-4 text-center"
      >
        🎉 Sessão completa!
      </Animated.Text>

      <Animated.View
        style={statsStyle}
        className="bg-content1 rounded-3xl p-8 w-full items-center mb-6"
      >
        <Text className="text-6xl font-bold text-primary">{accuracy}%</Text>
        <Text className="text-default-400 mt-2 text-base">de acerto</Text>
        <Text className="text-foreground mt-4">
          {correct} de {answered} questões corretas
        </Text>
      </Animated.View>

      <Animated.Text style={subtitleStyle} className="text-default-400 text-sm mb-8 text-center">
        Continue praticando para melhorar seu desempenho!
      </Animated.Text>

      <Animated.View style={buttonStyle} className="w-full">
        <Pressable
          onPress={() => {
            router.replace("/");
          }}
          className="bg-primary rounded-2xl py-4 items-center"
        >
          <Text className="text-white font-semibold text-lg">Voltar ao início</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
