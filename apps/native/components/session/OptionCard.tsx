import { Pressable, StyleSheet, Text, View } from "react-native";

export type OptionCardState = "idle" | "selected" | "correct" | "wrong";

type Props = {
  letter: string;
  text: string;
  state: OptionCardState;
  onPress: () => void;
  disabled?: boolean;
};

export function OptionCard({ letter, text, state, onPress, disabled = false }: Props) {
  const cardStyle =
    state === "correct"
      ? [styles.card, styles.cardCorrect]
      : state === "wrong"
        ? [styles.card, styles.cardWrong]
        : state === "selected"
          ? [styles.card, styles.cardSelected]
          : styles.card;

  const letterStyle =
    state === "correct"
      ? [styles.letter, styles.letterCorrect]
      : state === "wrong"
        ? [styles.letter, styles.letterWrong]
        : state === "selected"
          ? [styles.letter, styles.letterSelected]
          : styles.letter;

  const letterTextStyle =
    state === "idle" ? styles.letterText : [styles.letterText, styles.letterTextSelected];
  const textStyle =
    state === "idle" ? styles.text : [styles.text, styles.textSelected];

  return (
    <Pressable style={cardStyle} onPress={onPress} disabled={disabled}>
      <View style={letterStyle}>
        <Text style={letterTextStyle}>{letter}</Text>
      </View>
      <Text style={textStyle}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.4)",
    paddingHorizontal: 20,
    minHeight: 68,
    paddingVertical: 14,
    gap: 16,
  },
  cardSelected: {
    backgroundColor: "rgba(88, 205, 4, 0.05)",
    borderColor: "#58CD04",
  },
  cardCorrect: {
    backgroundColor: "rgba(88, 205, 4, 0.15)",
    borderColor: "#58CD04",
  },
  cardWrong: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "#EF4444",
  },
  letter: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  letterSelected: { backgroundColor: "#58CD04" },
  letterCorrect: { backgroundColor: "#58CD04" },
  letterWrong: { backgroundColor: "#EF4444" },
  letterText: {
    fontWeight: "900",
    fontSize: 13,
    color: "#6B6B6B",
  },
  letterTextSelected: { color: "#FFFFFF" },
  text: {
    flex: 1,
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 22,
    color: "#2B2B2B",
  },
  textSelected: { fontWeight: "900" },
});
