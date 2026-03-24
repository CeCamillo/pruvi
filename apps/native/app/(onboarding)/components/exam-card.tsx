import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

function CheckSelected() {
  return (
    <View style={styles.checkShadow}>
      <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
        <Rect width={28} height={28} rx={12} fill="#84CC16" />
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M20.667 14c0 3.682-2.985 6.667-6.667 6.667S7.333 17.682 7.333 14 10.318 7.333 14 7.333 20.667 10.318 20.667 14zm-3.98-2.02a.5.5 0 010 .707l-3.334 3.333a.5.5 0 01-.706 0l-1.334-1.333a.5.5 0 01.707-.707l.98.98 1.49-1.49 1.49-1.49a.5.5 0 01.707 0z"
          fill="white"
        />
      </Svg>
    </View>
  );
}

function CheckUnselected() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Rect width={28} height={28} rx={12} fill="#F0F0F0" fillOpacity={0.2} />
      <Rect x={0.5} y={0.5} width={27} height={27} rx={11.5} stroke="#EFECEC" strokeOpacity={0.4} />
    </Svg>
  );
}

type Props = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
};

export function ExamCard({ icon, title, subtitle, selected, onPress }: Props) {
  return (
    <Pressable
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
        {icon}
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.checkContainer}>
        {selected ? <CheckSelected /> : <CheckUnselected />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    height: 91,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 22,
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cardSelected: {
    borderColor: "#84CC16",
    shadowColor: "rgba(220, 252, 231, 1)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(240, 240, 240, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainerSelected: {
    backgroundColor: "rgba(132, 204, 22, 0.1)",
  },
  textContainer: {
    flex: 1,
    marginLeft: 16,
  },
  title: {
    fontWeight: "900",
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.375,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },
  subtitle: {
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "rgba(107, 107, 107, 0.6)",
    marginTop: 2,
  },
  checkContainer: {
    marginLeft: 8,
  },
  checkShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
});
