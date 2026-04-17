import { Text, View } from "react-native";

import type { XpResponse } from "@pruvi/shared";

import { colors } from "@/lib/design-tokens";

interface Props {
  xp: XpResponse;
}

export function XpCard({ xp }: Props) {
  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        borderWidth: 2,
        borderColor: colors.border,
        padding: 20,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>
          Nível {xp.currentLevel}
        </Text>
        <Text style={{ fontSize: 14, fontWeight: "900", color: colors.primary }}>
          {xp.totalXp} XP
        </Text>
      </View>
      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted }}>
        Faltam {xp.xpForNextLevel} XP para o próximo nível
      </Text>
    </View>
  );
}
