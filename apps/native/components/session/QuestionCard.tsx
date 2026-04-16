import { useCallback } from "react";
import { Text, View } from "react-native";

import type { ClientQuestion } from "@pruvi/shared";

import { colors } from "@/lib/design-tokens";

import { OptionButton, type OptionButtonState } from "./OptionButton";

interface Props {
  question: ClientQuestion;
  selectedIndex: number | null;
  answerState: "idle" | "correct" | "wrong";
  correctIndex: number | null;
  onSelect: (index: number) => void;
}

const LETTERS = ["A", "B", "C", "D"];

export function QuestionCard({
  question,
  selectedIndex,
  answerState,
  correctIndex,
  onSelect,
}: Props) {
  const handleSelect = useCallback((index: number) => onSelect(index), [onSelect]);

  return (
    <View style={{ gap: 24 }}>
      <Text
        style={{
          fontSize: 15,
          lineHeight: 24,
          fontWeight: "500",
          color: colors.text,
        }}
      >
        {question.body}
      </Text>

      <View style={{ gap: 12 }}>
        {question.options.map((optionText, index) => {
          const state = computeOptionState({
            index,
            selectedIndex,
            answerState,
            correctIndex,
          });
          const isDisabled = answerState !== "idle";

          return (
            <OptionButton
              key={index}
              letter={LETTERS[index] ?? String(index + 1)}
              text={optionText}
              state={state}
              onPress={() => handleSelect(index)}
              disabled={isDisabled}
            />
          );
        })}
      </View>
    </View>
  );
}

function computeOptionState({
  index,
  selectedIndex,
  answerState,
  correctIndex,
}: {
  index: number;
  selectedIndex: number | null;
  answerState: "idle" | "correct" | "wrong";
  correctIndex: number | null;
}): OptionButtonState {
  if (answerState !== "idle") {
    if (correctIndex === index) return "correct";
    if (selectedIndex === index && answerState === "wrong") return "wrong";
    return "idle";
  }
  if (selectedIndex === index) return "selected";
  return "idle";
}
