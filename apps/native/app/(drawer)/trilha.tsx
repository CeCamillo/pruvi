import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path } from "react-native-svg";

// ─── Icons ───────────────────────────────────────────────────────────────────

function BiologyIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
      <Path
        d="M16 4c6 0 11 4 12 10s-2 12-8 14-13-1-15-7S10 4 16 4z"
        fill="#58CD04"
      />
      <Path
        d="M13 14c2-5 7-8 11-6s6 8 3 13-10 5-13 2-3-4-1-9z"
        fill="#FFFFFF"
        fillOpacity={0.3}
      />
    </Svg>
  );
}

function FireIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 1.33c-.17.7-.56 1.93-1.33 2.77C5.7 5.17 4.67 5.87 4.67 7.83c0 2.2 1.5 3.84 3.33 3.84s3.33-1.64 3.33-3.84c0-2.33-1.55-4.1-3.33-6.5z"
        fill="#FF9600"
      />
    </Svg>
  );
}

function LeafIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M13.33 2.67s-1.5 0-3.66.83C7.5 4.33 5 6.5 4.33 9.33c-.5 2.17 0 4 0 4s2.5-.17 4.17-1.5c1.67-1.33 3-3.5 3.33-5.16.34-1.67 1.5-4 1.5-4zM2.67 13.33l4-4"
        stroke="#58CD04"
        strokeWidth={1.33}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DropdownIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M4 6l4 4 4-4"
        stroke="#2B2B2B"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckmarkIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M9 16l5 5 9-9"
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function LockIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Path
        d="M9.33 12.83V9.33a4.67 4.67 0 019.34 0v3.5M7 14a2.33 2.33 0 012.33-2.33h9.34A2.33 2.33 0 0121 14v7a2.33 2.33 0 01-2.33 2.33H9.33A2.33 2.33 0 017 21v-7z"
        stroke="#6B6B6B"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.3}
      />
    </Svg>
  );
}

function AllSubjectsIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
      <Path
        d="M6 8h20v16a2 2 0 01-2 2H8a2 2 0 01-2-2V8z"
        fill="#58CC02"
      />
      <Path
        d="M6 8a2 2 0 012-2h16a2 2 0 012 2v3H6V8z"
        fill="#46A302"
      />
      <Path d="M12 16h8M12 20h5" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ChevronRightIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 6l6 6-6 6"
        stroke="#6B6B6B"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function HomeIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
        stroke="#2B2B2B"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 21V12h6v9"
        stroke="#2B2B2B"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TrailIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M3 17l4-4 4 4 4-4 4 4M3 12l4-4 4 4 4-4 4 4"
        stroke="#58CD04"
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
      <SvgCircle cx={12} cy={12} r={9} stroke="#2B2B2B" strokeWidth={2} />
      <Path d="M12 3v9l6 3" stroke="#2B2B2B" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function FriendsIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
        stroke="#2B2B2B"
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
      <SvgCircle cx={12} cy={5} r={1.5} fill="#2B2B2B" />
      <SvgCircle cx={12} cy={12} r={1.5} fill="#2B2B2B" />
      <SvgCircle cx={12} cy={19} r={1.5} fill="#2B2B2B" />
    </Svg>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

type TrailNode = {
  id: string;
  label: string;
  status: "completed" | "current" | "locked";
  size: "large" | "medium";
  offsetX: number;
};

type TrailUnit = {
  id: string;
  title: string;
  active: boolean;
  nodes: TrailNode[];
};

const TRAIL_UNITS: TrailUnit[] = [
  {
    id: "1",
    title: "Unidade 01 • Citologia",
    active: true,
    nodes: [
      { id: "1-1", label: "Introdução", status: "completed", size: "large", offsetX: 0 },
      { id: "1-2", label: "A Célula", status: "completed", size: "medium", offsetX: 56 },
      { id: "1-3", label: "Organelas", status: "locked", size: "medium", offsetX: -40 },
    ],
  },
  {
    id: "2",
    title: "Unidade 02 • Genética",
    active: false,
    nodes: [
      { id: "2-1", label: "", status: "locked", size: "medium", offsetX: 0 },
      { id: "2-2", label: "", status: "locked", size: "medium", offsetX: 48 },
    ],
  },
];

// ─── Components ──────────────────────────────────────────────────────────────

function TopSection({ topInset }: { topInset: number }) {
  return (
    <View style={[styles.topSection, { paddingTop: topInset }]}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.trailInfo}>
          <View style={styles.trailActiveLabel}>
            <Text style={styles.trailActiveLabelText}>Trilha Ativa</Text>
          </View>
          <View style={styles.trailNameRow}>
            <Text style={styles.trailName}>ENEM 2024</Text>
            <DropdownIcon />
          </View>
        </View>

        <View style={styles.headerBadges}>
          {/* Bio toggle */}
          <View style={styles.bioToggle}>
            <BiologyIcon />
            <View style={styles.toggleTrack}>
              <View style={styles.toggleThumb} />
            </View>
          </View>

          {/* Fire badge */}
          <View style={styles.badgeOrange}>
            <FireIcon />
            <Text style={styles.badgeOrangeText}>12</Text>
          </View>

          {/* Leaf badge */}
          <View style={styles.badgeGreen}>
            <LeafIcon />
            <Text style={styles.badgeGreenText}>2.4k</Text>
          </View>
        </View>
      </View>

      {/* All Subjects button */}
      <Pressable
        style={({ pressed }) => [
          styles.allSubjectsButton,
          pressed && { opacity: 0.9 },
        ]}
      >
        <View style={styles.allSubjectsLeft}>
          <View style={styles.allSubjectsIcon}>
            <AllSubjectsIcon />
          </View>
          <View style={styles.allSubjectsText}>
            <Text style={styles.allSubjectsTitle}>Todas as Matérias</Text>
            <Text style={styles.allSubjectsSubtitle}>Ver toda a trilha</Text>
          </View>
        </View>
        <ChevronRightIcon />
      </Pressable>
    </View>
  );
}

function TrailNodeCircle({
  node,
}: {
  node: TrailNode;
}) {
  const size = node.size === "large" ? 80 : 64;
  const innerPadding = node.size === "large" ? 24 : 18;

  if (node.status === "completed") {
    return (
      <View style={[styles.nodeWrapper, { marginLeft: node.offsetX }]}>
        {/* Outer rings for large node */}
        {node.size === "large" && (
          <>
            <View style={styles.outerRing} />
            <View style={styles.middleRing} />
          </>
        )}
        <View
          style={[
            styles.nodeCircle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: "#58CD04",
              borderBottomWidth: node.size === "large" ? 8 : 6,
              borderBottomColor: "rgba(88, 205, 4, 0.7)",
            },
          ]}
        >
          <CheckmarkIcon size={innerPadding + 4} />
        </View>
        {node.label ? (
          <View style={styles.nodeLabelPill}>
            <Text style={styles.nodeLabelText}>{node.label}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (node.status === "current") {
    return (
      <View style={[styles.nodeWrapper, { marginLeft: node.offsetX }]}>
        <View
          style={[
            styles.nodeCircle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: "#58CD04",
              borderBottomWidth: 6,
              borderBottomColor: "rgba(88, 205, 4, 0.7)",
            },
          ]}
        >
          <CheckmarkIcon size={innerPadding + 4} />
        </View>
        {node.label ? (
          <View style={styles.nodeLabelPill}>
            <Text style={styles.nodeLabelText}>{node.label}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  // locked
  return (
    <View style={[styles.nodeWrapper, { marginLeft: node.offsetX }]}>
      <View
        style={[
          styles.nodeCircle,
          styles.nodeCircleLocked,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        <LockIcon size={innerPadding + 4} />
      </View>
      {node.label ? (
        <View style={styles.nodeLabelPillLocked}>
          <Text style={styles.nodeLabelTextLocked}>{node.label}</Text>
        </View>
      ) : null}
    </View>
  );
}

function UnitBadge({ title, active }: { title: string; active: boolean }) {
  return (
    <View
      style={[
        styles.unitBadge,
        active ? styles.unitBadgeActive : styles.unitBadgeInactive,
      ]}
    >
      <Text
        style={[
          styles.unitBadgeText,
          active ? styles.unitBadgeTextActive : styles.unitBadgeTextInactive,
        ]}
      >
        {title}
      </Text>
    </View>
  );
}

function TrailPath() {
  return (
    <View style={styles.trailContainer}>
      {/* Center vertical line */}
      <View style={styles.centerLine} />

      {TRAIL_UNITS.map((unit, unitIndex) => (
        <View key={unit.id} style={styles.unitSection}>
          {/* Unit badge */}
          <View style={styles.unitBadgeContainer}>
            <UnitBadge title={unit.title} active={unit.active} />
          </View>

          {/* Nodes */}
          <View style={styles.nodesContainer}>
            {unit.nodes.map((node) => (
              <TrailNodeCircle key={node.id} node={node} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function BottomTabBar({ bottomInset }: { bottomInset: number }) {
  const tabs = [
    { label: "Home", icon: <HomeIcon />, active: false },
    { label: "Trilha", icon: <TrailIcon />, active: true },
    { label: "Roleta", icon: <RouletteIcon />, active: false },
    { label: "Amigos", icon: <FriendsIcon />, active: false },
    { label: "Mais", icon: <MoreIcon />, active: false },
  ];

  return (
    <View style={[styles.bottomBar, { paddingBottom: bottomInset }]}>
      <View style={styles.bottomBarContent}>
        {tabs.map((tab) => (
          <Pressable key={tab.label} style={styles.tabItem}>
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

export default function TrilhaScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <TopSection topInset={insets.top} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TrailPath />
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

  // ─── Top Section ──────────────────────────────────────────────────────────
  topSection: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(239, 236, 236, 0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  trailInfo: {
    gap: 2,
  },
  trailActiveLabel: {
    backgroundColor: "rgba(240, 240, 240, 0.4)",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  trailActiveLabelText: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  trailNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  trailName: {
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.4,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },
  headerBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 11,
  },
  bioToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(88, 205, 4, 0.1)",
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(88, 205, 4, 0.3)",
  },
  toggleTrack: {
    width: 32,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#58CD04",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-end",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  badgeOrange: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 150, 0, 0.1)",
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 9,
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
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(88, 205, 4, 0.2)",
  },
  badgeGreenText: {
    fontWeight: "900",
    fontSize: 12,
    lineHeight: 16,
    color: "#58CD04",
  },

  // ─── All Subjects Button ──────────────────────────────────────────────────
  allSubjectsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.4)",
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  allSubjectsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  allSubjectsIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#58CC02",
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 4,
    borderBottomColor: "#46A302",
    shadowColor: "rgba(88, 205, 4, 0.1)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 3,
  },
  allSubjectsText: {
    gap: 2,
  },
  allSubjectsTitle: {
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 23,
    color: "#1F2937",
  },
  allSubjectsSubtitle: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: -0.33,
    color: "#6B6B6B",
  },

  // ─── Trail Path ───────────────────────────────────────────────────────────
  trailContainer: {
    alignItems: "center",
    paddingTop: 40,
    minHeight: 700,
  },
  centerLine: {
    position: "absolute",
    top: 40,
    bottom: 0,
    width: 6,
    backgroundColor: "rgba(240, 240, 240, 0.3)",
    alignSelf: "center",
  },
  unitSection: {
    width: "100%",
    alignItems: "center",
    marginBottom: 32,
  },
  unitBadgeContainer: {
    alignItems: "center",
    marginBottom: 24,
    zIndex: 10,
  },
  unitBadge: {
    borderRadius: 20,
    paddingHorizontal: 26,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  unitBadgeActive: {
    backgroundColor: "rgba(88, 205, 4, 0.1)",
    borderWidth: 2,
    borderColor: "rgba(88, 205, 4, 0.2)",
  },
  unitBadgeInactive: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EFECEC",
  },
  unitBadgeText: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  unitBadgeTextActive: {
    color: "#58CD04",
  },
  unitBadgeTextInactive: {
    color: "#6B6B6B",
  },
  nodesContainer: {
    alignItems: "center",
    gap: 32,
  },

  // ─── Trail Nodes ──────────────────────────────────────────────────────────
  nodeWrapper: {
    alignItems: "center",
    gap: 8,
  },
  outerRing: {
    position: "absolute",
    width: 187,
    height: 187,
    borderRadius: 94,
    borderWidth: 6,
    borderColor: "rgba(88, 205, 4, 0.1)",
    top: -53,
    alignSelf: "center",
  },
  middleRing: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: "rgba(88, 205, 4, 0.2)",
    top: -8,
    alignSelf: "center",
  },
  nodeCircle: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(34, 197, 94, 0.3)",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 5,
  },
  nodeCircleLocked: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.4)",
    borderBottomWidth: 6,
    borderBottomColor: "rgba(239, 236, 236, 0.4)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  nodeLabelPill: {
    backgroundColor: "#FFFFFF",
    borderRadius: 9999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#EFECEC",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  nodeLabelText: {
    fontWeight: "900",
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },
  nodeLabelPillLocked: {
    backgroundColor: "#F0F0F0",
    borderRadius: 9999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 236, 236, 0.4)",
  },
  nodeLabelTextLocked: {
    fontWeight: "900",
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "rgba(107, 107, 107, 0.3)",
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
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },
  tabLabelActive: {
    fontWeight: "900",
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: "#58CD04",
  },
});
