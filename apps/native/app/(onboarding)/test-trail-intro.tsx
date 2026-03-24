import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";

import { PrimaryButton } from "./components/primary-button";

// --- Feature Icons ---

function QuestionsIcon() {
  return (
    <View style={styles.featureIcon}>
      <Svg width={24} height={24} viewBox="12 10 22 22" fill="none">
        <Path fillRule="evenodd" clipRule="evenodd" d="M28.293 12.293C28 12.586 28 13.057 28 14v13c0 .943 0 1.414.293 1.707.293.293.764.293 1.707.293s1.414 0 1.707-.293C32 28.414 32 27.943 32 27V14c0-.943 0-1.414-.293-1.707C31.414 12 30.943 12 30 12s-1.414 0-1.707.293z" fill="#84CC16" />
        <Path fillRule="evenodd" clipRule="evenodd" d="M21 17c0-.943 0-1.414.293-1.707C21.586 15 22.057 15 23 15s1.414 0 1.707.293C25 15.586 25 16.057 25 17v10c0 .943 0 1.414-.293 1.707C24.414 29 23.943 29 23 29s-1.414 0-1.707-.293C21 28.414 21 27.943 21 27V17z" fill="#84CC16" />
        <Path fillRule="evenodd" clipRule="evenodd" d="M14.293 19.293C14 19.586 14 20.057 14 21v6c0 .943 0 1.414.293 1.707.293.293.764.293 1.707.293s1.414 0 1.707-.293C18 28.414 18 27.943 18 27v-6c0-.943 0-1.414-.293-1.707C17.414 19 16.943 19 16 19s-1.414 0-1.707.293z" fill="#84CC16" />
        <Path fillRule="evenodd" clipRule="evenodd" d="M14 31.25a.75.75 0 000 1.5h18a.75.75 0 000-1.5H14z" fill="#84CC16" />
      </Svg>
    </View>
  );
}

function ResultIcon() {
  return (
    <View style={styles.featureIcon}>
      <Svg width={24} height={24} viewBox="12 10 22 24" fill="none">
        <Path fillRule="evenodd" clipRule="evenodd" d="M14.001 13.927c-1.176 1.176-1.176 3.083 0 4.26l1.658 1.659.04-.042 4.178-4.179.042-.04-1.66-1.658a3.012 3.012 0 00-4.258 0z" fill="#84CC16" />
        <Path fillRule="evenodd" clipRule="evenodd" d="M21.024 16.69l-.04.042-4.178 4.179-.042.04 10.016 10.015c1.182 1.143 3.062 1.127 4.224-.035 1.162-1.163 1.178-3.042.036-4.224L21.024 16.69z" fill="#84CC16" />
        <Path fillRule="evenodd" clipRule="evenodd" d="M26.803 12.32a.75.75 0 01.94-.64l.47 1.144a.58.58 0 00.283.286l1.14.452a.75.75 0 010 1.39l-1.139.451a.58.58 0 00-.285.286l-.449 1.143a.75.75 0 01-1.41 0l-.449-1.144a.58.58 0 00-.285-.285l-1.139-.451a.75.75 0 010-1.39l1.139-.452a.58.58 0 00.285-.286l.45-1.143a.75.75 0 01.45-.361z" fill="#84CC16" />
      </Svg>
    </View>
  );
}

function XpBonusIcon() {
  return (
    <View style={styles.featureIcon}>
      <Svg width={24} height={24} viewBox="12 10 22 24" fill="none">
        <Path fillRule="evenodd" clipRule="evenodd" d="M29.678 26.916c-2.82.677-5.79-.107-7.908-2.086-2.118-1.98-3.101-4.89-2.616-7.749l-.115.099c-.284.216-.64.296-1.35.457l-.645.146c-2.498.565-3.747.848-4.044 1.803-.297.954.554 1.95 2.257 3.942l.44.515c.484.565.726.849.835 1.198.108.35.072.728-.001 1.482l-.067.688c-.257 2.657-.386 3.985.392 4.575.778.59 1.947.053 4.285-1.024l.606-.278c.664-.307.996-.459 1.348-.459s.685.152 1.35.459l.604.278c2.338 1.077 3.508 1.614 4.285 1.025.779-.59.65-1.918.393-4.576l-.049-.494z" fill="#84CC16" />
        <Path fillRule="evenodd" clipRule="evenodd" d="M20.152 15.424l-.33.59c-.361.65-.542.974-.824 1.188l.114-.097c-.48 2.828.493 5.708 2.589 7.667 2.096 1.958 5.035 2.734 7.825 2.064l-.02-.19c-.072-.747-.108-1.12 0-1.467.107-.346.346-.626.826-1.186l.436-.51c1.685-1.968 2.527-2.954 2.232-3.899-.293-.945-1.529-1.226-4-1.784l-.639-.145c-.702-.159-1.054-.238-1.336-.452-.282-.214-.462-.538-.824-1.188l-.329-.59C24.599 13.141 23.963 12 23.012 12s-1.587 1.141-2.86 3.424z" fill="#84CC16" />
      </Svg>
    </View>
  );
}

export default function TestTrailIntroScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title}>VAMOS TESTAR SEU NÍVEL NA PRÁTICA.</Text>

        {/* Subtitle with mixed colors */}
        <Text style={styles.subtitleWrap}>
          <Text style={styles.subtitleGray}>Responda </Text>
          <Text style={styles.subtitleDark}>5 questões </Text>
          <Text style={styles.subtitleGray}>da trilha de </Text>
          <Text style={styles.subtitleGreen}>ENEM </Text>
          <Text style={styles.subtitleGray}>para que possamos calibrar seu plano.</Text>
        </Text>

        {/* Feature Card */}
        <View style={styles.featureCard}>
          <View style={styles.featureRow}>
            <QuestionsIcon />
            <Text style={styles.featureText}>5 QUESTÕES RÁPIDAS</Text>
          </View>
          <View style={styles.featureRow}>
            <ResultIcon />
            <Text style={styles.featureText}>RESULTADO IMEDIATO</Text>
          </View>
          <View style={styles.featureRow}>
            <XpBonusIcon />
            <Text style={styles.featureText}>BÔNUS DE XP INICIAL</Text>
          </View>
        </View>
      </View>

      {/* Bottom Section */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
        <PrimaryButton label="COMEÇAR TESTE" onPress={() => router.push("/(onboarding)/test-question")} />
        <Pressable
          style={styles.skipButton}
          onPress={() => router.push("/(drawer)")}
        >
          <Text style={styles.skipText}>PULAR TESTE DE NIVELAMENTO</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
    gap: 24,
  },

  // Title
  title: {
    fontWeight: "900",
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.65,
    textTransform: "uppercase",
    textAlign: "center",
    color: "#2B2B2B",
  },

  // Subtitle
  subtitleWrap: {
    textAlign: "center",
    lineHeight: 26,
  },
  subtitleGray: {
    fontWeight: "700",
    fontSize: 16,
    color: "rgba(107, 107, 107, 0.8)",
  },
  subtitleDark: {
    fontWeight: "700",
    fontSize: 16,
    color: "#2B2B2B",
  },
  subtitleGreen: {
    fontWeight: "700",
    fontSize: 16,
    color: "#58CD04",
  },

  // Feature Card
  featureCard: {
    backgroundColor: "rgba(240, 240, 240, 0.3)",
    borderRadius: 32,
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  featureText: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: -0.35,
    textTransform: "uppercase",
    color: "rgba(43, 43, 43, 0.8)",
  },

  // Bottom
  bottomSection: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 32,
    paddingTop: 25,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(239, 236, 236, 0.5)",
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: 16,
  },
  skipText: {
    fontWeight: "900",
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.65,
    textTransform: "uppercase",
    color: "rgba(107, 107, 107, 0.4)",
  },
});
