import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

// ─── Icons ──────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d="M12 4L4 12M4 4l8 8" stroke="#6B6B6B" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function CheckIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M3 8.5l3.5 3.5L13 5"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Data ───────────────────────────────────────────────────────────────────

type Assunto = {
  id: string;
  number: number;
  name: string;
  description: string;
};

const ASSUNTOS: Assunto[] = [
  { id: "citologia", number: 1, name: "Citologia", description: "Celula e organelas" },
  { id: "genetica", number: 2, name: "Genetica", description: "Heranca e DNA" },
  { id: "ecologia", number: 3, name: "Ecologia", description: "Ecossistemas e relacoes" },
  { id: "evolucao", number: 4, name: "Evolucao", description: "" },
];

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function FiltroAssuntosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selected, setSelected] = useState("citologia");

  return (
    <View style={styles.container}>
      {/* Dark overlay */}
      <Pressable style={styles.overlay} onPress={() => router.back()} />

      {/* Bottom sheet */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        {/* Handle */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>Biologia</Text>
            <Text style={styles.sheetSubtitle}>Selecione um assunto para navegar</Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={() => router.back()}>
            <CloseIcon />
          </Pressable>
        </View>

        {/* Assunto list */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.assuntoList}>
          {ASSUNTOS.map((assunto) => {
            const isSelected = selected === assunto.id;
            return (
              <Pressable
                key={assunto.id}
                style={[styles.assuntoCard, isSelected && styles.assuntoCardSelected]}
                onPress={() => setSelected(assunto.id)}
              >
                {/* Number circle */}
                <View style={[styles.numberCircle, isSelected && styles.numberCircleSelected]}>
                  {isSelected ? (
                    <CheckIcon />
                  ) : (
                    <Text style={styles.numberText}>{assunto.number}</Text>
                  )}
                </View>

                {/* Text */}
                <View style={styles.assuntoInfo}>
                  <Text style={[styles.assuntoName, isSelected && styles.assuntoNameSelected]}>
                    {assunto.name}
                  </Text>
                  {assunto.description ? (
                    <Text style={[styles.assuntoDesc, isSelected && styles.assuntoDescSelected]}>
                      {assunto.description}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  sheet: {
    backgroundColor: "#F7F9FC",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: 8,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 0.15,
    shadowRadius: 50,
    elevation: 20,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  handle: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(240, 240, 240, 0.5)",
  },

  // ─── Header ───────────────────────────────────────────────────────────────
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  sheetTitle: {
    fontWeight: "900",
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -1.1,
    color: "#2B2B2B",
  },
  sheetSubtitle: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    color: "#6B6B6B",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  // ─── Assunto List ─────────────────────────────────────────────────────────
  assuntoList: {
    paddingHorizontal: 24,
    gap: 10,
    paddingBottom: 16,
  },
  assuntoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "transparent",
    padding: 16,
    gap: 14,
  },
  assuntoCardSelected: {
    borderColor: "#58CD04",
    backgroundColor: "rgba(88, 205, 4, 0.04)",
    shadowColor: "rgba(88, 205, 4, 0.1)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },

  // ─── Number Circle ────────────────────────────────────────────────────────
  numberCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  numberCircleSelected: {
    backgroundColor: "#58CD04",
  },
  numberText: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    color: "#6B6B6B",
  },

  // ─── Assunto Info ─────────────────────────────────────────────────────────
  assuntoInfo: {
    flex: 1,
    gap: 2,
  },
  assuntoName: {
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.4,
    color: "#2B2B2B",
  },
  assuntoNameSelected: {
    color: "#2B2B2B",
  },
  assuntoDesc: {
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
    color: "#6B6B6B",
  },
  assuntoDescSelected: {
    color: "#58CD04",
  },
});
