import { Text } from "react-native";
import { Screen } from "@/components/common/Screen";

export default function HomeScreen() {
  return (
    <Screen scrollable={false}>
      <Text className="text-foreground text-xl font-semibold text-center mt-20">
        Home
      </Text>
      <Text className="text-default-500 text-center mt-2">
        Session entry point — wired in Phase 3
      </Text>
    </Screen>
  );
}
