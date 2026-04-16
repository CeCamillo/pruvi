import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";

import { colors } from "@/lib/design-tokens";

export type AvatarExpression = "neutral" | "happy" | "sad";

interface Props {
  expression: AvatarExpression;
  size?: number;
}

export function CharacterAvatar({ expression, size = 80 }: Props) {
  const { iconName, color, opacity } = getAvatarAppearance(expression);
  const containerSize = size + 20;

  return (
    <View
      style={{
        width: containerSize,
        height: containerSize,
        borderRadius: containerSize / 2,
        backgroundColor: "#FFFFFF",
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        opacity,
      }}
    >
      <Ionicons name={iconName} size={size} color={color} />
    </View>
  );
}

function getAvatarAppearance(expression: AvatarExpression) {
  switch (expression) {
    case "happy":
      return { iconName: "happy" as const, color: colors.primary, opacity: 1 };
    case "sad":
      return { iconName: "sad-outline" as const, color: colors.textMuted, opacity: 1 };
    case "neutral":
    default:
      return { iconName: "happy" as const, color: colors.text, opacity: 0.7 };
  }
}
