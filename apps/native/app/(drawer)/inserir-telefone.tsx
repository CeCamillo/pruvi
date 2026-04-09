import { useState } from "react";
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

function ChevronDown() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d="M4 6l4 4 4-4" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ArrowRightIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.835 11.43L9.205 5a.5.5 0 00-.205-.13c-.265-.08-.5.102-.5.5v12.86c0 .528.79.771 1.205.37l6.63-6.43A.47.47 0 0016 11.8a.47.47 0 00-.165-.37z"
        fill="white"
      />
    </Svg>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function InserirTelefoneScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [phone, setPhone] = useState("");

  const formatPhone = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handlePhoneChange = (text: string) => {
    setPhone(formatPhone(text));
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
          <View style={[styles.progressFill, { width: "50%" }]} />
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>Qual é o seu número?</Text>
        <Text style={styles.subtitle}>Você receberá um SMS para confirmar seu número.</Text>

        {/* Phone input row */}
        <View style={styles.phoneRow}>
          <Pressable style={styles.countryCode}>
            <Text style={styles.countryCodeText}>+55</Text>
            <ChevronDown />
          </Pressable>

          <View style={styles.phoneInputWrapper}>
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={handlePhoneChange}
              placeholder="(00) 00000-0000"
              placeholderTextColor="#BDBDBD"
              keyboardType="phone-pad"
              maxLength={16}
            />
          </View>
        </View>

        <Text style={styles.infoText}>
          Taxas de SMS poderão ser aplicadas de acordo com sua operadora.
        </Text>
      </View>

      {/* Bottom sticky */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
          onPress={() => router.push("/(drawer)/inserir-codigo-sms" as any)}
        >
          <Text style={styles.primaryButtonText}>Avançar</Text>
          <ArrowRightIcon />
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
    marginBottom: 32,
  },

  phoneRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  countryCode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#EFECEC",
    backgroundColor: "#FAFAFA",
  },
  countryCodeText: {
    fontWeight: "900",
    fontSize: 16,
    color: "#2B2B2B",
  },
  phoneInputWrapper: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#EFECEC",
    backgroundColor: "#FAFAFA",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  phoneInput: {
    fontWeight: "700",
    fontSize: 16,
    color: "#2B2B2B",
  },
  infoText: {
    fontWeight: "500",
    fontSize: 12,
    lineHeight: 18,
    color: "#6B6B6B",
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
