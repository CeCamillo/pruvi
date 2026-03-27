import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Circle as SvgCircle,
  Path,
} from "react-native-svg";

import { TrailHeader } from "./components/trail-header";

// ─── Icons (extracted from Figma SVGs) ───────────────────────────────────────

function PlayIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 80 80" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M52.545 31.957a5.33 5.33 0 010 9.059L35.463 50.305c-2.75 1.497-6.13-.45-6.13-3.528V26.197c0-3.08 3.38-4.945 6.13-3.45l17.082 9.21z"
        fill="white"
      />
    </Svg>
  );
}

function StarIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 74 74" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M33.659 22.332c1.487-2.666 2.23-3.999 3.341-3.999 1.111 0 1.854 1.333 3.341 3.999l.385.69c.422.758.633 1.137.962 1.387.329.25.74.342 1.561.528l.746.169c2.887.654 4.329.98 4.673 2.084.343 1.103-.64 2.254-2.608 4.555l-.509.595c-.559.654-.839.98-.965 1.384-.125.404-.083.841 0 1.713l.077.794c.297 3.071.446 4.606-.453 5.287-.899.682-2.251.06-4.952-1.184l-.7-.322c-.768-.354-1.151-.531-1.558-.531-.407 0-.79.177-1.558.531l-.7.322c-2.703 1.244-4.054 1.866-4.953 1.185-.9-.683-.751-2.218-.454-5.289l.078-.793c.084-.872.127-1.308 0-1.712-.125-.405-.405-.731-.963-1.385l-.51-.594c-1.967-2.3-2.95-3.451-2.608-4.555.343-1.104 1.788-1.43 4.674-2.084l.746-.169c.82-.186 1.23-.278 1.56-.528.33-.25.54-.629.962-1.387l.385-.69z"
        fill="white"
      />
    </Svg>
  );
}

function LockIcon({ size = 64 }: { size?: number }) {
  const scale = size / 64;
  return (
    <Svg width={size} height={size} viewBox="0 0 70 70" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M27.125 29.731V27.333a7.875 7.875 0 0115.75 0v2.398c1.3.097 2.147.342 2.766.962C46.667 31.717 46.667 33.367 46.667 36.667c0 3.299 0 4.95-1.026 5.974-1.024 1.026-2.675 1.026-5.974 1.026H30.333c-3.299 0-4.95 0-5.974-1.026-1.026-1.024-1.026-2.675-1.026-5.974 0-3.3 0-4.95 1.026-5.975.618-.62 1.465-.865 2.766-.962zM28.875 27.333a6.125 6.125 0 0112.25 0v2.338c-.447-.004-.933-.005-1.458-.005h-9.334c-.526-.001-1.013 0-1.458.004v-2.337z"
        fill="#6B6B6B"
      />
    </Svg>
  );
}

function TrophyIcon() {
  return (
    <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M26.667 8.603V8.725c0 1.433 0 2.152-.345 2.738-.345.587-.974.935-2.228 1.634l-1.321.733c.91-3.08 1.215-6.39 1.327-9.22l.017-.368.003-.087c1.085.377 1.695.658 2.075 1.185.472.655.472 1.525.472 3.263z"
        fill="#6B6B6B"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.333 8.603V8.725c0 1.433 0 2.152.345 2.738.345.587.974.935 2.228 1.634l1.322.733c-.91-3.08-1.216-6.39-1.328-9.22l-.017-.368-.001-.087c-1.087.377-1.697.658-2.077 1.185-.472.655-.472 1.527-.472 3.263z"
        fill="#6B6B6B"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M19.956 -1.667c2.974 0 5.422.262 7.295.578 1.899.32 2.847.48 3.64 1.457.794.976.75 2.031.667 4.141-.287 7.249-1.85 16.3-10.352 17.1v5.891h2.384c.794 0 1.477.561 1.633 1.34l.317 1.577h4.416c.691 0 1.25.56 1.25 1.25s-.559 1.25-1.25 1.25H9.956c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25h4.417l.317-1.577c.155-.779.839-1.34 1.633-1.34h2.383v-5.89c-8.5-.8-10.063-9.854-10.35-17.1-.085-2.11-.126-3.167.667-4.142.792-.976 1.74-1.136 3.638-1.456 2.412-.395 4.852-.588 7.295-.578zm1.587 6.998l-.163-.293c-.634-1.138-.95-1.705-1.424-1.705-.473 0-.79.567-1.423 1.705l-.163.293c-.18.324-.27.484-.41.59-.142.107-.317.147-.667.226l-.317.073c-1.23.278-1.845.417-1.991.887-.147.47.273.962 1.111 1.942l.217.253c.238.279.358.417.412.59.053.174.035.359 0 .731l-.034.338c-.126 1.308-.19 1.963.192 2.253.383.29.96.025 2.112-.44l.296-.137c.329-.15.492-.225.665-.225s.337.075.665.225l.297.137c1.152.466 1.728.731 2.112.44.383-.29.318-.945.191-2.253l-.033-.338c-.035-.372-.053-.557 0-.73.053-.174.173-.312.412-.591l.216-.253c.839-.98 1.258-1.471 1.112-1.941-.147-.47-.762-.61-1.992-.887l-.316-.073c-.35-.08-.525-.12-.667-.226-.14-.107-.23-.267-.41-.591l-.18-.324z"
        fill="#6B6B6B"
      />
    </Svg>
  );
}

function AllSubjectsIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 56 56" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17.563 4.229C16 5.791 16 8.306 16 13.333v5.334c0 5.028 0 7.543 1.563 9.104C19.125 29.332 21.639 29.333 26.667 29.333h2.666c5.028 0 7.543 0 9.104-1.562C40 26.209 40 23.695 40 18.667v-5.334c0-5.028 0-7.542-1.563-9.104C36.876 2.668 34.361 2.667 29.333 2.667h-2.666c-5.028 0-7.542 0-9.104 1.562zM21.667 10.667a1 1 0 011-1h10.666a1 1 0 110 2H22.667a1 1 0 01-1-1zm0 5.333a1 1 0 011-1h10.666a1 1 0 110 2H22.667a1 1 0 01-1-1zm1 4.333a1 1 0 100 2h6.666a1 1 0 100-2h-6.666z"
        fill="white"
      />
    </Svg>
  );
}

function ChevronDownIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 9l6 6 6-6"
        stroke="#6B6B6B"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function HomeTabIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
        stroke="#2B2B2B"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M9 21V12h6v9" stroke="#2B2B2B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TrailTabIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M3.33 16.67c1.67-3.34 5-6.67 6.67-3.34s5 3.33 6.67 0"
        stroke="#58CD04"
        strokeWidth={1.67}
        strokeLinecap="round"
      />
      <Path
        d="M3.33 11.67c1.67-3.34 5-6.67 6.67-3.34s5 3.33 6.67 0"
        stroke="#58CD04"
        strokeWidth={1.67}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function RouletteTabIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx={12} cy={12} r={9} stroke="#2B2B2B" strokeWidth={1.5} />
      <Path d="M12 3v9l6 3" stroke="#2B2B2B" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function FriendsTabIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
        stroke="#2B2B2B"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MoreTabIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx={5} cy={12} r={2} fill="#2B2B2B" />
      <SvgCircle cx={12} cy={12} r={2} fill="#2B2B2B" />
      <SvgCircle cx={19} cy={12} r={2} fill="#2B2B2B" />
    </Svg>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

type TrailNode = {
  id: string;
  label: string;
  status: "completed" | "locked";
  size: number;
  icon: "play" | "star" | "lock" | "trophy";
  positionX: "left" | "center" | "right";
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
      { id: "1-1", label: "Introdução", status: "completed", size: 80, icon: "play", positionX: "center" },
      { id: "1-2", label: "A Célula", status: "completed", size: 64, icon: "star", positionX: "right" },
      { id: "1-3", label: "Organelas", status: "locked", size: 64, icon: "lock", positionX: "left" },
    ],
  },
  {
    id: "2",
    title: "Unidade 02 • Genética",
    active: false,
    nodes: [
      { id: "2-1", label: "", status: "locked", size: 64, icon: "lock", positionX: "center" },
      { id: "2-2", label: "", status: "locked", size: 80, icon: "trophy", positionX: "center" },
    ],
  },
];

// ─── Components ──────────────────────────────────────────────────────────────

function AllSubjectsButton() {
  return (
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
      <ChevronDownIcon />
    </Pressable>
  );
}

function NodeIcon({ icon, size }: { icon: TrailNode["icon"]; size: number }) {
  switch (icon) {
    case "play":
      return <PlayIcon />;
    case "star":
      return <StarIcon />;
    case "trophy":
      return <TrophyIcon />;
    case "lock":
      return <LockIcon size={size * 0.55} />;
  }
}

function TrailNodeCircle({ node }: { node: TrailNode }) {
  const isCompleted = node.status === "completed";
  const isLarge = node.size === 80;

  // Horizontal offset for zigzag pattern
  const offsetX =
    node.positionX === "left" ? -60 :
    node.positionX === "right" ? 60 : 0;

  return (
    <View style={[styles.nodeWrapper, { marginLeft: offsetX }]}>
      {/* Outer concentric rings for large completed node */}
      {isLarge && isCompleted && (
        <>
          <View style={styles.outerRing} />
          <View style={styles.middleRing} />
        </>
      )}

      {/* The node circle */}
      <Pressable
        style={[
          styles.nodeCircle,
          {
            width: node.size,
            height: node.size,
            borderRadius: node.size / 2,
          },
          isCompleted
            ? {
                backgroundColor: "#58CD04",
                shadowColor: "rgba(34, 197, 94, 0.3)",
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 1,
                shadowRadius: 24,
                elevation: 5,
              }
            : node.icon === "trophy"
            ? {
                backgroundColor: "rgba(240, 240, 240, 0.3)",
                borderWidth: 2,
                borderColor: "rgba(107, 107, 107, 0.3)",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 3,
                elevation: 2,
              }
            : {
                backgroundColor: "#FFFFFF",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 3,
                elevation: 2,
              },
        ]}
      >
        {/* Bottom "3D" effect for completed */}
        {isCompleted && (
          <View
            style={[
              styles.nodeBottomEdge,
              {
                width: node.size,
                height: isLarge ? 8 : 6,
                borderBottomLeftRadius: node.size / 2,
                borderBottomRightRadius: node.size / 2,
              },
            ]}
          />
        )}
        {/* Bottom edge for locked */}
        {!isCompleted && node.icon !== "trophy" && (
          <View
            style={[
              styles.nodeBottomEdgeLocked,
              {
                width: node.size,
                height: 6,
                borderBottomLeftRadius: node.size / 2,
                borderBottomRightRadius: node.size / 2,
              },
            ]}
          />
        )}
        <NodeIcon icon={node.icon} size={node.size} />
      </Pressable>

      {/* Label pill */}
      {node.label ? (
        <View
          style={[
            styles.nodeLabelPill,
            !isCompleted && styles.nodeLabelPillLocked,
          ]}
        >
          <Text
            style={[
              styles.nodeLabelText,
              !isCompleted && styles.nodeLabelTextLocked,
            ]}
          >
            {node.label}
          </Text>
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
      {/* Center vertical dotted line */}
      <View style={styles.centerLine} />

      {TRAIL_UNITS.map((unit) => (
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

const TAB_ROUTES: Record<string, string> = {
  Home: "/(drawer)",
  Trilha: "/(drawer)/trilha",
  Roleta: "/(drawer)/roleta",
  Amigos: "/(drawer)/amigos",
};

function BottomTabBar({ bottomInset }: { bottomInset: number }) {
  const router = useRouter();
  const tabs = [
    { label: "Home", icon: <HomeTabIcon />, active: false },
    { label: "Trilha", icon: <TrailTabIcon />, active: true },
    { label: "Roleta", icon: <RouletteTabIcon />, active: false },
    { label: "Amigos", icon: <FriendsTabIcon />, active: false },
    { label: "Mais", icon: <MoreTabIcon />, active: false },
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

export default function TrilhaScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <TrailHeader toggleOn>
        <AllSubjectsButton />
      </TrailHeader>

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
    shadowColor: "rgba(88, 205, 4, 0.1)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 3,
    // Bottom 3D edge
    borderBottomWidth: 4,
    borderBottomColor: "#46A302",
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
    paddingBottom: 40,
  },
  centerLine: {
    position: "absolute",
    top: 40,
    bottom: 0,
    width: 6,
    backgroundColor: "rgba(240, 240, 240, 0.3)",
    alignSelf: "center",
    borderRadius: 3,
  },
  unitSection: {
    width: "100%",
    alignItems: "center",
    marginBottom: 40,
  },
  unitBadgeContainer: {
    alignItems: "center",
    marginBottom: 32,
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
    gap: 40,
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
    zIndex: -1,
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
    zIndex: -1,
  },
  nodeCircle: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  nodeBottomEdge: {
    position: "absolute",
    bottom: 0,
    backgroundColor: "rgba(88, 205, 4, 0.7)",
  },
  nodeBottomEdgeLocked: {
    position: "absolute",
    bottom: 0,
    backgroundColor: "rgba(239, 236, 236, 0.4)",
    borderTopWidth: 2,
    borderTopColor: "rgba(239, 236, 236, 0.4)",
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
  nodeLabelPillLocked: {
    backgroundColor: "#F0F0F0",
    borderColor: "rgba(239, 236, 236, 0.4)",
    shadowOpacity: 0,
    elevation: 0,
  },
  nodeLabelText: {
    fontWeight: "900",
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },
  nodeLabelTextLocked: {
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
