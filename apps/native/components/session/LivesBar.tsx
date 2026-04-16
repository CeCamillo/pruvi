import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/lib/design-tokens";

interface Props {
  livesRemaining: number;
  maxLives?: number;
}

export function LivesBar({ livesRemaining, maxLives = 5 }: Props) {
  const translateX = useSharedValue(0);
  const previousLives = useRef(livesRemaining);

  useEffect(() => {
    if (livesRemaining < previousLives.current) {
      translateX.value = withSequence(
        withTiming(-8, { duration: 60, easing: Easing.linear }),
        withTiming(8, { duration: 60, easing: Easing.linear }),
        withTiming(-8, { duration: 60, easing: Easing.linear }),
        withTiming(0, { duration: 60, easing: Easing.linear }),
      );
    }
    previousLives.current = livesRemaining;
  }, [livesRemaining, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View
      style={[
        { flexDirection: "row", gap: 4, alignItems: "center" },
        animatedStyle,
      ]}
    >
      {Array.from({ length: maxLives }, (_, i) => {
        const filled = i < livesRemaining;
        return (
          <Ionicons
            key={i}
            name={filled ? "heart" : "heart-outline"}
            size={20}
            color={filled ? colors.accent : colors.surface}
          />
        );
      })}
    </Animated.View>
  );
}
