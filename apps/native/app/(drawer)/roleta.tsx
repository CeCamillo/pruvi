import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Circle as SvgCircle,
  G,
  Path,
  Polygon,
  Rect,
} from "react-native-svg";

import { TrailHeader } from "./components/trail-header";

// ─── Icons ───────────────────────────────────────────────────────────────────

function DiceIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Rect x={4} y={4} width={20} height={20} rx={4} fill="white" fillOpacity={0.3} />
      <SvgCircle cx={10} cy={10} r={1.5} fill="white" />
      <SvgCircle cx={18} cy={10} r={1.5} fill="white" />
      <SvgCircle cx={14} cy={14} r={1.5} fill="white" />
      <SvgCircle cx={10} cy={18} r={1.5} fill="white" />
      <SvgCircle cx={18} cy={18} r={1.5} fill="white" />
    </Svg>
  );
}

function SettingsIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
        stroke="#6B6B6B"
        strokeWidth={1.5}
      />
      <Path
        d="M16.167 10c0-.475-.033-.943-.1-1.4l1.6-1.267-1.667-2.886-1.9.633a6.7 6.7 0 00-2.433-1.4L11.333 1.667H8l-.333 2.013a6.7 6.7 0 00-2.434 1.4l-1.9-.633L1.667 7.333l1.6 1.267a6.8 6.8 0 000 2.8l-1.6 1.267 1.666 2.886 1.9-.633a6.7 6.7 0 002.434 1.4l.333 2.013h3.333l.334-2.013a6.7 6.7 0 002.433-1.4l1.9.633 1.667-2.886-1.6-1.267c.066-.457.1-.925.1-1.4z"
        stroke="#6B6B6B"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TrophyIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
      <Path
        d="M22.667 5.603v.122c0 1.433 0 2.152-.345 2.738-.345.587-.974.935-2.228 1.634l-1.321.733c.91-3.08 1.215-6.39 1.327-9.22l.017-.368.003-.087c1.085.377 1.695.658 2.075 1.185.472.655.472 1.525.472 3.263z"
        fill="#FF9600"
      />
      <Path
        d="M9.333 5.603v.122c0 1.433 0 2.152.345 2.738.345.587.974.935 2.228 1.634l1.322.733c-.91-3.08-1.216-6.39-1.328-9.22l-.017-.368-.001-.087C11.095 1.532 10.485 1.813 10.105 2.34c-.472.655-.472 1.527-.472 3.263z"
        fill="#FF9600"
      />
      <Path
        d="M15.956-4.667c2.974 0 5.422.262 7.295.578 1.899.32 2.847.48 3.64 1.457.794.976.75 2.031.667 4.141-.287 7.249-1.85 16.3-10.352 17.1v5.891h2.384c.794 0 1.477.561 1.633 1.34l.317 1.577h4.416c.691 0 1.25.56 1.25 1.25s-.559 1.25-1.25 1.25H5.956c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25h4.417l.317-1.577c.155-.779.839-1.34 1.633-1.34h2.383V18.41c-8.5-.8-10.063-9.854-10.35-17.1-.085-2.11-.126-3.167.667-4.142.792-.976 1.74-1.136 3.638-1.456 2.412-.395 4.852-.588 7.295-.578z"
        fill="#FF9600"
      />
    </Svg>
  );
}

// ─── Tab Icons ───────────────────────────────────────────────────────────────

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
      <SvgCircle cx={12} cy={12} r={9} fill="#58CD04" />
      <Path d="M12 3v9M12 12l6.36 3.64M12 12L5.64 15.64M12 12l-3.64-6.36M12 12l3.64-6.36" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
      <SvgCircle cx={12} cy={12} r={2} fill="white" />
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
      <Path d="M3 8l4-4 5 3 5-3 4 4-3 8H6L3 8z" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 16h12v2a2 2 0 01-2 2H8a2 2 0 01-2-2v-2z" stroke="#6B6B6B" strokeWidth={1.5} />
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

// ─── Wheel Component ─────────────────────────────────────────────────────────

const WHEEL_COLORS = [
  "#4ADE80", // green
  "#3B82F6", // blue
  "#8B5CF6", // purple
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#84CC16", // lime
  "#EC4899", // pink
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

function RouletteWheel() {
  const size = 300;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const segmentAngle = 360 / WHEEL_COLORS.length;

  // Simple white icons per segment (approximated with basic shapes)
  const iconPositions = WHEEL_COLORS.map((_, i) => {
    const midAngle = i * segmentAngle + segmentAngle / 2;
    const iconR = r * 0.62;
    const pos = polarToCartesian(cx, cy, iconR, midAngle);
    return pos;
  });

  return (
    <View style={styles.wheelContainer}>
      {/* Pointer triangle at top */}
      <View style={styles.pointer}>
        <Svg width={24} height={20} viewBox="0 0 24 20">
          <Polygon points="12,20 0,0 24,0" fill="#2B2B2B" />
        </Svg>
      </View>

      {/* Outer shadow ring */}
      <View style={styles.wheelShadowRing}>
        {/* White border */}
        <View style={styles.wheelWhiteBorder}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Colored segments */}
            {WHEEL_COLORS.map((color, i) => (
              <Path
                key={i}
                d={describeArc(cx, cy, r, i * segmentAngle, (i + 1) * segmentAngle)}
                fill={color}
              />
            ))}
            {/* White icon dots (simplified) */}
            {iconPositions.map((pos, i) => (
              <G key={`icon-${i}`}>
                <SvgCircle cx={pos.x} cy={pos.y} r={12} fill="white" fillOpacity={0.3} />
                <SvgCircle cx={pos.x} cy={pos.y} r={6} fill="white" fillOpacity={0.6} />
              </G>
            ))}
            {/* Center hub */}
            <SvgCircle cx={cx} cy={cy} r={38} fill="white" stroke="rgba(240,240,240,0.2)" strokeWidth={4} />
            <SvgCircle cx={cx} cy={cy} r={12} fill="#F0F0F0" stroke="white" strokeWidth={1} />
          </Svg>
        </View>
      </View>
    </View>
  );
}

// ─── Components ──────────────────────────────────────────────────────────────

function MultiplicadorCard() {
  return (
    <View style={styles.multiplicadorCard}>
      <View style={styles.multiplicadorIcon}>
        <TrophyIcon />
      </View>
      <View style={styles.multiplicadorText}>
        <Text style={styles.multiplicadorTitle}>Multiplicador 2x</Text>
        <Text style={styles.multiplicadorSubtitle}>Pontos dobrados no próximo giro!</Text>
      </View>
    </View>
  );
}

const TAB_ROUTES: Record<string, string> = {
  Home: "/(drawer)",
  Trilha: "/(drawer)/trilha",
  Roleta: "/(drawer)/roleta",
};

function BottomTabBar({ bottomInset }: { bottomInset: number }) {
  const router = useRouter();
  const tabs = [
    { label: "Home", icon: <HomeTabIcon /> },
    { label: "Trilha", icon: <TrilhaTabIcon /> },
    { label: "Roleta", icon: <RouletteTabIcon />, active: true },
    { label: "Amigos", icon: <AmigosTabIcon /> },
    { label: "Premium", icon: <PremiumTabIcon /> },
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
            {tab.active ? (
              <>
                {tab.icon}
                <Text style={styles.tabLabelActive}>{tab.label}</Text>
              </>
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

export default function RoletaScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <TrailHeader toggleOn={false} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Roleta de Estudos</Text>
          <Text style={styles.subtitle}>O que vamos estudar agora?</Text>
        </View>

        {/* Wheel */}
        <RouletteWheel />

        {/* Buttons */}
        <View style={styles.buttonsSection}>
          <Pressable
            style={({ pressed }) => [
              styles.girarButton,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            <DiceIcon />
            <Text style={styles.girarButtonText}>GIRAR AGORA</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.personalizarButton,
              pressed && { opacity: 0.8 },
            ]}
          >
            <SettingsIcon />
            <Text style={styles.personalizarButtonText}>Personalizar Matérias</Text>
          </Pressable>

          <Text style={styles.custoText}>Custo: 1 ticket por giro</Text>
        </View>

        {/* Multiplicador card */}
        <View style={styles.cardSection}>
          <MultiplicadorCard />
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
    paddingBottom: 40,
  },

  // ─── Title ────────────────────────────────────────────────────────────────
  titleSection: {
    alignItems: "center",
    paddingTop: 32,
    paddingHorizontal: 24,
    gap: 4,
  },
  title: {
    fontWeight: "900",
    fontSize: 24,
    lineHeight: 24,
    letterSpacing: -1.2,
    textTransform: "uppercase",
    color: "#2B2B2B",
    textAlign: "center",
  },
  subtitle: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: "#6B6B6B",
    textAlign: "center",
  },

  // ─── Wheel ────────────────────────────────────────────────────────────────
  wheelContainer: {
    alignItems: "center",
    marginTop: 24,
    marginBottom: 16,
  },
  pointer: {
    zIndex: 10,
    marginBottom: -6,
  },
  wheelShadowRing: {
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "rgba(0,0,0,0.03)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 40 },
    shadowOpacity: 0.18,
    shadowRadius: 80,
    elevation: 10,
  },
  wheelWhiteBorder: {
    width: 316,
    height: 316,
    borderRadius: 158,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 8,
    borderColor: "#FFFFFF",
    overflow: "hidden",
  },

  // ─── Buttons ──────────────────────────────────────────────────────────────
  buttonsSection: {
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 16,
  },
  girarButton: {
    width: 280,
    height: 64,
    backgroundColor: "#58CD04",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderBottomWidth: 6,
    borderBottomColor: "#46A302",
    shadowColor: "rgba(88, 205, 4, 0.2)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 25,
    elevation: 8,
  },
  girarButtonText: {
    fontWeight: "900",
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
  personalizarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(240, 240, 240, 0.5)",
    borderRadius: 16,
    paddingHorizontal: 25,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "rgba(239, 236, 236, 0.5)",
  },
  personalizarButtonText: {
    fontWeight: "900",
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  custoText: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(107, 107, 107, 0.5)",
  },

  // ─── Multiplicador Card ───────────────────────────────────────────────────
  cardSection: {
    paddingHorizontal: 24,
    marginTop: 32,
  },
  multiplicadorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.5)",
    padding: 22,
    gap: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  multiplicadorIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(255, 150, 0, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 150, 0, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  multiplicadorText: {
    flex: 1,
    gap: 2,
  },
  multiplicadorTitle: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.35,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },
  multiplicadorSubtitle: {
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 18,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "#6B6B6B",
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
