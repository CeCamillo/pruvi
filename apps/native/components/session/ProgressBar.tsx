import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

import { colors } from "@/lib/design-tokens";

interface Props {
  total: number;
  completed: number;
}

export function ProgressBar({ total, completed }: Props) {
  return (
    <View style={{ flex: 1, flexDirection: "row", gap: 6, alignItems: "center" }}>
      {Array.from({ length: total }, (_, i) => (
        <Segment key={i} isComplete={i < completed} />
      ))}
    </View>
  );
}

function Segment({ isComplete }: { isComplete: boolean }) {
  const progress = useSharedValue(isComplete ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isComplete ? 1 : 0, { duration: 300 });
  }, [isComplete, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: progress.value > 0.5 ? colors.primary : colors.surface,
  }));

  return (
    <Animated.View
      style={[
        { flex: 1, height: 6, borderRadius: 3 },
        animatedStyle,
      ]}
    />
  );
}
