import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Svg, { Path } from "react-native-svg";

function ArrowRightIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.835 11.43L9.205 5a.5.5 0 00-.205-.13c-.265-.08-.5.102-.5.5v12.86c0 .528.79.771 1.205.37l6.63-6.43A.47.47 0 0016 11.8a.47.47 0 00-.165-.37z"
        fill="white"
      />
    </Svg>
  );
}

type Props = {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  showArrow?: boolean;
};

export function PrimaryButton({ label, onPress, icon, showArrow = true }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      onPress={onPress}
    >
      {icon}
      <Text style={styles.label}>{label}</Text>
      {showArrow && <ArrowRightIcon />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 64,
    backgroundColor: "#84CC16",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "rgba(185, 248, 207, 1)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 8,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  label: {
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 27,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
});
