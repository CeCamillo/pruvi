import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path } from "react-native-svg";

// ─── Icons (pixel-perfect from Figma SVGs) ──────────────────────────────────

function EditIcon({ color = "#6B6B6B" }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.667 1.333c.762.763.762 2 0 2.762l-.352.352a3.8 3.8 0 01-.73-.655 4.4 4.4 0 01-.88-1.396 3.8 3.8 0 01-.107-.378l.352-.352a1.951 1.951 0 012.717-.333z"
        fill={color}
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.974 8.788a6 6 0 01-.588.553 5.6 5.6 0 01-.602.372c-.18.086-.373.15-.757.278l-2.028.676a.5.5 0 01-.54-.127.5.5 0 01-.127-.54l.676-2.027c.128-.385.192-.577.278-.758a5 5 0 01.372-.602 6 6 0 01.553-.588L10.7 2.538a4.4 4.4 0 001.088 1.674 4.4 4.4 0 001.674 1.088L9.974 8.788z"
        fill={color}
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.691 13.691c.976-.977.976-2.548.976-5.691 0-1.032 0-1.895-.035-2.623l-4.241 4.241c-.234.235-.41.41-.608.565a5.3 5.3 0 01-.75.363c-.227.108-.566.187-.88.279l-5.456 1.782a1.5 1.5 0 01-1.64-.355 1.5 1.5 0 01-.361-1.637l1.82-5.399c.293-.879.371-1.116.463-1.33.153-.365.357-.704.604-.952.15-.157.34-.332.576-.567L7.976 1.368C7.248 1.333 6.385 1.333 5.333 1.333c-3.143 0-4.714 0-5.69.977C.666 3.287.666 4.857.666 8c0 3.143 0 4.714.976 5.69.977.977 2.548.977 5.691.977 3.143 0 4.714 0 5.69-.976h.668z"
        fill={color}
      />
    </Svg>
  );
}

function DropdownIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M5.33 5.33l2.67 3.07 2.67-3.07"
        fill="#58CD04"
      />
    </Svg>
  );
}

function FireIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 1.33c-.17.7-.56 1.93-1.33 2.77C5.7 5.17 4.67 5.87 4.67 7.83c0 2.2 1.5 3.84 3.33 3.84s3.33-1.64 3.33-3.84c0-2.33-1.55-4.1-3.33-6.5z"
        fill="#FF9600"
      />
    </Svg>
  );
}

function StarIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 1.5l1.76 3.57 3.94.57-2.85 2.78.67 3.93L8 10.52l-3.52 1.83.67-3.93L2.3 5.64l3.94-.57L8 1.5z"
        fill="#58CD04"
      />
    </Svg>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

type TrailHeaderProps = {
  toggleOn?: boolean;
  children?: ReactNode;
};

// ─── Component ───────────────────────────────────────────────────────────────

export function TrailHeader({ toggleOn = false, children }: TrailHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        {/* Left: Trilha Ativa + ENEM 2024 */}
        <View style={styles.trailInfoBox}>
          <View style={styles.trailInfoInner}>
            <Text style={styles.trilhaAtivaText}>Trilha Ativa</Text>
            <View style={styles.enemRow}>
              <Text style={styles.enemText}>ENEM 2024</Text>
              <DropdownIcon />
            </View>
          </View>
        </View>

        {/* Right: Toggle + Fire + Leaf badges */}
        <View style={styles.badgesRow}>
          {/* Edit toggle */}
          <View
            style={[
              styles.toggleBadge,
              toggleOn ? styles.toggleBadgeOn : styles.toggleBadgeOff,
            ]}
          >
            <View
              style={[
                styles.editIconBox,
                toggleOn ? styles.editIconBoxOn : styles.editIconBoxOff,
              ]}
            >
              <EditIcon color={toggleOn ? "#58CD04" : "#6B6B6B"} />
            </View>
            <View
              style={[
                styles.toggleTrack,
                toggleOn ? styles.toggleTrackOn : styles.toggleTrackOff,
              ]}
            >
              <View
                style={[
                  styles.toggleThumb,
                  toggleOn ? styles.toggleThumbOn : styles.toggleThumbOff,
                ]}
              />
            </View>
          </View>

          {/* Fire badge */}
          <View style={styles.fireBadge}>
            <FireIcon />
            <Text style={styles.fireText}>12</Text>
          </View>

          {/* Leaf/Star badge */}
          <View style={styles.leafBadge}>
            <StarIcon />
            <Text style={styles.leafText}>2.4k</Text>
          </View>
        </View>
      </View>

      {/* Optional children below header row (e.g. "Todas as Matérias") */}
      {children}
    </View>
  );
}

// ─── Styles (pixel-perfect from Figma) ───────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(239, 236, 236, 0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },

  // ─── Header Row ───────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },

  // ─── Left: Trilha Ativa Box ───────────────────────────────────────────────
  // Figma: 145×56, fill rgba(240,240,240,0.4), borderRadius 16
  trailInfoBox: {
    width: 145,
    height: 56,
    backgroundColor: "rgba(240, 240, 240, 0.4)",
    borderRadius: 16,
    justifyContent: "center",
  },
  trailInfoInner: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  // Figma: style_F9CJ65 — Schibsted Grotesk, 900, 10px, lineHeight 1em, letterSpacing 10%, UPPER
  trilhaAtivaText: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  enemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  // Figma: style_K4PSIZ — Geologica, 900, 16px, lineHeight 1.5em, letterSpacing -2.5%, UPPER
  enemText: {
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.4,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },

  // ─── Right: Badges Row ────────────────────────────────────────────────────
  // Figma: at x=148.14, y=11, w=234, h=34
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  // ─── Toggle Badge ─────────────────────────────────────────────────────────
  // Figma: 82×34, borderRadius 16
  toggleBadge: {
    flexDirection: "row",
    alignItems: "center",
    width: 82,
    height: 34,
    borderRadius: 16,
    paddingHorizontal: 5,
    gap: 5,
  },
  toggleBadgeOff: {
    backgroundColor: "rgba(240, 240, 240, 0.5)",
    borderWidth: 1,
    borderColor: "#EFECEC",
  },
  toggleBadgeOn: {
    backgroundColor: "rgba(88, 205, 4, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(88, 205, 4, 0.3)",
  },
  // Figma: Edit icon box — inside toggle at x=13, y=9, but visually it's a rounded square
  editIconBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  editIconBoxOff: {
    backgroundColor: "rgba(107, 107, 107, 0.15)",
  },
  editIconBoxOn: {
    backgroundColor: "rgba(88, 205, 4, 0.15)",
  },
  // Figma: Toggle track — 32×16, borderRadius pill
  toggleTrack: {
    width: 32,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleTrackOff: {
    backgroundColor: "rgba(107, 107, 107, 0.2)",
  },
  toggleTrackOn: {
    backgroundColor: "#58CD04",
  },
  toggleThumb: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleThumbOff: {
    alignSelf: "flex-start",
  },
  toggleThumbOn: {
    alignSelf: "flex-end",
  },

  // ─── Fire Badge ───────────────────────────────────────────────────────────
  // Figma: 61×34, fill rgba(255,150,0,0.1), border rgba(255,150,0,0.2) 1px, borderRadius 16
  fireBadge: {
    flexDirection: "row",
    alignItems: "center",
    height: 34,
    borderRadius: 16,
    paddingHorizontal: 13,
    gap: 6,
    backgroundColor: "rgba(255, 150, 0, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 150, 0, 0.2)",
  },
  // Figma: style_9ARCQ6 — Schibsted Grotesk, 900, 12px, lineHeight 1.33em
  fireText: {
    fontWeight: "900",
    fontSize: 12,
    lineHeight: 16,
    color: "#FF9600",
  },

  // ─── Leaf Badge ───────────────────────────────────────────────────────────
  // Figma: 76×34, fill rgba(88,205,4,0.1), border rgba(88,205,4,0.2) 1px, borderRadius 16
  leafBadge: {
    flexDirection: "row",
    alignItems: "center",
    height: 34,
    borderRadius: 16,
    paddingHorizontal: 13,
    gap: 6,
    backgroundColor: "rgba(88, 205, 4, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(88, 205, 4, 0.2)",
  },
  // Figma: style_9ARCQ6 — same as fire
  leafText: {
    fontWeight: "900",
    fontSize: 12,
    lineHeight: 16,
    color: "#58CD04",
  },
});
