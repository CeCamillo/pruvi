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

function TrophyRingIcon() {
  return (
    <View style={{ width: 64, height: 64, alignItems: "center", justifyContent: "center" }}>
      <Svg width={64} height={64} viewBox="0 0 64 64" fill="none">
        <SvgCircle cx={32} cy={32} r={28} stroke="#58CD04" strokeWidth={3} strokeDasharray="6 4" />
        <Path d="M26 24h12v8a6 6 0 01-12 0v-8zM24 24h2M38 24h2M30 36v3M34 36v3M28 39h8" stroke="#58CD04" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function FilterIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Rect x={1} y={2} width={14} height={2} rx={1} fill="currentColor" />
      <Rect x={3} y={7} width={10} height={2} rx={1} fill="currentColor" />
      <Rect x={5} y={12} width={6} height={2} rx={1} fill="currentColor" />
    </Svg>
  );
}

function CheckIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M6 12l4 4 8-8" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PencilIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function LockSmallIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M8 11V8a4 4 0 018 0v3M5 11h14a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8a1 1 0 011-1z" stroke="#6B6B6B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function FireSmallIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2c-.25 1.05-.84 2.9-2 4.15C8.55 7.75 7 8.8 7 11.75c0 3.3 2.25 5.75 5 5.75s5-2.45 5-5.75c0-3.5-2.33-6.15-5-9.75z" fill="#6B6B6B" />
    </Svg>
  );
}

// Tab icons (reused)
function HomeTabIcon() {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /><Path d="M9 21V12h6v9" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function TrilhaTabIcon() {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><Rect x={3} y={3} width={18} height={18} rx={4} stroke="#6B6B6B" strokeWidth={1.5} /><Path d="M8 10l4-3 4 3" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function RouletteTabIcon() {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><SvgCircle cx={12} cy={12} r={9} stroke="#6B6B6B" strokeWidth={1.5} /><Path d="M12 3v9l6 3" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" /></Svg>;
}
function AmigosTabIcon() {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><SvgCircle cx={9} cy={7} r={3} stroke="#6B6B6B" strokeWidth={1.5} /><SvgCircle cx={15} cy={7} r={2} stroke="#6B6B6B" strokeWidth={1.5} /><Path d="M3 19c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" /><Path d="M15 13c2.761 0 5 2.239 5 5" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" /></Svg>;
}
function PremiumTabIcon() {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><Path d="M3 8l4-4 5 3 5-3 4 4-3 8H6L3 8z" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /><Path d="M6 16h12v2a2 2 0 01-2 2H8a2 2 0 01-2-2v-2z" stroke="#6B6B6B" strokeWidth={1.5} /></Svg>;
}
function MoreTabIcon() {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><SvgCircle cx={5} cy={12} r={2} fill="#6B6B6B" /><SvgCircle cx={12} cy={12} r={2} fill="#6B6B6B" /><SvgCircle cx={19} cy={12} r={2} fill="#6B6B6B" /></Svg>;
}

// ─── Data ────────────────────────────────────────────────────────────────────

type Achievement = {
  id: string;
  title: string;
  description: string;
  xp: string;
  icon: "check" | "pencil" | "lock" | "fire";
  iconBg: string;
  progress?: { current: number; total: number };
  completed?: boolean;
};

const UNLOCKED: Achievement[] = [
  { id: "1", title: "Primeira Vitória", description: "Complete sua primeira fase", xp: "+10 XP", icon: "check", iconBg: "#58CD04", completed: true },
  { id: "2", title: "Curioso", description: "Responda 10 questões", xp: "+10 XP", icon: "pencil", iconBg: "#84CC16", completed: true },
];

const IN_PROGRESS: Achievement[] = [
  { id: "3", title: "Primeiros Passos", description: "Alcance 100 XP", xp: "+10 XP", icon: "lock", iconBg: "#F0F0F0", progress: { current: 110, total: 100 } },
  { id: "4", title: "Incendiário", description: "Mantenha ofensiva de 7 dias", xp: "+30 XP", icon: "fire", iconBg: "#F0F0F0", progress: { current: 3, total: 7 } },
];

const FILTERS = ["Todas", "XP", "Streak", "Questões"];

// ─── Components ──────────────────────────────────────────────────────────────

function AchievementIcon({ icon, bg, completed }: { icon: Achievement["icon"]; bg: string; completed?: boolean }) {
  return (
    <View style={[styles.achieveIcon, { backgroundColor: bg }]}>
      {icon === "check" && <CheckIcon />}
      {icon === "pencil" && <PencilIcon />}
      {icon === "lock" && <LockSmallIcon />}
      {icon === "fire" && <FireSmallIcon />}
    </View>
  );
}

function AchievementCard({ item }: { item: Achievement }) {
  const pct = item.progress ? Math.min((item.progress.current / item.progress.total) * 100, 100) : 0;

  return (
    <View style={[styles.achieveCard, item.completed && styles.achieveCardCompleted]}>
      <View style={styles.achieveCardRow}>
        <AchievementIcon icon={item.icon} bg={item.iconBg} completed={item.completed} />
        <View style={styles.achieveCardInfo}>
          <Text style={styles.achieveCardTitle}>{item.title}</Text>
          <Text style={styles.achieveCardDesc}>{item.description}</Text>

          {item.progress && (
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>{item.progress.current} / {item.progress.total}</Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: pct >= 100 ? "#58CD04" : "#FF9600" }]} />
              </View>
              <Text style={styles.progressPct}>{Math.round(pct)}%</Text>
            </View>
          )}

          <Text style={[styles.achieveXP, item.completed ? styles.achieveXPGreen : styles.achieveXPGray]}>{item.xp}</Text>
        </View>
      </View>
    </View>
  );
}

const TAB_ROUTES: Record<string, string> = {
  Home: "/(drawer)",
  Trilha: "/(drawer)/trilha",
  Roleta: "/(drawer)/roleta",
  Amigos: "/(drawer)/amigos",
  Premium: "/(drawer)/premium",
  Mais: "/mais",
};

function BottomTabBar({ bottomInset }: { bottomInset: number }) {
  const router = useRouter();
  const tabs = [
    { label: "Home", icon: <HomeTabIcon /> },
    { label: "Trilha", icon: <TrilhaTabIcon /> },
    { label: "Roleta", icon: <RouletteTabIcon /> },
    { label: "Amigos", icon: <AmigosTabIcon /> },
    { label: "Premium", icon: <PremiumTabIcon /> },
    { label: "Mais", icon: <MoreTabIcon /> },
  ];

  return (
    <View style={[styles.bottomBar, { paddingBottom: bottomInset }]}>
      <View style={styles.bottomBarContent}>
        {tabs.map((tab) => (
          <Pressable key={tab.label} style={styles.tabItem} onPress={() => { const r = TAB_ROUTES[tab.label]; if (r) router.push(r as any); }}>
            {tab.icon}
            <Text style={styles.tabLabel}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ProgressoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Conquistas</Text>
            <Text style={styles.headerSubtitle}>2 de 19 desbloqueadas</Text>
          </View>
          <TrophyRingIcon />
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Progress bar card */}
        <View style={styles.section}>
          <View style={styles.overallCard}>
            <View style={styles.overallRow}>
              <Text style={styles.overallLabel}>Progresso Geral</Text>
              <Text style={styles.overallPct}>11%</Text>
            </View>
            <View style={styles.overallBarBg}>
              <View style={[styles.overallBarFill, { width: "11%" }]} />
            </View>
          </View>
        </View>

        {/* Filter tabs */}
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {FILTERS.map((f, i) => (
              <Pressable key={f} style={[styles.filterBtn, i === 0 && styles.filterBtnActive]}>
                <View style={[styles.filterDot, i === 0 ? { backgroundColor: "#FFFFFF" } : { backgroundColor: "#6B6B6B" }]} />
                <Text style={[styles.filterText, i === 0 && styles.filterTextActive]}>{f}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Desbloqueadas */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionLabel}>Desbloqueadas (2)</Text>
          </View>
          <View style={styles.achieveList}>
            {UNLOCKED.map((a) => <AchievementCard key={a.id} item={a} />)}
          </View>
        </View>

        {/* Em Progresso */}
        <View style={[styles.section, { marginBottom: 24 }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: "#6B6B6B" }]} />
            <Text style={styles.sectionLabel}>Em Progresso (17)</Text>
          </View>
          <View style={styles.achieveList}>
            {IN_PROGRESS.map((a) => <AchievementCard key={a.id} item={a} />)}
          </View>
        </View>
      </ScrollView>

      <BottomTabBar bottomInset={insets.bottom} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  section: { paddingHorizontal: 24, marginBottom: 24 },

  // ─── Header ───────────────────────────────────────────────────────────────
  header: { paddingHorizontal: 24, paddingBottom: 16 },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
  },
  headerTitle: {
    fontWeight: "900",
    fontSize: 28,
    lineHeight: 28,
    letterSpacing: -1.4,
    color: "#2B2B2B",
  },
  headerSubtitle: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    color: "#6B6B6B",
    marginTop: 4,
    fontStyle: "italic",
  },

  // ─── Overall Progress ─────────────────────────────────────────────────────
  overallCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.5)",
    padding: 26,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  overallRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  overallLabel: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.35,
    color: "#2B2B2B",
  },
  overallPct: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    color: "#58CD04",
  },
  overallBarBg: {
    height: 14,
    borderRadius: 9999,
    backgroundColor: "#EFECEC",
  },
  overallBarFill: {
    height: 14,
    borderRadius: 9999,
    backgroundColor: "#58CD04",
  },

  // ─── Filters ──────────────────────────────────────────────────────────────
  filterRow: { marginBottom: 24 },
  filterScroll: { paddingHorizontal: 24, gap: 8 },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(240, 240, 240, 0.4)",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  filterBtnActive: {
    backgroundColor: "#2B2B2B",
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filterText: {
    fontWeight: "900",
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },

  // ─── Section Headers ──────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#58CD04",
  },
  sectionLabel: {
    fontWeight: "900",
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: -0.33,
    color: "#6B6B6B",
    fontStyle: "italic",
  },

  // ─── Achievement Cards ────────────────────────────────────────────────────
  achieveList: { gap: 12 },
  achieveCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(239, 236, 236, 0.5)",
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  achieveCardCompleted: {
    backgroundColor: "rgba(88, 205, 4, 0.04)",
    borderColor: "rgba(88, 205, 4, 0.15)",
  },
  achieveCardRow: {
    flexDirection: "row",
    gap: 16,
  },
  achieveIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  achieveCardInfo: { flex: 1, gap: 4 },
  achieveCardTitle: {
    fontWeight: "900",
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.38,
    color: "#2B2B2B",
  },
  achieveCardDesc: {
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
    color: "#6B6B6B",
  },
  achieveXP: {
    fontWeight: "900",
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 0.55,
    marginTop: 4,
  },
  achieveXPGreen: { color: "#58CD04" },
  achieveXPGray: { color: "#6B6B6B" },

  // ─── Progress Bar (in card) ───────────────────────────────────────────────
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  progressLabel: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    color: "#6B6B6B",
    minWidth: 50,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F0F0F0",
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
  },
  progressPct: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    color: "#58CD04",
    minWidth: 35,
    textAlign: "right",
  },

  // ─── Bottom Tab Bar ───────────────────────────────────────────────────────
  bottomBar: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "rgba(239, 236, 236, 0.6)",
  },
  bottomBarContent: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  tabItem: { alignItems: "center", gap: 4, minWidth: 50 },
  tabLabel: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: -0.5,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
});
