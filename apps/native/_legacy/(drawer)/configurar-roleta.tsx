import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path, Rect } from "react-native-svg";

// ─── Icons ───────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke="#6B6B6B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckCircleFilled() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx={12} cy={12} r={12} fill="#58CD04" />
      <Path d="M7 12l3.5 3.5 6.5-6.5" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function EmptyCircle() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx={12} cy={12} r={11} stroke="#EFECEC" strokeWidth={2} />
    </Svg>
  );
}

function CheckBadge() {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <SvgCircle cx={11} cy={11} r={9} fill="rgba(255,255,255,0.3)" />
      <Path d="M7 11l2.5 2.5 5.5-5.5" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Subject icons
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
    <View style={[styles.subjectIcon, { backgroundColor: "#1CB0F6" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path d="M9 3h6M10 3v6.5L5 18a1 1 0 001 1h12a1 1 0 001-1l-5-8.5V3" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
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

// ─── Data ────────────────────────────────────────────────────────────────────

type Subject = {
  id: string;
  name: string;
  icon: React.ReactNode;
};

const SUBJECTS: Subject[] = [
  { id: "bio", name: "Biologia", icon: <BiologiaIcon /> },
  { id: "fis", name: "Física", icon: <FisicaIcon /> },
  { id: "qui", name: "Química", icon: <QuimicaIcon /> },
  { id: "mat", name: "Matemática", icon: <MatematicaIcon /> },
  { id: "por", name: "Português", icon: <PortuguesIcon /> },
  { id: "his", name: "História", icon: <HistoriaIcon /> },
];

const MIN_SELECTION = 4;

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ConfigurarRoletaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(["bio", "fis", "qui", "mat"]));

  const toggleSubject = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const canConfirm = selected.size >= MIN_SELECTION;

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <View style={styles.topBarContent}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <BackIcon />
          </Pressable>
          <View style={styles.topBarTitles}>
            <Text style={styles.topBarLabel}>Personalização</Text>
            <Text style={styles.topBarTitle}>Roleta do Saber</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>
            Quais matérias quer{"\n"}
            <Text style={styles.titleGreen}>desafiar</Text>?
          </Text>
          <Text style={styles.subtitle}>Selecione pelo menos {MIN_SELECTION} para girar</Text>
        </View>

        {/* Subject list */}
        <View style={styles.subjectList}>
          {SUBJECTS.map((subject) => {
            const isSelected = selected.has(subject.id);
            return (
              <Pressable
                key={subject.id}
                style={[styles.subjectCard, isSelected && styles.subjectCardSelected]}
                onPress={() => toggleSubject(subject.id)}
              >
                {subject.icon}
                <Text style={styles.subjectName}>{subject.name}</Text>
                <View style={styles.checkArea}>
                  {isSelected ? <CheckCircleFilled /> : <EmptyCircle />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.confirmBtn,
            !canConfirm && styles.confirmBtnDisabled,
            pressed && canConfirm && { opacity: 0.9 },
          ]}
          disabled={!canConfirm}
          onPress={() => router.back()}
        >
          <Text style={styles.confirmBtnText}>Confirmar Seleção</Text>
          <CheckBadge />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFBFC" },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  // Top bar
  topBar: { backgroundColor: "rgba(255, 255, 255, 0.5)" },
  topBarContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 12,
    gap: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitles: { flex: 1, alignItems: "flex-end" },
  topBarLabel: {
    fontWeight: "900",
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "#58CD04",
  },
  topBarTitle: {
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.8,
    color: "#2B2B2B",
  },

  // Title
  titleSection: { paddingHorizontal: 32, paddingTop: 24, gap: 8, marginBottom: 24 },
  title: {
    fontWeight: "900",
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -1.4,
    color: "#2B2B2B",
  },
  titleGreen: { color: "#58CD04" },
  subtitle: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    color: "#6B6B6B",
  },

  // Subject list
  subjectList: { paddingHorizontal: 32, gap: 10 },
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
  },
  subjectIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  subjectName: {
    flex: 1,
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.4,
    color: "#2B2B2B",
  },
  checkArea: { marginLeft: "auto" },

  // Bottom
  bottomSection: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 32,
    paddingTop: 20,
  },
  confirmBtn: {
    height: 64,
    backgroundColor: "#58CD04",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "rgba(185, 248, 207, 1)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 8,
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtnText: {
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 27,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
});
