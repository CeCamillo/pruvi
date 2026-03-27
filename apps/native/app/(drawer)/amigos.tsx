import { useRouter } from "expo-router";
import { Image, type ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path, Rect } from "react-native-svg";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const avatarAna = require("@/assets/images/avatar-ana.png") as ImageSourcePropType;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const avatarCarlos = require("@/assets/images/avatar-carlos.png") as ImageSourcePropType;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const avatarMaria = require("@/assets/images/avatar-maria.png") as ImageSourcePropType;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const avatarJoao = require("@/assets/images/avatar-joao.png") as ImageSourcePropType;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const avatarAlice = require("@/assets/images/avatar-alice.png") as ImageSourcePropType;

// ─── Icons ───────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M9.167 15.833a6.667 6.667 0 100-13.333 6.667 6.667 0 000 13.333zM17.5 17.5l-3.625-3.625"
        stroke="#6B6B6B"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function FireIcon({ size = 12 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path
        d="M6 1c-.13.53-.42 1.45-1 2.08C4.28 3.88 3.5 4.4 3.5 5.87c0 1.65 1.13 2.88 2.5 2.88s2.5-1.23 2.5-2.88C8.5 4.13 7.34 2.8 6 1z"
        fill="#FF9600"
      />
    </Svg>
  );
}

function LeafIcon({ size = 12 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path
        d="M10 2s-1.13 0-2.75.63C5.63 3.25 3.75 4.88 3.25 7c-.38 1.63 0 3 0 3s1.88-.13 3.13-1.13c1.25-1 2.25-2.63 2.5-3.87.25-1.25 1.12-3 1.12-3zM2 10l3-3"
        stroke="#58CD04"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PersonAddIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M13.333 17.5v-1.667a3.333 3.333 0 00-3.333-3.333H5a3.333 3.333 0 00-3.333 3.333V17.5M7.5 9.167a3.333 3.333 0 100-6.667 3.333 3.333 0 000 6.667zM16.667 6.667v5M14.167 9.167h5"
        stroke="#FFFFFF"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TrophySmallIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Path
        d="M19.833 4.667v.1c0 1.15 0 1.72-.276 2.19-.276.47-.78.748-1.783 1.31l-1.057.587c.728-2.464.972-5.112 1.062-7.376l.013-.294.003-.07a4.7 4.7 0 011.66.948c.378.524.378 1.22.378 2.61z"
        fill="#FF9600"
      />
      <Path
        d="M8.167 4.667v.1c0 1.15 0 1.72.276 2.19.276.47.78.748 1.782 1.31l1.058.587c-.728-2.464-.973-5.112-1.063-7.376l-.013-.294-.001-.07A4.7 4.7 0 008.545 2.06c-.378.524-.378 1.222-.378 2.61z"
        fill="#FF9600"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.965-2.333c2.38 0 4.338.21 5.836.462 1.52.256 2.278.384 2.912 1.166.635.781.6 1.625.534 3.313-.23 5.799-1.48 13.04-8.282 13.68v4.712h1.907c.635 0 1.182.449 1.307 1.072l.253 1.262h3.534c.552 0 1 .448 1 1s-.448 1-1 1H6.365c-.553 0-1-.448-1-1s.447-1 1-1h3.533l.254-1.262c.124-.623.67-1.072 1.306-1.072h1.907v-4.713c-6.8-.64-8.05-7.883-8.28-13.68-.068-1.688-.101-2.534.533-3.314.634-.78 1.392-.909 2.91-1.165 1.93-.316 3.882-.47 5.837-.462zm1.27 5.598l-.131-.234c-.507-.91-.76-1.364-1.139-1.364-.378 0-.632.454-1.139 1.364l-.13.235c-.144.259-.216.387-.328.471-.114.086-.254.118-.534.14l-.253.058c-.984.222-1.476.334-1.593.71-.117.375.218.769.889 1.553l.174.202c.19.223.286.334.33.471.042.14.028.287 0 .581l-.027.27c-.1 1.047-.152 1.571.153 1.803.306.232.768.02 1.69-.352l.236-.109c.263-.12.395-.18.526-.18.14 0 .27.06.527.18l.236.109c.924.372 1.385.584 1.691.352.307-.232.254-.756.153-1.802l-.027-.271c-.028-.294-.042-.441 0-.581.042-.137.139-.248.329-.471l.173-.202c.671-.784 1.007-1.178.889-1.553-.116-.376-.608-.488-1.593-.71l-.253-.058c-.28-.022-.42-.054-.534-.14a.9.9 0 01-.328-.471l-.144-.259z"
        fill="#FF9600"
      />
    </Svg>
  );
}

function ChevronRightSmall() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d="M6 4l4 4-4 4" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
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
      <SvgCircle cx={9} cy={7} r={3} fill="#58CD04" fillOpacity={0.15} stroke="#58CD04" strokeWidth={1.5} />
      <SvgCircle cx={15} cy={7} r={2} stroke="#58CD04" strokeWidth={1.5} />
      <Path d="M3 19c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#58CD04" strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M15 13c2.761 0 5 2.239 5 5" stroke="#58CD04" strokeWidth={1.5} strokeLinecap="round" />
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

// ─── Data ────────────────────────────────────────────────────────────────────

const FRIENDS = [
  { id: "1", name: "Ana Beatriz", streak: "12 Dias", xp: "2.4k XP", rank: 1, avatar: avatarAna },
  { id: "2", name: "Carlos Lima", streak: "0 Dias", xp: "1.1k XP", rank: 2, avatar: avatarCarlos },
];

const SUGGESTIONS = [
  { id: "1", name: "Maria Clara", tag: "ESTUDANTE DE MED", avatar: avatarMaria },
  { id: "2", name: "João Victor", tag: "FOCO ENEM", avatar: avatarJoao },
  { id: "3", name: "Alice Rocha", tag: "EXATAS", avatar: avatarAlice },
];

// ─── Components ──────────────────────────────────────────────────────────────

function InviteCard() {
  return (
    <View style={styles.inviteCard}>
      <View style={styles.inviteTextArea}>
        <Text style={styles.inviteTitle}>Convide amigos e suba junto! 🚀</Text>
        <Text style={styles.inviteDescription}>
          "Estudar em grupo aumenta em até 3x o engajamento e a retenção de conteúdo."
        </Text>
      </View>

      <View style={styles.inviteActions}>
        <Pressable style={({ pressed }) => [styles.findButton, pressed && { opacity: 0.9 }]}>
          <PersonAddIcon />
          <Text style={styles.findButtonText}>Encontrar Amigos</Text>
        </Pressable>

        <View style={styles.codeBox}>
          <View style={styles.codeLabel}>
            <Text style={styles.codeLabelText}>Seu Código</Text>
          </View>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>PRUVI-GK2024</Text>
            <Pressable style={styles.copyButton}>
              <Text style={styles.copyButtonText}>Copiar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function MissionCard() {
  return (
    <View style={styles.missionCard}>
      <View style={styles.missionIcon}>
        <TrophySmallIcon />
      </View>
      <View style={styles.missionTextArea}>
        <Text style={styles.missionTitle}>Missão Semanal</Text>
        <Text style={styles.missionSubtitle}>Convide 1 amigo e ganhe 50 XP</Text>
      </View>
      <Text style={styles.missionProgress}>0/1</Text>
    </View>
  );
}

function FriendCard({ friend }: { friend: typeof FRIENDS[0] }) {
  const hasRank = friend.rank <= 3;
  return (
    <View style={styles.friendCard}>
      {/* Avatar + rank */}
      <View style={styles.friendAvatarArea}>
        <View style={styles.friendAvatar}>
          <Image source={friend.avatar} style={styles.avatarImage} />
        </View>
        {hasRank && (
          <View style={[styles.rankBadge, friend.rank === 1 && styles.rankBadgeGreen]}>
            <Text style={styles.rankBadgeText}>{friend.rank}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{friend.name}</Text>
        <View style={styles.friendStats}>
          <View style={styles.friendStat}>
            <FireIcon />
            <Text style={[styles.friendStatText, { color: "#FF9600" }]}>{friend.streak}</Text>
          </View>
          <View style={styles.friendStat}>
            <LeafIcon />
            <Text style={[styles.friendStatText, { color: "#6B6B6B" }]}>{friend.xp}</Text>
          </View>
        </View>
      </View>

      {/* Action button */}
      <View style={styles.friendActionBtn}>
        <ChevronRightSmall />
      </View>
    </View>
  );
}

function SuggestionCard({ suggestion }: { suggestion: typeof SUGGESTIONS[0] }) {
  return (
    <View style={styles.suggestionCard}>
      <View style={styles.suggestionAvatar}>
        <Image source={suggestion.avatar} style={styles.suggestionAvatarImage} />
      </View>
      <Text style={styles.suggestionName}>{suggestion.name}</Text>
      <Text style={styles.suggestionTag}>{suggestion.tag}</Text>
      <Pressable style={({ pressed }) => [styles.followButton, pressed && { opacity: 0.8 }]}>
        <Text style={styles.followButtonText}>Seguir</Text>
      </Pressable>
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
    { label: "Home", icon: <HomeTabIcon /> },
    { label: "Trilha", icon: <TrilhaTabIcon /> },
    { label: "Roleta", icon: <RouletteTabIcon /> },
    { label: "Amigos", icon: <AmigosTabIcon />, active: true },
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
            {tab.icon}
            <Text style={tab.active ? styles.tabLabelActive : styles.tabLabel}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function AmigosScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Simple title header */}
      <View style={[styles.titleBar, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.screenTitle}>Amigos</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Invite Card */}
        <View style={styles.section}>
          <InviteCard />
        </View>

        {/* Mission Card */}
        <View style={styles.section}>
          <MissionCard />
        </View>

        {/* Sua Rede */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sua Rede</Text>
            <Pressable>
              <Text style={styles.sectionLink}>Ver ranking</Text>
            </Pressable>
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <SearchIcon />
            <Text style={styles.searchPlaceholder}>BUSCAR NA MINHA REDE...</Text>
          </View>

          {/* Friend list */}
          <View style={styles.friendsList}>
            {FRIENDS.map((friend) => (
              <FriendCard key={friend.id} friend={friend} />
            ))}
          </View>
        </View>

        {/* Suggestions */}
        <View style={[styles.section, { marginBottom: 24 }]}>
          <Text style={styles.sectionTitle}>Sugeridos para você</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsRow}
          >
            {SUGGESTIONS.map((s) => (
              <SuggestionCard key={s.id} suggestion={s} />
            ))}
          </ScrollView>
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
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  section: { paddingHorizontal: 24, marginBottom: 24 },

  // ─── Title Bar ────────────────────────────────────────────────────────────
  titleBar: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  screenTitle: {
    fontWeight: "900",
    fontSize: 28,
    lineHeight: 28,
    letterSpacing: -1.4,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },

  // ─── Invite Card ──────────────────────────────────────────────────────────
  inviteCard: {
    backgroundColor: "rgba(88, 205, 4, 0.05)",
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(88, 205, 4, 0.15)",
    padding: 24,
    gap: 20,
  },
  inviteTextArea: { gap: 8 },
  inviteTitle: {
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.9,
    color: "#2B2B2B",
  },
  inviteDescription: {
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(107, 107, 107, 0.7)",
    fontStyle: "italic",
  },
  inviteActions: { gap: 12 },
  findButton: {
    backgroundColor: "#58CD04",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    shadowColor: "rgba(88, 205, 4, 0.3)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 5,
  },
  findButtonText: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
  codeBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(88, 205, 4, 0.15)",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  codeLabel: { marginBottom: 4 },
  codeLabelText: {
    fontWeight: "900",
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  codeText: {
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.8,
    textTransform: "uppercase",
    color: "#58CD04",
  },
  copyButton: {
    backgroundColor: "rgba(88, 205, 4, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  copyButtonText: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#58CD04",
  },

  // ─── Mission Card ─────────────────────────────────────────────────────────
  missionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 150, 0, 0.1)",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(255, 150, 0, 0.2)",
    padding: 18,
    gap: 16,
  },
  missionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255, 150, 0, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  missionTextArea: { flex: 1 },
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
    fontSize: 12,
    lineHeight: 16,
    color: "#6B6B6B",
  },
  missionProgress: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.7,
    color: "#FF9600",
  },

  // ─── Section Header ───────────────────────────────────────────────────────
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
    color: "#6B6B6B",
    marginBottom: 16,
  },
  sectionLink: {
    fontWeight: "900",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#58CD04",
    marginBottom: 16,
  },

  // ─── Search Bar ───────────────────────────────────────────────────────────
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.4)",
    paddingHorizontal: 16,
    height: 56,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    marginBottom: 16,
  },
  searchPlaceholder: {
    fontWeight: "900",
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },

  // ─── Friend Card ──────────────────────────────────────────────────────────
  friendsList: { gap: 12 },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(239, 236, 236, 0.5)",
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  friendAvatarArea: {
    position: "relative",
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  rankBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#6B6B6B",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadgeGreen: {
    backgroundColor: "#58CD04",
  },
  rankBadgeText: {
    fontWeight: "900",
    fontSize: 9,
    lineHeight: 9,
    color: "#FFFFFF",
  },
  friendInfo: { flex: 1, gap: 4 },
  friendName: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.35,
    color: "#2B2B2B",
  },
  friendStats: {
    flexDirection: "row",
    gap: 12,
  },
  friendStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  friendStatText: {
    fontWeight: "700",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  friendActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(88, 205, 4, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ─── Suggestion Cards ─────────────────────────────────────────────────────
  suggestionsRow: {
    gap: 12,
    paddingRight: 24,
  },
  suggestionCard: {
    width: 130,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(239, 236, 236, 0.5)",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  suggestionAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(88, 205, 4, 0.15)",
  },
  suggestionAvatarImage: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  suggestionName: {
    fontWeight: "900",
    fontSize: 11,
    lineHeight: 11,
    letterSpacing: -0.28,
    textTransform: "uppercase",
    color: "#2B2B2B",
    textAlign: "center",
  },
  suggestionTag: {
    fontWeight: "700",
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#6B6B6B",
    textAlign: "center",
  },
  followButton: {
    backgroundColor: "rgba(88, 205, 4, 0.1)",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  followButtonText: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#58CD04",
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
