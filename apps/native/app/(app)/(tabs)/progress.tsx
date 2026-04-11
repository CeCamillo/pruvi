import { Text } from "react-native";
import { Screen } from "@/components/common/Screen";

export default function ProgressScreen() {
  return (
    <Screen scrollable={false}>
      <Text className="text-foreground text-xl font-semibold text-center mt-20">
        Progress
      </Text>
      <Text className="text-default-500 text-center mt-2">
        Stats & subject history — wired in Phase 4
      </Text>
    </Screen>
  );
}
