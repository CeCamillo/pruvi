import { Text } from "react-native";
import { Screen } from "@/components/common/Screen";

export default function SessionResultScreen() {
  return (
    <Screen scrollable={false}>
      <Text className="text-foreground text-xl font-semibold text-center mt-20">
        Session Result
      </Text>
      <Text className="text-default-500 text-center mt-2">
        XP breakdown — wired in Phase 3
      </Text>
    </Screen>
  );
}
