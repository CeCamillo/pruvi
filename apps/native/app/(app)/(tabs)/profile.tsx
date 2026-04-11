import { Text } from "react-native";
import { Screen } from "@/components/common/Screen";

export default function ProfileScreen() {
  return (
    <Screen scrollable={false}>
      <Text className="text-foreground text-xl font-semibold text-center mt-20">
        Profile
      </Text>
      <Text className="text-default-500 text-center mt-2">
        User profile + settings — wired in Phase 4
      </Text>
    </Screen>
  );
}
