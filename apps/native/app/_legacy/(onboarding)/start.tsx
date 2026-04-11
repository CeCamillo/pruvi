import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Svg, { Defs, Path, RadialGradient, Rect, Stop, Circle as SvgCircle } from "react-native-svg";

import { OnboardingLayout } from "./components/onboarding-layout";
import { PrimaryButton } from "./components/primary-button";
import { ProgressBar } from "./components/progress-bar";

function GraduationCapIcon() {
  return (
    <View style={styles.capIconContainer}>
      <Svg width={60} height={60} viewBox="0 0 60 60" fill="none">
        <Rect width={60} height={60} rx={16} fill="white" />
        <Rect
          x={0.5}
          y={0.5}
          width={59}
          height={59}
          rx={15.5}
          stroke="#EFECEC"
          strokeOpacity={0.4}
        />
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M31.054 21.592a3.29 3.29 0 00-3.429 0l-5.724 3.12a3.79 3.79 0 00-1.866 3.145v5.894a3.79 3.79 0 001.866 3.145l5.724 3.12a3.29 3.29 0 003.429 0l5.723-3.12a3.79 3.79 0 001.867-3.145v-5.896a3.79 3.79 0 00-1.867-3.144l-5.723-3.12zm-1.714 5.631c-.34 0-.566.406-1.02 1.221l-.117.21a1.12 1.12 0 01-.41.633 1.12 1.12 0 01-.478.161l-.227.053c-.881.199-1.321.298-1.427.635-.105.337.196.689.797 1.39l.155.182c.17.2.257.299.295.423.038.124.025.257 0 .523l-.024.242c-.09.938-.136 1.407.137 1.615.275.208.688.018 1.513-.362l.213-.098c.235-.107.352-.161.477-.161.124 0 .241.054.476.161l.213.098c.824.38 1.237.57 1.512.362.274-.208.228-.677.137-1.615l-.024-.242c-.025-.266-.037-.399 0-.523.039-.124.125-.224.295-.423l.156-.181c.6-.702.901-1.054.796-1.39-.105-.338-.546-.437-1.427-.636l-.227-.052a1.12 1.12 0 01-.477-.161 1.12 1.12 0 01-.41-.634l-.117-.21c-.454-.815-.68-1.22-1.02-1.22z"
          fill="#FF9600"
        />
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M30.251 18.83h2.124c2.002 0 3.002 0 3.624.622.622.622.622 1.623.622 3.625v.019l-3.021-1.648a4.62 4.62 0 00-4.574 0l-3.021 1.648v-.019c0-2.002 0-3.003.622-3.625.622-.622 1.623-.622 3.624-.622z"
          fill="#FF9600"
        />
      </Svg>
    </View>
  );
}

function BouncingCapIcon() {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-12, { duration: 600, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 600, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { rotate: "12deg" }],
  }));

  return (
    <Animated.View style={[styles.floatingCap, animatedStyle]}>
      <GraduationCapIcon />
    </Animated.View>
  );
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const avatarsImg = require("@/assets/images/avatars.png") as number;

export default function OnboardingStartScreen() {
  const router = useRouter();

  return (
    <OnboardingLayout
      progressBar={<ProgressBar current={1} total={3} />}
      bottomSection={
        <>
          <View style={styles.socialProof}>
            <Image source={avatarsImg} style={styles.avatarsImage} />
            <Text style={styles.socialText}>+50 MIL APROVADOS PELO PRUVI</Text>
          </View>
          <View style={styles.buttonWrapper}>
            <PrimaryButton
              label="COMEÇAR AGORA"
              onPress={() => router.push("/(onboarding)/exam-select")}
            />
          </View>
        </>
      }
    >
      {/* Hero Area */}
      <View style={styles.heroSection}>
        <View style={styles.heroGlowContainer}>
          <Svg width={400} height={400} style={styles.glowSvg}>
            <Defs>
              <RadialGradient id="greenGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#84CC16" stopOpacity="0.10" />
                <Stop offset="45%" stopColor="#84CC16" stopOpacity="0.05" />
                <Stop offset="100%" stopColor="#84CC16" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="orangeGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#FF9600" stopOpacity="0.07" />
                <Stop offset="50%" stopColor="#FF9600" stopOpacity="0.03" />
                <Stop offset="100%" stopColor="#FF9600" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <SvgCircle cx="200" cy="200" r="200" fill="url(#greenGlow)" />
            <SvgCircle cx="200" cy="200" r="153" fill="url(#orangeGlow)" />
          </Svg>
        </View>
      </View>

      {/* Floating Graduation Cap Icon */}
      <BouncingCapIcon />

      {/* Text Content */}
      <View style={styles.textSection}>
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>
            {"CONQUISTE SUA\nVAGA EM "}
            <Text style={styles.titleHighlight}>MEDICINA.</Text>
          </Text>
        </View>

        <Text style={styles.subtitle}>
          O Pruvi adapta sua jornada de estudos para o ENEM e os vestibulares mais difíceis do país.
        </Text>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  // Hero
  heroSection: {
    height: 340,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    width: 340,
  },
  heroGlowContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  glowSvg: {
    position: "absolute",
  },
  capIconContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.05,
    shadowRadius: 25,
    elevation: 8,
  },
  floatingCap: {
    position: "absolute",
    top: "15%",
    right: 24,
    zIndex: 20,
  },

  // Text
  textSection: {
    paddingHorizontal: 32,
    gap: 12,
    marginTop: 150,
  },
  titleContainer: {
    alignItems: "center",
  },
  titleText: {
    fontWeight: "900",
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.8,
    textTransform: "uppercase",
    textAlign: "center",
    color: "#2B2B2B",
  },
  titleHighlight: {
    color: "#84CC16",
  },
  subtitle: {
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
    color: "rgba(107, 107, 107, 0.7)",
  },

  // Bottom content
  socialProof: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  avatarsImage: {
    width: 62,
    height: 26,
    resizeMode: "contain",
  },
  socialText: {
    fontWeight: "900",
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "rgba(107, 107, 107, 0.6)",
  },
  buttonWrapper: {
    marginTop: 24,
  },
});
