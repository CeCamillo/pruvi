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

function SearchIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M9.167 15.833a6.667 6.667 0 100-13.333 6.667 6.667 0 000 13.333zM17.5 17.5l-3.625-3.625" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckCircleIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx={12} cy={12} r={12} fill="#58CD04" />
      <Path d="M7 12l3.5 3.5 6.5-6.5" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function EmptyCircleIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx={12} cy={12} r={11} stroke="#EFECEC" strokeWidth={2} />
    </Svg>
  );
}

function PlayArrowIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l8 6-8 6V6z" fill="white" />
    </Svg>
  );
}

// Exam-specific icons
function EnemIcon() {
  return (
    <View style={[styles.examIconBox, { backgroundColor: "rgba(88, 205, 4, 0.1)" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path d="M12 2L4 6.5V11c0 5.25 3.4 10.15 8 11.5 4.6-1.35 8-6.25 8-11.5V6.5L12 2z" fill="#58CD04" fillOpacity={0.5} />
        <Path d="M9 12l2 2 4-4" stroke="#58CD04" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function BahianaIcon() {
  return (
    <View style={[styles.examIconBox, { backgroundColor: "#F0F0F0" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Rect x={7} y={4} width={10} height={16} rx={2} fill="#6B6B6B" />
        <Path d="M9 8h6M9 11h6M9 14h3" stroke="white" strokeWidth={1.2} strokeLinecap="round" />
        <Path d="M11 4h2v2h-2z" fill="#6B6B6B" />
        <Rect x={10} y={2} width={4} height={3} rx={1} stroke="#6B6B6B" strokeWidth={1.2} />
      </Svg>
    </View>
  );
}

function FuvestIcon() {
  return (
    <View style={[styles.examIconBox, { backgroundColor: "#F0F0F0" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path d="M3 21h18M5 21V7l7-4 7 4v14" stroke="#6B6B6B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M9 21v-4h6v4M9 10h.01M15 10h.01M9 14h.01M15 14h.01" stroke="#6B6B6B" strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

type TrailOption = {
  id: string;
  name: string;
  subtitle: string;
  icon: React.ReactNode;
  badge?: string;
};

const TRAIL_OPTIONS: TrailOption[] = [
  { id: "enem", name: "ENEM", subtitle: "Exame Nacional • 45.2k Alunos", icon: <EnemIcon />, badge: "Ativo" },
  { id: "bahiana", name: "BAHIANA DE Medicina", subtitle: "Foco Bio e Química • 12.8k Alunos", icon: <BahianaIcon /> },
  { id: "fuvest", name: "FUVEST", subtitle: "Estadual SP • 8.4k Alunos", icon: <FuvestIcon /> },
  { id: "unicamp", name: "UNICAMP", subtitle: "Estadual SP • 6.2k Alunos", icon: <FuvestIcon /> },
];

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SelecaoTrilhaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selected, setSelected] = useState<string>("enem");

  return (
    <View style={styles.container}>
      {/* Top bar - frosted */}
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <View style={styles.topBarContent}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <BackIcon />
          </Pressable>
          <View style={styles.topBarTitles}>
            <Text style={styles.topBarLabel}>Configurações</Text>
            <Text style={styles.topBarTitle}>Trilha Ativa</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>
            Qual seu foco de{"\n"}
            <Text style={styles.titleGreen}>estudo</Text> agora?
          </Text>
          <Text style={styles.subtitle}>
            Sua trilha personaliza todos os exercícios e aulas para o que você realmente precisa conquistar.
          </Text>
        </View>

        {/* Search */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <SearchIcon />
            <Text style={styles.searchPlaceholder}>Pesquise por prova ou curso...</Text>
          </View>
        </View>

        {/* Trail options */}
        <View style={styles.optionsSection}>
          {TRAIL_OPTIONS.map((trail) => {
            const isSelected = selected === trail.id;
            return (
              <Pressable
                key={trail.id}
                style={[styles.trailCard, isSelected && styles.trailCardSelected]}
                onPress={() => setSelected(trail.id)}
              >
                {trail.icon}
                <View style={styles.trailCardInfo}>
                  <View style={styles.trailCardNameRow}>
                    <Text style={styles.trailCardName}>{trail.name}</Text>
                    {trail.badge && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>{trail.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.trailCardSubtitle}>{trail.subtitle}</Text>
                </View>
                {isSelected ? <CheckCircleIcon /> : <EmptyCircleIcon />}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom sticky section */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.bottomHint}>
          <View style={styles.hintDot} />
          <Text style={styles.hintText}>Escolha seu foco para adaptar seu curso.</Text>
        </View>
        <Pressable style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }]}>
          <Text style={styles.saveBtnText}>Salvar Trilha</Text>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <SvgCircle cx={12} cy={12} r={10} fill="rgba(255,255,255,0.3)" />
            <Path d="M7 12l3.5 3.5 6.5-6.5" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
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

  // ─── Top Bar ──────────────────────────────────────────────────────────────
  topBar: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  topBarTitles: {
    flex: 1,
    alignItems: "flex-end",
  },
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

  // ─── Title Section ────────────────────────────────────────────────────────
  titleSection: {
    paddingHorizontal: 32,
    paddingTop: 24,
    gap: 12,
  },
  title: {
    fontWeight: "900",
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -1.4,
    color: "#2B2B2B",
  },
  titleGreen: {
    color: "#58CD04",
  },
  subtitle: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    color: "#6B6B6B",
  },

  // ─── Search ───────────────────────────────────────────────────────────────
  searchSection: {
    paddingHorizontal: 32,
    marginTop: 20,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.4)",
    paddingHorizontal: 20,
    height: 64,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  searchPlaceholder: {
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(107, 107, 107, 0.5)",
    fontStyle: "italic",
  },

  // ─── Options ──────────────────────────────────────────────────────────────
  optionsSection: {
    paddingHorizontal: 32,
    marginTop: 24,
    gap: 12,
  },
  trailCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 20,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  trailCardSelected: {
    borderWidth: 2,
    borderColor: "#58CD04",
    padding: 18,
    shadowColor: "rgba(88, 205, 4, 0.1)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  examIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  trailCardInfo: { flex: 1, gap: 2 },
  trailCardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trailCardName: {
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.8,
    color: "#2B2B2B",
  },
  activeBadge: {
    backgroundColor: "rgba(88, 205, 4, 0.15)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activeBadgeText: {
    fontWeight: "900",
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: "#58CD04",
  },
  trailCardSubtitle: {
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
    color: "#6B6B6B",
  },

  // ─── Bottom Section ───────────────────────────────────────────────────────
  bottomSection: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "rgba(239, 236, 236, 0.4)",
    paddingHorizontal: 32,
    paddingTop: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.03,
    shadowRadius: 40,
    elevation: 5,
  },
  bottomHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  hintDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#58CD04",
  },
  hintText: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    color: "#6B6B6B",
  },
  saveBtn: {
    backgroundColor: "#58CD04",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 64,
    shadowColor: "rgba(88, 205, 4, 0.2)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 25,
    elevation: 8,
  },
  saveBtnText: {
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 25,
    letterSpacing: -0.9,
    color: "#FFFFFF",
    fontStyle: "italic",
  },
});
