import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";

import { colors, radii } from "@/lib/design-tokens";

interface Props {
  count: number;
  animate?: boolean;
}

export function StreakBadge({ count, animate }: Props) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (animate) {
      scale.value = withSequence(
        withSpring(1.2, { damping: 8, stiffness: 180 }),
        withSpring(1, { damping: 10, stiffness: 180 }),
      );
    }
  }, [animate, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          backgroundColor: colors.accentLight,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: radii.sm,
        },
        animatedStyle,
      ]}
    >
      <Ionicons name="flame" size={20} color={colors.accent} />
      <Text style={{ fontWeight: "900", fontSize: 12, color: colors.accent }}>
        {count}
      </Text>
    </Animated.View>
  );
}
