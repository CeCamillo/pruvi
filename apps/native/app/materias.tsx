import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path, Rect } from "react-native-svg";

// ─── Subject Icons ───────────────────────────────────────────────────────────

function BiologiaIcon() {
  return (
    <View style={[styles.subjectIcon, { backgroundColor: "#58CD04" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path d="M7 20s1.5-2 5-2 5 2 5 2M12 4c3 0 6 2 7 5s-1 7-4 8-8 0-9-4S9 4 12 4z" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function FisicaIcon() {
  return (
    <View style={[styles.subjectIcon, { backgroundColor: "#3B82F6" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path d="M5 12c0-4 3-7 7-7s7 3 7 7" stroke="white" strokeWidth={2} strokeLinecap="round" />
        <Path d="M12 5v7l4 2" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function QuimicaIcon() {
  return (
    <View style={[styles.subjectIcon, { backgroundColor: "#EF4444" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path d="M9 3h6M10 3v6.5L5 18a1 1 0 001 1h12a1 1 0 001-1l-5-8.5V3" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M7 15h10" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function MatematicaIcon() {
  return (
    <View style={[styles.subjectIcon, { backgroundColor: "#F59E0B" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Rect x={4} y={4} width={16} height={16} rx={3} stroke="white" strokeWidth={1.5} />
        <Path d="M8 12h8M12 8v8" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function PortuguesIcon() {
  return (
    <View style={[styles.subjectIcon, { backgroundColor: "#EC4899" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path d="M4 4h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" stroke="white" strokeWidth={1.5} />
        <Path d="M8 8h8M8 12h5" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
        <Path d="M12 18v3" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function HistoriaIcon() {
  return (
    <View style={[styles.subjectIcon, { backgroundColor: "#10B981" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <SvgCircle cx={12} cy={12} r={8} stroke="white" strokeWidth={1.5} />
        <Path d="M12 8v4l2.5 2.5" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function CloseIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d="M12 4L4 12M4 4l8 8" stroke="#6B6B6B" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

type Subject = {
  id: string;
  name: string;
  unit: string;
  icon: React.ReactNode;
  active?: boolean;
};

const SUBJECTS: Subject[] = [
  { id: "bio", name: "Biologia", unit: "Unidade 01 • Citologia", icon: <BiologiaIcon />, active: true },
  { id: "fis", name: "Física", unit: "Unidade 03 • Cinemática", icon: <FisicaIcon /> },
  { id: "qui", name: "Química", unit: "Unidade 02 • Átomos", icon: <QuimicaIcon /> },
  { id: "mat", name: "Matemática", unit: "Unidade 05 • Funções", icon: <MatematicaIcon /> },
  { id: "por", name: "Português", unit: "Unidade 01 • Gramática", icon: <PortuguesIcon /> },
  { id: "his", name: "História", unit: "Unidade 04 • Brasil Império", icon: <HistoriaIcon /> },
];

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function MateriasScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selected, setSelected] = useState("bio");

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
            <Text style={styles.sheetTitle}>Minhas Matérias</Text>
            <Text style={styles.sheetSubtitle}>Selecione para mudar sua trilha</Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={() => router.back()}>
            <CloseIcon />
          </Pressable>
        </View>

        {/* Subject list */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.subjectList}>
          {SUBJECTS.map((subject) => {
            const isSelected = selected === subject.id;
            return (
              <Pressable
                key={subject.id}
                style={[styles.subjectCard, isSelected && styles.subjectCardSelected]}
                onPress={() => setSelected(subject.id)}
              >
                {subject.icon}
                <View style={styles.subjectInfo}>
                  <Text style={styles.subjectName}>{subject.name}</Text>
                  <Text style={[styles.subjectUnit, isSelected && styles.subjectUnitSelected]}>
                    {subject.unit}
                  </Text>
                </View>
                {isSelected && (
                  <View style={styles.estudandoBadge}>
                    <Text style={styles.estudandoText}>Estudando</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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

  // ─── Subject List ─────────────────────────────────────────────────────────
  subjectList: {
    paddingHorizontal: 24,
    gap: 10,
    paddingBottom: 16,
  },
  subjectCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "transparent",
    padding: 16,
    gap: 14,
  },
  subjectCardSelected: {
    borderColor: "#58CD04",
    backgroundColor: "rgba(88, 205, 4, 0.04)",
    shadowColor: "rgba(88, 205, 4, 0.1)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
  subjectIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  subjectInfo: { flex: 1, gap: 2 },
  subjectName: {
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.4,
    color: "#2B2B2B",
  },
  subjectUnit: {
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
    color: "#6B6B6B",
  },
  subjectUnitSelected: {
    color: "#58CD04",
  },
  estudandoBadge: {
    backgroundColor: "#58CD04",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  estudandoText: {
    fontWeight: "900",
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
});
