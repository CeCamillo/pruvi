import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";

type Props = {
  step: number;
  totalSteps: number;
  title: string;
};

function BackIcon() {
  return (
    <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
      <Rect width={40} height={40} rx={16} fill="white" />
      <Rect x={0.5} y={0.5} width={39} height={39} rx={15.5} stroke="#EFECEC" strokeOpacity={0.5} />
      <Path d="M23 12L17 19L23 26" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function OnboardingHeader({ step, totalSteps, title }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const fillPercentage = (step / totalSteps) * 100;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.row}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
        >
          <BackIcon />
        </Pressable>

        <View style={styles.stepInfo}>
          <Text style={styles.stepLabel}>
            PASSO {String(step).padStart(2, "0")}/{String(totalSteps).padStart(2, "0")}
          </Text>
          <Text style={styles.stepTitle}>{title}</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${fillPercentage}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    paddingHorizontal: 32,
    paddingBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  stepInfo: {
    alignItems: "flex-end",
  },
  stepLabel: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(107, 107, 107, 0.6)",
  },
  stepTitle: {
    fontWeight: "900",
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: -0.325,
    textTransform: "uppercase",
    color: "#2B2B2B",
    marginTop: 4,
  },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 9999,
    backgroundColor: "rgba(240, 240, 240, 0.4)",
    marginTop: 20,
  },
  progressFill: {
    height: 6,
    borderRadius: 9999,
    backgroundColor: "#84CC16",
    shadowColor: "rgba(132, 204, 22, 0.4)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
});
