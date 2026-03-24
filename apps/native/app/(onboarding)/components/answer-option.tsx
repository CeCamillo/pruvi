import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  letter: string;
  text: string;
  selected: boolean;
  onPress: () => void;
};

export function AnswerOption({ letter, text, selected, onPress }: Props) {
  return (
    <Pressable
      style={[styles.option, selected && styles.optionSelected]}
      onPress={onPress}
    >
      <View style={[styles.letterBadge, selected && styles.letterBadgeSelected]}>
        <Text style={[styles.letter, selected && styles.letterSelected]}>{letter}</Text>
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.text, selected && styles.textSelected]}>{text}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 84,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 20,
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  optionSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2B7FFF",
    shadowColor: "rgba(219, 234, 254, 1)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  letterBadge: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: "rgba(240, 240, 240, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  letterBadgeSelected: {
    backgroundColor: "#2B7FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  letter: {
    fontWeight: "900",
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(107, 107, 107, 0.6)",
  },
  letterSelected: {
    color: "#FFFFFF",
  },
  textContainer: {
    flex: 1,
    marginLeft: 16,
  },
  text: {
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 19,
    color: "rgba(43, 43, 43, 0.8)",
  },
  textSelected: {
    fontWeight: "900",
    color: "#2B2B2B",
  },
});
