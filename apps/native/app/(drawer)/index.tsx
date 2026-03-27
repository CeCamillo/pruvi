import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Defs, Path, RadialGradient, Stop } from "react-native-svg";

// ─── Icons ───────────────────────────────────────────────────────────────────

function PruviLogo() {
  return (
    <View style={styles.logoIcon}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 2L4 6.5V11c0 5.25 3.4 10.15 8 11.5 4.6-1.35 8-6.25 8-11.5V6.5L12 2z"
          fill="#58CD04"
        />
        <Path
          d="M10 12l2 2 4-4"
          stroke="#FFFFFF"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

function FireIcon({ size = 16, color = "#FF9600" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 1.33c-.17.7-.56 1.93-1.33 2.77C5.7 5.17 4.67 5.87 4.67 7.83c0 2.2 1.5 3.84 3.33 3.84s3.33-1.64 3.33-3.84c0-2.33-1.55-4.1-3.33-6.5z"
        fill={color}
      />
    </Svg>
  );
}

function LeafIcon({ size = 16, color = "#58CD04" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M13.33 2.67s-1.5 0-3.66.83C7.5 4.33 5 6.5 4.33 9.33c-.5 2.17 0 4 0 4s2.5-.17 4.17-1.5c1.67-1.33 3-3.5 3.33-5.16.34-1.67 1.5-4 1.5-4zM2.67 13.33l4-4"
        stroke={color}
        strokeWidth={1.33}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckCircleIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <SvgCircle cx={8} cy={8} r={7} stroke="#58CD04" strokeWidth={2} />
      <Path
        d="M5.5 8l1.5 1.5 3-3"
        stroke="#58CD04"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TargetIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <SvgCircle cx={8} cy={8} r={6} stroke="#6B6B6B" strokeWidth={1.5} strokeOpacity={0.3} />
      <SvgCircle cx={8} cy={8} r={3} stroke="#6B6B6B" strokeWidth={1.5} strokeOpacity={0.3} />
      <SvgCircle cx={8} cy={8} r={1} fill="#6B6B6B" fillOpacity={0.3} />
    </Svg>
  );
}

function FlashcardIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Path
        d="M4 7h20v14a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"
        fill="#D08700"
        fillOpacity={0.3}
      />
      <Path
        d="M4 7a2 2 0 012-2h16a2 2 0 012 2v2H4V7z"
        fill="#D08700"
      />
      <SvgCircle cx={17} cy={16} r={1.5} fill="#D08700" />
    </Svg>
  );
}

function SwordIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Path
        d="M6 22l3-3m0 0l8-8m-8 8l-3 0m3 0l0 3M22 6l-8 8m8-8l-2 0m2 0l0 2"
        stroke="#FF9600"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SparkleIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z"
        fill="#FFFFFF"
        fillOpacity={0.9}
      />
    </Svg>
  );
}

function HomeIcon({ active = false }: { active?: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
        fill={active ? "#58CD04" : "none"}
        stroke={active ? "#58CD04" : "#6B6B6B"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fillOpacity={active ? 0.15 : 0}
      />
      <Path
        d="M9 21V12h6v9"
        stroke={active ? "#58CD04" : "#6B6B6B"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TrailIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 19l4-4 4 4 4-4 4 4M4 14l4-4 4 4 4-4 4 4"
        stroke="#6B6B6B"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function RouletteIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx={12} cy={12} r={9} stroke="#6B6B6B" strokeWidth={2} />
      <Path
        d="M12 3v9l6 3"
        stroke="#6B6B6B"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function FriendsIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
        stroke="#6B6B6B"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MoreIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx={12} cy={5} r={1.5} fill="#6B6B6B" />
      <SvgCircle cx={12} cy={12} r={1.5} fill="#6B6B6B" />
      <SvgCircle cx={12} cy={19} r={1.5} fill="#6B6B6B" />
    </Svg>
  );
}

function ChevronIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M7.5 5l5 5-5 5"
        stroke="#6B6B6B"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

const MISSIONS = [
  {
    id: "1",
    title: "Completar 3 lições",
    subtitle: "Ganha 50 XP",
    completed: false,
    icon: "check" as const,
  },
  {
    id: "2",
    title: "Acerte 10 seguidas",
    subtitle: "0/10 concluído",
    completed: false,
    icon: "target" as const,
  },
];

const WEEK_DAYS = [
  { label: "S", height: 32, opacity: 0.2 },
  { label: "T", height: 54, opacity: 0.2 },
  { label: "Q", height: 80, opacity: 0.4 },
  { label: "Q", height: 107, opacity: 1, active: true },
  { label: "S", height: 11, opacity: 0.1 },
  { label: "S", height: 0, opacity: 0 },
  { label: "D", height: 0, opacity: 0 },
];

// ─── Components ──────────────────────────────────────────────────────────────

function TopBar({ topInset }: { topInset: number }) {
  return (
    <View style={[styles.topBar, { paddingTop: topInset }]}>
      <View style={styles.topBarContent}>
        <View style={styles.topBarLeft}>
          <PruviLogo />
          <View style={styles.topBarBrand}>
            <Text style={styles.brandName}>Pruvi</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online Agora</Text>
            </View>
          </View>
        </View>
        <View style={styles.topBarRight}>
          <View style={styles.badgeOrange}>
            <FireIcon size={16} />
            <Text style={styles.badgeOrangeText}>12</Text>
          </View>
          <View style={styles.badgeGreen}>
            <LeafIcon size={16} />
            <Text style={styles.badgeGreenText}>2.4k</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function HeroCard() {
  return (
    <View style={styles.heroCard}>
      {/* Decorative green glow */}
      <View style={styles.heroGlow}>
        <Svg width={160} height={160}>
          <Defs>
            <RadialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#58CD04" stopOpacity="0.05" />
              <Stop offset="100%" stopColor="#58CD04" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <SvgCircle cx={80} cy={80} r={80} fill="url(#heroGlow)" />
        </Svg>
      </View>

      {/* Decorative plant SVG top-right */}
      <View style={styles.heroPlant}>
        <Svg width={114} height={114} viewBox="0 0 114 114" fill="none">
          <Path
            d="M57 10c20 0 40 15 45 40s-5 50-25 55-45-5-55-30S37 10 57 10z"
            fill="#58CD04"
            fillOpacity={0.08}
          />
          <Path
            d="M50 45c5-15 20-25 35-20s20 25 10 40-30 15-40 5-10-10-5-25z"
            fill="#58CD04"
            fillOpacity={0.12}
          />
        </Svg>
      </View>

      <View style={styles.heroContent}>
        <View style={styles.heroTextArea}>
          <Text style={styles.heroGreeting}>E aí, Guilherme! </Text>
          <Text style={styles.heroSubtitle}>
            Pronto para bater sua meta de 15 minutos hoje?
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.continueButton,
            pressed && styles.continueButtonPressed,
          ]}
        >
          <Text style={styles.continueButtonText}>Continuar Estudando</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MissionCard({
  title,
  subtitle,
  completed,
  icon,
}: {
  title: string;
  subtitle: string;
  completed: boolean;
  icon: "check" | "target";
}) {
  return (
    <View style={styles.missionCard}>
      <View style={styles.missionLeft}>
        <View style={styles.missionIcon}>
          {icon === "check" ? (
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 12l2 2 4-4M12 3a9 9 0 100 18 9 9 0 000-18z"
                stroke="#2B2B2B"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ) : (
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <SvgCircle cx={12} cy={12} r={9} stroke="#2B2B2B" strokeWidth={2} />
              <SvgCircle cx={12} cy={12} r={5} stroke="#2B2B2B" strokeWidth={2} />
              <SvgCircle cx={12} cy={12} r={1.5} fill="#2B2B2B" />
            </Svg>
          )}
        </View>
        <View style={styles.missionTextArea}>
          <Text style={styles.missionTitle}>{title}</Text>
          <Text style={styles.missionSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <View
        style={[
          styles.missionCheckbox,
          completed ? styles.missionCheckboxDone : styles.missionCheckboxUndone,
        ]}
      >
        {completed && <CheckCircleIcon />}
      </View>
    </View>
  );
}

function PracticaCard({
  title,
  subtitle,
  bgColor,
  icon,
}: {
  title: string;
  subtitle: string;
  bgColor: string;
  icon: React.ReactNode;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.practicaCard,
        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={[styles.practicaIconContainer, { backgroundColor: bgColor }]}>
        {icon}
      </View>
      <View style={styles.practicaTextArea}>
        <Text style={styles.practicaTitle}>{title}</Text>
        <Text style={styles.practicaSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

function AIAnalysisCard() {
  return (
    <LinearGradient
      colors={["#4F39F6", "#7008E7"]}
      style={styles.aiCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* Decorative blur circle */}
      <View style={styles.aiBlurCircle} />

      <View style={styles.aiContent}>
        <View style={styles.aiLeft}>
          {/* Badge */}
          <View style={styles.aiBadge}>
            <SparkleIcon size={16} />
            <Text style={styles.aiBadgeText}>Análise de IA</Text>
          </View>

          {/* Text */}
          <View style={styles.aiTextArea}>
            <Text style={styles.aiTitle}>{"Matéria Crítica:\nBiologia"}</Text>
            <Text style={styles.aiDescription}>
              Seu desempenho caiu 15% em Citologia. Vamos revisar?
            </Text>
          </View>

          {/* Button */}
          <Pressable
            style={({ pressed }) => [
              styles.aiButton,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.aiButtonText}>Iniciar Revisão</Text>
          </Pressable>
        </View>

        {/* Progress circle */}
        <View style={styles.aiRight}>
          <Svg width={80} height={80} viewBox="0 0 80 80">
            <SvgCircle
              cx={40}
              cy={40}
              r={33}
              stroke="#FFFFFF"
              strokeWidth={6.67}
              strokeOpacity={0.15}
              fill="none"
            />
            <SvgCircle
              cx={40}
              cy={40}
              r={33}
              stroke="#FFFFFF"
              strokeWidth={6.67}
              strokeDasharray={`${2 * Math.PI * 33 * 0.35} ${2 * Math.PI * 33 * 0.65}`}
              strokeLinecap="round"
              fill="none"
              transform="rotate(-90 40 40)"
            />
          </Svg>
          <Text style={styles.aiPercentage}>35%</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

function WeeklyActivityCard() {
  const maxBarHeight = 107;

  return (
    <View style={styles.weeklyCard}>
      {/* Header */}
      <View style={styles.weeklyHeader}>
        <View>
          <Text style={styles.weeklyTitle}>Atividade Semanal</Text>
          <Text style={styles.weeklySubtitle}>Minutos de estudo</Text>
        </View>
        <ChevronIcon />
      </View>

      {/* Chart */}
      <View style={styles.weeklyChart}>
        {WEEK_DAYS.map((day, index) => (
          <View key={index} style={styles.weeklyBarColumn}>
            <View style={styles.weeklyBarContainer}>
              {day.height > 0 && (
                <View
                  style={[
                    styles.weeklyBar,
                    {
                      height: day.height,
                      backgroundColor: day.active
                        ? "#58CD04"
                        : `rgba(88, 205, 4, ${day.opacity})`,
                    },
                  ]}
                />
              )}
            </View>
            <Text
              style={[
                styles.weeklyDayLabel,
                day.active && styles.weeklyDayLabelActive,
              ]}
            >
              {day.label}
            </Text>
          </View>
        ))}
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
  Mais: "/(drawer)/mais",
};

function BottomTabBar({ bottomInset }: { bottomInset: number }) {
  const router = useRouter();
  const tabs = [
    { label: "Home", icon: <HomeIcon active />, active: true },
    { label: "Trilha", icon: <TrailIcon /> },
    { label: "Roleta", icon: <RouletteIcon /> },
    { label: "Amigos", icon: <FriendsIcon /> },
    { label: "Mais", icon: <MoreIcon /> },
  ];

  return (
    <View style={[styles.bottomBar, { paddingBottom: bottomInset }]}>
      <View style={styles.bottomBarContent}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.label}
            style={styles.tabItem}
            onPress={() => {
              const route = TAB_ROUTES[tab.label];
              if (route && !tab.active) {
                router.push(route as any);
              }
            }}
          >
            {tab.active ? (
              <View style={styles.tabActiveContainer}>
                {tab.icon}
                <Text style={styles.tabLabelActive}>{tab.label}</Text>
              </View>
            ) : (
              <>
                {tab.icon}
                <Text style={styles.tabLabel}>{tab.label}</Text>
              </>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function Home() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <TopBar topInset={insets.top} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <View style={styles.section}>
          <HeroCard />
        </View>

        {/* Missões de Hoje */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Missões de Hoje</Text>
            <Pressable>
              <Text style={styles.sectionLink}>Ver Todas</Text>
            </Pressable>
          </View>
          <View style={styles.missionsContainer}>
            {MISSIONS.map((mission) => (
              <MissionCard key={mission.id} {...mission} />
            ))}
          </View>
        </View>

        {/* Prática Expressa */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prática Expressa</Text>
          <View style={styles.practicaRow}>
            <PracticaCard
              title="Flashcards"
              subtitle="Revisão Rápida"
              bgColor="#FEF9C2"
              icon={<FlashcardIcon />}
            />
            <PracticaCard
              title="Desafios"
              subtitle="Gere 2x XP"
              bgColor="rgba(255, 150, 0, 0.1)"
              icon={<SwordIcon />}
            />
          </View>
        </View>

        {/* AI Analysis */}
        <View style={styles.section}>
          <AIAnalysisCard />
        </View>

        {/* Weekly Activity */}
        <View style={[styles.section, { marginBottom: 24 }]}>
          <WeeklyActivityCard />
        </View>
      </ScrollView>

      <BottomTabBar bottomInset={insets.bottom} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 2.1,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },
  sectionLink: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#58CD04",
  },

  // ─── Top Bar ─────────────────────────────────────────────────────────────
  topBar: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
  },
  topBarContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 10,
    height: 60,
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#58CD04",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(88, 205, 4, 0.2)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 5,
  },
  topBarBrand: {
    gap: 2,
  },
  brandName: {
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 18,
    letterSpacing: -0.45,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },
  onlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#58CD04",
  },
  onlineText: {
    fontWeight: "900",
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  topBarRight: {
    flexDirection: "row",
    gap: 8,
  },
  badgeOrange: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 150, 0, 0.1)",
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255, 150, 0, 0.2)",
  },
  badgeOrangeText: {
    fontWeight: "900",
    fontSize: 12,
    lineHeight: 16,
    color: "#FF9600",
  },
  badgeGreen: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(88, 205, 4, 0.1)",
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(88, 205, 4, 0.2)",
  },
  badgeGreenText: {
    fontWeight: "900",
    fontSize: 12,
    lineHeight: 16,
    color: "#58CD04",
  },

  // ─── Hero Card ────────────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.5)",
    padding: 26,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  heroGlow: {
    position: "absolute",
    right: -20,
    top: -20,
  },
  heroPlant: {
    position: "absolute",
    right: 0,
    top: 0,
  },
  heroContent: {
    gap: 16,
  },
  heroTextArea: {
    gap: 4,
    maxWidth: 220,
  },
  heroGreeting: {
    fontWeight: "900",
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.6,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },
  heroSubtitle: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 21,
    color: "#6B6B6B",
  },
  continueButton: {
    backgroundColor: "#58CD04",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignSelf: "flex-start",
    shadowColor: "rgba(88, 205, 4, 0.3)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 5,
  },
  continueButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  continueButtonText: {
    fontWeight: "900",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },

  // ─── Missions ─────────────────────────────────────────────────────────────
  missionsContainer: {
    gap: 12,
  },
  missionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(239, 236, 236, 0.5)",
    padding: 17,
  },
  missionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  missionIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  missionTextArea: {
    gap: 0,
  },
  missionTitle: {
    fontWeight: "900",
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: -0.33,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },
  missionSubtitle: {
    fontWeight: "700",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  missionCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  missionCheckboxDone: {
    borderWidth: 2,
    borderColor: "#58CD04",
  },
  missionCheckboxUndone: {
    borderWidth: 2,
    borderColor: "rgba(107, 107, 107, 0.3)",
  },

  // ─── Pratica Expressa ─────────────────────────────────────────────────────
  practicaRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 16,
  },
  practicaCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.5)",
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  practicaIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  practicaTextArea: {
    alignItems: "center",
    marginTop: 12,
    gap: 4,
  },
  practicaTitle: {
    fontWeight: "900",
    fontSize: 11,
    lineHeight: 11,
    letterSpacing: -0.28,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },
  practicaSubtitle: {
    fontWeight: "700",
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },

  // ─── AI Analysis Card ─────────────────────────────────────────────────────
  aiCard: {
    borderRadius: 32,
    padding: 20,
    overflow: "hidden",
    shadowColor: "rgba(198, 210, 255, 0.5)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 5,
  },
  aiBlurCircle: {
    position: "absolute",
    right: -20,
    top: -40,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  aiContent: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  aiLeft: {
    flex: 1,
    gap: 12,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  aiBadgeText: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(255, 255, 255, 0.9)",
  },
  aiTextArea: {
    gap: 4,
  },
  aiTitle: {
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 22.5,
    letterSpacing: -0.45,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
  aiDescription: {
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 16.5,
    letterSpacing: 0.28,
    textTransform: "uppercase",
    color: "rgba(255, 255, 255, 0.7)",
  },
  aiButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  aiButtonText: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#4F39F6",
  },
  aiRight: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  aiPercentage: {
    position: "absolute",
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    color: "#FFFFFF",
  },

  // ─── Weekly Activity ──────────────────────────────────────────────────────
  weeklyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.5)",
    padding: 26,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  weeklyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  weeklyTitle: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.35,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },
  weeklySubtitle: {
    fontWeight: "700",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  weeklyChart: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 128,
  },
  weeklyBarColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: 128,
  },
  weeklyBarContainer: {
    flex: 1,
    width: 41,
    justifyContent: "flex-end",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F0F0F0",
  },
  weeklyBar: {
    width: "100%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  weeklyDayLabel: {
    fontWeight: "900",
    fontSize: 9,
    lineHeight: 14,
    textTransform: "uppercase",
    color: "#6B6B6B",
    marginTop: 4,
  },
  weeklyDayLabelActive: {
    color: "#58CD04",
  },

  // ─── Bottom Tab Bar ───────────────────────────────────────────────────────
  bottomBar: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderTopWidth: 1,
    borderTopColor: "#EFECEC",
  },
  bottomBarContent: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 12,
    paddingHorizontal: 8,
  },
  tabItem: {
    alignItems: "center",
    gap: 4,
    minWidth: 60,
  },
  tabActiveContainer: {
    backgroundColor: "rgba(88, 205, 4, 0.1)",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  tabLabel: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    color: "#2B2B2B",
  },
  tabLabelActive: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    color: "#58CD04",
  },
});
