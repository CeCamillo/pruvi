import { memo, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { SubjectProgress } from "@pruvi/shared";

import { colors, radii } from "@/lib/design-tokens";

interface Props {
  subject: SubjectProgress;
  onPress: () => void;
}

function SubjectCardImpl({ subject, onPress }: Props) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(subject.accuracy, { duration: 600 });
  }, [subject.accuracy, width]);

  const barStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: radii.xl,
        borderWidth: 2,
        borderColor: colors.border,
        padding: 16,
        gap: 12,
        marginBottom: 12,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: "900",
            color: colors.text,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {subject.name}
        </Text>
        <Text style={{ fontSize: 16, fontWeight: "900", color: colors.primary }}>
          {subject.accuracy}%
        </Text>
      </View>

      <View
        style={{
          height: 8,
          backgroundColor: colors.surface,
          borderRadius: radii.sm,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={[
            {
              height: "100%",
              backgroundColor: colors.primary,
              borderRadius: radii.sm,
            },
            barStyle,
          ]}
        />
      </View>

      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted }}>
        {subject.correctCount}/{subject.totalQuestions} corretas
      </Text>
    </Pressable>
  );
}

export const SubjectCard = memo(SubjectCardImpl);
