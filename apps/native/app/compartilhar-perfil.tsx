import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

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

function QrCodePlaceholder() {
  return (
    <View style={styles.qrContainer}>
      <Svg width={220} height={220} viewBox="0 0 220 220" fill="none">
        <Defs>
          <LinearGradient id="qrBorder" x1="0" y1="0" x2="220" y2="220" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#58CD04" />
            <Stop offset="50%" stopColor="#84CC16" />
            <Stop offset="100%" stopColor="#F59E0B" />
          </LinearGradient>
        </Defs>
        <Rect x={3} y={3} width={214} height={214} rx={29} stroke="url(#qrBorder)" strokeWidth={6} fill="white" />
        {/* QR grid placeholder pattern */}
        <Rect x={40} y={40} width={36} height={36} rx={6} fill="#2B2B2B" />
        <Rect x={144} y={40} width={36} height={36} rx={6} fill="#2B2B2B" />
        <Rect x={40} y={144} width={36} height={36} rx={6} fill="#2B2B2B" />
        <Rect x={88} y={88} width={44} height={44} rx={10} fill="#58CD04" />
        {/* Small dots */}
        <Rect x={88} y={44} width={8} height={8} rx={2} fill="#2B2B2B" />
        <Rect x={104} y={44} width={8} height={8} rx={2} fill="#2B2B2B" />
        <Rect x={120} y={44} width={8} height={8} rx={2} fill="#2B2B2B" />
        <Rect x={44} y={88} width={8} height={8} rx={2} fill="#2B2B2B" />
        <Rect x={44} y={104} width={8} height={8} rx={2} fill="#2B2B2B" />
        <Rect x={44} y={120} width={8} height={8} rx={2} fill="#2B2B2B" />
        <Rect x={148} y={88} width={8} height={8} rx={2} fill="#2B2B2B" />
        <Rect x={164} y={88} width={8} height={8} rx={2} fill="#2B2B2B" />
        <Rect x={148} y={104} width={8} height={8} rx={2} fill="#2B2B2B" />
        <Rect x={164} y={104} width={8} height={8} rx={2} fill="#2B2B2B" />
        <Rect x={88} y={148} width={8} height={8} rx={2} fill="#2B2B2B" />
        <Rect x={104} y={148} width={8} height={8} rx={2} fill="#2B2B2B" />
        <Rect x={148} y={148} width={8} height={8} rx={2} fill="#2B2B2B" />
        <Rect x={164} y={148} width={8} height={8} rx={2} fill="#2B2B2B" />
        <Rect x={120} y={164} width={8} height={8} rx={2} fill="#2B2B2B" />
        <Rect x={148} y={164} width={8} height={8} rx={2} fill="#2B2B2B" />
        {/* Pruvi "P" in center */}
        <Path d="M104 102v16M104 102h6c2.2 0 4 1.8 4 4s-1.8 4-4 4h-6" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function ShareLinkIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M15 6.67a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM5 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM15 18.33a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM7.17 11.25l5.67 3.33M12.83 5.42L7.17 8.75"
        stroke="#2B2B2B"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CopyLinkIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M8.333 10.833a4.167 4.167 0 006.284.45l2.5-2.5a4.167 4.167 0 00-5.892-5.892l-1.433 1.425"
        stroke="#2B2B2B"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M11.667 9.167a4.167 4.167 0 00-6.284-.45l-2.5 2.5a4.167 4.167 0 005.892 5.892l1.425-1.425"
        stroke="#2B2B2B"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PruviBadge() {
  return (
    <View style={styles.badge}>
      <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
        <SvgCircle cx={8} cy={8} r={8} fill="#58CD04" />
        <Path d="M5 6v5M5 6h3c1.1 0 2 .9 2 2s-.9 2-2 2H5" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <Text style={styles.badgeText}>Pruvi</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function CompartilharPerfilScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Dark overlay */}
      <Pressable style={styles.overlay} onPress={() => router.back()} />

      {/* Modal card */}
      <View style={styles.modal}>
        {/* Close */}
        <Pressable
          style={({ pressed }) => [styles.closePosition, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
        >
          <CloseIcon />
        </Pressable>

        {/* Profile info */}
        <Text style={styles.profileName}>Guilherme Kauark</Text>
        <Text style={styles.profileUsername}>@kauark_enem</Text>

        {/* QR Code */}
        <QrCodePlaceholder />

        <Text style={styles.scanText}>Escaneie para me adicionar na Pruvi</Text>

        <PruviBadge />

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <Pressable style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.8 }]}>
            <ShareLinkIcon />
            <Text style={styles.actionButtonText}>Enviar link</Text>
          </Pressable>

          <Pressable style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.8 }]}>
            <CopyLinkIcon />
            <Text style={styles.actionButtonText}>Copiar link</Text>
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
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },

  modal: {
    width: "85%",
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    paddingTop: 48,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 50,
    elevation: 20,
  },
  closePosition: {
    position: "absolute",
    top: 16,
    left: 16,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },

  profileName: {
    fontWeight: "900",
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -1.1,
    color: "#2B2B2B",
    marginBottom: 4,
  },
  profileUsername: {
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 20,
    color: "#6B6B6B",
    marginBottom: 24,
  },

  qrContainer: {
    marginBottom: 16,
  },

  scanText: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    color: "#6B6B6B",
    textAlign: "center",
    marginBottom: 12,
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(88, 205, 4, 0.08)",
    borderRadius: 12,
    marginBottom: 24,
  },
  badgeText: {
    fontWeight: "900",
    fontSize: 13,
    color: "#58CD04",
  },

  actionsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#EFECEC",
    backgroundColor: "#FAFAFA",
  },
  actionButtonText: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.35,
    color: "#2B2B2B",
  },
});
