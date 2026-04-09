import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path, Rect } from "react-native-svg";

// ─── Icons ───────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <View style={styles.closeBtn}>
      <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
        <Path d="M11 3L3 11M3 3l8 8" stroke="#2B2B2B" strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function ContactsIcon() {
  return (
    <View style={[styles.optionIcon, { backgroundColor: "#F59E0B" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Rect x={4} y={3} width={16} height={18} rx={3} fill="white" fillOpacity={0.3} />
        <Path d="M8 10h8M8 14h5" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
        <SvgCircle cx={12} cy={7} r={2} stroke="white" strokeWidth={1.5} />
      </Svg>
    </View>
  );
}

function SearchUserIcon() {
  return (
    <View style={[styles.optionIcon, { backgroundColor: "#8B5CF6" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <SvgCircle cx={11} cy={11} r={6} stroke="white" strokeWidth={2} />
        <Path d="M20 20l-3-3" stroke="white" strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function LinkIcon() {
  return (
    <View style={[styles.optionIcon, { backgroundColor: "#3B82F6" }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="white" strokeWidth={2} strokeLinecap="round" />
        <Path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="white" strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function ChevronRight() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M7.5 5l5 5-5 5" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ShareIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M15 6.67a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM5 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM15 18.33a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM7.17 11.25l5.67 3.33M12.83 5.42L7.17 8.75" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PeopleIllustration() {
  return (
    <Svg width={80} height={50} viewBox="0 0 80 50" fill="none">
      <SvgCircle cx={30} cy={20} r={12} fill="#6B6B6B" fillOpacity={0.15} />
      <SvgCircle cx={50} cy={20} r={12} fill="#6B6B6B" fillOpacity={0.2} />
      <Path d="M15 45c0-8.284 6.716-15 15-15 3.5 0 6.71 1.19 9.26 3.19" fill="#6B6B6B" fillOpacity={0.1} />
      <Path d="M65 45c0-8.284-6.716-15-15-15-3.5 0-6.71 1.19-9.26 3.19" fill="#6B6B6B" fillOpacity={0.1} />
    </Svg>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function EncontreAmigosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + 16 }]}>
        {/* Close */}
        <Pressable onPress={() => router.back()}>
          <CloseIcon />
        </Pressable>

        {/* Title */}
        <Text style={styles.title}>Encontre os seus amigos</Text>

        {/* Options */}
        <View style={styles.optionsList}>
          {/* Contatos */}
          <Pressable
            style={({ pressed }) => [styles.optionCard, pressed && { opacity: 0.8 }]}
            onPress={() => router.push("/permissao-contatos" as any)}
          >
            <ContactsIcon />
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>Escolher nos contatos</Text>
              <Text style={styles.optionSubtitle}>Sincronize sua agenda</Text>
            </View>
            <ChevronRight />
          </Pressable>

          {/* Buscar */}
          <Pressable style={({ pressed }) => [styles.optionCard, pressed && { opacity: 0.8 }]}>
            <SearchUserIcon />
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>Buscar por nome</Text>
              <Text style={styles.optionSubtitle}>Encontre pelo @username</Text>
            </View>
            <ChevronRight />
          </Pressable>

          {/* Link */}
          <Pressable style={({ pressed }) => [styles.optionCard, pressed && { opacity: 0.8 }]}>
            <LinkIcon />
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>Link do seu perfil</Text>
              <Text style={styles.optionSubtitle}>Compartilhe seu progresso</Text>
            </View>
            <ShareIcon />
          </Pressable>
        </View>

        {/* Bottom illustration */}
        <View style={styles.bottomIllustration}>
          <PeopleIllustration />
          <Text style={styles.bottomText}>
            Estudar com amigos é 2x{"\n"}mais divertido!
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { flex: 1, paddingHorizontal: 24 },

  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },

  title: {
    fontWeight: "900",
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -1.3,
    color: "#2B2B2B",
    marginBottom: 28,
  },

  optionsList: { gap: 12 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.4)",
    padding: 20,
    gap: 16,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  optionInfo: { flex: 1, gap: 2 },
  optionTitle: {
    fontWeight: "900",
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.38,
    color: "#2B2B2B",
  },
  optionSubtitle: {
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
    color: "#6B6B6B",
  },

  bottomIllustration: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 60,
    gap: 16,
  },
  bottomText: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.35,
    color: "#2B2B2B",
    textAlign: "center",
  },
});
