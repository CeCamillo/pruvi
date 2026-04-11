import { Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/common/Screen";

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen scrollable={false}>
      <Text className="text-foreground text-xl font-semibold text-center mt-20">
        Session {id}
      </Text>
      <Text className="text-default-500 text-center mt-2">
        Active Q&A loop — wired in Phase 3
      </Text>
    </Screen>
  );
}
