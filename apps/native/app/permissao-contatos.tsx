import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path } from "react-native-svg";

// ─── Icons ───────────────────────────────────────────────────────────────────

function PeopleIcon() {
  return (
    <View style={styles.peopleIconBg}>
      <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
        <SvgCircle cx={15} cy={14} r={5} fill="#F59E0B" fillOpacity={0.6} />
        <SvgCircle cx={25} cy={14} r={5} fill="#F59E0B" fillOpacity={0.8} />
        <Path d="M5 34c0-5.523 4.477-10 10-10 2.5 0 4.777.92 6.527 2.44" fill="#F59E0B" fillOpacity={0.3} />
        <Path d="M35 34c0-5.523-4.477-10-10-10-2.5 0-4.777.92-6.527 2.44" fill="#F59E0B" fillOpacity={0.3} />
      </Svg>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function PermissaoContatosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Dark overlay */}
      <Pressable style={styles.overlay} onPress={() => router.back()} />

      {/* Modal card */}
      <View style={[styles.modal, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.modalContent}>
          {/* Icon */}
          <PeopleIcon />

          {/* Title */}
          <Text style={styles.modalTitle}>Permitir acesso aos contatos?</Text>

          {/* Description */}
          <Text style={styles.modalDescription}>
            A <Text style={styles.pruviText}>Pruvi</Text>rá sua agenda apenas para encontrar amigos que já estudam.
          </Text>
          <Text style={styles.modalBold}>
            Nunca enviaremos mensagens sem sua autorização.
          </Text>

          {/* Buttons */}
          <Pressable
            style={({ pressed }) => [styles.allowBtn, pressed && { opacity: 0.9 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.allowBtnText}>Permitir acesso</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.denyBtn, pressed && { opacity: 0.7 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.denyBtnText}>Agora não</Text>
          </Pressable>
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  modal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: 32,
    paddingHorizontal: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 0.15,
    shadowRadius: 50,
    elevation: 20,
  },
  modalContent: {
    alignItems: "center",
    gap: 16,
  },
  peopleIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  modalTitle: {
    fontWeight: "900",
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -1.1,
    color: "#2B2B2B",
    textAlign: "center",
  },
  modalDescription: {
    fontWeight: "500",
    fontSize: 14,
    lineHeight: 22,
    color: "#6B6B6B",
    textAlign: "center",
  },
  pruviText: {
    fontWeight: "900",
    color: "#58CD04",
  },
  modalBold: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 22,
    color: "#58CD04",
    textAlign: "center",
    marginBottom: 8,
  },
  allowBtn: {
    width: "100%",
    height: 56,
    backgroundColor: "#58CD04",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(88, 205, 4, 0.3)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 5,
  },
  allowBtnText: {
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 22,
    color: "#FFFFFF",
  },
  denyBtn: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
  },
  denyBtnText: {
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 20,
    color: "#6B6B6B",
  },
});
