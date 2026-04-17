import { useMemo } from "react";
import { Text, View } from "react-native";

import { WEEKDAYS_PT, buildMonthGrid } from "@/lib/date-format";
import { colors, radii } from "@/lib/design-tokens";

interface Props {
  dates: string[];
  month: string;
}

export function StudyCalendar({ dates, month }: Props) {
  const cells = useMemo(
    () => buildMonthGrid(month, new Set(dates)),
    [month, dates],
  );

  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: radii.xl,
        borderWidth: 2,
        borderColor: colors.border,
        padding: 16,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row" }}>
        {WEEKDAYS_PT.map((d, i) => (
          <View key={`w-${i}`} style={{ flex: 1, alignItems: "center" }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "900",
                color: colors.textMuted,
                letterSpacing: 0.5,
              }}
            >
              {d}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((cell, i) => (
          <View
            key={`c-${i}`}
            style={{
              width: `${100 / 7}%`,
              aspectRatio: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 2,
            }}
          >
            <View
              style={{
                width: "80%",
                height: "80%",
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: cell.studied ? colors.primary : "transparent",
                borderWidth: cell.isToday ? 2 : 0,
                borderColor: cell.isToday ? colors.primary : "transparent",
              }}
            >
              {cell.inMonth && (
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: cell.studied ? "900" : "700",
                    color: cell.studied
                      ? "#FFFFFF"
                      : cell.isToday
                      ? colors.primary
                      : colors.text,
                  }}
                >
                  {cell.day}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
