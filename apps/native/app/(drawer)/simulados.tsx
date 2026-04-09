import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path, Rect } from "react-native-svg";

// ─── Icons ───────────────────────────────────────────────────────────────────

function FilterIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h16M6 12h12M9 18h6" stroke="#2B2B2B" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function HistoryIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12a9 9 0 1018 0 9 9 0 00-18 0z" stroke="#2B2B2B" strokeWidth={2} />
      <Path d="M12 7v5l3 3" stroke="#2B2B2B" strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 12h2M1 9l3 3-3 3" stroke="#2B2B2B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function StarIcon() {
  return (
    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(88,205,4,0.1)", alignItems: "center", justifyContent: "center" }}>
      <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
        <Path d="M11 2l2.3 6.9L20 10l-5.5 4.7L16 22 11 18.5 6 22l1.5-7.3L2 10l6.7-1.1L11 2z" fill="#58CD04" />
      </Svg>
    </View>
  );
}

function PlayIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M6 4l10 6-10 6V4z" fill="white" />
    </Svg>
  );
}

function PencilBadgeIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Rect width={16} height={16} rx={4} fill="#58CD04" />
      <Path d="M5 11l1-3.5 4-4 2.5 2.5-4 4L5 11z" fill="white" />
    </Svg>
  );
}

// Training card icons
function ErrorIcon() {
  return (
    <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center" }}>
      <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
        <Rect x={3} y={3} width={16} height={16} rx={3} fill="#F59E0B" />
        <Path d="M11 7v4M11 14h.01" stroke="white" strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function SpeedIcon() {
  return (
    <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" }}>
      <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
        <Path d="M5 17c0-3.866 2.686-7 6-7s6 3.134 6 7" stroke="#3B82F6" strokeWidth={2} strokeLinecap="round" />
        <Path d="M11 10V6M11 10l3-2" stroke="#3B82F6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function WeakIcon() {
  return (
    <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center" }}>
      <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
        <SvgCircle cx={11} cy={11} r={8} stroke="#10B981" strokeWidth={2} />
        <Path d="M11 7v4l2.5 2.5" stroke="#10B981" strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function ExamStarIcon() {
  return (
    <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: "rgba(88,205,4,0.1)", alignItems: "center", justifyContent: "center" }}>
      <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
        <Path d="M11 2l2.3 6.9L20 10l-5.5 4.7L16 22 11 18.5 6 22l1.5-7.3L2 10l6.7-1.1L11 2z" fill="#58CD04" />
      </Svg>
    </View>
  );
}

function GradCapSmallIcon() {
  return (
    <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: "rgba(99,102,241,0.1)", alignItems: "center", justifyContent: "center" }}>
      <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
        <Path d="M11 3L2 7.5 11 12l9-4.5L11 3zM5 10v4c0 1.5 2.5 3 6 3s6-1.5 6-3v-4" stroke="#6366F1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function BoltIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d="M9 1L4 9h4l-1 6 5-8H8l1-6z" fill="#F59E0B" />
    </Svg>
  );
}

function DocIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Rect x={3} y={2} width={10} height={12} rx={2} fill="#3B82F6" />
      <Path d="M6 6h4M6 8.5h4M6 11h2.5" stroke="white" strokeWidth={1} strokeLinecap="round" />
    </Svg>
  );
}

function LockIcon() {
  return (
    <View style={{ backgroundColor: "rgba(255,150,0,0.15)", borderRadius: 8, padding: 4 }}>
      <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
        <Path d="M4.67 6.42V4.67a2.33 2.33 0 014.66 0v1.75M3.5 7a1.17 1.17 0 011.17-1.17h4.66A1.17 1.17 0 0110.5 7v3.5a1.17 1.17 0 01-1.17 1.17H4.67A1.17 1.17 0 013.5 10.5V7z" stroke="#FF9600" strokeWidth={1.2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function ChevronRight() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d="M6 4l4 4-4 4" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Tab icons
function HomeTabIcon() { return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="#6B6B6B" strokeWidth={1.5} /><Path d="M9 21V12h6v9" stroke="#6B6B6B" strokeWidth={1.5} /></Svg>; }
function TrilhaTabIcon() { return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><Rect x={3} y={3} width={18} height={18} rx={4} stroke="#6B6B6B" strokeWidth={1.5} /><Path d="M8 10l4-3 4 3" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>; }
function RouletteTabIcon() { return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><SvgCircle cx={12} cy={12} r={9} stroke="#6B6B6B" strokeWidth={1.5} /><Path d="M12 3v9l6 3" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" /></Svg>; }
function AmigosTabIcon() { return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><SvgCircle cx={9} cy={7} r={3} stroke="#6B6B6B" strokeWidth={1.5} /><SvgCircle cx={15} cy={7} r={2} stroke="#6B6B6B" strokeWidth={1.5} /><Path d="M3 19c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" /><Path d="M15 13c2.761 0 5 2.239 5 5" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" /></Svg>; }
function PremiumTabIcon() { return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><Path d="M3 8l4-4 5 3 5-3 4 4-3 8H6L3 8z" stroke="#6B6B6B" strokeWidth={1.5} /><Path d="M6 16h12v2a2 2 0 01-2 2H8a2 2 0 01-2-2v-2z" stroke="#6B6B6B" strokeWidth={1.5} /></Svg>; }
function MoreTabIcon() { return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><SvgCircle cx={5} cy={12} r={2} fill="#6B6B6B" /><SvgCircle cx={12} cy={12} r={2} fill="#6B6B6B" /><SvgCircle cx={19} cy={12} r={2} fill="#6B6B6B" /></Svg>; }

// ─── Components ──────────────────────────────────────────────────────────────

function WeeklySimuladoCard({ onStart }: { onStart: () => void }) {
  return (
    <View style={styles.weeklyCard}>
      {/* Badge */}
      <View style={styles.weeklyBadge}>
        <PencilBadgeIcon />
        <Text style={styles.weeklyBadgeText}>MODO PAPEL E CANETA</Text>
      </View>

      <View style={styles.weeklyBody}>
        <View style={styles.weeklyTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.weeklyTitle}>Simulado da Semana</Text>
            <Text style={styles.weeklySubtitle}>Padrão ENEM • Linguagens & Matemática</Text>
          </View>
          <StarIcon />
        </View>

        {/* Stats row */}
        <View style={styles.weeklyStats}>
          <View style={styles.weeklyStat}>
            <Text style={styles.weeklyStatLabel}>Questões</Text>
            <Text style={styles.weeklyStatValue}>20</Text>
          </View>
          <View style={styles.weeklyStat}>
            <Text style={styles.weeklyStatLabel}>Tempo</Text>
            <Text style={styles.weeklyStatValue}>35 min</Text>
          </View>
          <View style={styles.weeklyStat}>
            <Text style={styles.weeklyStatLabel}>Dificuldade</Text>
            <Text style={[styles.weeklyStatValue, { color: "#58CD04" }]}>Complexa</Text>
          </View>
        </View>

        {/* CTA */}
        <Pressable style={({ pressed }) => [styles.greenCTA, pressed && { opacity: 0.9 }]} onPress={onStart}>
          <Text style={styles.greenCTAText}>COMEÇAR AGORA</Text>
          <PlayIcon />
        </Pressable>
      </View>
    </View>
  );
}

function TrainingCard({
  title, subtitle, icon, stats, buttonText, buttonColor,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  stats: { label: string; value: string; color?: string }[];
  buttonText: string;
  buttonColor: string;
}) {
  return (
    <View style={styles.trainingCard}>
      <View style={styles.trainingTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.trainingTitle}>{title}</Text>
          <Text style={styles.trainingSubtitle}>{subtitle}</Text>
        </View>
        {icon}
      </View>
      <View style={styles.trainingStats}>
        {stats.map((s) => (
          <View key={s.label} style={styles.trainingStat}>
            <Text style={styles.trainingStatLabel}>{s.label}</Text>
            <Text style={[styles.trainingStatValue, s.color ? { color: s.color } : undefined]}>{s.value}</Text>
          </View>
        ))}
      </View>
      <Pressable style={[styles.trainingBtn, { borderColor: buttonColor }]}>
        <Text style={[styles.trainingBtnText, { color: buttonColor }]}>{buttonText}</Text>
      </Pressable>
    </View>
  );
}

function ExamCard({
  name, icon, progress, items,
}: {
  name: string;
  icon: React.ReactNode;
  progress: number;
  items: { title: string; meta: string; icon: React.ReactNode; locked?: boolean }[];
}) {
  return (
    <View style={styles.examCard}>
      <View style={styles.examHeader}>
        {icon}
        <View style={{ flex: 1 }}>
          <Text style={styles.examName}>{name}</Text>
          <View style={styles.examProgressRow}>
            <View style={styles.examProgressBg}>
              <View style={[styles.examProgressFill, { width: `${progress}%`, backgroundColor: progress > 50 ? "#58CD04" : "#3B82F6" }]} />
            </View>
            <Text style={styles.examProgressText}>{progress}% da Trilha</Text>
          </View>
        </View>
      </View>

      {items.map((item, i) => (
        <Pressable key={i} style={styles.examItem}>
          {item.icon}
          <View style={{ flex: 1 }}>
            <Text style={styles.examItemTitle}>{item.title}</Text>
            <Text style={styles.examItemMeta}>{item.meta}</Text>
          </View>
          {item.locked ? <LockIcon /> : <ChevronRight />}
        </Pressable>
      ))}
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

export default function SimuladosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Simulados</Text>
            <Text style={styles.headerSubtitle}>Baseados nas suas trilhas ativas</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.headerBtn}><FilterIcon /></Pressable>
            <Pressable style={styles.headerBtn}><HistoryIcon /></Pressable>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Weekly Simulado */}
        <View style={styles.section}>
          <WeeklySimuladoCard onStart={() => router.push("/(drawer)/questao-simulado" as any)} />
        </View>

        {/* Reforço de Base */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reforço de Base</Text>
          <Text style={styles.sectionSubtitle}>Baseado nos seus erros recentes e desempenho</Text>
          <View style={styles.trainingList}>
            <TrainingCard
              title="Revisão de Erros"
              subtitle="Geometria Plana"
              icon={<ErrorIcon />}
              stats={[
                { label: "Questões", value: "8" },
                { label: "Dificuldade", value: "Fácil", color: "#58CD04" },
                { label: "Objetivo", value: "Fixação" },
              ]}
              buttonText="COMEÇAR REVISÃO"
              buttonColor="#F59E0B"
            />
            <TrainingCard
              title="Treino de Velocidade"
              subtitle="Cálculo Básico"
              icon={<SpeedIcon />}
              stats={[
                { label: "Questões", value: "15" },
                { label: "Dificuldade", value: "Média", color: "#F59E0B" },
                { label: "Foco", value: "Agilidade" },
              ]}
              buttonText="INICIAR TREINO"
              buttonColor="#3B82F6"
            />
            <TrainingCard
              title="Assuntos Fracos"
              subtitle="Células e Organelas"
              icon={<WeakIcon />}
              stats={[
                { label: "Questões", value: "10" },
                { label: "Dificuldade", value: "Média", color: "#F59E0B" },
                { label: "Ajuste", value: "Dificuldade" },
              ]}
              buttonText="REFORÇAR BASE"
              buttonColor="#10B981"
            />
          </View>
        </View>

        {/* Foco em Exames */}
        <View style={[styles.section, { marginBottom: 24 }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Foco em Exames</Text>
            <Text style={styles.sectionCount}>2 selecionados</Text>
          </View>
          <View style={styles.examList}>
            <ExamCard
              name="ENEM 2024"
              icon={<ExamStarIcon />}
              progress={65}
              items={[
                { title: "Simulado Rápido", meta: "15 questões • 20 min", icon: <BoltIcon /> },
                { title: "Simulado Oficial (Anterior)", meta: "90 questões • 5h", icon: <DocIcon /> },
              ]}
            />
            <ExamCard
              name="FUVEST / USP"
              icon={<GradCapSmallIcon />}
              progress={20}
              items={[
                { title: "Simulado Rápido", meta: "10 questões • 15 min", icon: <BoltIcon /> },
                { title: "Primeira Fase (Completa)", meta: "90 questões • 5h", icon: <DocIcon />, locked: true },
              ]}
            />
          </View>
        </View>
      </ScrollView>

      <BottomTabBar bottomInset={insets.bottom} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  section: { paddingHorizontal: 24, marginBottom: 32 },

  // ─── Header ───────────────────────────────────────────────────────────────
  header: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(239, 236, 236, 0.5)",
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontWeight: "900",
    fontSize: 28,
    lineHeight: 28,
    letterSpacing: -1.4,
    color: "#2B2B2B",
    fontStyle: "italic",
  },
  headerSubtitle: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    color: "#6B6B6B",
    marginTop: 4,
    fontStyle: "italic",
  },
  headerActions: { flexDirection: "row", gap: 8 },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(240, 240, 240, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ─── Weekly Card ──────────────────────────────────────────────────────────
  weeklyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(88, 205, 4, 0.2)",
    overflow: "hidden",
    marginTop: 24,
    shadowColor: "rgba(132, 204, 22, 0.08)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 5,
  },
  weeklyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(88, 205, 4, 0.08)",
    paddingHorizontal: 24,
    paddingVertical: 10,
    alignSelf: "flex-start",
    borderBottomRightRadius: 16,
  },
  weeklyBadgeText: {
    fontWeight: "900",
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "#58CD04",
  },
  weeklyBody: { padding: 24, gap: 20 },
  weeklyTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  weeklyTitle: {
    fontWeight: "900",
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -1.1,
    color: "#2B2B2B",
  },
  weeklySubtitle: {
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
    color: "#6B6B6B",
    marginTop: 2,
  },
  weeklyStats: { flexDirection: "row", gap: 24 },
  weeklyStat: { gap: 2 },
  weeklyStatLabel: {
    fontWeight: "700",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  weeklyStatValue: {
    fontWeight: "900",
    fontSize: 20,
    lineHeight: 20,
    letterSpacing: -1,
    color: "#2B2B2B",
  },
  greenCTA: {
    backgroundColor: "#58CD04",
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    shadowColor: "rgba(88, 205, 4, 0.3)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 5,
  },
  greenCTAText: {
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },

  // ─── Section Headers ──────────────────────────────────────────────────────
  sectionTitle: {
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 25,
    letterSpacing: -0.9,
    color: "#2B2B2B",
    fontStyle: "italic",
  },
  sectionSubtitle: {
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
    color: "#6B6B6B",
    fontStyle: "italic",
    marginTop: 2,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionCount: {
    fontWeight: "900",
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "#58CD04",
    fontStyle: "italic",
  },

  // ─── Training Cards ───────────────────────────────────────────────────────
  trainingList: { gap: 16 },
  trainingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(239, 236, 236, 0.5)",
    padding: 20,
    gap: 16,
  },
  trainingTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  trainingTitle: {
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.4,
    color: "#2B2B2B",
  },
  trainingSubtitle: {
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
    color: "#6B6B6B",
  },
  trainingStats: { flexDirection: "row", gap: 24 },
  trainingStat: { gap: 2 },
  trainingStatLabel: {
    fontWeight: "700",
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  trainingStatValue: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 14,
    letterSpacing: -0.7,
    color: "#2B2B2B",
  },
  trainingBtn: {
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  trainingBtnText: {
    fontWeight: "900",
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  // ─── Exam Cards ───────────────────────────────────────────────────────────
  examList: { gap: 16 },
  examCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(239, 236, 236, 0.5)",
    padding: 20,
    gap: 16,
  },
  examHeader: { flexDirection: "row", alignItems: "center", gap: 14 },
  examName: {
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 25,
    letterSpacing: -0.9,
    color: "#2B2B2B",
  },
  examProgressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  examProgressBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "#F0F0F0" },
  examProgressFill: { height: 6, borderRadius: 3 },
  examProgressText: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    color: "#58CD04",
  },
  examItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(239, 236, 236, 0.3)",
  },
  examItemTitle: {
    fontWeight: "900",
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: -0.33,
    color: "#2B2B2B",
  },
  examItemMeta: {
    fontWeight: "700",
    fontSize: 10,
    lineHeight: 15,
    color: "#6B6B6B",
  },

  // ─── Bottom Tab Bar ───────────────────────────────────────────────────────
  bottomBar: { backgroundColor: "rgba(255,255,255,0.9)", borderTopWidth: 1, borderTopColor: "#EFECEC" },
  bottomBarContent: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingTop: 10, paddingHorizontal: 8 },
  tabItem: { alignItems: "center", gap: 4, minWidth: 50 },
  tabLabel: { fontWeight: "900", fontSize: 10, lineHeight: 15, letterSpacing: -0.5, textTransform: "uppercase", color: "#6B6B6B" },
});
