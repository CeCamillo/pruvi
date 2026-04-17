import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import { Text, View } from "react-native";

import { colors } from "@/lib/design-tokens";

interface Props {
  text?: string;
}

export function NotFoundState({ text = "Matéria não encontrada" }: Props) {
  const router = useRouter();
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
          fontSize: 16,
          fontWeight: "900",
          color: colors.text,
          textAlign: "center",
        }}
      >
        {text}
      </Text>
      <Button onPress={() => router.back()} size="sm" variant="secondary">
        <Button.Label>Voltar</Button.Label>
      </Button>
    </View>
  );
}
