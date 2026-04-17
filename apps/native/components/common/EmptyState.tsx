import { Text, View } from "react-native";

import { colors } from "@/lib/design-tokens";

interface Props {
  text: string;
}

export function EmptyState({ text }: Props) {
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 48,
        paddingHorizontal: 24,
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: "700",
          color: colors.textMuted,
          textAlign: "center",
        }}
      >
        {text}
      </Text>
    </View>
  );
}
