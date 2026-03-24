import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

function RadioSelected() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={12} fill="#84CC16" />
      <Circle cx={12} cy={12} r={5} fill="white" />
    </Svg>
  );
}

function RadioUnselected() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={11} stroke="rgba(239, 236, 236, 0.4)" strokeWidth={2} />
    </Svg>
  );
}

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export function RadioOption({ label, selected, onPress }: Props) {
  return (
    <Pressable
      style={[styles.option, selected && styles.optionSelected]}
      onPress={onPress}
    >
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelDefault]}>
        {label}
      </Text>
      {selected ? <RadioSelected /> : <RadioUnselected />}
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  optionSelected: {
    borderWidth: 2,
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
});
