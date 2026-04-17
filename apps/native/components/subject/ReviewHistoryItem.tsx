import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Text, View } from "react-native";

import type { ReviewItem } from "@pruvi/shared";

import { formatRelativeTime } from "@/lib/date-format";
import { colors, radii } from "@/lib/design-tokens";

interface Props {
  review: ReviewItem;
}

function ReviewHistoryItemImpl({ review }: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        padding: 16,
        backgroundColor: "#FFFFFF",
        borderRadius: radii.md,
        borderWidth: 2,
        borderColor: colors.border,
        marginBottom: 8,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: radii.sm,
          backgroundColor: review.correct ? colors.primary : colors.danger,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name={review.correct ? "checkmark" : "close"}
          size={16}
          color="#FFFFFF"
        />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          numberOfLines={2}
          style={{
            fontSize: 13,
            fontWeight: "500",
            lineHeight: 18,
            color: colors.text,
          }}
        >
          {review.body}
        </Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted }}>
          {formatRelativeTime(review.reviewedAt)}
        </Text>
      </View>
    </View>
  );
}

export const ReviewHistoryItem = memo(ReviewHistoryItemImpl);
