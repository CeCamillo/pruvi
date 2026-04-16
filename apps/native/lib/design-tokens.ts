export const colors = {
  primary: "#58CD04",
  primaryLight: "rgba(88, 205, 4, 0.08)",
  primaryGlow: "rgba(88, 205, 4, 0.3)",
  accent: "#FF9600",
  accentLight: "rgba(255, 150, 0, 0.1)",
  danger: "#EF4444",
  dangerLight: "rgba(239, 68, 68, 0.08)",
  warning: "#F59E0B",
  warningLight: "rgba(255, 150, 0, 0.06)",
  text: "#2B2B2B",
  textMuted: "#6B6B6B",
  surface: "#F0F0F0",
  border: "rgba(239, 236, 236, 0.5)",
  selectedBg: "rgba(59, 130, 246, 0.05)",
  selectedBorder: "#3B82F6",
} as const;

export const typography = {
  heading900: { fontWeight: "900" as const, letterSpacing: -0.6 },
  bodyBold700: { fontWeight: "700" as const },
  bodyRegular500: { fontWeight: "500" as const },
  uppercaseLabel: { fontWeight: "900" as const, letterSpacing: 1, textTransform: "uppercase" as const },
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;
