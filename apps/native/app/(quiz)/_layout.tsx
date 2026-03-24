import { Stack } from "expo-router";
import { useThemeColor } from "heroui-native";

export default function QuizLayout() {
  const foreground = useThemeColor("foreground");
  const background = useThemeColor("background");

  return (
    <Stack
      screenOptions={{
        headerTintColor: foreground,
        headerStyle: { backgroundColor: background },
        headerTitleStyle: { fontWeight: "600", color: foreground },
      }}
    >
      <Stack.Screen name="mode-select" options={{ title: "Select Mode" }} />
      <Stack.Screen
        name="quiz"
        options={{ title: "Quiz", headerBackVisible: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="results"
        options={{ title: "Results", headerBackVisible: false, gestureEnabled: false }}
      />
    </Stack>
  );
}
