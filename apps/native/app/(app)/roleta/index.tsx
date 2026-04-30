import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle as SvgCircle, Path } from "react-native-svg";

import { useSpinRoleta } from "@/hooks/useRoleta";
import { useRoletaActions } from "@/stores/roletaStore";

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke="#2B2B2B"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function WheelIcon({ size = 200 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <SvgCircle cx={100} cy={100} r={92} fill="#58CD04" fillOpacity={0.1} />
      <SvgCircle cx={100} cy={100} r={80} stroke="#58CD04" strokeWidth={4} />
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * Math.PI) / 4;
        const x2 = 100 + Math.cos(angle) * 80;
        const y2 = 100 + Math.sin(angle) * 80;
        return (
          <Path
            key={i}
            d={`M100 100 L${x2} ${y2}`}
            stroke="#58CD04"
            strokeWidth={2}
            strokeOpacity={0.3}
          />
        );
      })}
      <SvgCircle cx={100} cy={100} r={12} fill="#58CD04" />
      <Path d="M100 4 L108 20 L92 20 Z" fill="#FF9600" />
    </Svg>
  );
}

export default function RoletaLanding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const spin = useSpinRoleta();
  const { reset } = useRoletaActions();

  const rotation = useSharedValue(0);

  useEffect(() => {
    if (spin.isPending) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1200, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      cancelAnimation(rotation);
      rotation.value = 0;
    }
    return () => {
      cancelAnimation(rotation);
    };
  }, [spin.isPending, rotation]);

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handleSpin = async () => {
    try {
      const data = await spin.mutateAsync();
      queryClient.setQueryData(["roleta", "active-spin", data.spinId], data);
      reset();
      router.replace(`/roleta/play?spinId=${encodeURIComponent(data.spinId)}`);
    } catch {
      Alert.alert(
        "Não foi possível girar",
        "Verifique sua conexão e tente novamente.",
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <View style={styles.topBarContent}>
          <Pressable
            onPress={() => router.replace("/(app)/(tabs)")}
            style={styles.backBtn}
            hitSlop={8}
          >
            <BackIcon />
          </Pressable>
          <Text style={styles.topBarTitle}>Roleta</Text>
          <Pressable
            onPress={() => router.push("/roleta/configurar")}
            style={styles.configBtn}
            hitSlop={8}
          >
            <Text style={styles.configBtnText}>CONFIGURAR</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>PRÁTICA EXPRESSA</Text>
        <Text style={styles.title}>3 questões aleatórias</Text>
        <Text style={styles.subtitle}>
          Gire para descobrir qual matéria cai.{"\n"}
          Sem vidas, metade do XP.
        </Text>

        <Animated.View style={[styles.wheel, wheelStyle]}>
          <WheelIcon size={220} />
        </Animated.View>

        <Pressable
          style={({ pressed }) => [
            styles.spinBtn,
            spin.isPending && styles.spinBtnDisabled,
            pressed && !spin.isPending && { opacity: 0.9 },
          ]}
          onPress={handleSpin}
          disabled={spin.isPending}
        >
          <Text style={styles.spinBtnText}>
            {spin.isPending ? "GIRANDO..." : "GIRAR"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  topBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(239, 236, 236, 0.5)",
  },
  topBarContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(240, 240, 240, 0.5)",
  },
  topBarTitle: {
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: -0.45,
    color: "#2B2B2B",
  },
  configBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  configBtnText: {
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#58CD04",
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  eyebrow: {
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  title: {
    fontWeight: "900",
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.7,
    color: "#2B2B2B",
    marginTop: 4,
  },
  subtitle: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    color: "#6B6B6B",
    textAlign: "center",
    marginTop: 8,
  },
  wheel: {
    marginTop: 40,
    marginBottom: 40,
  },
  spinBtn: {
    alignSelf: "stretch",
    height: 64,
    backgroundColor: "#58CD04",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
    marginBottom: 32,
    shadowColor: "rgba(88, 205, 4, 0.3)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 25,
    elevation: 8,
  },
  spinBtnDisabled: {
    backgroundColor: "#B8E890",
    shadowOpacity: 0,
    elevation: 0,
  },
  spinBtnText: {
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
});
