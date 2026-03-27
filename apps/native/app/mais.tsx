import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path, Rect } from "react-native-svg";

// ─── Menu Item Icons ─────────────────────────────────────────────────────────

function PerfilIcon() {
  return (
    <View style={[styles.menuIconBox, { backgroundColor: "rgba(88, 205, 4, 0.1)" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <SvgCircle cx={12} cy={8} r={4} fill="#58CD04" />
        <Path d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6" fill="#58CD04" />
      </Svg>
    </View>
  );
}

function ProgressoIcon() {
  return (
    <View style={[styles.menuIconBox, { backgroundColor: "#DCFCE7" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path d="M12 2l2.09 6.26L20.18 9l-5 4.27L16.82 20 12 16.9 7.18 20l1.64-6.73L3.82 9l6.09-.74L12 2z" fill="#84CC16" />
      </Svg>
    </View>
  );
}

function SimuladosIcon() {
  return (
    <View style={[styles.menuIconBox, { backgroundColor: "#DBEAFE" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Rect x={4} y={3} width={16} height={18} rx={3} fill="#1CB0F6" />
        <Path d="M8 8h8M8 12h8M8 16h5" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function FlashcardsIcon() {
  return (
    <View style={[styles.menuIconBox, { backgroundColor: "#F3E8FF" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Rect x={2} y={6} width={20} height={4} rx={1} fill="#CE82FF" />
        <Rect x={2} y={12} width={20} height={4} rx={1} fill="#CE82FF" fillOpacity={0.6} />
        <Rect x={2} y={18} width={20} height={4} rx={1} fill="#CE82FF" fillOpacity={0.3} />
      </Svg>
    </View>
  );
}

function SonsIcon() {
  return (
    <View style={[styles.menuIconBox, { backgroundColor: "#FFEDD4" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path d="M11 5L6 9H2v6h4l5 4V5z" fill="#FF6900" />
        <Path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" stroke="#FF6900" strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function AjudaIcon() {
  return (
    <View style={[styles.menuIconBox, { backgroundColor: "#F0F0F0" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <SvgCircle cx={12} cy={12} r={9} stroke="#6B6B6B" strokeWidth={1.5} />
        <Path d="M9.5 9.5a2.5 2.5 0 014.5 1.5c0 1.5-2.5 2-2.5 2" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" />
        <SvgCircle cx={12} cy={17} r={0.75} fill="#6B6B6B" />
      </Svg>
    </View>
  );
}

function FeedbackIcon() {
  return (
    <View style={[styles.menuIconBox, { backgroundColor: "#F0F0F0" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function SairIcon() {
  return (
    <View style={[styles.menuIconBox, { backgroundColor: "rgba(255, 75, 75, 0.1)" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="#FF4B4B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function ChevronRight() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M7.5 4.17l5 5.83-5 5.83" stroke="#6B6B6B" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

const moreStyles = StyleSheet.create({
  onBadge: {
    backgroundColor: "#58CD04",
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  onBadgeText: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: -0.5,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
});

type MenuItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  color?: string;
  trailing?: React.ReactNode;
  route?: string;
};

const MENU_ITEMS: MenuItem[] = [
  { id: "perfil", label: "Perfil", icon: <PerfilIcon />, trailing: <ChevronRight />, route: "/(drawer)/profile" },
  { id: "progresso", label: "Progresso", icon: <ProgressoIcon />, trailing: <ChevronRight /> },
  { id: "simulados", label: "Simulados", icon: <SimuladosIcon />, trailing: <ChevronRight /> },
  { id: "flashcards", label: "Flashcards", icon: <FlashcardsIcon />, trailing: <ChevronRight /> },
  {
    id: "sons",
    label: "Sons",
    icon: <SonsIcon />,
    trailing: (
      <View style={moreStyles.onBadge}>
        <Text style={moreStyles.onBadgeText}>On</Text>
      </View>
    ),
  },
];

const SECONDARY_ITEMS: MenuItem[] = [
  { id: "ajuda", label: "Ajuda & Suporte", icon: <AjudaIcon />, color: "rgba(43, 43, 43, 0.7)" },
  { id: "feedback", label: "Feedbacks", icon: <FeedbackIcon />, color: "rgba(43, 43, 43, 0.7)" },
  { id: "sair", label: "Sair", icon: <SairIcon />, color: "#FF4B4B" },
];

// ─── Component ───────────────────────────────────────────────────────────────

function MenuRow({ item, onPress }: { item: MenuItem; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}>
      {item.icon}
      <Text style={[styles.menuLabel, item.color ? { color: item.color } : undefined]}>{item.label}</Text>
      {item.trailing && <View style={styles.menuTrailing}>{item.trailing}</View>}
    </Pressable>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function MaisScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Dark overlay */}
      <Pressable style={styles.overlay} onPress={() => router.back()} />

      {/* Bottom sheet */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        {/* Handle bar */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Menu items */}
        <View style={styles.menuList}>
          {MENU_ITEMS.map((item) => (
            <MenuRow
              key={item.id}
              item={item}
              onPress={item.route ? () => router.push(item.route as any) : undefined}
            />
          ))}

          {/* Separator */}
          <View style={styles.separator} />

          {SECONDARY_ITEMS.map((item) => (
            <MenuRow key={item.id} item={item} />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },

  // ─── Overlay ──────────────────────────────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },

  // ─── Sheet ────────────────────────────────────────────────────────────────
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 0.15,
    shadowRadius: 60,
    elevation: 20,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  handle: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(240, 240, 240, 0.4)",
  },

  // ─── Menu List ────────────────────────────────────────────────────────────
  menuList: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 72,
    borderRadius: 16,
    gap: 16,
  },
  menuIconBox: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontWeight: "900",
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: -0.38,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },
  menuTrailing: {
    marginLeft: "auto",
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(239, 236, 236, 0.4)",
    marginHorizontal: -8,
    marginVertical: 8,
  },
});
