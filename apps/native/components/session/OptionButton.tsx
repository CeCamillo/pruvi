import { memo, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { colors, radii } from "@/lib/design-tokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type OptionButtonState = "idle" | "selected" | "correct" | "wrong";

interface Props {
  letter: string;
  text: string;
  state: OptionButtonState;
  onPress: () => void;
  disabled: boolean;
}

function OptionButtonImpl({ letter, text, state, onPress, disabled }: Props) {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (state === "correct") {
      scale.value = withSequence(
        withSpring(1.05, { damping: 6, stiffness: 180 }),
        withSpring(1, { damping: 10, stiffness: 180 }),
      );
    }
    if (state === "wrong") {
      translateX.value = withSequence(
        withTiming(-8, { duration: 60, easing: Easing.linear }),
        withTiming(8, { duration: 60, easing: Easing.linear }),
        withTiming(-8, { duration: 60, easing: Easing.linear }),
        withTiming(0, { duration: 60, easing: Easing.linear }),
      );
    }
  }, [state, scale, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: translateX.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.97, { damping: 12, stiffness: 300 });
    }
  };
  const handlePressOut = () => {
    if (!disabled) {
      scale.value = withSpring(1, { damping: 12, stiffness: 300 });
    }
  };

  const containerStyles = getContainerStyles(state);
  const letterStyles = getLetterStyles(state);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 16,
          borderRadius: radii.md,
          borderWidth: 2,
          borderColor: containerStyles.borderColor,
          backgroundColor: containerStyles.bg,
        },
        animatedStyle,
      ]}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radii.sm,
          backgroundColor: letterStyles.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontWeight: "900", fontSize: 14, color: letterStyles.color }}>
          {letter}
        </Text>
      </View>
      <Text
        style={{
          flex: 1,
          fontWeight: state === "selected" ? "900" : "700",
          fontSize: 14,
          lineHeight: 20,
          color: colors.text,
        }}
      >
        {text}
      </Text>
    </AnimatedPressable>
  );
}

function getContainerStyles(state: OptionButtonState) {
  switch (state) {
    case "selected":
      return { bg: colors.selectedBg, borderColor: colors.selectedBorder };
    case "correct":
      return { bg: colors.primaryLight, borderColor: colors.primary };
    case "wrong":
      return { bg: colors.dangerLight, borderColor: colors.danger };
    case "idle":
    default:
      return { bg: "#FFFFFF", borderColor: colors.border };
  }
}

function getLetterStyles(state: OptionButtonState) {
  switch (state) {
    case "selected":
      return { bg: colors.selectedBorder, color: "#FFFFFF" };
    case "correct":
      return { bg: colors.primary, color: "#FFFFFF" };
    case "wrong":
      return { bg: colors.danger, color: "#FFFFFF" };
    case "idle":
    default:
      return { bg: colors.surface, color: colors.textMuted };
  }
}

export const OptionButton = memo(OptionButtonImpl);
