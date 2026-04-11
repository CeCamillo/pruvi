import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path, Rect } from "react-native-svg";

// ─── Icons ───────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke="#2B2B2B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function FlameIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Path d="M14 3c-.3 1.22-.98 3.37-2.33 4.84C10 9.64 8.17 10.52 8.17 13.69c0 3.85 2.62 6.72 5.83 6.72s5.83-2.87 5.83-6.72c0-4.08-2.72-7.17-5.83-13.69z" fill="#CE82FF" />
    </Svg>
  );
}

function ClockIcon() {
  return (
    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(206, 130, 255, 0.1)", alignItems: "center", justifyContent: "center" }}>
      <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
        <SvgCircle cx={11} cy={11} r={8} stroke="#CE82FF" strokeWidth={2} />
        <Path d="M11 7v4.5l3 1.5" stroke="#CE82FF" strokeWidth={2} strokeLinecap="round" />
        <Path d="M7 3l-2 2M15 3l2 2" stroke="#CE82FF" strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function ToggleIcon() {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 16, backgroundColor: "#F3E8FF", alignItems: "center", justifyContent: "center" }}>
      <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
        <Rect x={2} y={6} width={16} height={8} rx={4} stroke="#CE82FF" strokeWidth={1.5} />
        <SvgCircle cx={14} cy={10} r={2.5} fill="#CE82FF" />
      </Svg>
    </View>
  );
}

// Deck icons
function MathIcon() {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" }}>
      <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
        <Rect x={3} y={3} width={14} height={14} rx={3} fill="#3B82F6" />
        <Path d="M7 10h6M10 7v6" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function BioIcon() {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(88, 205, 4, 0.1)", alignItems: "center", justifyContent: "center" }}>
      <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
        <Path d="M10 2c4.5 0 7.5 3 7.5 7.5S14.5 17 10 17 2.5 14 2.5 9.5 5.5 2 10 2z" fill="#58CD04" />
        <Path d="M7 9c1-3 4-4 6-3s3 4 2 7" stroke="white" strokeWidth={1.2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function HistoryIcon() {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center" }}>
      <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
        <Rect x={4} y={3} width={12} height={14} rx={2} fill="#F59E0B" />
        <Path d="M7 7h6M7 10h6M7 13h4" stroke="white" strokeWidth={1.2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function PhysicsIcon() {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" }}>
      <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
        <SvgCircle cx={10} cy={10} r={7} stroke="#EF4444" strokeWidth={1.5} />
        <SvgCircle cx={10} cy={10} r={2} fill="#EF4444" />
        <Path d="M10 3v2M10 15v2M3 10h2M15 10h2" stroke="#EF4444" strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

const DECKS = [
  { id: "1", name: "Matemática", progress: 12, total: 40, icon: <MathIcon />, color: "#3B82F6" },
  { id: "2", name: "Biologia", progress: 85, total: 110, icon: <BioIcon />, color: "#58CD04" },
  { id: "3", name: "História", progress: 30, total: 65, icon: <HistoryIcon />, color: "#F59E0B" },
  { id: "4", name: "Física", progress: 4, total: 40, icon: <PhysicsIcon />, color: "#EF4444" },
];

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function FlashcardsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <Pressable onPress={() => router.back()}>
            <BackIcon />
          </Pressable>
          <Text style={styles.headerTitle}>Flashcards</Text>
          <ToggleIcon />
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Streak card */}
        <View style={styles.section}>
          <View style={styles.streakCard}>
            <View style={styles.streakIcon}>
              <FlameIcon />
            </View>
            <View style={styles.streakInfo}>
              <Text style={styles.streakTitle}>Sequência</Text>
              <Text style={styles.streakSubtitle}>Estude hoje para manter 12 dias!</Text>
            </View>
          </View>
        </View>

        {/* Revisão Diária */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revisão Diária</Text>

          <View style={styles.reviewCard}>
            <View style={styles.reviewTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewTitle}>Cartões Vencidos</Text>
                <Text style={styles.reviewSubtitle}>Assuntos para revisar agora</Text>
              </View>
              <ClockIcon />
            </View>

            <View style={styles.reviewStats}>
              <View style={styles.reviewStat}>
                <Text style={styles.reviewStatLabel}>Cartões</Text>
                <Text style={styles.reviewStatValue}>42</Text>
              </View>
              <View style={styles.reviewStat}>
                <Text style={styles.reviewStatLabel}>Tempo est.</Text>
                <Text style={styles.reviewStatValue}>~10m</Text>
              </View>
            </View>

            <Pressable style={({ pressed }) => [styles.studyBtn, pressed && { opacity: 0.9 }]}>
              <Text style={styles.studyBtnText}>ESTUDAR AGORA</Text>
            </Pressable>
          </View>
        </View>

        {/* Seus Baralhos */}
        <View style={[styles.section, { marginBottom: 24 }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Seus Baralhos</Text>
            <Pressable>
              <Text style={styles.sectionLink}>Ver Todos</Text>
            </Pressable>
          </View>

          <View style={styles.decksGrid}>
            {DECKS.map((deck) => {
              const pct = deck.total > 0 ? (deck.progress / deck.total) * 100 : 0;
              return (
                <Pressable key={deck.id} style={styles.deckCard}>
                  {deck.icon}
                  <Text style={styles.deckName}>{deck.name}</Text>
                  <View style={styles.deckProgressRow}>
                    <View style={styles.deckProgressBg}>
                      <View style={[styles.deckProgressFill, { width: `${pct}%`, backgroundColor: deck.color }]} />
                    </View>
                    <Text style={styles.deckCount}>{deck.progress}/{deck.total}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  section: { paddingHorizontal: 24, marginBottom: 28 },

  // ─── Header ───────────────────────────────────────────────────────────────
  header: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(239, 236, 236, 0.5)",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  headerTitle: {
    fontWeight: "900",
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -1,
    color: "#2B2B2B",
  },

  // ─── Streak Card ──────────────────────────────────────────────────────────
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(206, 130, 255, 0.1)",
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(206, 130, 255, 0.2)",
    padding: 25,
    gap: 24,
    marginTop: 24,
  },
  streakIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#CE82FF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(233, 212, 255, 1)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 5,
  },
  streakInfo: { flex: 1, gap: 4 },
  streakTitle: {
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.4,
    color: "#2B2B2B",
  },
  streakSubtitle: {
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
    color: "#6B6B6B",
  },

  // ─── Section Headers ──────────────────────────────────────────────────────
  sectionTitle: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 2.1,
    textTransform: "uppercase",
    color: "#2B2B2B",
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionLink: {
    fontWeight: "900",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#CE82FF",
  },

  // ─── Review Card ──────────────────────────────────────────────────────────
  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(239, 236, 236, 0.4)",
    padding: 24,
    gap: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  reviewTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  reviewTitle: {
    fontWeight: "900",
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -1,
    color: "#2B2B2B",
  },
  reviewSubtitle: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    color: "#6B6B6B",
    marginTop: 2,
  },
  reviewStats: {
    flexDirection: "row",
    gap: 32,
  },
  reviewStat: { gap: 2 },
  reviewStatLabel: {
    fontWeight: "700",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  reviewStatValue: {
    fontWeight: "900",
    fontSize: 24,
    lineHeight: 24,
    letterSpacing: -1.2,
    color: "#2B2B2B",
  },
  studyBtn: {
    backgroundColor: "#CE82FF",
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "rgba(206, 130, 255, 0.3)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 5,
  },
  studyBtnText: {
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },

  // ─── Decks Grid ───────────────────────────────────────────────────────────
  decksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  deckCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(239, 236, 236, 0.5)",
    padding: 20,
    gap: 12,
  },
  deckName: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.35,
    color: "#2B2B2B",
  },
  deckProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deckProgressBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#F0F0F0",
  },
  deckProgressFill: {
    height: 4,
    borderRadius: 2,
  },
  deckCount: {
    fontWeight: "700",
    fontSize: 10,
    lineHeight: 15,
    color: "#6B6B6B",
  },
});
