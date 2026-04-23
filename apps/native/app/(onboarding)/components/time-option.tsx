import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  label: string;
  tag: string;
  selected: boolean;
  onPress: () => void;
};

export function TimeOption({ label, tag, selected, onPress }: Props) {
  return (
    <Pressable
      style={[styles.option, selected && styles.optionSelected]}
      onPress={onPress}
    >
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelDefault]}>
        {label}
      </Text>
      <Text style={[styles.tag, selected && styles.tagSelected]}>{tag}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 76,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 26,
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  optionSelected: {
    borderColor: "#84CC16",
    shadowColor: "rgba(220, 252, 231, 1)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  label: {
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.4,
    textTransform: "uppercase",
  },
  labelSelected: {
    color: "#2B2B2B",
  },
  labelDefault: {
    color: "rgba(43, 43, 43, 0.8)",
  },
  tag: {
    fontWeight: "900",
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "rgba(107, 107, 107, 0.4)",
  },
  tagSelected: {
    color: "#84CC16",
  },
});
