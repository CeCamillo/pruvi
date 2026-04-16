import { useEffect, useState } from "react";
import { Text } from "react-native";
import {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/lib/design-tokens";

interface Props {
  earnedXP: number;
  durationMs?: number;
}

export function XPCounter({ earnedXP, durationMs = 1200 }: Props) {
  const value = useSharedValue(0);
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    value.value = withTiming(earnedXP, {
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [earnedXP, durationMs, value]);

  useAnimatedReaction(
    () => value.value,
    (current) => {
      runOnJS(setDisplayed)(Math.round(current));
    },
  );

  return (
    <Text style={{ fontSize: 48, fontWeight: "900", color: colors.primary }}>
      +{displayed} XP
    </Text>
  );
}
