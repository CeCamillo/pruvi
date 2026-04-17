import { Button } from "heroui-native";
import { Text, View } from "react-native";

import { colors } from "@/lib/design-tokens";

interface Props {
  text?: string;
  onRetry?: () => void;
}

export function ErrorState({
  text = "Não foi possível carregar. Tente novamente.",
  onRetry,
}: Props) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
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
      {onRetry && (
        <Button onPress={onRetry} size="sm" variant="secondary">
          <Button.Label>Tentar de novo</Button.Label>
        </Button>
      )}
    </View>
  );
}
