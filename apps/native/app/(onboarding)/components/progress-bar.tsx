import { StyleSheet, View } from "react-native";

type Props = {
  /** Current step (1-indexed) */
  current: number;
  /** Total number of steps */
  total: number;
};

export function ProgressBar({ current, total }: Props) {
  const fillPercentage = (current / total) * 100;

  return (
    <View style={styles.section}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fillPercentage}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    height: 52,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 6,
  },
  track: {
    width: 120,
    height: 6,
    borderRadius: 9999,
    backgroundColor: "rgba(220, 220, 220, 0.6)",
  },
  fill: {
    height: 6,
    borderRadius: 9999,
    backgroundColor: "#84CC16",
  },
});
