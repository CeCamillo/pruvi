import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path, Rect } from "react-native-svg";

// ─── Icons ───────────────────────────────────────────────────────────────────

function CheckCircleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <SvgCircle cx={10} cy={10} r={10} fill="#58CD04" />
      <Path
        d="M6.5 10l2.5 2.5 4.5-4.5"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TimerIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Rect x={2} y={2} width={12} height={12} rx={3} fill="#2B2B2B" />
      <Path d="M8 5v3.5l2 1" stroke="#FFFFFF" strokeWidth={1.2} strokeLinecap="round" />
    </Svg>
  );
}

// Tab icons
function HomeTabIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 21V12h6v9" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function TrilhaTabIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={4} stroke="#6B6B6B" strokeWidth={1.5} />
      <Path d="M8 10l4-3 4 3" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function RouletteTabIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx={12} cy={12} r={9} stroke="#6B6B6B" strokeWidth={1.5} />
      <Path d="M12 3v9l6 3" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}
function AmigosTabIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx={9} cy={7} r={3} stroke="#6B6B6B" strokeWidth={1.5} />
      <SvgCircle cx={15} cy={7} r={2} stroke="#6B6B6B" strokeWidth={1.5} />
      <Path d="M3 19c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M15 13c2.761 0 5 2.239 5 5" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}
function PremiumTabIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M3 8l4-4 5 3 5-3 4 4-3 8H6L3 8z" fill="#58CD04" fillOpacity={0.15} stroke="#58CD04" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 16h12v2a2 2 0 01-2 2H8a2 2 0 01-2-2v-2z" stroke="#58CD04" strokeWidth={1.5} />
    </Svg>
  );
}
function MoreTabIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx={5} cy={12} r={2} fill="#6B6B6B" />
      <SvgCircle cx={12} cy={12} r={2} fill="#6B6B6B" />
      <SvgCircle cx={19} cy={12} r={2} fill="#6B6B6B" />
    </Svg>
  );
}

// ─── Components ──────────────────────────────────────────────────────────────

function HeroSection({ topInset }: { topInset: number }) {
  return (
    <View style={[styles.hero, { paddingTop: topInset + 24 }]}>
      {/* Dark background with gradient overlay */}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.heroBg} />
        <LinearGradient
          colors={["rgba(88, 205, 4, 0.2)", "rgba(88, 205, 4, 0)"]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {/* Decorative blurred circles */}
      <View style={styles.heroBlurGreen} />
      <View style={styles.heroBlurOrange} />

      <View style={styles.heroContent}>
        <Text style={styles.heroTitle}>Pruvi Premium</Text>
        <Text style={styles.heroSubtitle}>O atalho para sua aprovação</Text>
      </View>
    </View>
  );
}

function UltraCard() {
  return (
    <View style={styles.ultraCard}>
      {/* Green top banner */}
      <View style={styles.ultraBanner}>
        <Text style={styles.ultraBannerLeft}>Oferta de lançamento</Text>
        <View style={styles.ultraTimer}>
          <TimerIcon />
          <Text style={styles.ultraTimerText}>Expira em 23:59:59</Text>
        </View>
      </View>

      {/* Card body */}
      <View style={styles.ultraBody}>
        {/* Title + Price */}
        <View style={styles.ultraHeader}>
          <View>
            <Text style={styles.ultraTitle}>Pruvi Ultra</Text>
            <Text style={styles.ultraPlanType}>Plano Individual</Text>
          </View>
          <View style={styles.ultraPriceArea}>
            <Text style={styles.ultraOldPrice}>R$ 49,90</Text>
            <View style={styles.ultraPriceRow}>
              <Text style={styles.ultraCurrency}>R$</Text>
              <Text style={styles.ultraPrice}>19,90</Text>
              <Text style={styles.ultraPeriod}>/mês</Text>
            </View>
          </View>
        </View>

        {/* Features */}
        <View style={styles.featuresList}>
          <View style={styles.featureRow}>
            <CheckCircleIcon />
            <Text style={styles.featureText}>
              Trilhas e Exercícios <Text style={styles.featureHighlight}>Ilimitados</Text>
            </Text>
          </View>
          <View style={styles.featureRow}>
            <CheckCircleIcon />
            <Text style={styles.featureText}>
              Simulados ENEM com correção <Text style={styles.featureHighlight}>TRI</Text>
            </Text>
          </View>
          <View style={styles.featureRow}>
            <CheckCircleIcon />
            <Text style={styles.featureText}>
              Revisão Inteligente via <Text style={styles.featureHighlight}>IA</Text>
            </Text>
          </View>
        </View>

        {/* CTA */}
        <Pressable style={({ pressed }) => [styles.ultraCTA, pressed && { opacity: 0.9 }]}>
          <Text style={styles.ultraCTAText}>Começar teste grátis</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AmigosCard() {
  return (
    <View style={styles.amigosCard}>
      {/* Title + Price */}
      <View style={styles.amigosHeader}>
        <View>
          <Text style={styles.amigosTitle}>Plano Amigos</Text>
          <Text style={styles.amigosPlanType}>Você + 3 Amigos</Text>
        </View>
        <View style={styles.amigosPriceArea}>
          <View style={styles.amigosPriceRow}>
            <Text style={styles.amigosCurrency}>R$</Text>
            <Text style={styles.amigosPrice}>39,90</Text>
            <Text style={styles.amigosPeriod}>/mês</Text>
          </View>
          <Text style={styles.amigosPerPerson}>R$ 9,97 por pessoa</Text>
        </View>
      </View>

      {/* Features */}
      <View style={styles.featuresList}>
        <View style={styles.featureRow}>
          <CheckCircleIcon />
          <Text style={styles.featureText}>
            Todos os recursos do Plano Ultra
          </Text>
        </View>
        <View style={styles.featureRow}>
          <CheckCircleIcon />
          <Text style={styles.featureText}>
            Acesso para <Text style={styles.featureHighlight}>4 pessoas</Text> simultâneas
          </Text>
        </View>
        <View style={styles.featureRow}>
          <CheckCircleIcon />
          <Text style={styles.featureText}>
            Rankings exclusivos de grupo
          </Text>
        </View>
      </View>

      {/* CTA */}
      <Pressable style={({ pressed }) => [styles.amigosCTA, pressed && { opacity: 0.9 }]}>
        <Text style={styles.amigosCTAText}>Obter Plano Amigos</Text>
      </Pressable>
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
    { label: "Premium", icon: <PremiumTabIcon />, active: true },
    { label: "Mais", icon: <MoreTabIcon /> },
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
              if (route && !tab.active) router.push(route as any);
            }}
          >
            {tab.icon}
            <Text style={tab.active ? styles.tabLabelActive : styles.tabLabel}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <HeroSection topInset={insets.top} />

        <View style={styles.cardsArea}>
          <UltraCard />
          <AmigosCard />

          {/* Terms */}
          <View style={styles.termsRow}>
            <Text style={styles.termsText}>Termos de Uso</Text>
            <Text style={styles.termsDot}>•</Text>
            <Text style={styles.termsText}>Política de Reembolso</Text>
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

  // ─── Hero ─────────────────────────────────────────────────────────────────
  hero: {
    height: 242,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#020618",
  },
  heroBlurGreen: {
    position: "absolute",
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: "rgba(88, 205, 4, 0.1)",
    top: -96,
    right: -20,
  },
  heroBlurOrange: {
    position: "absolute",
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: "rgba(255, 150, 0, 0.1)",
    bottom: -48,
    left: -48,
  },
  heroContent: {
    alignItems: "center",
    gap: 8,
  },
  heroTitle: {
    fontWeight: "900",
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: -1.6,
    textTransform: "uppercase",
    color: "#FFFFFF",
    textAlign: "center",
  },
  heroSubtitle: {
    fontWeight: "900",
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: "rgba(255, 255, 255, 0.4)",
    textAlign: "center",
  },

  // ─── Cards Area ───────────────────────────────────────────────────────────
  cardsArea: {
    marginTop: -48,
    paddingHorizontal: 24,
    gap: 24,
  },

  // ─── Ultra Card ───────────────────────────────────────────────────────────
  ultraCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(88, 205, 4, 0.2)",
    overflow: "hidden",
    shadowColor: "rgba(88, 205, 4, 0.1)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 50,
    elevation: 8,
  },
  ultraBanner: {
    backgroundColor: "#58CD04",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  ultraBannerLeft: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
  ultraTimer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ultraTimerText: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
  ultraBody: {
    padding: 28,
    gap: 28,
  },
  ultraHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  ultraTitle: {
    fontWeight: "900",
    fontSize: 24,
    lineHeight: 24,
    letterSpacing: -1.2,
    color: "#2B2B2B",
  },
  ultraPlanType: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(107, 107, 107, 0.7)",
    marginTop: 2,
  },
  ultraPriceArea: {
    alignItems: "flex-end",
  },
  ultraOldPrice: {
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(107, 107, 107, 0.4)",
    textDecorationLine: "line-through",
  },
  ultraPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  ultraCurrency: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    color: "#2B2B2B",
    marginRight: 2,
  },
  ultraPrice: {
    fontWeight: "900",
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: -1.6,
    color: "#2B2B2B",
  },
  ultraPeriod: {
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(107, 107, 107, 0.4)",
    marginLeft: 2,
  },

  // ─── Features ─────────────────────────────────────────────────────────────
  featuresList: {
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureText: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(43, 43, 43, 0.8)",
    flex: 1,
  },
  featureHighlight: {
    fontWeight: "900",
    color: "#58CD04",
  },

  // ─── Ultra CTA ────────────────────────────────────────────────────────────
  ultraCTA: {
    backgroundColor: "#58CD04",
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "rgba(88, 205, 4, 0.3)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 5,
  },
  ultraCTAText: {
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 25,
    letterSpacing: -0.9,
    color: "#FFFFFF",
    fontStyle: "italic",
  },

  // ─── Amigos Card ──────────────────────────────────────────────────────────
  amigosCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.6)",
    padding: 28,
    gap: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  amigosHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  amigosTitle: {
    fontWeight: "900",
    fontSize: 24,
    lineHeight: 24,
    letterSpacing: -1.2,
    color: "#2B2B2B",
  },
  amigosPlanType: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(107, 107, 107, 0.7)",
    marginTop: 2,
  },
  amigosPriceArea: {
    alignItems: "flex-end",
  },
  amigosPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  amigosCurrency: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    color: "#2B2B2B",
    marginRight: 2,
  },
  amigosPrice: {
    fontWeight: "900",
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: -1.6,
    color: "#2B2B2B",
  },
  amigosPeriod: {
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(107, 107, 107, 0.4)",
    marginLeft: 2,
  },
  amigosPerPerson: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#58CD04",
    marginTop: 2,
  },

  // ─── Amigos CTA ───────────────────────────────────────────────────────────
  amigosCTA: {
    backgroundColor: "#58CD04",
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "rgba(88, 205, 4, 0.3)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 5,
  },
  amigosCTAText: {
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 25,
    letterSpacing: -0.9,
    color: "#FFFFFF",
    fontStyle: "italic",
  },

  // ─── Terms ────────────────────────────────────────────────────────────────
  termsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
  },
  termsText: {
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(107, 107, 107, 0.5)",
    textDecorationLine: "underline",
  },
  termsDot: {
    fontWeight: "700",
    fontSize: 12,
    color: "rgba(107, 107, 107, 0.3)",
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
  tabItem: {
    alignItems: "center",
    gap: 4,
    minWidth: 50,
  },
  tabLabel: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: -0.5,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  tabLabelActive: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: -0.5,
    textTransform: "uppercase",
    color: "#58CD04",
  },
});
