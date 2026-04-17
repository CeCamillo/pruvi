import { useMemo } from "react";
import { Text, View } from "react-native";

import { WEEKDAYS_PT, buildMonthGrid, type MonthCell } from "@/lib/date-format";
import { colors, radii } from "@/lib/design-tokens";

interface Props {
  dates: string[];
  month: string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export function StudyCalendar({ dates, month }: Props) {
  const rows = useMemo(() => {
    const cells = buildMonthGrid(month, new Set(dates));
    return chunk(cells, 7);
  }, [month, dates]);

  return (
    <View
      style={{
        backgroundColor: colors.card,
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

      {rows.map((row, rowIdx) => (
        <View key={`r-${rowIdx}`} style={{ flexDirection: "row" }}>
          {row.map((cell, colIdx) => (
            <CalendarCell key={cell.dateStr ?? `blank-${rowIdx}-${colIdx}`} cell={cell} />
          ))}
        </View>
      ))}
    </View>
  );
}

function CalendarCell({ cell }: { cell: MonthCell }) {
  // Today+studied conflict: if we keep the ring in primary, it's invisible
  // on a primary-filled background. Ring the cell with onFill instead when
  // it's also studied — the white ring reads as "today" over the green fill.
  const ringColor = cell.isToday
    ? cell.studied
      ? colors.onFill
      : colors.primary
    : "transparent";

  const textColor = cell.studied
    ? colors.onFill
    : cell.isToday
      ? colors.primary
      : colors.text;

  return (
    <View
      style={{
        flex: 1,
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
          borderColor: ringColor,
        }}
      >
        {cell.inMonth && (
          <Text
            style={{
              fontSize: 12,
              fontWeight: cell.studied ? "900" : "700",
              color: textColor,
            }}
          >
            {cell.day}
          </Text>
        )}
      </View>
    </View>
  );
}
