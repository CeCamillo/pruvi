import { useRouter } from "expo-router";
import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { useProgress } from "@/hooks/useProgress";
import {
  useRoletaConfig,
  useSaveRoletaConfig,
} from "@/hooks/useRoleta";

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

function CheckIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path
        d="M3 7l2.5 2.5L11 4"
        stroke="white"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function ConfigurarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const config = useRoletaConfig();
  const progress = useProgress();
  const save = useSaveRoletaConfig();

  const eligibleSet = useMemo(
    () => new Set(config.data?.subjects ?? []),
    [config.data?.subjects],
  );

  const allSubjects = progress.data?.subjects ?? [];

  const toggle = (slug: string) => {
    const next = new Set(eligibleSet);
    if (next.has(slug)) {
      if (next.size === 1) return; // must keep at least one
      next.delete(slug);
    } else {
      next.add(slug);
    }
    save.mutate({ subjects: Array.from(next) });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <View style={styles.topBarContent}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <BackIcon />
          </Pressable>
          <Text style={styles.topBarTitle}>Configurar</Text>
          <View style={{ width: 36 }} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>MATÉRIAS ELEGÍVEIS</Text>
        <Text style={styles.description}>
          Cada giro sorteia uma dessas matérias. Mantenha ao menos uma marcada.
        </Text>

        <View style={styles.list}>
          {allSubjects.map((subj) => {
            const checked = eligibleSet.has(subj.slug);
            const disableUncheck = checked && eligibleSet.size === 1;
            return (
              <Pressable
                key={subj.slug}
                style={({ pressed }) => [
                  styles.row,
                  checked && styles.rowChecked,
                  pressed && { opacity: 0.9 },
                ]}
                onPress={() => toggle(subj.slug)}
                disabled={save.isPending}
              >
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{subj.name}</Text>
                  <Text style={styles.rowAccuracy}>
                    {subj.totalQuestions > 0
                      ? `${subj.accuracy}% de acerto`
                      : "sem respostas ainda"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    checked && styles.checkboxChecked,
                    disableUncheck && styles.checkboxLocked,
                  ]}
                >
                  {checked && <CheckIcon />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFBFC" },
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },
  eyebrow: {
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  description: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    color: "#6B6B6B",
    marginTop: 4,
    marginBottom: 20,
  },
  list: { gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.5)",
    padding: 18,
  },
  rowChecked: {
    borderColor: "#58CD04",
    backgroundColor: "rgba(88, 205, 4, 0.05)",
  },
  rowInfo: { flex: 1, gap: 4 },
  rowName: {
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: -0.4,
    color: "#2B2B2B",
  },
  rowAccuracy: {
    fontWeight: "700",
    fontSize: 11,
    color: "#6B6B6B",
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "rgba(107, 107, 107, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    borderColor: "#58CD04",
    backgroundColor: "#58CD04",
  },
  checkboxLocked: {
    opacity: 0.6,
  },
});
