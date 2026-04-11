import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Circle as SvgCircle,
  Path,
} from "react-native-svg";

import { SubjectHeader } from "./components/subject-header";
import { TrailHeader } from "./components/trail-header";
import { TrailPath } from "./components/trail-path";

import type { TrailUnit } from "./components/trail-path";

// ─── Icons ──────────────────────────────────────────────────────────────────

function BiologiaIcon() {
  return (
    <View style={styles.subjectIconBox}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M7 20s1.5-2 5-2 5 2 5 2M12 4c3 0 6 2 7 5s-1 7-4 8-8 0-9-4S9 4 12 4z"
          stroke="white"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </Svg>
    </View>
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

const BIOLOGIA_UNITS: TrailUnit[] = [
  {
    id: "1",
    title: "Unidade 01 \u2022 Citologia",
    active: true,
    nodes: [
      { id: "1-1", label: "Introdu\u00e7\u00e3o", status: "completed", size: 80, icon: "play", positionX: "center" },
      { id: "1-2", label: "A C\u00e9lula", status: "completed", size: 64, icon: "star", positionX: "right" },
      { id: "1-3", label: "Organelas", status: "locked", size: 64, icon: "lock", positionX: "left" },
    ],
  },
  {
    id: "2",
    title: "Unidade 02 \u2022 Gen\u00e9tica",
    active: false,
    nodes: [
      { id: "2-1", label: "", status: "locked", size: 64, icon: "lock", positionX: "center" },
      { id: "2-2", label: "", status: "locked", size: 80, icon: "trophy", positionX: "center" },
    ],
  },
];

// ─── Bottom Tab Bar ─────────────────────────────────────────────────────────

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
        <SubjectHeader
          subjectIcon={<BiologiaIcon />}
          subjectName="Biologia"
        />
      </TrailHeader>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TrailPath units={BIOLOGIA_UNITS} />
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

  // ─── Subject Icon ──────────────────────────────────────────────────────────
  subjectIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#58CD04",
    alignItems: "center",
    justifyContent: "center",
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
