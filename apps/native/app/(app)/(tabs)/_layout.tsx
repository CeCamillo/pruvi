import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle as SvgCircle, Path } from "react-native-svg";

// ─── Icons ───────────────────────────────────────────────────────────────────

function HomeIcon({ active }: { active: boolean }) {
  const stroke = active ? "#58CD04" : "#6B6B6B";
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
        fill={active ? "#58CD04" : "none"}
        fillOpacity={active ? 0.15 : 0}
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 21V12h6v9"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TrophyIcon({ active }: { active: boolean }) {
  const stroke = active ? "#58CD04" : "#6B6B6B";
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16 6V4H8v2M16 6h4v3a4 4 0 01-4 4M8 6H4v3a4 4 0 004 4M12 13c-2.2 0-4-1.8-4-4V6h8v3c0 2.2-1.8 4-4 4zM12 13v4M9 20h6v-3H9v3z"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function UserIcon({ active }: { active: boolean }) {
  const stroke = active ? "#58CD04" : "#6B6B6B";
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx={12} cy={8} r={4} stroke={stroke} strokeWidth={2} />
      <Path
        d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ─── Custom Tab Bar Item ─────────────────────────────────────────────────────

function TabBarItem({
  label,
  active,
  icon,
}: {
  label: string;
  active: boolean;
  icon: React.ReactNode;
}) {
  if (active) {
    return (
      <View style={styles.tabActiveContainer}>
        {icon}
        <Text style={styles.tabLabelActive}>{label}</Text>
      </View>
    );
  }
  return (
    <View style={styles.tabItem}>
      {icon}
      <Text style={styles.tabLabel}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: { paddingTop: 6 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarItem
              label="Home"
              active={focused}
              icon={<HomeIcon active={focused} />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarItem
              label="Progresso"
              active={focused}
              icon={<TrophyIcon active={focused} />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarItem
              label="Perfil"
              active={focused}
              icon={<UserIcon active={focused} />}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(239, 236, 236, 0.6)",
    height: 78,
    paddingTop: 8,
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
    lineHeight: 13,
    color: "#6B6B6B",
  },
  tabLabelActive: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 13,
    color: "#58CD04",
  },
});
