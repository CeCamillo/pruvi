import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

// ─── Types ──────────────────────────────────────────────────────────────────

export type TrailNode = {
  id: string;
  label: string;
  status: "completed" | "locked";
  size: number;
  icon: "play" | "star" | "lock" | "trophy";
  positionX: "left" | "center" | "right";
};

export type TrailUnit = {
  id: string;
  title: string;
  active: boolean;
  nodes: TrailNode[];
};

// ─── Icons ──────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 80 80" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M52.545 31.957a5.33 5.33 0 010 9.059L35.463 50.305c-2.75 1.497-6.13-.45-6.13-3.528V26.197c0-3.08 3.38-4.945 6.13-3.45l17.082 9.21z"
        fill="white"
      />
    </Svg>
  );
}

function StarIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 74 74" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M33.659 22.332c1.487-2.666 2.23-3.999 3.341-3.999 1.111 0 1.854 1.333 3.341 3.999l.385.69c.422.758.633 1.137.962 1.387.329.25.74.342 1.561.528l.746.169c2.887.654 4.329.98 4.673 2.084.343 1.103-.64 2.254-2.608 4.555l-.509.595c-.559.654-.839.98-.965 1.384-.125.404-.083.841 0 1.713l.077.794c.297 3.071.446 4.606-.453 5.287-.899.682-2.251.06-4.952-1.184l-.7-.322c-.768-.354-1.151-.531-1.558-.531-.407 0-.79.177-1.558.531l-.7.322c-2.703 1.244-4.054 1.866-4.953 1.185-.9-.683-.751-2.218-.454-5.289l.078-.793c.084-.872.127-1.308 0-1.712-.125-.405-.405-.731-.963-1.385l-.51-.594c-1.967-2.3-2.95-3.451-2.608-4.555.343-1.104 1.788-1.43 4.674-2.084l.746-.169c.82-.186 1.23-.278 1.56-.528.33-.25.54-.629.962-1.387l.385-.69z"
        fill="white"
      />
    </Svg>
  );
}

function LockIcon({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 70 70" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M27.125 29.731V27.333a7.875 7.875 0 0115.75 0v2.398c1.3.097 2.147.342 2.766.962C46.667 31.717 46.667 33.367 46.667 36.667c0 3.299 0 4.95-1.026 5.974-1.024 1.026-2.675 1.026-5.974 1.026H30.333c-3.299 0-4.95 0-5.974-1.026-1.026-1.024-1.026-2.675-1.026-5.974 0-3.3 0-4.95 1.026-5.975.618-.62 1.465-.865 2.766-.962zM28.875 27.333a6.125 6.125 0 0112.25 0v2.338c-.447-.004-.933-.005-1.458-.005h-9.334c-.526-.001-1.013 0-1.458.004v-2.337z"
        fill="#6B6B6B"
      />
    </Svg>
  );
}

function TrophyIcon() {
  return (
    <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M26.667 8.603V8.725c0 1.433 0 2.152-.345 2.738-.345.587-.974.935-2.228 1.634l-1.321.733c.91-3.08 1.215-6.39 1.327-9.22l.017-.368.003-.087c1.085.377 1.695.658 2.075 1.185.472.655.472 1.525.472 3.263z"
        fill="#6B6B6B"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.333 8.603V8.725c0 1.433 0 2.152.345 2.738.345.587.974.935 2.228 1.634l1.322.733c-.91-3.08-1.216-6.39-1.328-9.22l-.017-.368-.001-.087c-1.087.377-1.697.658-2.077 1.185-.472.655-.472 1.527-.472 3.263z"
        fill="#6B6B6B"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M19.956 -1.667c2.974 0 5.422.262 7.295.578 1.899.32 2.847.48 3.64 1.457.794.976.75 2.031.667 4.141-.287 7.249-1.85 16.3-10.352 17.1v5.891h2.384c.794 0 1.477.561 1.633 1.34l.317 1.577h4.416c.691 0 1.25.56 1.25 1.25s-.559 1.25-1.25 1.25H9.956c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25h4.417l.317-1.577c.155-.779.839-1.34 1.633-1.34h2.383v-5.89c-8.5-.8-10.063-9.854-10.35-17.1-.085-2.11-.126-3.167.667-4.142.792-.976 1.74-1.136 3.638-1.456 2.412-.395 4.852-.588 7.295-.578zm1.587 6.998l-.163-.293c-.634-1.138-.95-1.705-1.424-1.705-.473 0-.79.567-1.423 1.705l-.163.293c-.18.324-.27.484-.41.59-.142.107-.317.147-.667.226l-.317.073c-1.23.278-1.845.417-1.991.887-.147.47.273.962 1.111 1.942l.217.253c.238.279.358.417.412.59.053.174.035.359 0 .731l-.034.338c-.126 1.308-.19 1.963.192 2.253.383.29.96.025 2.112-.44l.296-.137c.329-.15.492-.225.665-.225s.337.075.665.225l.297.137c1.152.466 1.728.731 2.112.44.383-.29.318-.945.191-2.253l-.033-.338c-.035-.372-.053-.557 0-.73.053-.174.173-.312.412-.591l.216-.253c.839-.98 1.258-1.471 1.112-1.941-.147-.47-.762-.61-1.992-.887l-.316-.073c-.35-.08-.525-.12-.667-.226-.14-.107-.23-.267-.41-.591l-.18-.324z"
        fill="#6B6B6B"
      />
    </Svg>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function NodeIcon({ icon, size }: { icon: TrailNode["icon"]; size: number }) {
  switch (icon) {
    case "play":
      return <PlayIcon />;
    case "star":
      return <StarIcon />;
    case "trophy":
      return <TrophyIcon />;
    case "lock":
      return <LockIcon size={size * 0.55} />;
  }
}

function TrailNodeCircle({ node }: { node: TrailNode }) {
  const isCompleted = node.status === "completed";
  const isLarge = node.size === 80;

  const offsetX =
    node.positionX === "left" ? -60 :
    node.positionX === "right" ? 60 : 0;

  return (
    <View style={[styles.nodeWrapper, { marginLeft: offsetX }]}>
      {isLarge && isCompleted && (
        <>
          <View style={styles.outerRing} />
          <View style={styles.middleRing} />
        </>
      )}

      <Pressable
        style={[
          styles.nodeCircle,
          {
            width: node.size,
            height: node.size,
            borderRadius: node.size / 2,
          },
          isCompleted
            ? {
                backgroundColor: "#58CD04",
                shadowColor: "rgba(34, 197, 94, 0.3)",
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 1,
                shadowRadius: 24,
                elevation: 5,
              }
            : node.icon === "trophy"
            ? {
                backgroundColor: "rgba(240, 240, 240, 0.3)",
                borderWidth: 2,
                borderColor: "rgba(107, 107, 107, 0.3)",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 3,
                elevation: 2,
              }
            : {
                backgroundColor: "#FFFFFF",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 3,
                elevation: 2,
              },
        ]}
      >
        {isCompleted && (
          <View
            style={[
              styles.nodeBottomEdge,
              {
                width: node.size,
                height: isLarge ? 8 : 6,
                borderBottomLeftRadius: node.size / 2,
                borderBottomRightRadius: node.size / 2,
              },
            ]}
          />
        )}
        {!isCompleted && node.icon !== "trophy" && (
          <View
            style={[
              styles.nodeBottomEdgeLocked,
              {
                width: node.size,
                height: 6,
                borderBottomLeftRadius: node.size / 2,
                borderBottomRightRadius: node.size / 2,
              },
            ]}
          />
        )}
        <NodeIcon icon={node.icon} size={node.size} />
      </Pressable>

      {node.label ? (
        <View
          style={[
            styles.nodeLabelPill,
            !isCompleted && styles.nodeLabelPillLocked,
          ]}
        >
          <Text
            style={[
              styles.nodeLabelText,
              !isCompleted && styles.nodeLabelTextLocked,
            ]}
          >
            {node.label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function UnitBadge({ title, active }: { title: string; active: boolean }) {
  return (
    <View
      style={[
        styles.unitBadge,
        active ? styles.unitBadgeActive : styles.unitBadgeInactive,
      ]}
    >
      <Text
        style={[
          styles.unitBadgeText,
          active ? styles.unitBadgeTextActive : styles.unitBadgeTextInactive,
        ]}
      >
        {title}
      </Text>
    </View>
  );
}

// ─── Main TrailPath Component ───────────────────────────────────────────────

type TrailPathProps = {
  units: TrailUnit[];
};

export function TrailPath({ units }: TrailPathProps) {
  return (
    <View style={styles.trailContainer}>
      <View style={styles.centerLine} />

      {units.map((unit) => (
        <View key={unit.id} style={styles.unitSection}>
          <View style={styles.unitBadgeContainer}>
            <UnitBadge title={unit.title} active={unit.active} />
          </View>

          <View style={styles.nodesContainer}>
            {unit.nodes.map((node) => (
              <TrailNodeCircle key={node.id} node={node} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ─── Trail Path ───────────────────────────────────────────────────────────
  trailContainer: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 40,
  },
  centerLine: {
    position: "absolute",
    top: 40,
    bottom: 0,
    width: 6,
    backgroundColor: "rgba(240, 240, 240, 0.3)",
    alignSelf: "center",
    borderRadius: 3,
  },
  unitSection: {
    width: "100%",
    alignItems: "center",
    marginBottom: 40,
  },
  unitBadgeContainer: {
    alignItems: "center",
    marginBottom: 32,
    zIndex: 10,
  },
  unitBadge: {
    borderRadius: 20,
    paddingHorizontal: 26,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  unitBadgeActive: {
    backgroundColor: "rgba(88, 205, 4, 0.1)",
    borderWidth: 2,
    borderColor: "rgba(88, 205, 4, 0.2)",
  },
  unitBadgeInactive: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EFECEC",
  },
  unitBadgeText: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  unitBadgeTextActive: {
    color: "#58CD04",
  },
  unitBadgeTextInactive: {
    color: "#6B6B6B",
  },
  nodesContainer: {
    alignItems: "center",
    gap: 40,
  },

  // ─── Trail Nodes ──────────────────────────────────────────────────────────
  nodeWrapper: {
    alignItems: "center",
    gap: 8,
  },
  outerRing: {
    position: "absolute",
    width: 187,
    height: 187,
    borderRadius: 94,
    borderWidth: 6,
    borderColor: "rgba(88, 205, 4, 0.1)",
    top: -53,
    alignSelf: "center",
    zIndex: -1,
  },
  middleRing: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: "rgba(88, 205, 4, 0.2)",
    top: -8,
    alignSelf: "center",
    zIndex: -1,
  },
  nodeCircle: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  nodeBottomEdge: {
    position: "absolute",
    bottom: 0,
    backgroundColor: "rgba(88, 205, 4, 0.7)",
  },
  nodeBottomEdgeLocked: {
    position: "absolute",
    bottom: 0,
    backgroundColor: "rgba(239, 236, 236, 0.4)",
    borderTopWidth: 2,
    borderTopColor: "rgba(239, 236, 236, 0.4)",
  },
  nodeLabelPill: {
    backgroundColor: "#FFFFFF",
    borderRadius: 9999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#EFECEC",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  nodeLabelPillLocked: {
    backgroundColor: "#F0F0F0",
    borderColor: "rgba(239, 236, 236, 0.4)",
    shadowOpacity: 0,
    elevation: 0,
  },
  nodeLabelText: {
    fontWeight: "900",
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },
  nodeLabelTextLocked: {
    color: "rgba(107, 107, 107, 0.3)",
  },
});
