import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

function SparkleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 1l2 5 5 1.5-5 1.5-2 5-2-5-5-1.5 5-1.5 2-5z"
        fill="#FF9600"
      />
    </Svg>
  );
}

export default function RoletaResultScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    correct: string;
    total: string;
    subject: string;
    xp: string;
  }>();

  const correct = Number(params.correct ?? 0);
  const total = Number(params.total ?? 3);
  const xp = Number(params.xp ?? 0);
  const subject = params.subject ?? "";

  const headline =
    correct === total ? "Perfeito!" : correct >= total - 1 ? "Mandou bem!" : "Bora de novo!";

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#58CD04", "#3FAE0A"]}
        style={[styles.hero, { paddingTop: insets.top + 32 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <Text style={styles.heroEyebrow}>ROLETA — {subject.toUpperCase()}</Text>
        <Text style={styles.heroTitle}>{headline}</Text>
        <Text style={styles.heroSubtitle}>
          {correct} de {total} acertos
        </Text>

        <View style={styles.xpBadge}>
          <SparkleIcon />
          <Text style={styles.xpBadgeText}>+{xp} XP</Text>
        </View>
      </LinearGradient>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => router.replace("/roleta")}
        >
          <Text style={styles.primaryBtnText}>GIRAR DE NOVO</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryBtn,
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => router.replace("/(app)/(tabs)")}
        >
          <Text style={styles.secondaryBtnText}>FECHAR</Text>
        </Pressable>
      </View>

      <View style={{ paddingBottom: insets.bottom }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: "center",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  heroEyebrow: {
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1.4,
    color: "rgba(255, 255, 255, 0.8)",
    textTransform: "uppercase",
  },
  heroTitle: {
    fontWeight: "900",
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.9,
    color: "#FFFFFF",
    marginTop: 8,
    textAlign: "center",
  },
  heroSubtitle: {
    fontWeight: "700",
    fontSize: 16,
    lineHeight: 22,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 8,
  },
  xpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 24,
  },
  xpBadgeText: {
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
  actions: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  primaryBtn: {
    height: 60,
    backgroundColor: "#58CD04",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(88, 205, 4, 0.3)",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 6,
  },
  primaryBtnText: {
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
  secondaryBtn: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
});
