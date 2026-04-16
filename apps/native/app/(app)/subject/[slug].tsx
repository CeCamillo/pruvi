import { Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/common/Screen";

export default function SubjectScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  return (
    <Screen scrollable={false}>
      <Text className="text-foreground text-xl font-semibold text-center mt-20">
        Subject: {slug}
      </Text>
      <Text className="text-default-500 text-center mt-2">
        Review history — wired in Phase 4
      </Text>
    </Screen>
  );
}
