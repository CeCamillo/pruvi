import { Link, Stack } from "expo-router";
import { Button } from "heroui-native";
import { Text, View } from "react-native";

import { Screen } from "@/components/common/Screen";
import { colors } from "@/lib/design-tokens";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Não encontrado" }} />
      <Screen scrollable={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>
            Página não encontrada
          </Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted }}>
            A tela que você procura não existe.
          </Text>
          <Link href="/(app)/(tabs)" asChild>
            <Button>
              <Button.Label>Voltar ao início</Button.Label>
            </Button>
          </Link>
        </View>
      </Screen>
    </>
  );
}
