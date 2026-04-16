import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

// ─── Icons ──────────────────────────────────────────────────────────────────

function ChevronDownIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 9l6 6 6-6"
        stroke="#6B6B6B"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function FilterIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 6h18M7 12h10M10 18h4"
        stroke="#6B6B6B"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

type SubjectHeaderProps = {
  subjectIcon: React.ReactNode;
  subjectName: string;
};

// ─── Component ──────────────────────────────────────────────────────────────

export function SubjectHeader({ subjectIcon, subjectName }: SubjectHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Left side: icon + subject info + dropdown */}
      <Pressable
        style={({ pressed }) => [
          styles.leftSection,
          pressed && { opacity: 0.7 },
        ]}
        onPress={() => router.push("/materias" as any)}
      >
        <View style={styles.iconWrapper}>{subjectIcon}</View>
        <View style={styles.textColumn}>
          <Text style={styles.allSubjectsLabel}>Todos os assuntos</Text>
          <Text style={styles.subjectName}>{subjectName}</Text>
        </View>
        <ChevronDownIcon />
      </Pressable>

      {/* Right side: filter button */}
      <Pressable
        style={({ pressed }) => [
          styles.filterButton,
          pressed && { opacity: 0.7 },
        ]}
        onPress={() => router.push("/filtro-assuntos" as any)}
      >
        <FilterIcon />
      </Pressable>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 16,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.4)",
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    gap: 12,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    overflow: "hidden",
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  allSubjectsLabel: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  subjectName: {
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 23,
    color: "#1F2937",
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
});
