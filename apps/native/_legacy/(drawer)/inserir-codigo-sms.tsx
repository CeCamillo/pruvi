import { useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";

// ─── Icons ───────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
      <Rect width={40} height={40} rx={16} fill="white" />
      <Rect x={0.5} y={0.5} width={39} height={39} rx={15.5} stroke="#EFECEC" strokeOpacity={0.5} />
      <Path d="M23 12L17 19L23 26" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12l5 5L20 7" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

const CODE_LENGTH = 6;

export default function InserirCodigoSmsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text.slice(-1);
    setCode(newCode);

    if (text && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
        >
          <BackIcon />
        </Pressable>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: "75%" }]} />
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>Insira o código de 6 dígitos</Text>
        <Text style={styles.subtitle}>Enviamos um código para +55 11 99999-9999</Text>

        {/* Code inputs */}
        <View style={styles.codeRow}>
          {Array.from({ length: CODE_LENGTH }).map((_, i) => (
            <TextInput
              key={i}
              ref={(ref) => {
                inputRefs.current[i] = ref;
              }}
              style={[styles.codeBox, code[i] ? styles.codeBoxFilled : undefined]}
              value={code[i]}
              onChangeText={(text) => handleChange(text, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Resend link */}
        <Pressable style={({ pressed }) => [styles.resendRow, pressed && { opacity: 0.7 }]}>
          <Text style={styles.resendText}>Não recebeu o código?</Text>
        </Pressable>
      </View>

      {/* Bottom sticky */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
          onPress={() => router.push("/(drawer)/contatos-na-pruvi" as any)}
        >
          <Text style={styles.primaryButtonText}>Avançar</Text>
          <CheckIcon />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },

  header: {
    paddingHorizontal: 32,
    paddingBottom: 20,
  },
  backButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    marginBottom: 20,
  },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 9999,
    backgroundColor: "rgba(240, 240, 240, 0.4)",
  },
  progressFill: {
    height: 6,
    borderRadius: 9999,
    backgroundColor: "#58CD04",
    shadowColor: "rgba(88, 205, 4, 0.4)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },

  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 32,
  },
  title: {
    fontWeight: "900",
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -1.3,
    color: "#2B2B2B",
    marginBottom: 8,
  },
  subtitle: {
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 22,
    color: "#6B6B6B",
    marginBottom: 40,
  },

  codeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 32,
  },
  codeBox: {
    width: 48,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#EFECEC",
    backgroundColor: "#FAFAFA",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 22,
    color: "#2B2B2B",
  },
  codeBoxFilled: {
    borderColor: "#58CD04",
    backgroundColor: "rgba(88, 205, 4, 0.05)",
  },

  resendRow: {
    alignItems: "center",
  },
  resendText: {
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 22,
    color: "#58CD04",
  },

  bottomSection: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 32,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(239, 236, 236, 0.4)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.03,
    shadowRadius: 40,
    elevation: 4,
  },
  primaryButton: {
    height: 64,
    backgroundColor: "#58CD04",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "rgba(88, 205, 4, 0.5)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 8,
  },
  primaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 27,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
});
